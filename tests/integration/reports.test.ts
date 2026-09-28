import { randomInt, randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { dekContextFor, encryptJson, FileKeyProvider, newDataKey } from "@/lib/crypto";
import type { Mailer, MailMessage } from "@/lib/mail";
import { apply, listApplicationsForOffer } from "@/modules/applications/server/applications";
import { sendPositionClosedEmails } from "@/modules/notifications/server/lifecycle-emails";
import { readApplicantForCompany } from "@/modules/privacy/server/application-pii";
import { saveWorkerProfile } from "@/modules/profiles/server/profile";
import { decideReports, listOpenReports, submitReport } from "@/modules/trust/server/reports";
import { DATABASE_URL } from "./db";

// Test di accettazione WP-024a (DSA art. 16-17, R-DSA-03/04) sul DB reale. NON modificarli per farli passare.

const keys = FileKeyProvider.fromFiles(
  "tests/fixtures/test-kek.b64",
  "tests/fixtures/test-blind-index.b64",
);
const clock = new Date(Math.floor(Date.now() / 1000) * 1000);
let pool: Pool;
let occupationId: number;
let moderator: string;
let sent: MailMessage[] = [];
const created = { users: [] as string[], companies: [] as string[] };
const mailer: Mailer = {
  async send(m) {
    sent.push(m);
  },
};
const deps = () => ({
  db: drizzle(pool),
  keys,
  mailer,
  now: () => clock,
  appUrl: "https://esempio.it",
});
const FACTS = "L'annuncio chiede 150 euro per un corso obbligatorio prima del colloquio.";

async function user(role: "worker" | "company_member" | "moderator", prefix: string) {
  const id = randomUUID();
  const email = `${prefix}.finta+${id.slice(0, 8)}@esempio.it`;
  const { dek, dekWrapped, keyVersion } = await newDataKey(keys, dekContextFor("users", id));
  const emailEnc = encryptJson(dek, email, { table: "users", column: "email_enc", rowId: id });
  dek.fill(0);
  await pool.query(
    `insert into users (id, role, email_bidx, email_enc, dek_wrapped, key_version, adult_declared_at)
     values ($1, $2, $3, $4, $5, $6, now())`,
    [id, role, await keys.blindIndex(email, "email"), emailEnc, dekWrapped, keyVersion],
  );
  created.users.push(id);
  return { id, email };
}

async function company() {
  const owner = await user("company_member", "titolare.segn");
  const recruiter = await user("company_member", "selezione.segn");
  const { rows } = await pool.query<{ id: string }>(
    `insert into companies (vat_number, legal_name, display_name, status, verified_at)
     values ($1, 'FINTA SRL', 'Logistica Finta', 'verified', now()) returning id`,
    [`7${String(randomInt(0, 1e9)).padStart(10, "0")}`],
  );
  const companyId = rows[0]!.id;
  created.companies.push(companyId);
  await pool.query(
    `insert into company_members (company_id, user_id, role) values ($1, $2, 'owner'), ($1, $3, 'recruiter')`,
    [companyId, owner.id, recruiter.id],
  );
  const offerId = await offer(companyId, "published");
  return { companyId, owner, recruiter, offerId };
}

async function offer(companyId: string, status: "published" | "draft") {
  const { rows } = await pool.query<{ id: string }>(
    `insert into job_offers (company_id, title, occupation_id, description_md, municipality_code, contract_type,
       schedule, status, salary_min, salary_period, published_at, valid_through)
     values ($1, 'Magazziniere/a', $2, 'Magazzino.', '098031', 'permanent', 'full_time', $3, 1400, 'month',
       now() - interval '1 day', now() + interval '20 days') returning id`,
    [companyId, occupationId, status],
  );
  return rows[0]!.id;
}

async function applicant(offerId: string) {
  const w = await user("worker", "candidata.segn");
  await saveWorkerProfile({ db: drizzle(pool), keys, now: () => clock }, w.id, {
    occupationIds: [occupationId],
    place: "Lodi",
    radiusKm: 20,
    relocationRegionCodes: [],
    experienceBand: "y1_3",
    contractPrefs: [],
    schedulePrefs: [],
    drivingLicenses: [],
    languages: [],
    state: "seeking",
    monthlyCheckOptIn: false,
    pii: { firstName: "Ginafinta", lastName: "Segnalafinta", experiences: [], education: [] },
  });
  const applied = await apply(deps(), w.id, { offerId, message: "Disponibile." });
  if (applied.status !== "applied") throw new Error(applied.status);
  return { ...w, applicationId: applied.applicationId };
}

const report = (reporter: string | null, offerId: string, targetType: "offer" | "company") =>
  submitReport(deps(), reporter, {
    offerId,
    targetType,
    reason: "payment_requested",
    details: "Chiedono soldi per il corso.",
    goodFaith: "on",
  });

const reportRows = async (targetId: string) =>
  (
    await pool.query(
      `select status, decision, statement_of_reasons, reporter_user_id from reports
       where target_id = $1 order by created_at`,
      [targetId],
    )
  ).rows;

describe.skipIf(!DATABASE_URL)("segnalazioni e decisioni motivate (WP-024a)", () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 3 });
    await pool.query(
      `insert into regions (code, name) values ('03','Lombardia') on conflict do nothing`,
    );
    await pool.query(
      `insert into provinces (code, name, abbreviation, region_code) values ('098','Lodi','LO','03') on conflict do nothing`,
    );
    await pool.query(
      `insert into municipalities (istat_code, name, province_code, region_code, lat, lon)
       values ('098031','Lodi','098','03',45.3097,9.5037) on conflict do nothing`,
    );
    const occ = await pool.query<{ id: number }>(
      `insert into occupations (slug, category, label_it, group_code)
       values ('test-segnalazioni', 'logistica', 'Magazziniere di prova', '998')
       on conflict (slug) do update set label_it = excluded.label_it returning id`,
    );
    occupationId = occ.rows[0]!.id;
    moderator = (await user("moderator", "moderatore.segn")).id;
  });
  beforeEach(() => {
    sent = [];
  });
  afterAll(async () => {
    await pool.query(`delete from reports where target_id = any($1::uuid[])`, [created.companies]);
    await pool.query(
      `delete from reports where target_id in (select id from job_offers where company_id = any($1::uuid[]))`,
      [created.companies],
    );
    await pool.query(`delete from companies where id = any($1::uuid[])`, [created.companies]);
    await pool.query(`delete from users where id = any($1::uuid[])`, [created.users]);
    await pool?.end();
  });

  it("segnalare: anche senza account, solo ciò che è pubblico; con l'account ricevuta e niente doppioni", async () => {
    const c = await company();
    const reporter = await user("worker", "segnalante");
    expect(await report(null, c.offerId, "offer")).toEqual({ status: "received" });
    expect(sent).toHaveLength(0); // anonima: nessuna email
    expect(await report(reporter.id, c.offerId, "company")).toEqual({ status: "received" });
    expect(await report(reporter.id, c.offerId, "company")).toEqual({ status: "received" });
    expect(sent.map((m) => [m.to, m.subject])).toEqual([
      [reporter.email, "Abbiamo ricevuto la tua segnalazione"],
    ]);
    expect(await reportRows(c.offerId)).toEqual([
      expect.objectContaining({ status: "open", reporter_user_id: null }),
    ]);
    expect(await reportRows(c.companyId)).toHaveLength(1); // il doppione non conta

    const draft = await offer(c.companyId, "draft");
    expect(await report(null, draft, "offer")).toEqual({ status: "not_found" });
    expect(await report(null, randomUUID(), "offer")).toEqual({ status: "not_found" });

    const queue = await listOpenReports(drizzle(pool));
    expect(queue.find((g) => g.targetId === c.offerId)).toMatchObject({
      targetType: "offer",
      title: "Magazziniere/a",
      company: "Logistica Finta",
      count: 1,
      reasons: [{ reason: "payment_requested", count: 1 }],
      details: ["Chiedono soldi per il corso."],
    });
    // Nella coda nessun dato di chi ha segnalato.
    expect(JSON.stringify(queue)).not.toContain(reporter.id);
  });

  it("togliere l'annuncio: offerta tolta, candidature chiuse, motivazione all'azienda, esito a chi ha segnalato", async () => {
    const c = await company();
    const w = await applicant(c.offerId);
    const reporter = await user("worker", "segnalante");
    await report(null, c.offerId, "offer");
    await report(reporter.id, c.offerId, "offer");
    sent = [];

    expect(
      await decideReports(deps(), moderator, {
        targetType: "offer",
        targetId: c.offerId,
        decision: "act",
        ground: "payment_request",
        facts: FACTS,
      }),
    ).toEqual({ status: "removed" });

    const offerRow = await pool.query(`select status from job_offers where id = $1`, [c.offerId]);
    expect(offerRow.rows[0]!.status).toBe("removed");
    const app = await pool.query(`select status from applications where id = $1`, [
      w.applicationId,
    ]);
    expect(app.rows[0]!.status).toBe("closed");
    const rows = await reportRows(c.offerId);
    expect(rows).toHaveLength(2);
    for (const r of rows) {
      expect(r).toMatchObject({ status: "actioned", decision: "remove_offer:payment_request" });
      expect(r.statement_of_reasons).toContain(FACTS);
    }
    const audit = await pool.query(
      `select actor_id, purpose from audit_log where action = 'report.decide' and target_id = $1`,
      [c.offerId],
    );
    expect(audit.rows).toEqual([{ actor_id: moderator, purpose: "remove_offer:payment_request" }]);

    const toCompany = sent.filter((m) => [c.owner.email, c.recruiter.email].includes(m.to));
    expect(toCompany).toHaveLength(2);
    for (const m of toCompany) {
      expect(m.subject).toBe("Abbiamo tolto la tua offerta «Magazziniere/a»");
      expect(m.text).toContain(FACTS);
      expect(m.text).toContain("riesame entro 6 mesi");
      expect(m.text).not.toContain(reporter.email); // chi segnala resta anonimo
    }
    const toReporter = sent.filter((m) => m.to === reporter.email);
    expect(toReporter).toHaveLength(1);
    expect(toReporter[0]!.subject).toBe("Esito della tua segnalazione");
    expect(toReporter[0]!.text).not.toContain(FACTS);

    // Una seconda decisione non trova nulla da decidere.
    expect(
      await decideReports(deps(), moderator, {
        targetType: "offer",
        targetId: c.offerId,
        decision: "dismiss",
      }),
    ).toEqual({ status: "not_found" });

    // Il candidato riceve l'avviso con la messa in guardia.
    sent = [];
    await sendPositionClosedEmails(deps());
    const warning = sent.find((m) => m.to === w.email)!;
    expect(warning.text).toContain("non rispettava le regole");
    expect(warning.text).toContain("non darli");
  });

  it("archiviare: nulla cambia per l'azienda, chi ha segnalato riceve l'esito", async () => {
    const c = await company();
    const reporter = await user("worker", "segnalante");
    await report(reporter.id, c.offerId, "offer");
    sent = [];
    expect(
      await decideReports(deps(), moderator, {
        targetType: "offer",
        targetId: c.offerId,
        decision: "dismiss",
      }),
    ).toEqual({ status: "dismissed" });
    const offerRow = await pool.query(`select status from job_offers where id = $1`, [c.offerId]);
    expect(offerRow.rows[0]!.status).toBe("published");
    expect(await reportRows(c.offerId)).toEqual([
      expect.objectContaining({
        status: "dismissed",
        decision: "dismiss",
        statement_of_reasons: null,
      }),
    ]);
    expect(sent.map((m) => m.to)).toEqual([reporter.email]);
    expect(sent[0]!.text).toContain("non abbiamo trovato violazioni");
  });

  it("sospendere l'azienda: offerte tolte, dati dei candidati non più leggibili", async () => {
    const c = await company();
    const w = await applicant(c.offerId);
    expect(await readApplicantForCompany(deps(), c.owner.id, w.applicationId)).not.toBeNull();
    await report(null, c.offerId, "company");
    sent = [];
    expect(
      await decideReports(deps(), moderator, {
        targetType: "company",
        targetId: c.companyId,
        decision: "act",
        ground: "scam",
        facts: "Più segnalazioni: dopo la candidatura chiedono i dati della carta di credito.",
      }),
    ).toEqual({ status: "suspended" });

    const companyRow = await pool.query(`select status from companies where id = $1`, [
      c.companyId,
    ]);
    expect(companyRow.rows[0]!.status).toBe("suspended");
    const offerRow = await pool.query(`select status from job_offers where id = $1`, [c.offerId]);
    expect(offerRow.rows[0]!.status).toBe("removed");
    expect(await readApplicantForCompany(deps(), c.owner.id, w.applicationId)).toBeNull();
    expect(await listApplicationsForOffer(deps(), c.owner.id, c.offerId)).toBeNull();
    const toOwner = sent.find((m) => m.to === c.owner.email)!;
    expect(toOwner.subject).toBe("Abbiamo sospeso l'account di Logistica Finta");
    expect(toOwner.text).toContain("le candidature ricevute non sono più consultabili");
  });

  it("solo moderatori e amministratori decidono", async () => {
    const c = await company();
    await report(null, c.offerId, "offer");
    expect(
      await decideReports(deps(), c.owner.id, {
        targetType: "offer",
        targetId: c.offerId,
        decision: "act",
        ground: "scam",
        facts: FACTS,
      }),
    ).toEqual({ status: "not_allowed" });
    expect(await reportRows(c.offerId)).toEqual([expect.objectContaining({ status: "open" })]);
    const offerRow = await pool.query(`select status from job_offers where id = $1`, [c.offerId]);
    expect(offerRow.rows[0]!.status).toBe("published");
  });
});
