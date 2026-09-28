/**
 * Dopo un ripristino da backup (ADR-0014, docs/runbook/RIPRISTINO.md): ripete le cancellazioni degli account
 * avvenute dopo la data del backup, leggendo il registro delle cancellazioni e/o il log dell'app (righe JSON con
 * `"event":"account.erased"`). Stampa i conteggi; il log dell'app registra ogni cancellazione come sempre (solo l'id).
 * Uso: DATABASE_URL=postgres://… pnpm privacy:reapply-erasures <registro.jsonl> [log…]
 */
import { readFile } from "node:fs/promises";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { parseErasedUserIds } from "../src/modules/privacy/domain";
import { reapplyErasures } from "../src/modules/privacy/server/erasure";

const url = process.env.DATABASE_URL;
const files = process.argv.slice(2);
if (!url || files.length === 0) {
  console.error("Uso: DATABASE_URL=… pnpm privacy:reapply-erasures <registro.jsonl> [log…]");
  process.exit(1);
}

async function main(connectionString: string) {
  const texts = await Promise.all(files.map((f) => readFile(f, "utf8")));
  const ids = parseErasedUserIds(texts.join("\n"));
  const pool = new Pool({ connectionString, max: 1 });
  try {
    const result = await reapplyErasures({ db: drizzle(pool), now: () => new Date() }, ids);
    console.log(
      `Cancellazioni nel registro: ${ids.length}. Ripetute ora: ${result.erased}. Già assenti: ${result.alreadyGone}.`,
    );
  } catch (error) {
    console.error("Ripetizione interrotta:", (error as Error).message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main(url);
