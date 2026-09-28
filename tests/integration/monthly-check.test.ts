import { randomInt, randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { dekContextFor, encryptJson, FileKeyProvider, newDataKey } from "@/lib/crypto";
import type { Mailer, MailMessage } from "@/lib/mail";
import {
  answerMonthlyCheck,
  checkMonthlyToken,
  sendMonthlyChecks,
} from "@/modules/notifications/server/monthly";
import type { OutcomeDeps } from "@/modules/notifications/server/outcomes";
import { DATABASE_URL } from "./db";

// Test di accettazione WP-021 (mail mensile, 01-PRODOTTO §6.2) sul DB reale. NON modificarli.

const keys = FileKeyProvider.fromFiles(
  "tests/fixtures/test-kek.b64",
  "tests/fixtures/test-blind-index.b64",
);
const DAY = 24 * 60 * 60_000;
// Dopo il periodo fondatori (31/01/2027): il Piano Nazionale c'è solo con una riga `entitlements`.
const T0 = new Date("2027-03-01T08:00:00Z");
let clock = T0;
let pool: Pool;
let sent: MailMessage[] = [];
let failSmtp = false;
const occ = { a: 0, b: 0, c: 0 };
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
const at = (days: number) => new Date(T0.getTime() + days * DAY);

async function worker(profile: {
  state?: "seeking" | "open" | "hidden";
  optIn?: boolean;
  nextCheckAt?: Date | null;
  unanswered?: number;
  relocation?: string[];
}) {
  const id = randomUUID();
  const email = `mensile.finta+${id.slice(0, 8)}@esempio.it`;
  const { dek, dekWrapped, keyVersion } = await newDataKey(keys, dekContextFor("users", id));
  const emailEnc = encryptJson(dek, email, { table: "users", column: "email_enc", rowId: id });
  dek.fill(0);
  await pool.query(
    `insert into users (id, role, email_bidx, email_enc, dek_wrapped, key_version, adult_declared_at)
     values ($1, 'worker', $2, $3, $4, $5, now())`,
    [id, await keys.blindIndex(email, "email"), emailEnc, dekWrapped, keyVersion],
  );
  created.users.push(id);
  await pool.query(
    `insert into worker_profiles (user_id, state, municipality_code, radius_km, relocation_region_codes,
       monthly_check_opt_in, next_check_at, unanswered_checks)
     values ($1, $2, '098031', 20, $3, $4, $5, $6)`,
    [
      id,
      profile.state ?? "open",
      profile.relocation ?? [],
      profile.optIn ?? true,
      profile.nextCheckAt === undefined ? at(-0.1) : profile.nextCheckAt,
      profile.unanswered ?? 0,
    ],
  );
  await pool.query(`insert into profile_occupations (user_id, occupation_id) values ($1, $2)`, [
    id,
    occ.a,
  ]);
  return { id, email };
}

async function company(national: boolean) {
  const { rows } = await pool.query<{ id: string }>(
    `insert into companies (vat_number, legal_name, display_name, status, verified_at, created_at)
     values ($1, 'FINTA SRL', 'Cucina Finta', 'verified', now(), '2027-02-10T10:00:00Z') returning id`,
    [`2${String(randomInt(0, 1e9)).padStart(10, "0")}`],
  );
  const id = rows[0]!.id;
  created.companies.push(id);
  if (national) {
    await pool.query(
      `insert into entitlements (owner_type, owner_id, product, valid_from, valid_to, source)
       values ('company', $1, 'national', $2, $3, 'promo')`,
      [id, at(-60), at(300)],
    );
  }
  return id;
}

async function offer(
  companyId: string,
  occupationId: number,
  municipality: string,
  publishedDaysAgo = 2,
) {
  const published = at(-publishedDaysAgo);
  const { rows } = await pool.query<{ id: string }>(
    `insert into job_offers (company_id, title, occupation_id, description_md, municipality_code, contract_type,
       schedule, status, salary_min, salary_period, published_at, valid_through)
     values ($1, 'Cuoco/a mensile', $2, 'Cucina.', $3, 'permanent', 'full_time', 'published', 1500, 'month', $4, $5)
     returning id`,
    [companyId, occupationId, municipality, published, new Date(published.getTime() + 55 * DAY)],
  );
  return rows[0]!.id;
}

async function profileRow(userId: string) {
  const { rows } = await pool.query(
    `select state, monthly_check_opt_in, next_check_at, unanswered_checks from worker_profiles where user_id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

const tokenOf = (mail: MailMessage) => /token=([\w-]{43})/.exec(mail.text)![1]!;

describe.skipIf(!DATABASE_URL)("mail mensile (WP-021)", () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 3 });
    await pool.query(
      `insert into regions (code, name) values ('03','Lombardia'), ('08','Emilia-Romagna') on conflict do nothing`,
    );
    await pool.query(
      `insert into provinces (code, name, abbreviation, region_code) values
         ('098','Lodi','LO','03'), ('015','Milano','MI','03'), ('033','Piacenza','PC','08')
       on conflict do nothing`,
    );
    await pool.query(
      `insert into municipalities (istat_code, name, province_code, region_code, lat, lon) values
         ('098031','Lodi','098','03',45.3097,9.5037), ('015146','Milano','015','03',45.4642,9.1900),
         ('033032','Piacenza','033','08',45.0526,9.6934)
       on conflict do nothing`,
    );
    const insert = async (slug: string, group: string) =>
      (
        await pool.query<{ id: number }>(
          `insert into occupations (slug, category, label_it, group_code)
           values ($1::varchar, 'ristorazione', $1::text, $2)
           on conflict (slug) do update set group_code = excluded.group_code returning id`,
          [slug, group],
        )
      ).rows[0]!.id;
    occ.a = await insert("test-mensile-cuoco", "M01");
    occ.b = await insert("test-mensile-aiuto-cuoco", "M01");
    occ.c = await insert("test-mensile-autista", "M02");
  });
  beforeEach(() => {
    clock = T0;
    sent = [];
    failSmtp = false;
  });
  afterAll(async () => {
    await pool.query(`delete from companies where id = any($1::uuid[])`, [created.companies]);
    await pool.query(`delete from users where id = any($1::uuid[])`, [created.users]);
    await pool?.end();
  });

  it("chi la riceve: solo 'aperti' con la mail scelta e la data raggiunta", async () => {
    const due = await worker({});
    const seeking = await worker({ state: "seeking" });
    const optedOut = await worker({ optIn: false, nextCheckAt: null });
    const later = await worker({ nextCheckAt: at(5) });
    await sendMonthlyChecks(deps());
    const to = sent.map((m) => m.to);
    expect(to).toContain(due.email);
    for (const w of [seeking, optedOut, later]) expect(to).not.toContain(w.email);
    const audit = await pool.query(
      `select purpose from audit_log where actor_id = 'system:notify' and target_id = $1`,
      [due.id],
    );
    expect(audit.rows).toContainEqual({ purpose: "notification.monthly-check" });
  });

  it("offerte: mansione o simile nel raggio; trasferimento solo con Piano Nazionale; ultimi 30 giorni", async () => {
    const w = await worker({ relocation: ["08"] });
    const plain = await company(false);
    const national = await company(true);
    const same = await offer(plain, occ.a, "098031");
    const similar = await offer(plain, occ.b, "098031");
    const unrelated = await offer(plain, occ.c, "098031");
    const outOfRadius = await offer(plain, occ.a, "015146"); // Milano, ~30 km
    const relocationNoPlan = await offer(plain, occ.a, "033032"); // Piacenza, regione 08
    const relocationNational = await offer(national, occ.a, "033032");
    const old = await offer(plain, occ.a, "098031", 40);

    const before = await profileRow(w.id);
    await sendMonthlyChecks(deps());
    const mail = sent.find((m) => m.to === w.email)!;
    expect(mail.subject).toBe("Stai ancora cercando lavoro? 3 offerte per te vicino a Lodi (LO)");
    for (const id of [same, similar, relocationNational]) expect(mail.text).toContain(id);
    for (const id of [unrelated, outOfRadius, relocationNoPlan, old]) {
      expect(mail.text).not.toContain(id);
    }
    expect(mail.headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(mail.headers?.["List-Unsubscribe"]).toMatch(
      /^<https:\/\/esempio\.it\/api\/mensile\/disiscrizione\?token=[\w-]{43}>$/,
    );
    expect(await profileRow(w.id)).toMatchObject({
      unanswered_checks: 1,
      next_check_at: new Date(before.next_check_at.getTime() + 30 * DAY),
    });
  });

  it("risposte: una per mail, dopo conferma; la disiscrizione funziona anche dopo", async () => {
    const w = await worker({});
    await sendMonthlyChecks(deps());
    const token = tokenOf(sent.find((m) => m.to === w.email)!);

    expect(await checkMonthlyToken(deps(), token)).toBe("valid");
    expect(await answerMonthlyCheck(deps(), token, "open")).toEqual({ status: "done" });
    expect(await profileRow(w.id)).toMatchObject({ state: "open", unanswered_checks: 0 });
    expect(await checkMonthlyToken(deps(), token)).toBe("used");
    expect(await answerMonthlyCheck(deps(), token, "hide")).toEqual({ status: "used" });
    expect(await answerMonthlyCheck(deps(), token, "stop")).toEqual({ status: "done" });
    expect(await profileRow(w.id)).toMatchObject({
      state: "open",
      monthly_check_opt_in: false,
      next_check_at: null,
    });

    for (const bad of [null, "", "x".repeat(43), undefined]) {
      expect(await answerMonthlyCheck(deps(), bad, "open")).toEqual({ status: "invalid" });
    }
    clock = at(31);
    expect(await checkMonthlyToken(deps(), token)).toBe("invalid");
  });

  it("rispondere dalla mail è attività: rimanda la conservazione (R-PRIV-03, WP-023b)", async () => {
    const w = await worker({});
    await pool.query(`update users set last_active_at = $2 where id = $1`, [w.id, at(-400)]);
    await sendMonthlyChecks(deps());
    await answerMonthlyCheck(deps(), tokenOf(sent.find((m) => m.to === w.email)!), "open");
    const { rows } = await pool.query(`select last_active_at from users where id = $1`, [w.id]);
    expect(rows[0]!.last_active_at).toEqual(T0);
  });

  it("'cerco', 'nascondimi' e 'cancella il profilo'", async () => {
    const [a, b, c] = [await worker({}), await worker({}), await worker({})];
    await sendMonthlyChecks(deps());
    const token = (w: { email: string }) => tokenOf(sent.find((m) => m.to === w.email)!);
    await answerMonthlyCheck(deps(), token(a), "seeking");
    await answerMonthlyCheck(deps(), token(b), "hide");
    await answerMonthlyCheck(deps(), token(c), "delete");
    expect((await profileRow(a.id)).state).toBe("seeking");
    expect((await profileRow(b.id)).state).toBe("hidden");
    expect(await profileRow(c.id)).toBeNull();
    const account = await pool.query(`select status from users where id = $1`, [c.id]);
    expect(account.rows[0]!.status).toBe("active"); // l'account resta
  });

  it("dopo 6 mail senza risposta: pausa, profilo nascosto, un'ultima mail", async () => {
    const w = await worker({ unanswered: 6 });
    await sendMonthlyChecks(deps());
    const mine = sent.filter((m) => m.to === w.email);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.subject).toBe("Abbiamo messo in pausa il tuo profilo");
    expect(await profileRow(w.id)).toMatchObject({
      state: "hidden",
      monthly_check_opt_in: false,
      next_check_at: null,
    });
  });

  it("SMTP giù: la data non si sposta, la mail parte al giro dopo", async () => {
    const w = await worker({});
    const before = await profileRow(w.id);
    failSmtp = true;
    expect((await sendMonthlyChecks(deps())).failures).toBeGreaterThanOrEqual(1);
    expect((await profileRow(w.id)).next_check_at).toEqual(before.next_check_at);
    failSmtp = false;
    await sendMonthlyChecks(deps());
    expect(sent.filter((m) => m.to === w.email)).toHaveLength(1);
  });
});
