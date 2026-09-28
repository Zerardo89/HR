import { randomInt, randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { dekContextFor, encryptJson, FileKeyProvider, newDataKey } from "@/lib/crypto";
import type { Mailer, MailMessage } from "@/lib/mail";
import { apply, decideApplication } from "@/modules/applications/server/applications";
import { decideSite } from "@/modules/companies/server/sites";
import { verifyCompanyManually } from "@/modules/companies/server/verification";
import {
  notifyApplicationUpdate,
  notifyCompanyVerified,
  notifyOfferOutcome,
  notifySiteOutcome,
  type OutcomeDeps,
} from "@/modules/notifications/server/outcomes";
import { decideOffer } from "@/modules/offers/server/moderation";
import { saveWorkerProfile } from "@/modules/profiles/server/profile";
import { DATABASE_URL } from "./db";

// Test di accettazione WP-020c (email di esito) sul DB reale. NON modificarli per farli passare.

const keys = FileKeyProvider.fromFiles(
  "tests/fixtures/test-kek.b64",
  "tests/fixtures/test-blind-index.b64",
);
const clock = new Date("2026-11-05T09:00:00Z");
let pool: Pool;
let occupationId: number;
let sent: MailMessage[] = [];
let failSmtp = false;
const created = { users: [] as string[], companies: [] as string[] };
const mailer: Mailer = {
  async send(m) {
    if (failSmtp) throw new Error("smtp giù");
    sent.push(m);
  },
};
const deps = (): OutcomeDeps => ({
  db: drizzle(pool),
  keys,
  mailer,
  now: () => clock,
  appUrl: "https://esempio.it",
});

async function user(role: "worker" | "company_member" | "moderator", email: string) {
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

/** Azienda con titolare, selezionatore e un ex membro (account sospeso). */
async function company(status: "verified" | "pending" = "verified") {
  const tag = randomUUID().slice(0, 8);
  const emails = {
    owner: `titolare.esito+${tag}@esempio.it`,
    recruiter: `selezione.esito+${tag}@esempio.it`,
    former: `ex.esito+${tag}@esempio.it`,
  };
  const owner = await user("company_member", emails.owner);
  const recruiter = await user("company_member", emails.recruiter);
  const former = await user("company_member", emails.former);
  await pool.query(`update users set status = 'suspended' where id = $1`, [former]);
  const { rows } = await pool.query<{ id: string }>(
    `insert into companies (vat_number, legal_name, display_name, status, verified_at)
     values ($1, 'FINTA SRL', 'Trattoria Finta', $2::company_status,
       case when $2::company_status = 'verified' then now() end) returning id`,
    [`9${String(randomInt(0, 1e9)).padStart(10, "0")}`, status],
  );
  const companyId = rows[0]!.id;
  created.companies.push(companyId);
  await pool.query(
    `insert into company_members (company_id, user_id, role)
     values ($1, $2, 'owner'), ($1, $3, 'recruiter'), ($1, $4, 'recruiter')`,
    [companyId, owner, recruiter, former],
  );
  return { companyId, owner, emails };
}

async function pendingOffer(companyId: string, title: string) {
  const { rows } = await pool.query<{ id: string }>(
    `insert into job_offers (company_id, title, occupation_id, description_md, municipality_code, contract_type,
       schedule, status, salary_min, salary_period, moderation)
     values ($1, $2, $3, 'Servizio.', '098031', 'permanent', 'full_time', 'pending_review', 1400, 'month',
       '{"validDays": 30}') returning id`,
    [companyId, title, occupationId],
  );
  return rows[0]!.id;
}

describe.skipIf(!DATABASE_URL)("email di esito (WP-020c)", () => {
  let moderator: string;

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
       values ('test-esiti', 'ristorazione', 'Mansione di prova esiti', '999')
       on conflict (slug) do update set label_it = excluded.label_it returning id`,
    );
    occupationId = occ.rows[0]!.id;
    moderator = await user("moderator", `moderatore.esito+${randomUUID()}@esempio.it`);
  });
  beforeEach(() => {
    sent = [];
    failSmtp = false;
  });
  afterAll(async () => {
    await pool.query(`delete from companies where id = any($1::uuid[])`, [created.companies]);
    await pool.query(`delete from users where id = any($1::uuid[])`, [created.users]);
    await pool?.end();
  });

  it("offerta approvata o rifiutata: ai membri attivi, con il motivo; lettura degli indirizzi registrata", async () => {
    const c = await company();
    const approved = await pendingOffer(c.companyId, "Pizzaiolo/a");
    const rejected = await pendingOffer(c.companyId, "Lavapiatti");
    const waiting = await pendingOffer(c.companyId, "Barista");

    expect(await notifyOfferOutcome(deps(), waiting)).toBe(0); // nessuna decisione: niente email
    await decideOffer(deps(), moderator, { decision: "approve", offerId: approved });
    expect(await notifyOfferOutcome(deps(), approved)).toBe(2);
    expect(sent.map((m) => m.to).sort()).toEqual([c.emails.owner, c.emails.recruiter].sort());
    expect(sent[0]!.subject).toBe("La tua offerta «Pizzaiolo/a» è pubblicata");

    sent = [];
    await decideOffer(deps(), moderator, {
      decision: "reject",
      offerId: rejected,
      reason: "salary",
      note: "Manca il massimo.",
    });
    expect(await notifyOfferOutcome(deps(), rejected)).toBe(2);
    expect(sent[0]!.text).toContain("Motivo: Lo stipendio manca o non è credibile.");
    expect(sent[0]!.text).toContain("Nota della moderazione: Manca il massimo.");
    expect(sent.map((m) => m.to)).not.toContain(c.emails.former);

    const audit = await pool.query(
      `select count(*)::int as n from audit_log
       where actor_id = 'system:notify' and purpose = 'notification.offer-outcome' and target_id = $1`,
      [c.owner],
    );
    expect(audit.rows[0]!.n).toBe(2);
  });

  it("sede: l'esito va solo ai titolari", async () => {
    const c = await company();
    const { rows } = await pool.query<{ id: string }>(
      `insert into company_sites (company_id, municipality_code, label) values ($1, '098031', 'Laboratorio')
       returning id`,
      [c.companyId],
    );
    await decideSite(deps(), moderator, {
      decision: "reject",
      siteId: rows[0]!.id,
      reason: "not_found",
    });
    expect(await notifySiteOutcome(deps(), rows[0]!.id)).toBe(1);
    expect(sent).toEqual([
      expect.objectContaining({
        to: c.emails.owner,
        subject: "Sede di Lodi (LO) non approvata",
      }),
    ]);
    expect(sent[0]!.text).toContain("l'attività non risulta in quel comune");
  });

  it("azienda verificata a mano: ai membri attivi; se non è verificata, niente", async () => {
    const c = await company("pending");
    expect(await notifyCompanyVerified(deps(), c.companyId)).toBe(0);
    await verifyCompanyManually(deps(), moderator, c.companyId);
    expect(await notifyCompanyVerified(deps(), c.companyId)).toBe(2);
    expect(sent[0]!.subject).toBe("Trattoria Finta è verificata");
  });

  it("candidatura: il lavoratore riceve solo gli esiti che contano, senza dati di altri", async () => {
    const c = await company();
    const offerId = await pendingOffer(c.companyId, "Cameriere/a");
    await decideOffer(deps(), moderator, { decision: "approve", offerId });
    const workerEmail = `candidato.esito+${randomUUID()}@esempio.it`;
    const worker = await user("worker", workerEmail);
    await saveWorkerProfile({ db: drizzle(pool), keys, now: () => clock }, worker, {
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
      pii: { firstName: "Brunofinto", lastName: "Esitofinto", experiences: [], education: [] },
    });
    const applied = await apply(deps(), worker, { offerId });
    if (applied.status !== "applied") throw new Error(applied.status);
    sent = [];

    await decideApplication(deps(), c.owner, applied.applicationId, "in_review");
    expect(await notifyApplicationUpdate(deps(), applied.applicationId)).toBe(0);
    await decideApplication(deps(), c.owner, applied.applicationId, "contacted");
    expect(await notifyApplicationUpdate(deps(), applied.applicationId)).toBe(1);
    expect(sent).toEqual([
      expect.objectContaining({
        to: workerEmail,
        subject: "Novità sulla tua candidatura per «Cameriere/a»",
      }),
    ]);
    expect(sent[0]!.text).toContain("Trattoria Finta ha letto la tua candidatura");
    for (const other of [c.emails.owner, c.emails.recruiter, "Brunofinto"]) {
      expect(sent[0]!.text).not.toContain(other);
    }
  });

  it("SMTP giù: nessun errore per chi ha deciso, la decisione resta", async () => {
    const c = await company("pending");
    await verifyCompanyManually(deps(), moderator, c.companyId);
    failSmtp = true;
    await expect(notifyCompanyVerified(deps(), c.companyId)).resolves.toBe(0);
    const { rows } = await pool.query(`select status from companies where id = $1`, [c.companyId]);
    expect(rows[0]!.status).toBe("verified");
  });
});
