import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { FileKeyProvider } from "@/lib/crypto";
import type { Mailer, MailMessage } from "@/lib/mail";
import { base32Decode, totpStep } from "@/modules/identity/domain";
import type { IdentityDeps } from "@/modules/identity/server/deps";
import {
  pendingEnrollment,
  redeemRecoveryCode,
  verifyMfaCode,
  type MfaRequired,
} from "@/modules/identity/server/mfa";
import { resetSecondFactor } from "@/modules/identity/server/mfa-reset";
import { deleteExpiredAuthRows, validateSessionToken } from "@/modules/identity/server/sessions";
import {
  completeSignup,
  requestLoginCode,
  verifyLoginCode,
} from "@/modules/identity/server/sign-in";
import { hashToken } from "@/modules/identity/server/tokens";
import { hotp } from "@/modules/identity/server/totp";
import { DATABASE_URL } from "./db";

// Test di accettazione WP-011b (2FA TOTP) sul DB reale. Scritti dall'architetto: NON modificarli per farli passare.

const keys = FileKeyProvider.fromFiles(
  "tests/fixtures/test-kek.b64",
  "tests/fixtures/test-blind-index.b64",
);

let pool: Pool;
let clock: Date;
let sent: MailMessage[];
const createdEmails: string[] = [];

const recordingMailer: Mailer = {
  async send(message) {
    sent.push(message);
  },
};

const deps = (): IdentityDeps => ({
  db: drizzle(pool),
  keys,
  mailer: recordingMailer,
  now: () => clock,
  appUrl: "http://localhost:3000",
});

const secondsLater = (n: number) => (clock = new Date(clock.getTime() + n * 1000));

function lastCode(): string {
  const match = /\b(\d{6})\b/.exec(sent.at(-1)?.text ?? "");
  if (!match) throw new Error("nessun codice nell'ultima email");
  return match[1]!;
}

const totpNow = (secret: string) => hotp(base32Decode(secret)!, totpStep(clock));
const wrong = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, "0");

/** Primo fattore (codice email) per un'email nuova con il ruolo dato; ritorna la richiesta del secondo. */
async function signUp(role: "company_member" | "worker" = "company_member") {
  const email = `azienda.finta+${randomUUID().slice(0, 8)}@esempio.it`;
  createdEmails.push(email);
  await requestLoginCode(deps(), email);
  const verified = await verifyLoginCode(deps(), email, lastCode(), null);
  if (verified.status !== "signup_required") throw new Error(verified.status);
  const result = await completeSignup(
    deps(),
    { email, role, adult: "on", legal: "on" },
    verified.ticket,
  );
  return { email, result };
}

async function logIn(email: string): Promise<MfaRequired> {
  await requestLoginCode(deps(), email);
  const result = await verifyLoginCode(deps(), email, lastCode(), null);
  if (result.status !== "mfa_required") throw new Error(`atteso mfa_required: ${result.status}`);
  return result;
}

/** Account azienda con la 2FA già attiva: il segreto e i codici di recupero. */
async function enrolledCompany() {
  const { email, result } = await signUp();
  if (result.status !== "mfa_required" || !result.enrollment) throw new Error(result.status);
  const secret = result.enrollment.secret;
  const done = await verifyMfaCode(deps(), result.ticket, totpNow(secret), null);
  if (done.status !== "signed_in" || !done.recoveryCodes) throw new Error(done.status);
  secondsLater(30); // il codice appena usato non vale più: si passa al periodo successivo
  return { email, secret, userId: done.userId, recoveryCodes: done.recoveryCodes };
}

async function tablesContaining(needle: string): Promise<string[]> {
  const { rows: columns } = await pool.query<{ table_name: string; column_name: string }>(
    `select table_name, column_name from information_schema.columns
     where table_schema = 'public' and data_type in ('text', 'character varying', 'character', 'jsonb', 'ARRAY')`,
  );
  const found: string[] = [];
  for (const { table_name, column_name } of columns) {
    const { rows } = await pool.query<{ n: number }>(
      `select count(*)::int as n from "${table_name}" where "${column_name}"::text ilike $1`,
      [`%${needle}%`],
    );
    if (rows[0]!.n > 0) found.push(`${table_name}.${column_name}`);
  }
  return found;
}

async function auditActions(userId: string): Promise<string[]> {
  const { rows } = await pool.query<{ action: string }>(
    `select action from audit_log where actor_id = $1 order by id`,
    [userId],
  );
  return rows.map((r) => r.action);
}

describe.skipIf(!DATABASE_URL)("secondo fattore TOTP (WP-011b)", () => {
  beforeAll(() => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 3 });
  });

  beforeEach(() => {
    sent = [];
    clock = new Date("2026-10-05T08:00:05Z");
  });

  afterEach(async () => {
    for (const email of createdEmails.splice(0)) {
      const bidx = await keys.blindIndex(email, "email");
      await pool.query(`delete from users where email_bidx = $1`, [bidx]);
      await pool.query(`delete from auth_otp_challenges where email_bidx = $1`, [bidx]);
    }
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("chi cerca lavoro entra con il solo codice email", async () => {
    const { result } = await signUp("worker");
    expect(result.status).toBe("signed_in");
  });

  it("un'azienda appena registrata non ha sessione finché non attiva la 2FA", async () => {
    const { result } = await signUp();
    expect(result).toMatchObject({
      status: "mfa_required",
      enrollment: { secret: expect.any(String) },
    });
    if (result.status !== "mfa_required") return;
    expect(result.enrollment!.secret).toMatch(/^[A-Z2-7]{32}$/);
    const { rows } = await pool.query(
      `select count(*)::int as n from auth_sessions s join users u on u.id = s.user_id
       where u.email_bidx = $1`,
      [await keys.blindIndex(createdEmails.at(-1)!, "email")],
    );
    expect(rows[0].n).toBe(0);
  });

  it("attivazione: codice giusto → sessione e 10 codici di recupero; nel DB niente in chiaro", async () => {
    const { result } = await signUp();
    if (result.status !== "mfa_required" || !result.enrollment) throw new Error(result.status);
    const { secret } = result.enrollment;

    const done = await verifyMfaCode(deps(), result.ticket, totpNow(secret), null);
    expect(done).toMatchObject({ status: "signed_in", role: "company_member" });
    if (done.status !== "signed_in") return;
    expect(done.recoveryCodes).toHaveLength(10);
    expect(await validateSessionToken(deps(), done.session.token)).toMatchObject({
      user: { id: done.userId },
    });

    expect(await tablesContaining(secret)).toEqual([]);
    for (const code of done.recoveryCodes!) expect(await tablesContaining(code)).toEqual([]);
    const { rows } = await pool.query(`select * from auth_totp where user_id = $1`, [done.userId]);
    expect(rows[0].secret_enc).toMatch(/^v1\./);
    expect(rows[0].confirmed_at).toBeInstanceOf(Date);
    expect(await tablesContaining(result.ticket)).toEqual([]);
    expect(await auditActions(done.userId)).toEqual(["auth.mfa_enrolled"]);
  });

  it("attivazione: codice sbagliato → stesso segreto da rimostrare, tentativi che scendono", async () => {
    const { result } = await signUp();
    if (result.status !== "mfa_required" || !result.enrollment) throw new Error(result.status);
    const { secret } = result.enrollment;
    expect(await verifyMfaCode(deps(), result.ticket, wrong(totpNow(secret)), null)).toEqual({
      status: "wrong_code",
      attemptsLeft: 4,
      enrollment: { secret },
    });
    expect(await pendingEnrollment(deps(), result.ticket)).toEqual({ secret });
  });

  it("un nuovo accesso prima della conferma cambia il segreto: il vecchio non vale più", async () => {
    const { email, result } = await signUp();
    if (result.status !== "mfa_required" || !result.enrollment) throw new Error(result.status);
    const again = await logIn(email);
    expect(again.enrollment?.secret).toBeDefined();
    expect(again.enrollment!.secret).not.toBe(result.enrollment.secret);
    // Il primo biglietto è stato sostituito dal secondo.
    expect(
      await verifyMfaCode(deps(), result.ticket, totpNow(again.enrollment!.secret), null),
    ).toEqual({ status: "expired" });
    const old = await verifyMfaCode(deps(), again.ticket, totpNow(result.enrollment.secret), null);
    expect(old).toMatchObject({ status: "wrong_code" });
  });

  it("2FA attiva: l'accesso chiede il codice dell'app senza mostrare di nuovo il segreto", async () => {
    const { email, secret, userId } = await enrolledCompany();
    const mfa = await logIn(email);
    expect(mfa.enrollment).toBeNull();
    expect(await pendingEnrollment(deps(), mfa.ticket)).toBeNull();
    const done = await verifyMfaCode(deps(), mfa.ticket, totpNow(secret), null);
    expect(done).toMatchObject({ status: "signed_in", userId, recoveryCodes: null });
  });

  it("accetta ±30 secondi di sfasamento dell'orologio, non di più", async () => {
    const { email, secret } = await enrolledCompany();
    secondsLater(30); // il passo precedente non deve essere quello usato per l'attivazione
    const base = base32Decode(secret)!;
    const mfa = await logIn(email);
    const tooOld = hotp(base, totpStep(clock) - 2);
    expect(await verifyMfaCode(deps(), mfa.ticket, tooOld, null)).toMatchObject({
      status: "wrong_code",
    });
    const slightlyOld = hotp(base, totpStep(clock) - 1);
    expect(await verifyMfaCode(deps(), mfa.ticket, slightlyOld, null)).toMatchObject({
      status: "signed_in",
    });
  });

  it("lo stesso codice non vale due volte (anche in un nuovo accesso)", async () => {
    const { email, secret } = await enrolledCompany();
    const code = totpNow(secret);
    const first = await logIn(email);
    expect(await verifyMfaCode(deps(), first.ticket, code, null)).toMatchObject({
      status: "signed_in",
    });
    const second = await logIn(email);
    expect(await verifyMfaCode(deps(), second.ticket, code, null)).toMatchObject({
      status: "wrong_code",
    });
    secondsLater(30);
    expect(await verifyMfaCode(deps(), second.ticket, totpNow(secret), null)).toMatchObject({
      status: "signed_in",
    });
  });

  it("5 tentativi: al 6° il biglietto è bloccato anche con il codice giusto", async () => {
    const { email, secret } = await enrolledCompany();
    const mfa = await logIn(email);
    const code = totpNow(secret);
    for (let left = 4; left >= 0; left--) {
      expect(await verifyMfaCode(deps(), mfa.ticket, wrong(code), null)).toEqual({
        status: "wrong_code",
        attemptsLeft: left,
        enrollment: null,
      });
    }
    expect(await verifyMfaCode(deps(), mfa.ticket, code, null)).toEqual({ status: "expired" });
  });

  it("il passo in più scade dopo 10 minuti e vale una volta sola", async () => {
    const { email, secret } = await enrolledCompany();
    const mfa = await logIn(email);
    secondsLater(10 * 60);
    expect(await verifyMfaCode(deps(), mfa.ticket, totpNow(secret), null)).toEqual({
      status: "expired",
    });

    const next = await logIn(email);
    expect(await verifyMfaCode(deps(), next.ticket, totpNow(secret), null)).toMatchObject({
      status: "signed_in",
    });
    secondsLater(30);
    expect(await verifyMfaCode(deps(), next.ticket, totpNow(secret), null)).toEqual({
      status: "expired",
    });
  });

  it("codice di recupero: fa entrare una volta sola, con una riga di audit", async () => {
    const { email, userId, recoveryCodes } = await enrolledCompany();
    const [code] = recoveryCodes;
    const first = await logIn(email);
    expect(await redeemRecoveryCode(deps(), first.ticket, code!, null)).toMatchObject({
      status: "signed_in",
      userId,
    });
    const second = await logIn(email);
    expect(await redeemRecoveryCode(deps(), second.ticket, code!, null)).toEqual({
      status: "wrong_code",
      attemptsLeft: 4,
      enrollment: null,
    });
    expect(await auditActions(userId)).toEqual(["auth.mfa_enrolled", "auth.recovery_code_used"]);
  });

  it("i codici di recupero di un altro utente non valgono", async () => {
    const a = await enrolledCompany();
    const b = await enrolledCompany();
    const mfa = await logIn(a.email);
    expect(await redeemRecoveryCode(deps(), mfa.ticket, b.recoveryCodes[0]!, null)).toMatchObject({
      status: "wrong_code",
    });
  });

  it("durante l'attivazione i codici di recupero non servono", async () => {
    const { result } = await signUp();
    if (result.status !== "mfa_required") throw new Error(result.status);
    expect(await redeemRecoveryCode(deps(), result.ticket, "abcde-fgh23", null)).toMatchObject({
      status: "wrong_code",
    });
  });

  it("account sospeso tra il codice email e il secondo fattore: niente sessione", async () => {
    const { email, secret, userId } = await enrolledCompany();
    const mfa = await logIn(email);
    await pool.query(`update users set status = 'suspended' where id = $1`, [userId]);
    expect(await verifyMfaCode(deps(), mfa.ticket, totpNow(secret), null)).toEqual({
      status: "account_unavailable",
    });
  });

  it("gli accessi dei moderatori con 2FA finiscono nel log di audit con l'IP pseudonimizzato", async () => {
    const { email, secret, userId } = await enrolledCompany();
    await pool.query(`update users set role = 'moderator' where id = $1`, [userId]);
    const mfa = await logIn(email);
    const ip = "203.0.113.9";
    expect(await verifyMfaCode(deps(), mfa.ticket, totpNow(secret), ip)).toMatchObject({
      status: "signed_in",
      role: "moderator",
    });
    const { rows } = await pool.query(
      `select ip_hash from audit_log where actor_id = $1 and action = 'auth.login'`,
      [userId],
    );
    expect(rows.map((r) => r.ip_hash)).toEqual([await keys.mac(ip, "ip")]);
  });

  it("la pulizia elimina i biglietti del secondo fattore scaduti", async () => {
    const { email } = await enrolledCompany();
    const mfa = await logIn(email);
    secondsLater(11 * 60);
    await deleteExpiredAuthRows(deps());
    const { rows } = await pool.query(
      `select count(*)::int as n from auth_mfa_tickets where id = $1`,
      [hashToken(mfa.ticket)],
    );
    expect(rows[0].n).toBe(0);
  });

  it("azzeramento da admin: sessioni chiuse, al prossimo accesso si riattiva la 2FA", async () => {
    const { email, userId, recoveryCodes } = await enrolledCompany();
    const { rows } = await pool.query(
      `select count(*)::int as n from auth_sessions where user_id = $1`,
      [userId],
    );
    expect(rows[0].n).toBe(1);

    expect(await resetSecondFactor(pool, userId, clock)).toBe(true);
    const after = await pool.query(
      `select (select count(*) from auth_sessions where user_id = $1)::int as s,
              (select count(*) from auth_recovery_codes where user_id = $1)::int as r,
              (select count(*) from auth_totp where user_id = $1)::int as t`,
      [userId],
    );
    expect(after.rows[0]).toEqual({ s: 0, r: 0, t: 0 });
    const audit = await pool.query(
      `select actor_id from audit_log where target_id = $1 and action = 'auth.mfa_reset'`,
      [userId],
    );
    expect(audit.rows).toEqual([{ actor_id: "system:mfa-reset" }]);

    const mfa = await logIn(email);
    expect(mfa.enrollment).not.toBeNull();
    expect(await redeemRecoveryCode(deps(), mfa.ticket, recoveryCodes[0]!, null)).toMatchObject({
      status: "wrong_code",
    });
    expect(await resetSecondFactor(pool, randomUUID(), clock)).toBe(false);
  });

  it("biglietti inventati o vuoti non passano", async () => {
    expect(await verifyMfaCode(deps(), "biglietto-inventato", "123456", null)).toEqual({
      status: "expired",
    });
    expect(await redeemRecoveryCode(deps(), "", "abcde-fgh23", null)).toEqual({
      status: "expired",
    });
    expect(await pendingEnrollment(deps(), "biglietto-inventato")).toBeNull();
  });
});
