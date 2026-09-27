import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { decryptPii, dekContextFor, FileKeyProvider, type AuditEvent } from "@/lib/crypto";
import type { Mailer, MailMessage } from "@/lib/mail";
import { base32Decode, totpStep } from "@/modules/identity/domain";
import type { IdentityDeps } from "@/modules/identity/server/deps";
import { verifyMfaCode } from "@/modules/identity/server/mfa";
import {
  deleteExpiredAuthRows,
  deleteSession,
  validateSessionToken,
} from "@/modules/identity/server/sessions";
import {
  completeSignup,
  requestLoginCode,
  verifyLoginCode,
} from "@/modules/identity/server/sign-in";
import { hashToken } from "@/modules/identity/server/tokens";
import { hotp } from "@/modules/identity/server/totp";
import { DATABASE_URL } from "./db";

// Test di accettazione WP-008 (ADR-0013) sul DB reale. Scritti dall'architetto: NON modificarli per farli passare.

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

function deps(overrides: Partial<IdentityDeps> = {}): IdentityDeps {
  return {
    db: drizzle(pool),
    keys,
    mailer: recordingMailer,
    now: () => clock,
    appUrl: "http://localhost:3000",
    ...overrides,
  };
}

const minutesLater = (n: number) => (clock = new Date(clock.getTime() + n * 60_000));

function newEmail(): string {
  const email = `persona.finta+${randomUUID().slice(0, 8)}@esempio.it`;
  createdEmails.push(email);
  return email;
}

function lastCode(): string {
  const text = sent.at(-1)?.text ?? "";
  const match = /\b(\d{6})\b/.exec(text);
  if (!match) throw new Error("nessun codice nell'ultima email");
  return match[1]!;
}

const otherCode = (code: string) => String((Number(code) + 1) % 1_000_000).padStart(6, "0");

/** Cerca `needle` in TUTTE le colonne di testo di tutte le tabelle: deve comparire zero volte. */
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

async function signUpWorker(email: string) {
  await requestLoginCode(deps(), email);
  const verified = await verifyLoginCode(deps(), email, lastCode(), null);
  if (verified.status !== "signup_required")
    throw new Error(`atteso signup_required: ${verified.status}`);
  const result = await completeSignup(
    deps(),
    { email, role: "worker", adult: "on", legal: "on" },
    verified.ticket,
  );
  if (result.status !== "signed_in") throw new Error(`atteso signed_in: ${result.status}`);
  return result;
}

describe.skipIf(!DATABASE_URL)("accesso con codice via email (WP-008)", () => {
  beforeAll(() => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 3 });
  });

  beforeEach(() => {
    sent = [];
    clock = new Date("2026-10-05T08:00:00Z");
  });

  afterEach(async () => {
    for (const email of createdEmails.splice(0)) {
      const bidx = await keys.blindIndex(email, "email");
      await pool.query(`delete from users where email_bidx = $1`, [bidx]);
      await pool.query(`delete from auth_otp_challenges where email_bidx = $1`, [bidx]);
      await pool.query(`delete from auth_signup_tickets where email_bidx = $1`, [bidx]);
    }
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("invia un codice di 6 cifre; nel DB non ci sono né l'email né il codice", async () => {
    const email = newEmail();
    expect(await requestLoginCode(deps(), email)).toEqual({ status: "sent" });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe(email);
    const code = lastCode();
    expect(sent[0]!.subject).toContain(code);

    expect(await tablesContaining(email)).toEqual([]);
    expect(await tablesContaining("persona.finta")).toEqual([]);
    const { rows } = await pool.query(`select * from auth_otp_challenges where email_bidx = $1`, [
      await keys.blindIndex(email, "email"),
    ]);
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows[0])).not.toContain(code);
  });

  it("stessa risposta per email registrate e non registrate", async () => {
    const registered = newEmail();
    await signUpWorker(registered);
    expect(await requestLoginCode(deps(), registered)).toEqual({ status: "sent" });
    expect(await requestLoginCode(deps(), newEmail())).toEqual({ status: "sent" });
  });

  it("per email: il 4° codice in 15 minuti viene rifiutato e non parte nessuna email", async () => {
    const email = newEmail();
    for (let i = 0; i < 3; i++) {
      expect(await requestLoginCode(deps(), email)).toEqual({ status: "sent" });
      minutesLater(1);
    }
    expect(await requestLoginCode(deps(), email)).toEqual({ status: "rate_limited" });
    expect(sent).toHaveLength(3);
    minutesLater(15);
    expect(await requestLoginCode(deps(), email)).toEqual({ status: "sent" });
  });

  it("5 tentativi: al 6° il codice è bloccato anche se giusto", async () => {
    const email = newEmail();
    await requestLoginCode(deps(), email);
    const code = lastCode();
    for (let left = 4; left >= 0; left--) {
      expect(await verifyLoginCode(deps(), email, otherCode(code), null)).toEqual({
        status: "wrong_code",
        attemptsLeft: left,
      });
    }
    expect(await verifyLoginCode(deps(), email, code, null)).toEqual({ status: "expired" });
  });

  it("il codice scade dopo 10 minuti", async () => {
    const email = newEmail();
    await requestLoginCode(deps(), email);
    const code = lastCode();
    minutesLater(10);
    expect(await verifyLoginCode(deps(), email, code, null)).toEqual({ status: "expired" });
  });

  it("vale solo l'ultimo codice inviato, e una volta sola", async () => {
    const email = newEmail();
    await requestLoginCode(deps(), email);
    const first = lastCode();
    minutesLater(1);
    await requestLoginCode(deps(), email);
    const second = lastCode();
    if (first !== second) {
      expect(await verifyLoginCode(deps(), email, first, null)).toMatchObject({
        status: "wrong_code",
      });
    }
    expect(await verifyLoginCode(deps(), email, second, null)).toMatchObject({
      status: "signup_required",
    });
    expect(await verifyLoginCode(deps(), email, second, null)).toEqual({ status: "expired" });
  });

  it("se l'email non parte, il codice non resta valido", async () => {
    const email = newEmail();
    const failing: Mailer = {
      async send() {
        throw new Error("SMTP giù");
      },
    };
    expect(await requestLoginCode(deps({ mailer: failing }), email)).toEqual({
      status: "send_failed",
    });
    const { rows } = await pool.query(
      `select count(*)::int as n from auth_otp_challenges where email_bidx = $1 and consumed_at is null`,
      [await keys.blindIndex(email, "email")],
    );
    expect(rows[0].n).toBe(0);
  });

  it("registrazione: email cifrata (leggibile solo con decryptPii + audit), consensi salvati, nessun dato in chiaro", async () => {
    const email = newEmail();
    const result = await signUpWorker(email);
    expect(result.role).toBe("worker");

    expect(await tablesContaining(email)).toEqual([]);
    const { rows } = await pool.query(`select * from users where id = $1`, [result.userId]);
    const user = rows[0];
    expect(user.role).toBe("worker");
    expect(user.adult_declared_at).toBeInstanceOf(Date);

    const events: AuditEvent[] = [];
    const decrypted = await decryptPii({
      provider: keys,
      audit: { record: async (e) => void events.push(e) },
      actorId: result.userId,
      purpose: "test.self-view",
      dekWrapped: user.dek_wrapped,
      dekContext: dekContextFor("users", result.userId),
      token: user.email_enc,
      location: { table: "users", column: "email_enc", rowId: result.userId },
      schema: z.string(),
    });
    expect(decrypted).toBe(email);
    expect(events).toHaveLength(1);

    const consents = await pool.query(
      `select type, version from consents where user_id = $1 order by type`,
      [result.userId],
    );
    expect(consents.rows.map((r) => r.type)).toEqual(["privacy_notice", "terms"]);
    expect(consents.rows.every((r) => r.version.startsWith("bozza-"))).toBe(true);
  });

  it("il biglietto di registrazione vale una volta sola e solo per la sua email", async () => {
    const email = newEmail();
    await requestLoginCode(deps(), email);
    const verified = await verifyLoginCode(deps(), email, lastCode(), null);
    if (verified.status !== "signup_required") throw new Error(verified.status);

    const intruder = newEmail();
    const input = { role: "worker" as const, adult: "on" as const, legal: "on" as const };
    expect(await completeSignup(deps(), { ...input, email: intruder }, verified.ticket)).toEqual({
      status: "expired",
    });
    expect(await completeSignup(deps(), { ...input, email }, verified.ticket)).toMatchObject({
      status: "signed_in",
    });
    expect(await completeSignup(deps(), { ...input, email }, verified.ticket)).toEqual({
      status: "expired",
    });
  });

  it("il biglietto scade dopo 30 minuti", async () => {
    const email = newEmail();
    await requestLoginCode(deps(), email);
    const verified = await verifyLoginCode(deps(), email, lastCode(), null);
    if (verified.status !== "signup_required") throw new Error(verified.status);
    minutesLater(30);
    expect(
      await completeSignup(
        deps(),
        { email, role: "company_member", adult: "on", legal: "on" },
        verified.ticket,
      ),
    ).toEqual({ status: "expired" });
  });

  it("accesso di un utente registrato → sessione; nel DB solo l'hash del token", async () => {
    const email = newEmail();
    const { userId } = await signUpWorker(email);
    await requestLoginCode(deps(), email);
    const result = await verifyLoginCode(deps(), email, lastCode(), null);
    expect(result).toMatchObject({ status: "signed_in", userId, role: "worker" });
    if (result.status !== "signed_in") return;

    const { token } = result.session;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const { rows } = await pool.query(`select id from auth_sessions where user_id = $1`, [userId]);
    expect(rows.map((r) => r.id)).toContain(hashToken(token));
    expect(rows.map((r) => r.id)).not.toContain(token);

    expect(await validateSessionToken(deps(), token)).toMatchObject({
      user: { id: userId, role: "worker" },
    });
    expect(await validateSessionToken(deps(), "token-inventato")).toBeNull();

    await deleteSession(deps(), token);
    expect(await validateSessionToken(deps(), token)).toBeNull();
  });

  it("sessione: rinnovo sotto metà durata, rifiutata (e cancellata) dopo la scadenza", async () => {
    const { session } = await signUpWorker(newEmail());
    minutesLater(16 * 24 * 60); // 16 giorni: ne restano 14 < 15 → rinnovo a 30 giorni da adesso
    const renewed = await validateSessionToken(deps(), session.token);
    expect(renewed?.expiresAt.getTime()).toBe(clock.getTime() + 30 * 24 * 60 * 60_000);

    minutesLater(31 * 24 * 60);
    expect(await validateSessionToken(deps(), session.token)).toBeNull();
    const { rows } = await pool.query(
      `select count(*)::int as n from auth_sessions where id = $1`,
      [hashToken(session.token)],
    );
    expect(rows[0].n).toBe(0);
  });

  it("account sospeso: niente sessione, e le sessioni aperte smettono di valere", async () => {
    const email = newEmail();
    const { userId, session } = await signUpWorker(email);
    await pool.query(`update users set status = 'suspended' where id = $1`, [userId]);
    expect(await validateSessionToken(deps(), session.token)).toBeNull();
    await requestLoginCode(deps(), email);
    expect(await verifyLoginCode(deps(), email, lastCode(), null)).toEqual({
      status: "account_unavailable",
    });
  });

  it("gli accessi degli admin finiscono nel log di audit con l'IP pseudonimizzato", async () => {
    const email = newEmail();
    const { userId } = await signUpWorker(email);
    await pool.query(`update users set role = 'admin' where id = $1`, [userId]);
    await requestLoginCode(deps(), email);
    const ip = "203.0.113.7";
    // WP-011b: per gli admin la sessione (e la riga di audit) arriva dopo il secondo fattore.
    const first = await verifyLoginCode(deps(), email, lastCode(), ip);
    if (first.status !== "mfa_required" || !first.enrollment) throw new Error(first.status);
    const code = hotp(base32Decode(first.enrollment.secret)!, totpStep(clock));
    expect(await verifyMfaCode(deps(), first.ticket, code, ip)).toMatchObject({
      status: "signed_in",
      role: "admin",
    });
    const { rows } = await pool.query(
      `select action, ip_hash from audit_log where actor_id = $1 and action = 'auth.login'`,
      [userId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].ip_hash).toBe(await keys.mac(ip, "ip"));
    expect(rows[0].ip_hash).not.toContain(ip);
  });

  it("la pulizia elimina sessioni, biglietti e codici scaduti", async () => {
    const email = newEmail();
    const { session } = await signUpWorker(email);
    await requestLoginCode(deps(), email);
    minutesLater(40 * 24 * 60);
    expect(await deleteExpiredAuthRows(deps())).toBeGreaterThanOrEqual(3);
    const bidx = await keys.blindIndex(email, "email");
    const counts = await pool.query(
      `select (select count(*) from auth_sessions where id = $1)::int as s,
              (select count(*) from auth_otp_challenges where email_bidx = $2)::int as c`,
      [hashToken(session.token), bidx],
    );
    expect(counts.rows[0]).toEqual({ s: 0, c: 0 });
  });
});
