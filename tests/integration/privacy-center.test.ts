import { randomInt, randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { dekContextFor, encryptJson, FileKeyProvider, newDataKey } from "@/lib/crypto";
import type { Mailer } from "@/lib/mail";
import { apply, openApplication } from "@/modules/applications/server/applications";
import { saveAlert } from "@/modules/notifications/server/saved-searches";
import { eraseAccount } from "@/modules/privacy/server/erasure";
import { exportMyData } from "@/modules/privacy/server/export";
import { saveWorkerProfile } from "@/modules/profiles/server/profile";
import { DATABASE_URL } from "./db";

// Test di accettazione WP-023 (centro privacy: esporta e cancella, ADR-0014) sul DB reale. NON modificarli.

const keys = FileKeyProvider.fromFiles(
  "tests/fixtures/test-kek.b64",
  "tests/fixtures/test-blind-index.b64",
);
const clock = new Date(Math.floor(Date.now() / 1000) * 1000);
let pool: Pool;
let occupationId: number;
const created = { users: [] as string[], companies: [] as string[] };
const mailer: Mailer = { async send() {} };
const deps = () => ({
  db: drizzle(pool),
  keys,
  mailer,
  now: () => clock,
  appUrl: "https://esempio.it",
});

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

async function company() {
  const tag = randomUUID().slice(0, 8);
  const owner = await user("company_member", `titolare.priv+${tag}@esempio.it`);
  const recruiter = await user("company_member", `sel.priv+${tag}@esempio.it`);
  const { rows } = await pool.query<{ id: string }>(
    `insert into companies (vat_number, legal_name, display_name, status, verified_at)
     values ($1, 'FINTA SRL', 'Bottega Privacy', 'verified', now()) returning id`,
    [`6${String(randomInt(0, 1e9)).padStart(10, "0")}`],
  );
  const companyId = rows[0]!.id;
  created.companies.push(companyId);
  await pool.query(
    `insert into company_members (company_id, user_id, role, created_at)
     values ($1, $2, 'owner', now() - interval '2 days'), ($1, $3, 'recruiter', now() - interval '1 day')`,
    [companyId, owner, recruiter],
  );
  const offer = await pool.query<{ id: string }>(
    `insert into job_offers (company_id, title, occupation_id, description_md, municipality_code, contract_type,
       schedule, status, salary_min, salary_period, published_at, valid_through)
     values ($1, 'Commesso/a', $2, 'Negozio.', '098031', 'permanent', 'full_time', 'published', 1400, 'month',
       now() - interval '1 day', now() + interval '20 days') returning id`,
    [companyId, occupationId],
  );
  return { companyId, owner, recruiter, offerId: offer.rows[0]!.id };
}

/** Lavoratrice completa: profilo cifrato, candidatura con messaggio, avviso. */
async function fullWorker(offerId: string) {
  const email = `privacy.finta+${randomUUID().slice(0, 8)}@esempio.it`;
  const id = await user("worker", email);
  await saveWorkerProfile({ db: drizzle(pool), keys, now: () => clock }, id, {
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
    pii: { firstName: "Elenafinta", lastName: "Privacyfinta", experiences: [], education: [] },
  });
  const applied = await apply(deps(), id, { offerId, message: "Disponibile da lunedì." });
  if (applied.status !== "applied") throw new Error(applied.status);
  await saveAlert(deps(), id, { params: "q=commesso", frequency: "weekly" });
  return { id, email, applicationId: applied.applicationId };
}

describe.skipIf(!DATABASE_URL)("centro privacy (WP-023)", () => {
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
       values ('test-privacy', 'commercio', 'Commesso di prova', '999')
       on conflict (slug) do update set label_it = excluded.label_it returning id`,
    );
    occupationId = occ.rows[0]!.id;
  });
  afterAll(async () => {
    await pool.query(`delete from companies where id = any($1::uuid[])`, [created.companies]);
    await pool.query(`delete from users where id = any($1::uuid[])`, [created.users]);
    await pool?.end();
  });

  it("esporta: tutti i miei dati in chiaro, chi li ha letti per categoria, niente dati di altri", async () => {
    const c = await company();
    const w = await fullWorker(c.offerId);
    await openApplication(deps(), c.recruiter, w.applicationId); // l'azienda legge i dati

    const data = await exportMyData(deps(), w.id);
    expect(data).toMatchObject({
      account: { email: w.email, ruolo: "worker" },
      profilo: {
        comune: "Lodi (LO)",
        mansioni: ["Commesso di prova"],
        datiIdentificativi: { firstName: "Elenafinta", lastName: "Privacyfinta" },
      },
      candidature: [
        expect.objectContaining({
          offerta: "Commesso/a",
          azienda: "Bottega Privacy",
          stato: "viewed",
          messaggio: "Disponibile da lunedì.",
        }),
      ],
      avvisi: [expect.objectContaining({ ricerca: "«commesso»", frequenza: "weekly" })],
    });
    const reads = (data!.lettureDeiTuoiDatiCifrati as { chi: string; scopo: string }[]).map(
      (r) => `${r.chi}|${r.scopo}`,
    );
    expect(reads).toContain("azienda a cui ti sei candidata/o|application.company-view");
    expect(reads).toContain("tu|privacy.export");
    // Nessun id o email di altre persone (i membri dell'azienda).
    const json = JSON.stringify(data);
    for (const other of [c.owner, c.recruiter]) expect(json).not.toContain(other);
    expect(json).not.toContain("titolare.priv");
  });

  it("cancella: chiave distrutta, dati collegati spariti, email libera; restano lapide, consensi e audit", async () => {
    const c = await company();
    const w = await fullWorker(c.offerId);
    await pool.query(
      `insert into consents (user_id, type, version, granted_at) values ($1, 'terms', 'bozza', now())`,
      [w.id],
    );
    await pool.query(
      `insert into auth_sessions (id, user_id, expires_at) values ($1, $2, now() + interval '1 day')`,
      [`sess-${randomUUID()}`, w.id],
    );
    expect(await eraseAccount(deps(), w.id, "self")).toEqual({ status: "deleted" });
    expect(await eraseAccount(deps(), w.id, "self")).toEqual({ status: "not_found" });

    const { rows } = await pool.query(
      `select status, deleted_at, dek_wrapped, email_bidx, email_enc from users where id = $1`,
      [w.id],
    );
    expect(rows[0]).toEqual({
      status: "deleted",
      deleted_at: clock,
      dek_wrapped: null,
      email_bidx: `deleted:${w.id}`,
      email_enc: "",
    });
    for (const [table, column] of [
      ["worker_profiles", "user_id"],
      ["profile_occupations", "user_id"],
      ["applications", "worker_user_id"],
      ["saved_searches", "user_id"],
      ["auth_sessions", "user_id"],
      ["email_action_tokens", "user_id"],
    ] as const) {
      const left = await pool.query(`select 1 from ${table} where ${column} = $1`, [w.id]);
      expect(left.rowCount, table).toBe(0);
    }
    const consents = await pool.query(`select type from consents where user_id = $1`, [w.id]);
    expect(consents.rowCount).toBeGreaterThan(0);
    const audit = await pool.query(
      `select actor_id, purpose from audit_log where action = 'account.delete' and target_id = $1`,
      [w.id],
    );
    expect(audit.rows).toEqual([{ actor_id: w.id, purpose: "self" }]);
    expect(await exportMyData(deps(), w.id)).toBeNull();

    // La stessa email si può registrare di nuovo (nuovo account, nuova chiave).
    await expect(user("worker", w.email)).resolves.toBeTruthy();
  });

  it("unico titolare con colleghi: la titolarità passa al collega più anziano", async () => {
    const c = await company();
    expect(await eraseAccount(deps(), c.owner, "self")).toEqual({ status: "deleted" });
    const { rows } = await pool.query(
      `select user_id, role from company_members where company_id = $1`,
      [c.companyId],
    );
    expect(rows).toEqual([{ user_id: c.recruiter, role: "owner" }]);
    const audit = await pool.query(
      `select actor_id from audit_log where action = 'company.owner_transfer' and target_id = $1`,
      [c.companyId],
    );
    expect(audit.rows).toEqual([{ actor_id: "system:erasure" }]);
  });
});
