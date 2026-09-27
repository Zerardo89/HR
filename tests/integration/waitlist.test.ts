import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { decryptPii, dekContextFor, FileKeyProvider } from "@/lib/crypto";
import type { Mailer, MailMessage } from "@/lib/mail";
import type { WaitlistInput } from "@/modules/waitlist/domain";
import type { WaitlistDeps } from "@/modules/waitlist/server/deps";
import {
  confirmWaitlist,
  deleteUnconfirmedWaitlist,
  joinWaitlist,
} from "@/modules/waitlist/server/waitlist";
import { DATABASE_URL } from "./db";

// Test di accettazione WP-009 (lista d'attesa, doppia conferma) sul DB reale. NON modificarli per farli passare.

const keys = FileKeyProvider.fromFiles(
  "tests/fixtures/test-kek.b64",
  "tests/fixtures/test-blind-index.b64",
);

let pool: Pool;
let clock: Date;
let sent: MailMessage[];
const emails: string[] = [];

const mailer: Mailer = {
  async send(message) {
    sent.push(message);
  },
};

const deps = (over: Partial<WaitlistDeps> = {}): WaitlistDeps => ({
  db: drizzle(pool),
  keys,
  mailer,
  now: () => clock,
  appUrl: "http://localhost:3000",
  ...over,
});

const later = (minutes: number) => (clock = new Date(clock.getTime() + minutes * 60_000));

function input(over: Partial<WaitlistInput> = {}): WaitlistInput {
  const email = `lista.finta+${randomUUID().slice(0, 8)}@esempio.it`;
  emails.push(email);
  return { email, kind: "worker", province: undefined, consent: "on", ...over };
}

function tokenFromLastEmail(): string {
  const match = /\/lista-attesa\/conferma\?t=([A-Za-z0-9_-]{43})/.exec(sent.at(-1)?.text ?? "");
  if (!match) throw new Error("nessun link di conferma nell'ultima email");
  return match[1]!;
}

async function rowFor(email: string) {
  const { rows } = await pool.query(`select * from waitlist where email_bidx = $1`, [
    await keys.blindIndex(email, "email"),
  ]);
  return rows[0];
}

describe.skipIf(!DATABASE_URL)("lista d'attesa (WP-009)", () => {
  beforeAll(() => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 3 });
  });
  beforeEach(() => {
    sent = [];
    clock = new Date("2026-10-05T08:00:00Z");
  });
  afterEach(async () => {
    for (const email of emails.splice(0)) {
      await pool.query(`delete from waitlist where email_bidx = $1`, [
        await keys.blindIndex(email, "email"),
      ]);
    }
  });
  afterAll(async () => {
    await pool?.end();
  });

  it("iscrizione: email cifrata e leggibile solo con decryptPii; nessun dato in chiaro; link con pulsante", async () => {
    const data = input({ kind: "company" });
    expect(await joinWaitlist(deps(), data)).toEqual({ status: "sent" });
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe(data.email);
    expect(sent[0]!.text).toContain("http://localhost:3000/lista-attesa/conferma?t=");

    const row = await rowFor(data.email);
    expect(row.kind).toBe("company");
    expect(row.confirmed_at).toBeNull();
    expect(JSON.stringify(row)).not.toContain("lista.finta");
    const tokenRows = await pool.query(`select * from email_action_tokens where waitlist_id = $1`, [
      row.id,
    ]);
    expect(JSON.stringify(tokenRows.rows)).not.toContain(tokenFromLastEmail());

    const email = await decryptPii({
      provider: keys,
      audit: { record: async () => {} },
      actorId: "system:test",
      purpose: "test.waitlist",
      dekWrapped: row.dek_wrapped,
      dekContext: dekContextFor("waitlist", row.id),
      token: row.email_enc,
      location: { table: "waitlist", column: "email_enc", rowId: row.id },
      schema: z.string(),
    });
    expect(email).toBe(data.email);
  });

  it("conferma: una volta sola, con i consensi e le loro versioni", async () => {
    const data = input();
    await joinWaitlist(deps(), data);
    const token = tokenFromLastEmail();
    later(60);
    expect(await confirmWaitlist(deps(), token)).toEqual({ status: "confirmed" });
    expect(await confirmWaitlist(deps(), token)).toEqual({ status: "already_confirmed" });

    const row = await rowFor(data.email);
    expect(row.confirmed_at).toEqual(clock);
    const { rows } = await pool.query(
      `select type, version from consents where waitlist_id = $1 order by type`,
      [row.id],
    );
    expect(rows.map((r) => r.type)).toEqual(["privacy_notice", "waitlist_launch"]);
  });

  it("link scaduto o inventato → non valido", async () => {
    const data = input();
    await joinWaitlist(deps(), data);
    const token = tokenFromLastEmail();
    later(7 * 24 * 60);
    expect(await confirmWaitlist(deps(), token)).toEqual({ status: "invalid" });
    expect(await confirmWaitlist(deps(), "A".repeat(43))).toEqual({ status: "invalid" });
    expect((await rowFor(data.email)).confirmed_at).toBeNull();
  });

  it("stessa risposta se l'email è già iscritta; nessuna riga doppia; niente email a raffica", async () => {
    const data = input();
    await joinWaitlist(deps(), data);
    later(5);
    expect(await joinWaitlist(deps(), { ...data, kind: "company" })).toEqual({ status: "sent" });
    expect(sent).toHaveLength(1); // meno di 10 minuti: nessuna nuova email
    later(10);
    expect(await joinWaitlist(deps(), data)).toEqual({ status: "sent" });
    expect(sent).toHaveLength(2);

    const { rows } = await pool.query(
      `select count(*)::int as n from waitlist where email_bidx = $1`,
      [await keys.blindIndex(data.email, "email")],
    );
    expect(rows[0].n).toBe(1);
    expect((await rowFor(data.email)).kind).toBe("worker"); // la seconda richiesta non cambia i dati
  });

  it("dopo la conferma, una nuova iscrizione non invia altre email", async () => {
    const data = input();
    await joinWaitlist(deps(), data);
    await confirmWaitlist(deps(), tokenFromLastEmail());
    later(60);
    expect(await joinWaitlist(deps(), data)).toEqual({ status: "sent" });
    expect(sent).toHaveLength(1);
  });

  it("se l'email non parte lo si dice (senza rivelare altro)", async () => {
    const failing: Mailer = {
      async send() {
        throw new Error("SMTP giù");
      },
    };
    expect(await joinWaitlist(deps({ mailer: failing }), input())).toEqual({
      status: "send_failed",
    });
  });

  it("le iscrizioni non confermate si cancellano dopo 7 giorni, quelle confermate restano", async () => {
    const pending = input();
    const confirmed = input();
    await joinWaitlist(deps(), pending);
    await joinWaitlist(deps(), confirmed);
    await confirmWaitlist(deps(), tokenFromLastEmail());
    later(7 * 24 * 60 + 1);
    expect(await deleteUnconfirmedWaitlist(deps())).toBeGreaterThanOrEqual(1);
    expect(await rowFor(pending.email)).toBeUndefined();
    expect(await rowFor(confirmed.email)).toBeDefined();
  });
});
