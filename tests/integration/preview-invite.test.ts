import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { FileKeyProvider } from "@/lib/crypto";
import type { Mailer, MailMessage } from "@/lib/mail";
import type { IdentityDeps } from "@/modules/identity/server/deps";
import {
  completeSignup,
  requestLoginCode,
  verifyLoginCode,
} from "@/modules/identity/server/sign-in";
import { DATABASE_URL } from "./db";

// Test di accettazione WP-010b: in anteprima ci si registra solo con il codice invito dei tester.
// Scritti dall'architetto: NON modificarli per farli passare.

const keys = FileKeyProvider.fromFiles(
  "tests/fixtures/test-kek.b64",
  "tests/fixtures/test-blind-index.b64",
);
const INVITE = "TSTR-2026-ABCD";

let pool: Pool;
let sent: MailMessage[];
const createdEmails: string[] = [];

const recordingMailer: Mailer = {
  async send(message) {
    sent.push(message);
  },
};

function deps(previewInviteCodes?: readonly string[]): IdentityDeps {
  return {
    db: drizzle(pool),
    keys,
    mailer: recordingMailer,
    now: () => new Date("2026-10-05T08:00:00Z"),
    appUrl: "http://localhost:3000",
    previewInviteCodes,
  };
}

function newEmail(): string {
  const email = `tester.finto+${randomUUID().slice(0, 8)}@esempio.it`;
  createdEmails.push(email);
  return email;
}

function lastCode(): string {
  const match = /\b(\d{6})\b/.exec(sent.at(-1)?.text ?? "");
  if (!match) throw new Error("nessun codice nell'ultima email");
  return match[1]!;
}

async function ticketFor(email: string, d: IdentityDeps): Promise<string> {
  await requestLoginCode(d, email);
  const verified = await verifyLoginCode(d, email, lastCode(), null);
  if (verified.status !== "signup_required") throw new Error(verified.status);
  return verified.ticket;
}

const base = { role: "worker" as const, adult: "on" as const, legal: "on" as const };

describe.skipIf(!DATABASE_URL)("anteprima con codice invito (WP-010b)", () => {
  beforeAll(() => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 3 });
  });

  beforeEach(() => {
    sent = [];
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

  it("senza codice o con un codice sbagliato non si crea l'account, e il biglietto resta valido", async () => {
    const d = deps([INVITE]);
    const email = newEmail();
    const ticket = await ticketFor(email, d);

    expect(await completeSignup(d, { ...base, email }, ticket)).toEqual({
      status: "invite_required",
    });
    expect(
      await completeSignup(d, { ...base, email, inviteCode: "TSTR-2026-ABCE" }, ticket),
    ).toEqual({ status: "invite_required" });
    const bidx = await keys.blindIndex(email, "email");
    const users = await pool.query(`select 1 from users where email_bidx = $1`, [bidx]);
    expect(users.rowCount).toBe(0);

    // Con il codice giusto si entra: lo stesso biglietto vale ancora.
    expect(await completeSignup(d, { ...base, email, inviteCode: INVITE }, ticket)).toMatchObject({
      status: "signed_in",
      role: "worker",
    });
  });

  it("il codice si può scrivere in minuscolo, con spazi o senza trattini", async () => {
    const d = deps([INVITE]);
    const email = newEmail();
    const ticket = await ticketFor(email, d);
    expect(
      await completeSignup(d, { ...base, email, inviteCode: " tstr 2026abcd " }, ticket),
    ).toMatchObject({ status: "signed_in" });
  });

  it("vale qualsiasi codice dell'elenco", async () => {
    const d = deps(["PRIMO-CODICE-1", INVITE]);
    const email = newEmail();
    const ticket = await ticketFor(email, d);
    expect(await completeSignup(d, { ...base, email, inviteCode: INVITE }, ticket)).toMatchObject({
      status: "signed_in",
    });
  });

  it("chi ha già un account entra in anteprima senza codice", async () => {
    const email = newEmail();
    const open = deps();
    await completeSignup(open, { ...base, email }, await ticketFor(email, open));

    const d = deps([INVITE]);
    await requestLoginCode(d, email);
    expect(await verifyLoginCode(d, email, lastCode(), null)).toMatchObject({
      status: "signed_in",
    });
  });

  it("fuori dall'anteprima la registrazione non chiede il codice (nessuna regressione)", async () => {
    const d = deps();
    const email = newEmail();
    const ticket = await ticketFor(email, d);
    expect(await completeSignup(d, { ...base, email }, ticket)).toMatchObject({
      status: "signed_in",
    });
  });
});
