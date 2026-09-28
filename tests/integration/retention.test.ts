import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { dekContextFor, encryptJson, FileKeyProvider, newDataKey } from "@/lib/crypto";
import type { Mailer, MailMessage } from "@/lib/mail";
import { monthsBefore } from "@/modules/privacy/domain";
import {
  deleteInactiveAccounts,
  hideInactiveProfiles,
  purgeOldAuditLog,
  purgeWaitlist,
  sendDeletionNotices,
  type RetentionDeps,
} from "@/modules/privacy/server/retention";
import { DATABASE_URL } from "./db";

// Test di accettazione WP-023b (R-PRIV-03, docs/04 §8) sul DB reale. NON modificarli per farli passare.

const keys = FileKeyProvider.fromFiles(
  "tests/fixtures/test-kek.b64",
  "tests/fixtures/test-blind-index.b64",
);
const DAY = 24 * 60 * 60_000;
const clock = new Date(Math.floor(Date.now() / 1000) * 1000);
let pool: Pool;
let sent: MailMessage[] = [];
const created = { users: [] as string[] };
const mailer: Mailer = {
  async send(m) {
    sent.push(m);
  },
};
const deps = (): RetentionDeps => ({
  db: drizzle(pool),
  keys,
  mailer,
  now: () => clock,
  appUrl: "https://esempio.it",
});

async function user(opts: {
  role?: "worker" | "company_member" | "moderator";
  lastActiveAt: Date;
  noticeAt?: Date;
  profile?: { state: "seeking" | "open" | "hidden"; lastInteractionAt: Date };
}) {
  const id = randomUUID();
  const email = `conservazione.finta+${id.slice(0, 8)}@esempio.it`;
  const { dek, dekWrapped, keyVersion } = await newDataKey(keys, dekContextFor("users", id));
  const emailEnc = encryptJson(dek, email, { table: "users", column: "email_enc", rowId: id });
  dek.fill(0);
  await pool.query(
    `insert into users (id, role, email_bidx, email_enc, dek_wrapped, key_version, adult_declared_at,
       last_active_at, deletion_notice_at)
     values ($1, $2, $3, $4, $5, $6, now(), $7, $8)`,
    [
      id,
      opts.role ?? "worker",
      await keys.blindIndex(email, "email"),
      emailEnc,
      dekWrapped,
      keyVersion,
      opts.lastActiveAt,
      opts.noticeAt ?? null,
    ],
  );
  created.users.push(id);
  if (opts.profile) {
    await pool.query(
      `insert into worker_profiles (user_id, state, municipality_code, radius_km, monthly_check_opt_in,
         next_check_at, last_interaction_at)
       values ($1, $2, '098031', 20, true, now(), $3)`,
      [id, opts.profile.state, opts.profile.lastInteractionAt],
    );
  }
  return { id, email };
}

const row = async (id: string) =>
  (
    await pool.query(
      `select u.status, u.deletion_notice_at, p.state, p.monthly_check_opt_in
       from users u left join worker_profiles p on p.user_id = u.id where u.id = $1`,
      [id],
    )
  ).rows[0];

describe.skipIf(!DATABASE_URL)("conservazione (WP-023b)", () => {
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
  });
  beforeEach(() => {
    sent = [];
  });
  afterAll(async () => {
    await pool.query(`delete from users where id = any($1::uuid[])`, [created.users]);
    await pool?.end();
  });

  it("6 mesi senza attività: profilo nascosto, email spente, un avviso; chi ha interagito no", async () => {
    const old = monthsBefore(clock, 7);
    const idle = await user({
      lastActiveAt: old,
      profile: { state: "open", lastInteractionAt: old },
    });
    const answered = await user({
      lastActiveAt: old,
      profile: { state: "open", lastInteractionAt: new Date(clock.getTime() - 10 * DAY) },
    });
    await hideInactiveProfiles(deps());
    expect(await row(idle.id)).toMatchObject({ state: "hidden", monthly_check_opt_in: false });
    expect(await row(answered.id)).toMatchObject({ state: "open" });
    expect(sent.find((m) => m.to === idle.email)?.subject).toBe("Abbiamo nascosto il tuo profilo");
    expect(sent.some((m) => m.to === answered.email)).toBe(false);
    sent = [];
    await hideInactiveProfiles(deps());
    expect(sent.some((m) => m.to === idle.email)).toBe(false); // una volta sola
  });

  it("23 mesi: preavviso con la data; chi torna dopo il preavviso lo perde", async () => {
    const almost = await user({ lastActiveAt: monthsBefore(clock, 23) });
    const recent = await user({ lastActiveAt: monthsBefore(clock, 2) });
    const cameBack = await user({
      lastActiveAt: new Date(clock.getTime() - DAY),
      noticeAt: new Date(clock.getTime() - 10 * DAY),
    });
    await sendDeletionNotices(deps());
    expect((await row(almost.id)).deletion_notice_at).toEqual(clock);
    expect((await row(recent.id)).deletion_notice_at).toBeNull();
    expect((await row(cameBack.id)).deletion_notice_at).toBeNull();
    const mail = sent.find((m) => m.to === almost.email)!;
    expect(mail.subject).toMatch(/^Il \d{1,2} \w+ \d{4} cancelleremo il tuo account$/);
    expect(mail.text).toContain("https://esempio.it/accedi");
  });

  it("24 mesi e preavviso di almeno 30 giorni: cancellazione con crypto-shredding; il personale no", async () => {
    const gone = await user({
      lastActiveAt: monthsBefore(clock, 25),
      noticeAt: new Date(clock.getTime() - 31 * DAY),
      profile: { state: "hidden", lastInteractionAt: monthsBefore(clock, 25) },
    });
    const tooSoon = await user({
      lastActiveAt: monthsBefore(clock, 25),
      noticeAt: new Date(clock.getTime() - 10 * DAY),
    });
    const noNotice = await user({ lastActiveAt: monthsBefore(clock, 30) });
    const staff = await user({
      role: "moderator",
      lastActiveAt: monthsBefore(clock, 30),
      noticeAt: new Date(clock.getTime() - 60 * DAY),
    });
    await deleteInactiveAccounts(deps());
    expect(await row(gone.id)).toMatchObject({ status: "deleted", state: null });
    for (const u of [tooSoon, noNotice, staff]) expect((await row(u.id)).status).toBe("active");
    const audit = await pool.query(
      `select actor_id, purpose from audit_log where action = 'account.delete' and target_id = $1`,
      [gone.id],
    );
    expect(audit.rows).toEqual([{ actor_id: "system:retention", purpose: "retention" }]);
  });

  it("log di sicurezza: via le righe oltre i 12 mesi, le altre restano (e restano immodificabili)", async () => {
    const tag = randomUUID();
    await pool.query(
      `insert into audit_log (actor_id, action, target_id, at) values
         ('test', 'test.vecchia', $1, now() - interval '13 months'),
         ('test', 'test.recente', $1, now() - interval '11 months')`,
      [tag],
    );
    await purgeOldAuditLog(drizzle(pool), clock);
    const { rows } = await pool.query(`select action from audit_log where target_id = $1`, [tag]);
    expect(rows).toEqual([{ action: "test.recente" }]);
    await expect(pool.query(`delete from audit_log where target_id = $1`, [tag])).rejects.toThrow(
      /append-only/,
    );
    await expect(
      pool.query(`update audit_log set actor_id = 'x' where target_id = $1`, [tag]),
    ).rejects.toThrow(/append-only/);
  });

  it("lista d'attesa: chi si è registrato esce subito; dopo 6 mesi dal lancio escono tutti", async () => {
    const registered = await user({ lastActiveAt: clock });
    const registeredBidx = (
      await pool.query(`select email_bidx from users where id = $1`, [registered.id])
    ).rows[0]!.email_bidx as string;
    const insert = async (bidx: string) => {
      const id = randomUUID();
      await pool.query(
        `insert into waitlist (id, email_bidx, email_enc, key_version, kind) values ($1, $2, 'v1.finto', 1, 'worker')`,
        [id, bidx],
      );
      return id;
    };
    const converted = await insert(registeredBidx);
    const waiting = await insert(`bidx-finto-${randomUUID()}`);
    await purgeWaitlist(drizzle(pool), new Date("2027-01-15T10:00:00Z"));
    const left = async () =>
      (
        await pool.query(`select id from waitlist where id = any($1::uuid[])`, [
          [converted, waiting],
        ])
      ).rows.map((r) => r.id);
    expect(await left()).toEqual([waiting]);
    await purgeWaitlist(drizzle(pool), new Date("2027-05-02T10:00:00Z"));
    expect(await left()).toEqual([]);
  });
});
