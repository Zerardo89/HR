import { randomInt, randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { dekContextFor, encryptJson, FileKeyProvider, newDataKey } from "@/lib/crypto";
import type { Mailer, MailMessage } from "@/lib/mail";
import { sendDueAlerts, type AlertJobDeps } from "@/modules/notifications/server/alerts";
import {
  deleteAlert,
  listAlerts,
  saveAlert,
  setAlertFrequency,
} from "@/modules/notifications/server/saved-searches";
import {
  checkUnsubscribeToken,
  unsubscribeWithToken,
} from "@/modules/notifications/server/unsubscribe";
import { prepareCatalog } from "@/modules/taxonomy/domain";
import { DATABASE_URL } from "./db";

// Test di accettazione WP-020 (avvisi delle ricerche salvate) sul DB reale. NON modificarli.

const keys = FileKeyProvider.fromFiles(
  "tests/fixtures/test-kek.b64",
  "tests/fixtures/test-blind-index.b64",
);
const T0 = new Date("2026-11-02T07:00:30Z"); // lunedì, giro delle 8
const DAY = 24 * 60 * 60_000;
let pool: Pool;
let clock = T0;
let sent: MailMessage[] = [];
let failSmtp = false;
let companyId: string;
let occupationId: number;
const created = { users: [] as string[] };

const mailer: Mailer = {
  async send(m) {
    if (failSmtp) throw new Error("smtp giù");
    sent.push(m);
  },
};
const deps = (): AlertJobDeps => ({
  db: drizzle(pool),
  keys,
  mailer,
  now: () => clock,
  appUrl: "https://esempio.it",
  occupations: prepareCatalog([]),
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

/** Offerta pubblicata in un certo istante (titolo univoco per non pescare quelle degli altri test). */
async function offer(title: string, municipality: string, publishedAt: Date, status = "published") {
  const { rows } = await pool.query<{ id: string }>(
    `insert into job_offers (company_id, title, occupation_id, description_md, municipality_code, contract_type,
       schedule, status, salary_min, salary_period, published_at, valid_through)
     values ($1, $2, $3, 'Servizio di sala.', $4, 'permanent', 'full_time', $5, 1500, 'month', $6, $7)
     returning id`,
    [
      companyId,
      title,
      occupationId,
      municipality,
      status,
      publishedAt,
      new Date(publishedAt.getTime() + 60 * DAY),
    ],
  );
  return rows[0]!.id;
}

async function checkedUntil(userId: string): Promise<Date[]> {
  const { rows } = await pool.query<{ checked_until: Date }>(
    `select checked_until from saved_searches where user_id = $1 order by created_at`,
    [userId],
  );
  return rows.map((r) => r.checked_until);
}

/** Parola inventata, diversa per ogni test: la ricerca tollera i refusi (trigrammi), serve che non si somiglino. */
const word = () =>
  Array.from({ length: 10 }, () => String.fromCharCode(97 + randomInt(0, 26))).join("");

describe.skipIf(!DATABASE_URL)("avvisi (WP-020)", () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 3 });
    await pool.query(
      `insert into regions (code, name) values ('03','Lombardia') on conflict do nothing`,
    );
    await pool.query(
      `insert into provinces (code, name, abbreviation, region_code)
       values ('098','Lodi','LO','03'), ('015','Milano','MI','03') on conflict do nothing`,
    );
    await pool.query(
      `insert into municipalities (istat_code, name, province_code, region_code, lat, lon) values
         ('098031','Lodi','098','03',45.3097,9.5037), ('015146','Milano','015','03',45.4642,9.1900)
       on conflict do nothing`,
    );
    const occ = await pool.query<{ id: number }>(
      `insert into occupations (slug, category, label_it, group_code)
       values ('test-avvisi', 'ristorazione', 'Mansione di prova avvisi', '999')
       on conflict (slug) do update set label_it = excluded.label_it returning id`,
    );
    occupationId = occ.rows[0]!.id;
    const company = await pool.query<{ id: string }>(
      `insert into companies (vat_number, legal_name, display_name, status, verified_at)
       values ($1, 'FINTA SRL', 'Enoteca Finta', 'verified', now()) returning id`,
      [`8${String(randomInt(0, 1e9)).padStart(10, "0")}`],
    );
    companyId = company.rows[0]!.id;
  });
  beforeEach(() => {
    clock = T0;
    sent = [];
    failSmtp = false;
  });
  afterAll(async () => {
    await pool.query(`delete from companies where id = $1`, [companyId]);
    await pool.query(`delete from users where id = any($1::uuid[])`, [created.users]);
    await pool?.end();
  });

  it("salvare: comune in forma canonica, consenso registrato una volta, doppioni e limite di 5", async () => {
    const worker = await user("worker", `avvisi.finta+${randomUUID()}@esempio.it`);
    const d = deps();
    expect(await saveAlert(d, worker, { params: "q=cuoco&dove=lodi", frequency: "daily" })).toEqual(
      {
        status: "saved",
      },
    );
    const { rows } = await pool.query(`select params from saved_searches where user_id = $1`, [
      worker,
    ]);
    expect(rows).toEqual([{ params: "q=cuoco&dove=Lodi+%28LO%29" }]);
    // La stessa ricerca scritta diversamente è un doppione.
    expect(
      await saveAlert(d, worker, {
        params: "dove=Lodi+(LO)&q=cuoco&pagina=2",
        frequency: "weekly",
      }),
    ).toEqual({ status: "duplicate" });
    expect(
      await saveAlert(d, worker, { params: "contratto=permanent", frequency: "daily" }),
    ).toEqual({ status: "invalid" });
    expect(await saveAlert(d, worker, { params: "dove=Paesefinto", frequency: "daily" })).toEqual({
      status: "invalid",
    });
    for (const q of ["barista", "pizzaiolo", "lavapiatti", "aiuto cuoco"]) {
      expect((await saveAlert(d, worker, { params: `q=${q}`, frequency: "daily" })).status).toBe(
        "saved",
      );
    }
    expect(await saveAlert(d, worker, { params: "q=gelataio", frequency: "daily" })).toEqual({
      status: "limit",
    });
    const consents = await pool.query(
      `select version, revoked_at from consents where user_id = $1 and type = 'job_alerts'`,
      [worker],
    );
    expect(consents.rows).toEqual([{ version: "avvisi-2026-09-28", revoked_at: null }]);

    const company = await user("company_member", `azienda.finta+${randomUUID()}@esempio.it`);
    expect(await saveAlert(d, company, { params: "q=cuoco", frequency: "daily" })).toEqual({
      status: "not_allowed",
    });
  });

  it("invio: solo le offerte nuove, nel raggio, pubblicate; una email senza dati personali, con disiscrizione", async () => {
    const q = word();
    const email = `cerca.finta+${randomUUID()}@esempio.it`;
    const worker = await user("worker", email);
    await saveAlert(deps(), worker, { params: `q=${q}&dove=Lodi+(LO)`, frequency: "daily" });
    const before = await offer(`Sommelier ${q} vecchia`, "098031", new Date(T0.getTime() - DAY));
    const fresh = await offer(`Sommelier ${q}`, "098031", new Date(T0.getTime() + 3600_000));
    const far = await offer(`Sommelier ${q} Milano`, "015146", new Date(T0.getTime() + 3600_000));
    const draft = await offer(
      `Sommelier ${q} bozza`,
      "098031",
      new Date(T0.getTime() + 3600_000),
      "draft",
    );

    clock = new Date(T0.getTime() + DAY);
    expect(await sendDueAlerts(deps())).toMatchObject({ emails: 1, failures: 0 });
    const mine = sent.filter((m) => m.to === email);
    expect(mine).toHaveLength(1);
    const [mail] = mine;
    expect(mail!.subject).toBe("1 nuova offerta per le tue ricerche");
    expect(mail!.text).toContain(`https://esempio.it/offerte/${fresh}`);
    for (const other of [before, far, draft]) expect(mail!.text).not.toContain(other);
    expect(mail!.text).not.toContain(email);
    expect(mail!.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(mail!.headers?.["List-Unsubscribe"]).toMatch(
      /^<https:\/\/esempio\.it\/api\/avvisi\/disiscrizione\?token=[\w-]{43}>$/,
    );
    expect(await checkedUntil(worker)).toEqual([clock]);
    const audit = await pool.query(
      `select actor_id, purpose from audit_log where action = 'pii.decrypt' and target_id = $1`,
      [worker],
    );
    expect(audit.rows).toContainEqual({
      actor_id: "system:notify",
      purpose: "notification.job-alert",
    });

    // Rifatto subito: niente. Il giorno dopo senza offerte nuove: niente email, controllo avanzato.
    sent = [];
    await sendDueAlerts(deps());
    clock = new Date(T0.getTime() + 2 * DAY);
    await sendDueAlerts(deps());
    expect(sent.filter((m) => m.to === email)).toHaveLength(0);
    expect(await checkedUntil(worker)).toEqual([clock]);
  });

  it("più ricerche dovute della stessa persona: una sola email; la settimanale aspetta sette giorni", async () => {
    const [a, b, c] = [word(), word(), word()];
    const email = `due.ricerche+${randomUUID()}@esempio.it`;
    const worker = await user("worker", email);
    for (const [q, frequency] of [
      [a, "daily"],
      [b, "daily"],
      [c, "weekly"],
    ] as const) {
      await saveAlert(deps(), worker, { params: `q=${q}`, frequency });
    }
    for (const q of [a, b, c])
      await offer(`Sommelier ${q}`, "098031", new Date(T0.getTime() + 60_000));

    clock = new Date(T0.getTime() + DAY);
    await sendDueAlerts(deps());
    const mine = sent.filter((m) => m.to === email);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.subject).toBe("2 nuove offerte per le tue ricerche");
    expect(mine[0]!.text).toContain(a);
    expect(mine[0]!.text).toContain(b);
    expect(mine[0]!.text).not.toContain(c);

    sent = [];
    clock = new Date(T0.getTime() + 7 * DAY);
    await sendDueAlerts(deps());
    expect(sent.filter((m) => m.to === email)[0]?.text).toContain(c);
  });

  it("niente avvisi per chi è 'aperto' o 'nascosto', né per chi ha cancellato l'account", async () => {
    const q = word();
    const emails = ["aperta", "nascosta", "cancellata"].map(
      (n) => `${n}.finta+${randomUUID()}@esempio.it`,
    );
    const [open, hidden, deleted] = await Promise.all(emails.map((e) => user("worker", e)));
    for (const w of [open, hidden, deleted]) {
      await saveAlert(deps(), w!, { params: `q=${q}`, frequency: "daily" });
    }
    for (const [w, state] of [
      [open, "open"],
      [hidden, "hidden"],
    ] as const) {
      await pool.query(
        `insert into worker_profiles (user_id, municipality_code, radius_km, state) values ($1, '098031', 20, $2)`,
        [w, state],
      );
    }
    await pool.query(`update users set dek_wrapped = null where id = $1`, [deleted]);
    await offer(`Sommelier ${q}`, "098031", new Date(T0.getTime() + 60_000));

    clock = new Date(T0.getTime() + DAY);
    await sendDueAlerts(deps());
    expect(sent.filter((m) => emails.includes(m.to))).toHaveLength(0);
  });

  it("SMTP giù: nessuna offerta persa, al giro dopo parte", async () => {
    const q = word();
    const email = `smtp.finta+${randomUUID()}@esempio.it`;
    const worker = await user("worker", email);
    await saveAlert(deps(), worker, { params: `q=${q}`, frequency: "daily" });
    await offer(`Sommelier ${q}`, "098031", new Date(T0.getTime() + 60_000));

    clock = new Date(T0.getTime() + DAY);
    failSmtp = true;
    expect((await sendDueAlerts(deps())).failures).toBeGreaterThanOrEqual(1);
    expect(await checkedUntil(worker)).toEqual([T0]);

    failSmtp = false;
    clock = new Date(T0.getTime() + DAY + 5 * 60_000); // nuovo tentativo di pg-boss
    await sendDueAlerts(deps());
    expect(sent.filter((m) => m.to === email)[0]?.text).toContain(q);
  });

  it("disiscrizione con un clic: via tutti gli avvisi, consenso chiuso; rifarla è innocuo", async () => {
    const q = word();
    const email = `disiscritta.finta+${randomUUID()}@esempio.it`;
    const worker = await user("worker", email);
    await saveAlert(deps(), worker, { params: `q=${q}`, frequency: "daily" });
    await saveAlert(deps(), worker, { params: `q=${q}&dove=Lodi`, frequency: "weekly" });
    await offer(`Sommelier ${q}`, "098031", new Date(T0.getTime() + 60_000));
    clock = new Date(T0.getTime() + DAY);
    await sendDueAlerts(deps());
    const header = sent.find((m) => m.to === email)!.headers!["List-Unsubscribe"]!;
    const token = new URL(header.slice(1, -1)).searchParams.get("token");

    expect(await checkUnsubscribeToken(deps(), token)).toBe("valid");
    expect(await unsubscribeWithToken(deps(), token)).toEqual({ status: "done" });
    expect((await listAlerts(drizzle(pool), worker)).alerts).toEqual([]);
    const consent = await pool.query(
      `select revoked_at from consents where user_id = $1 and type = 'job_alerts'`,
      [worker],
    );
    expect(consent.rows).toEqual([{ revoked_at: clock }]);
    expect(await checkUnsubscribeToken(deps(), token)).toBe("used");
    expect(await unsubscribeWithToken(deps(), token)).toEqual({ status: "done" });

    for (const bad of [null, "", "abc", "x".repeat(43), undefined]) {
      expect(await unsubscribeWithToken(deps(), bad)).toEqual({ status: "invalid" });
    }
    clock = new Date(clock.getTime() + 61 * DAY);
    expect(await checkUnsubscribeToken(deps(), token)).toBe("invalid");
  });

  it("gestione: solo i propri avvisi; eliminato l'ultimo, il consenso si chiude", async () => {
    const worker = await user("worker", `gestione.finta+${randomUUID()}@esempio.it`);
    const other = await user("worker", `altra.finta+${randomUUID()}@esempio.it`);
    await saveAlert(deps(), worker, { params: `q=${word()}`, frequency: "daily" });
    const [alert] = (await listAlerts(drizzle(pool), worker)).alerts;

    expect(await setAlertFrequency(deps(), other, alert!.id, "weekly")).toEqual({
      status: "not_found",
    });
    expect(await deleteAlert(deps(), other, alert!.id)).toEqual({ status: "not_found" });
    expect(await setAlertFrequency(deps(), worker, alert!.id, "weekly")).toEqual({
      status: "updated",
    });
    expect((await listAlerts(drizzle(pool), worker)).alerts[0]!.frequency).toBe("weekly");
    expect(await deleteAlert(deps(), worker, alert!.id)).toEqual({ status: "deleted" });
    const consent = await pool.query(
      `select revoked_at from consents where user_id = $1 and type = 'job_alerts'`,
      [worker],
    );
    expect(consent.rows[0]!.revoked_at).not.toBeNull();
  });
});
