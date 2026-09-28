import { randomInt, randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { dekContextFor, encryptJson, FileKeyProvider, newDataKey } from "@/lib/crypto";
import type { Mailer, MailMessage } from "@/lib/mail";
import { purgeExpiredApplicationMessages } from "@/modules/applications/server/closure";
import {
  sendExpiryNotices,
  sendPositionClosedEmails,
} from "@/modules/notifications/server/lifecycle-emails";
import type { OutcomeDeps } from "@/modules/notifications/server/outcomes";
import { closeOffer, expireDueOffers, renewOffer } from "@/modules/offers/server/lifecycle";
import { DATABASE_URL } from "./db";

// Test di accettazione WP-022 (R-ANN-07, R-PRIV-03) sul DB reale. NON modificarli per farli passare.

const keys = FileKeyProvider.fromFiles(
  "tests/fixtures/test-kek.b64",
  "tests/fixtures/test-blind-index.b64",
);
const DAY = 24 * 60 * 60_000;
// Vicino all'ora vera: il job di scadenza non deve toccare offerte "future" di altri test.
const clock = new Date(Math.floor(Date.now() / 1000) * 1000);
const at = (days: number) => new Date(clock.getTime() + days * DAY);
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
  const emails = {
    owner: `titolare.ciclo+${tag}@esempio.it`,
    recruiter: `sel.ciclo+${tag}@esempio.it`,
  };
  const owner = await user("company_member", emails.owner);
  const recruiter = await user("company_member", emails.recruiter);
  const { rows } = await pool.query<{ id: string }>(
    `insert into companies (vat_number, legal_name, display_name, status, verified_at)
     values ($1, 'FINTA SRL', 'Locanda Finta', 'verified', now()) returning id`,
    [`4${String(randomInt(0, 1e9)).padStart(10, "0")}`],
  );
  const companyId = rows[0]!.id;
  created.companies.push(companyId);
  await pool.query(
    `insert into company_members (company_id, user_id, role) values ($1, $2, 'owner'), ($1, $3, 'recruiter')`,
    [companyId, owner, recruiter],
  );
  return { companyId, owner, recruiter, emails };
}

/** Offerta pubblicata con una certa scadenza (pubblicata 30 giorni prima della scadenza). */
async function offer(companyId: string, validThrough: Date, title = "Cuoco/a di linea") {
  const { rows } = await pool.query<{ id: string }>(
    `insert into job_offers (company_id, title, occupation_id, description_md, municipality_code, contract_type,
       schedule, status, salary_min, salary_period, published_at, valid_through)
     values ($1, $2, $3, 'Cucina.', '098031', 'permanent', 'full_time', 'published', 1600, 'month', $4, $5)
     returning id`,
    [companyId, title, occupationId, new Date(validThrough.getTime() - 30 * DAY), validThrough],
  );
  return rows[0]!.id;
}

async function application(offerId: string, status: string, email: string) {
  const worker = await user("worker", email);
  const { rows } = await pool.query<{ id: string }>(
    `insert into applications (offer_id, worker_user_id, status, message_enc) values ($1, $2, $3, 'v1.finto')
     returning id`,
    [offerId, worker, status],
  );
  return rows[0]!.id;
}

async function appRow(id: string) {
  const { rows } = await pool.query<{
    status: string;
    closed_at: Date | null;
    company_visible_until: Date | null;
  }>(`select status, closed_at, company_visible_until from applications where id = $1`, [id]);
  return rows[0]!;
}

const sixMonthsLater = () => {
  const d = new Date(clock);
  d.setUTCMonth(d.getUTCMonth() + 6);
  return d;
};

describe.skipIf(!DATABASE_URL)("ciclo di vita dell'offerta (WP-022)", () => {
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
       values ('test-ciclo', 'ristorazione', 'Mansione di prova ciclo', '999')
       on conflict (slug) do update set label_it = excluded.label_it returning id`,
    );
    occupationId = occ.rows[0]!.id;
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

  it("chiusura: solo i membri; candidature aperte chiuse, decise intatte, tutte visibili 6 mesi", async () => {
    const c = await company();
    const stranger = await company();
    const offerId = await offer(c.companyId, at(20));
    const tag = randomUUID().slice(0, 8);
    const open = await application(offerId, "sent", `aperta+${tag}@esempio.it`);
    const contacted = await application(offerId, "contacted", `contattata+${tag}@esempio.it`);
    const rejected = await application(offerId, "rejected", `scartata+${tag}@esempio.it`);

    expect(await closeOffer(deps(), stranger.owner, offerId)).toEqual({ status: "not_found" });
    expect(await closeOffer(deps(), c.recruiter, offerId)).toEqual({ status: "closed" });
    expect(await closeOffer(deps(), c.owner, offerId)).toEqual({ status: "not_allowed" });

    const { rows } = await pool.query(`select status from job_offers where id = $1`, [offerId]);
    expect(rows[0]!.status).toBe("closed");
    for (const id of [open, contacted]) {
      expect(await appRow(id)).toEqual({
        status: "closed",
        closed_at: clock,
        company_visible_until: sixMonthsLater(),
      });
    }
    expect(await appRow(rejected)).toMatchObject({
      status: "rejected",
      company_visible_until: sixMonthsLater(),
    });
    const audit = await pool.query(
      `select actor_id from audit_log where action = 'offer.close' and target_id = $1`,
      [offerId],
    );
    expect(audit.rows).toEqual([{ actor_id: c.recruiter }]);
  });

  it("rinnovo: solo negli ultimi 7 giorni; nuova pubblicazione e scadenza, promemoria azzerato", async () => {
    const c = await company();
    const far = await offer(c.companyId, at(10));
    expect(await renewOffer(deps(), c.owner, far, 30)).toEqual({ status: "not_allowed" });

    const near = await offer(c.companyId, at(5));
    // Scadenza scritta dal DB, con i microsecondi (come `now() + interval …`): il rinnovo deve funzionare.
    await pool.query(
      `update job_offers set expiry_notice_at = $1, valid_through = valid_through + interval '0.000123 seconds'
       where id = $2`,
      [at(-1), near],
    );
    expect(await renewOffer(deps(), c.owner, near, 45)).toEqual({ status: "renewed" });
    const { rows } = await pool.query(
      `select status, published_at, valid_through, expiry_notice_at from job_offers where id = $1`,
      [near],
    );
    expect(rows[0]).toEqual({
      status: "published",
      published_at: clock,
      valid_through: at(45),
      expiry_notice_at: null,
    });
    // Appena rinnovata non è più "negli ultimi 7 giorni".
    expect(await renewOffer(deps(), c.owner, near, 60)).toEqual({ status: "not_allowed" });
  });

  it("scadenza (job): oltre la data → scaduta e candidature chiuse; le altre restano", async () => {
    const c = await company();
    const due = await offer(c.companyId, at(-0.01));
    const live = await offer(c.companyId, at(1));
    const tag = randomUUID().slice(0, 8);
    const onDue = await application(due, "viewed", `scaduta+${tag}@esempio.it`);
    const onLive = await application(live, "sent", `viva+${tag}@esempio.it`);

    const result = await expireDueOffers(deps());
    expect(result.offersExpired).toBeGreaterThanOrEqual(1);
    const { rows } = await pool.query(
      `select id, status from job_offers where id = any($1::uuid[]) order by valid_through`,
      [[due, live]],
    );
    expect(rows).toEqual([
      { id: due, status: "expired" },
      { id: live, status: "published" },
    ]);
    expect((await appRow(onDue)).status).toBe("closed");
    expect((await appRow(onLive)).status).toBe("sent");
  });

  it("email: promemoria ai membri una volta sola; 'posizione chiusa' ai candidati una volta sola", async () => {
    const c = await company();
    const expiring = await offer(c.companyId, at(2), "Pasticciere/a");
    await sendExpiryNotices(deps());
    const notices = sent.filter((m) => [c.emails.owner, c.emails.recruiter].includes(m.to));
    expect(notices).toHaveLength(2);
    expect(notices[0]!.subject).toMatch(/^La tua offerta «Pasticciere\/a» scade il /);
    sent = [];
    await sendExpiryNotices(deps());
    expect(sent.filter((m) => m.to === c.emails.owner)).toHaveLength(0);

    const tag = randomUUID().slice(0, 8);
    const emails = {
      open: `chiusa.avviso+${tag}@esempio.it`,
      rejected: `scartata.avviso+${tag}@esempio.it`,
    };
    await application(expiring, "in_review", emails.open);
    await application(expiring, "rejected", emails.rejected);
    await closeOffer(deps(), c.owner, expiring);
    await sendPositionClosedEmails(deps());
    const mine = sent.filter((m) => Object.values(emails).includes(m.to));
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({
      to: emails.open,
      subject: "La posizione «Pasticciere/a» è chiusa",
    });
    expect(mine[0]!.text).toContain("Locanda Finta ha chiuso l'offerta");
    sent = [];
    await sendPositionClosedEmails(deps());
    expect(sent.filter((m) => m.to === emails.open)).toHaveLength(0);

    // Scaduta: il testo lo dice.
    const due = await offer(c.companyId, at(-0.01), "Gelataio/a");
    const late = `scaduta.avviso+${tag}@esempio.it`;
    await application(due, "sent", late);
    await expireDueOffers(deps());
    await sendPositionClosedEmails(deps());
    expect(sent.find((m) => m.to === late)?.text).toContain("è scaduta");
  });

  it("SMTP giù: nessun avviso perso, al giro dopo parte", async () => {
    const c = await company();
    const offerId = await offer(c.companyId, at(20));
    const email = `smtp.ciclo+${randomUUID()}@esempio.it`;
    await application(offerId, "sent", email);
    await closeOffer(deps(), c.owner, offerId);
    failSmtp = true;
    expect((await sendPositionClosedEmails(deps())).failures).toBeGreaterThanOrEqual(1);
    failSmtp = false;
    await sendPositionClosedEmails(deps());
    expect(sent.filter((m) => m.to === email)).toHaveLength(1);
  });

  it("conservazione: il messaggio si cancella finita la finestra dell'azienda, non prima", async () => {
    const c = await company();
    const offerId = await offer(c.companyId, at(20));
    const tag = randomUUID().slice(0, 8);
    const old = await application(offerId, "closed", `vecchia+${tag}@esempio.it`);
    const recent = await application(offerId, "closed", `recente+${tag}@esempio.it`);
    await pool.query(`update applications set company_visible_until = $1 where id = $2`, [
      at(-1),
      old,
    ]);
    await pool.query(`update applications set company_visible_until = $1 where id = $2`, [
      at(100),
      recent,
    ]);
    await purgeExpiredApplicationMessages(drizzle(pool), clock);
    const { rows } = await pool.query(
      `select id, message_enc from applications where id = any($1::uuid[])`,
      [[old, recent]],
    );
    expect(Object.fromEntries(rows.map((r) => [r.id, r.message_enc]))).toEqual({
      [old]: null,
      [recent]: "v1.finto",
    });
  });
});
