import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { dekContextFor, encryptJson, FileKeyProvider, newDataKey } from "@/lib/crypto";
import type { Mailer, MailMessage } from "@/lib/mail";
import {
  apply,
  decideApplication,
  findMyApplication,
  listApplicationsForOffer,
  listMyApplications,
  openApplication,
  withdraw,
  type ApplicationDeps,
} from "@/modules/applications/server/applications";
import { saveWorkerProfile } from "@/modules/profiles/server/profile";
import { DATABASE_URL } from "./db";

// Test di accettazione WP-019 (candidature e casella dell'azienda) sul DB reale. NON modificarli.

const keys = FileKeyProvider.fromFiles(
  "tests/fixtures/test-kek.b64",
  "tests/fixtures/test-blind-index.b64",
);
let pool: Pool;
let occupationId: number;
let clock = new Date("2026-11-05T09:00:00Z");
let sent: MailMessage[] = [];
const created = { users: [] as string[], companies: [] as string[] };
const mailer: Mailer = {
  async send(m) {
    sent.push(m);
  },
};
const deps = (): ApplicationDeps => ({
  db: drizzle(pool),
  keys,
  mailer,
  now: () => clock,
  appUrl: "http://localhost:3000",
});

/** Utente con DEK ed email cifrata, come dopo la registrazione. */
async function user(role: "worker" | "company_member", email: string) {
  const id = randomUUID();
  const { dek, dekWrapped, keyVersion } = await newDataKey(keys, dekContextFor("users", id));
  const emailEnc = encryptJson(dek, email, { table: "users", column: "email_enc", rowId: id });
  dek.fill(0);
  await pool.query(
    `insert into users (id, role, email_bidx, email_enc, dek_wrapped, key_version, adult_declared_at)
     values ($1, $2, $3, $4, $5, $6, now())`,
    [id, role, await keys.blindIndex(email, "email"), emailEnc, dekWrapped, keyVersion],
  );
  created.users.push(id);
  return id;
}

async function setup() {
  const tag = randomUUID().slice(0, 8);
  const owner = await user("company_member", `titolare.finto+${tag}@esempio.it`);
  const recruiter = await user("company_member", `collega.finto+${tag}@esempio.it`);
  const company = await pool.query<{ id: string }>(
    `insert into companies (vat_number, legal_name, display_name, status, verified_at)
     values ($1, 'FINTA SRL', 'Osteria Finta', 'verified', now()) returning id`,
    [`7${String(Math.floor(Math.random() * 1e10)).padStart(10, "0")}`],
  );
  const companyId = company.rows[0]!.id;
  created.companies.push(companyId);
  await pool.query(
    `insert into company_members (company_id, user_id, role) values ($1, $2, 'owner'), ($1, $3, 'recruiter')`,
    [companyId, owner, recruiter],
  );
  const offer = await pool.query<{ id: string }>(
    `insert into job_offers (company_id, title, occupation_id, description_md, municipality_code, contract_type,
       schedule, status, salary_min, salary_period, published_at, valid_through)
     values ($1, 'Cameriere/a di sala', $2, 'Servizio ai tavoli.', '098031', 'permanent', 'full_time',
       'published', 1400, 'month', $3, $4) returning id`,
    [companyId, occupationId, new Date("2026-11-01T09:00:00Z"), new Date("2026-12-01T09:00:00Z")],
  );
  const workerEmail = `lavoratrice.finta+${tag}@esempio.it`;
  const worker = await user("worker", workerEmail);
  await saveWorkerProfile({ db: drizzle(pool), keys, now: () => clock }, worker, {
    occupationIds: [occupationId],
    place: "Lodi",
    radiusKm: 20,
    relocationRegionCodes: [],
    experienceBand: "y3_5",
    contractPrefs: [],
    schedulePrefs: [],
    drivingLicenses: ["B"],
    languages: [{ code: "it", level: "native" }],
    state: "seeking",
    monthlyCheckOptIn: false,
    pii: {
      firstName: "Annafinta",
      lastName: "Candidatafinta",
      phone: "+39 340 111 2222",
      experiences: [],
      education: [],
    },
  });
  return { owner, recruiter, companyId, offerId: offer.rows[0]!.id, worker, workerEmail, tag };
}

describe.skipIf(!DATABASE_URL)("candidature (WP-019)", () => {
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
       values ('test-candidature', 'ristorazione', 'Cameriere di prova', '999')
       on conflict (slug) do update set label_it = excluded.label_it returning id`,
    );
    occupationId = occ.rows[0]!.id;
  });
  beforeEach(() => {
    sent = [];
    clock = new Date("2026-11-05T09:00:00Z");
  });
  afterAll(async () => {
    await pool.query(`delete from companies where id = any($1::uuid[])`, [created.companies]);
    await pool.query(`delete from users where id = any($1::uuid[])`, [created.users]);
    await pool?.end();
  });

  it("candidatura: messaggio cifrato, email a tutti i membri dell'azienda SENZA dati del candidato", async () => {
    const s = await setup();
    const r = await apply(deps(), s.worker, {
      offerId: s.offerId,
      message: "Disponibile anche nel weekend, chiedete di Annafinta.",
    });
    expect(r.status).toBe("applied");
    if (r.status !== "applied") return;

    const { rows } = await pool.query(`select * from applications where id = $1`, [
      r.applicationId,
    ]);
    expect(rows[0].status).toBe("sent");
    expect(JSON.stringify(rows[0])).not.toContain("weekend");

    expect(sent.map((m) => m.to).sort()).toEqual(
      [`collega.finto+${s.tag}@esempio.it`, `titolare.finto+${s.tag}@esempio.it`].sort(),
    );
    const mail = sent[0]!;
    expect(mail.subject).toBe("Nuova candidatura per «Cameriere/a di sala»");
    expect(mail.text).toContain(`/azienda/candidature?offerta=${s.offerId}`);
    for (const secret of ["Annafinta", "Candidatafinta", "340 111", s.workerEmail, "weekend"]) {
      expect(`${mail.subject}\n${mail.text}`).not.toContain(secret);
    }
    const notifyAudit = await pool.query(
      `select count(*)::int as n from audit_log where actor_id = 'system:notify' and purpose = 'notification.new-application'
       and target_id = any($1::text[])`,
      [[s.owner, s.recruiter]],
    );
    expect(notifyAudit.rows[0].n).toBe(2);

    expect(await apply(deps(), s.worker, { offerId: s.offerId })).toEqual({
      status: "already_applied",
    });
    expect(await findMyApplication(drizzle(pool), s.worker, s.offerId)).toMatchObject({
      status: "sent",
    });
  });

  it("chi può candidarsi: solo lavoratori con profilo, solo offerte visibili", async () => {
    const s = await setup();
    const noProfile = await user("worker", `senza.profilo+${s.tag}@esempio.it`);
    expect(await apply(deps(), noProfile, { offerId: s.offerId })).toEqual({
      status: "no_profile",
    });
    expect(await apply(deps(), s.owner, { offerId: s.offerId })).toEqual({
      status: "not_allowed",
    });
    await pool.query(`update job_offers set status = 'closed' where id = $1`, [s.offerId]);
    expect(await apply(deps(), s.worker, { offerId: s.offerId })).toEqual({
      status: "offer_unavailable",
    });
  });

  it("doppio invio simultaneo: una sola candidatura, una sola email per membro", async () => {
    const s = await setup();
    const results = await Promise.all([
      apply(deps(), s.worker, { offerId: s.offerId }),
      apply(deps(), s.worker, { offerId: s.offerId }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(["already_applied", "applied"]);
    const rows = await pool.query(`select id from applications where offer_id = $1`, [s.offerId]);
    expect(rows.rowCount).toBe(1);
    const audit = await pool.query(
      `select 1 from audit_log where action = 'application.create' and target_id = $1`,
      [rows.rows[0]!.id],
    );
    expect(audit.rowCount).toBe(1);
    expect(sent).toHaveLength(2); // titolare e collega
  });

  it("l'azienda apre la candidatura: vede dati ed email del candidato (lettura registrata); diventa 'vista'", async () => {
    const s = await setup();
    const r = await apply(deps(), s.worker, {
      offerId: s.offerId,
      message: "Posso iniziare subito.",
    });
    if (r.status !== "applied") throw new Error(r.status);

    const inbox = await listApplicationsForOffer(deps(), s.recruiter, s.offerId);
    expect(inbox?.rows).toEqual([
      expect.objectContaining({ id: r.applicationId, status: "sent", provinceAbbr: "LO" }),
    ]);
    expect(JSON.stringify(inbox)).not.toContain("Annafinta");

    const opened = await openApplication(deps(), s.recruiter, r.applicationId);
    expect(opened).toMatchObject({
      offerTitle: "Cameriere/a di sala",
      profile: { place: "Lodi (LO)", experienceBand: "y3_5", occupations: ["Cameriere di prova"] },
      applicant: {
        email: s.workerEmail,
        message: "Posso iniziare subito.",
        pii: { firstName: "Annafinta", lastName: "Candidatafinta", phone: "+39 340 111 2222" },
      },
    });
    const audit = await pool.query(
      `select target_table, purpose from audit_log where actor_id = $1 and action = 'pii.decrypt' order by target_table`,
      [s.recruiter],
    );
    expect(audit.rows).toEqual([
      { target_table: "applications", purpose: "application.company-view" },
      { target_table: "users", purpose: "application.company-view" },
      { target_table: "worker_profiles", purpose: "application.company-view" },
    ]);
    const mine = await listMyApplications(drizzle(pool), s.worker);
    expect(mine[0]).toMatchObject({ status: "viewed", companyName: "Osteria Finta" });
    expect(mine[0]!.viewedAt).toEqual(clock);
  });

  it("nessun altro apre la candidatura: altra azienda, lavoratore, candidatura ritirata o scaduta", async () => {
    const s = await setup();
    const other = await setup(); // un'altra azienda con i suoi membri
    const r = await apply(deps(), s.worker, { offerId: s.offerId });
    if (r.status !== "applied") throw new Error(r.status);

    expect(await openApplication(deps(), other.owner, r.applicationId)).toBeNull();
    expect(await openApplication(deps(), s.worker, r.applicationId)).toBeNull();
    expect(await listApplicationsForOffer(deps(), other.owner, s.offerId)).toBeNull();

    await pool.query(`update applications set company_visible_until = $1 where id = $2`, [
      new Date("2026-11-01T00:00:00Z"),
      r.applicationId,
    ]);
    expect(await openApplication(deps(), s.owner, r.applicationId)).toBeNull();
    expect((await listApplicationsForOffer(deps(), s.owner, s.offerId))?.rows).toEqual([]);
    await pool.query(`update applications set company_visible_until = null where id = $1`, [
      r.applicationId,
    ]);

    expect(await withdraw(deps(), other.worker, r.applicationId)).toEqual({ status: "not_found" });
    expect(await withdraw(deps(), s.worker, r.applicationId)).toEqual({ status: "withdrawn" });
    expect(await openApplication(deps(), s.owner, r.applicationId)).toBeNull();
    expect(await findMyApplication(drizzle(pool), s.worker, s.offerId)).toBeNull();
    // Dopo il ritiro ci si può ricandidare.
    expect((await apply(deps(), s.worker, { offerId: s.offerId })).status).toBe("applied");
  });

  it("decisioni dell'azienda e chiave distrutta del candidato", async () => {
    const s = await setup();
    const r = await apply(deps(), s.worker, { offerId: s.offerId });
    if (r.status !== "applied") throw new Error(r.status);
    expect(await decideApplication(deps(), s.owner, r.applicationId, "in_review")).toEqual({
      status: "updated",
    });
    expect(await decideApplication(deps(), s.owner, r.applicationId, "in_review")).toEqual({
      status: "not_allowed",
    });
    expect(await decideApplication(deps(), s.owner, r.applicationId, "rejected")).toEqual({
      status: "updated",
    });
    expect(await decideApplication(deps(), s.owner, r.applicationId, "hired")).toEqual({
      status: "not_allowed",
    });
    expect(await withdraw(deps(), s.worker, r.applicationId)).toEqual({ status: "not_allowed" });
    const stranger = await user("company_member", `estraneo.finto+${s.tag}@esempio.it`);
    expect(await decideApplication(deps(), stranger, r.applicationId, "contacted")).toEqual({
      status: "not_found",
    });

    await pool.query(`update users set dek_wrapped = null where id = $1`, [s.worker]);
    const opened = await openApplication(deps(), s.owner, r.applicationId);
    expect(opened?.applicant).toEqual({ pii: null, email: null, message: null });
  });
});
