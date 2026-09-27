import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { FileKeyProvider } from "@/lib/crypto";
import type { IdentityDeps } from "@/modules/identity/server/deps";
import {
  confirmTotpEnrollment,
  startTotpEnrollment,
  verifySecondFactor,
} from "@/modules/identity/server/mfa";
import { createSession, validateSessionToken } from "@/modules/identity/server/sessions";
import { hashToken } from "@/modules/identity/server/tokens";
import { totp } from "@/modules/identity/server/totp";
import { DATABASE_URL } from "./db";

// Test di accettazione WP-011b (2FA TOTP) sul DB reale. Scritti dall'architetto: NON modificarli per farli passare.

const keys = FileKeyProvider.fromFiles(
  "tests/fixtures/test-kek.b64",
  "tests/fixtures/test-blind-index.b64",
);
let pool: Pool;
let clock: Date;
const users: string[] = [];

const deps = (): IdentityDeps => ({
  db: drizzle(pool),
  keys,
  mailer: { send: async () => {} },
  now: () => clock,
  appUrl: "http://localhost:3000",
});
const later = (seconds: number) => (clock = new Date(clock.getTime() + seconds * 1000));

function base32Decode(value: string): Buffer {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0;
  let acc = 0;
  const out: number[] = [];
  for (const ch of value) {
    acc = (acc << 5) | alphabet.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((acc >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

async function newUser(role: "company_member" | "worker" = "company_member") {
  const { rows } = await pool.query<{ id: string }>(
    `insert into users (role, email_bidx, email_enc, key_version, adult_declared_at)
     values ($1, $2, 'v1.finto', 1, now()) returning id`,
    [role, `test-bidx-${randomUUID()}`],
  );
  const id = rows[0]!.id;
  users.push(id);
  const { token } = await createSession(deps(), id, role);
  return { id, token };
}

/** Attiva la 2FA per l'utente e restituisce il segreto (come farebbe l'app sul telefono). */
async function enable(userId: string, token: string) {
  const start = await startTotpEnrollment(deps(), userId);
  if (start.status !== "pending") throw new Error(start.status);
  const secret = base32Decode(start.secretBase32);
  const result = await confirmTotpEnrollment(deps(), userId, token, totp(secret, clock));
  if (result.status !== "enabled") throw new Error(result.status);
  return { secret, recoveryCodes: result.recoveryCodes };
}

describe.skipIf(!DATABASE_URL)("verifica in due passaggi (WP-011b)", () => {
  beforeAll(() => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 3 });
  });
  beforeEach(() => {
    clock = new Date("2026-10-05T08:00:00Z");
  });
  afterAll(async () => {
    await pool.query(`delete from users where id = any($1::uuid[])`, [users]);
    await pool?.end();
  });

  it("per le aziende è obbligatoria: la sessione dice che manca", async () => {
    const company = await newUser("company_member");
    expect((await validateSessionToken(deps(), company.token))?.user.mfa).toEqual({
      required: true,
      enabled: false,
      verified: false,
    });
    const worker = await newUser("worker");
    expect((await validateSessionToken(deps(), worker.token))?.user.mfa.required).toBe(false);
  });

  it("attivazione: segreto cifrato (mai in chiaro), stesso segreto se si ricarica la pagina, conferma obbligatoria", async () => {
    const { id, token } = await newUser();
    const first = await startTotpEnrollment(deps(), id);
    const again = await startTotpEnrollment(deps(), id);
    if (first.status !== "pending" || again.status !== "pending") throw new Error("atteso pending");
    expect(again.secretBase32).toBe(first.secretBase32);
    expect(first.uri).toContain(`secret=${first.secretBase32}`);

    const { rows } = await pool.query(
      `select totp_secret_enc, totp_enabled_at from users where id = $1`,
      [id],
    );
    expect(rows[0].totp_secret_enc).not.toContain(first.secretBase32);
    expect(rows[0].totp_secret_enc).not.toContain(
      base32Decode(first.secretBase32).toString("base64"),
    );
    expect(rows[0].totp_enabled_at).toBeNull();

    expect(await confirmTotpEnrollment(deps(), id, token, "000000")).toEqual({
      status: "wrong_code",
    });
    const secret = base32Decode(first.secretBase32);
    const result = await confirmTotpEnrollment(deps(), id, token, totp(secret, clock));
    expect(result.status).toBe("enabled");
    if (result.status !== "enabled") return;
    expect(result.recoveryCodes).toHaveLength(10);
    expect(new Set(result.recoveryCodes).size).toBe(10);

    // La sessione che ha attivato la 2FA è già verificata.
    expect((await validateSessionToken(deps(), token))?.user.mfa).toEqual({
      required: true,
      enabled: true,
      verified: true,
    });
    // Nel DB solo i MAC dei codici di recupero.
    const codes = await pool.query(`select code_mac from auth_recovery_codes where user_id = $1`, [
      id,
    ]);
    expect(codes.rows).toHaveLength(10);
    const stored = JSON.stringify(codes.rows);
    for (const c of result.recoveryCodes) expect(stored).not.toContain(c.replace("-", ""));
  });

  it("nuovo accesso: serve il codice dell'app; lo stesso codice non vale due volte", async () => {
    const { id, token } = await newUser();
    const { secret } = await enable(id, token);
    const usedCode = totp(secret, clock);

    const { token: second } = await createSession(deps(), id, "company_member");
    expect((await validateSessionToken(deps(), second))?.user.mfa.verified).toBe(false);
    expect(await verifySecondFactor(deps(), second, usedCode)).toMatchObject({
      status: "wrong_code",
    });

    later(30);
    expect(await verifySecondFactor(deps(), second, totp(secret, clock))).toEqual({
      status: "verified",
      usedRecoveryCode: false,
    });
    expect((await validateSessionToken(deps(), second))?.user.mfa.verified).toBe(true);
  });

  it("i codici di recupero funzionano una volta sola", async () => {
    const { id, token } = await newUser();
    const { recoveryCodes } = await enable(id, token);
    const code = recoveryCodes[0]!;

    const { token: a } = await createSession(deps(), id, "company_member");
    expect(await verifySecondFactor(deps(), a, code.toLowerCase())).toEqual({
      status: "verified",
      usedRecoveryCode: true,
    });
    const { token: b } = await createSession(deps(), id, "company_member");
    expect(await verifySecondFactor(deps(), b, code)).toMatchObject({ status: "wrong_code" });
  });

  it("5 tentativi sbagliati chiudono la sessione: si riparte dall'email", async () => {
    const { id, token } = await newUser();
    await enable(id, token);
    const { token: s } = await createSession(deps(), id, "company_member");
    for (let left = 4; left >= 1; left--) {
      expect(await verifySecondFactor(deps(), s, "000000")).toEqual({
        status: "wrong_code",
        attemptsLeft: left,
      });
    }
    expect(await verifySecondFactor(deps(), s, "000000")).toEqual({ status: "locked" });
    const { rows } = await pool.query(`select 1 from auth_sessions where id = $1`, [hashToken(s)]);
    expect(rows).toHaveLength(0);
    expect(await verifySecondFactor(deps(), s, "000000")).toEqual({ status: "no_session" });
  });

  it("senza 2FA attiva non c'è secondo passaggio da fare", async () => {
    const { token } = await newUser("worker");
    expect(await verifySecondFactor(deps(), token, "123456")).toEqual({ status: "not_enabled" });
  });
});
