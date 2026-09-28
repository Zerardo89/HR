import { randomUUID } from "node:crypto";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseErasedUserIds } from "@/modules/privacy/domain";
import { eraseAccount, reapplyErasures } from "@/modules/privacy/server/erasure";
import { fileErasureLedger } from "@/modules/privacy/server/ledger";
import { DATABASE_URL } from "./db";

// Test di accettazione WP-027 (ADR-0014): registro delle cancellazioni e ripetizione dopo un ripristino.

let pool: Pool;
const created: string[] = [];
const clock = new Date(Math.floor(Date.now() / 1000) * 1000);

async function user(): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `insert into users (id, role, email_bidx, email_enc, dek_wrapped, key_version, adult_declared_at)
     values ($1, 'worker', $2, 'v1.finto', 'chiave-finta', 1, now())`,
    [id, `bidx-finto-${id}`],
  );
  created.push(id);
  return id;
}

const state = async (id: string) =>
  (await pool.query(`select status, dek_wrapped from users where id = $1`, [id])).rows[0];

describe.skipIf(!DATABASE_URL)("ripristino da backup (WP-027, ADR-0014)", () => {
  beforeAll(() => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 2 });
  });
  afterAll(async () => {
    await pool.query(`delete from users where id = any($1::uuid[])`, [created]);
    await pool?.end();
  });

  it("ogni cancellazione finisce nel registro fuori dal DB (solo l'id, file leggibile solo dall'app)", async () => {
    const file = join(await mkdtemp(join(tmpdir(), "registro-")), "cancellazioni.jsonl");
    const deps = { db: drizzle(pool), now: () => clock, ledger: fileErasureLedger(file) };
    const [a, b] = [await user(), await user()];
    await eraseAccount(deps, a, "self");
    await eraseAccount(deps, b, "retention");
    await eraseAccount(deps, b, "retention"); // già cancellato: nessuna riga in più
    const text = await readFile(file, "utf8");
    expect(parseErasedUserIds(text)).toEqual([a, b]);
    expect(text.trim().split("\n")).toHaveLength(2);
    expect((await stat(file)).mode & 0o777).toBe(0o600);
  });

  it("se il registro non si scrive, la cancellazione vale lo stesso", async () => {
    const id = await user();
    const deps = {
      db: drizzle(pool),
      now: () => clock,
      ledger: async () => {
        throw new Error("disco pieno");
      },
    };
    expect(await eraseAccount(deps, id, "self")).toEqual({ status: "deleted" });
    expect(await state(id)).toMatchObject({ status: "deleted", dek_wrapped: null });
  });

  it("dopo il ripristino: chi risulta di nuovo attivo si ricancella; il resto si salta", async () => {
    const restored = await user(); // cancellato dopo il backup: nel DB ripristinato è di nuovo attivo
    const gone = await user();
    await eraseAccount({ db: drizzle(pool), now: () => clock }, gone, "self");
    const unknown = randomUUID(); // creato e cancellato dopo il backup: nel DB ripristinato non esiste

    expect(
      await reapplyErasures({ db: drizzle(pool), now: () => clock }, [restored, gone, unknown]),
    ).toEqual({ erased: 1, alreadyGone: 2 });
    expect(await state(restored)).toMatchObject({ status: "deleted", dek_wrapped: null });
    const audit = await pool.query(
      `select actor_id, purpose from audit_log where action = 'account.delete' and target_id = $1`,
      [restored],
    );
    expect(audit.rows).toEqual([{ actor_id: "system:restore", purpose: "restore" }]);
  });
});
