/**
 * Importa le mansioni nel DB (idempotente). Uso: DATABASE_URL=postgres://… pnpm taxonomy:import [data/occupations.csv]
 */
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { parseOccupationsCsv } from "../src/modules/taxonomy/domain";
import { importOccupations } from "../src/modules/taxonomy/server/import-occupations";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL mancante.");
  const file = process.argv[2] ?? "data/occupations.csv";
  const { rows, errors } = parseOccupationsCsv(readFileSync(file, "utf8"));
  if (errors.length > 0) {
    console.error(`${errors.length} righe non valide (import annullato):`);
    for (const e of errors.slice(0, 20)) console.error(`  riga ${e.line}: ${e.message}`);
    process.exitCode = 1;
    return;
  }
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    const s = await importOccupations(pool, rows);
    console.log(`Mansioni: ${s.inserted} nuove, ${s.updated} aggiornate, ${rows.length} nel file.`);
    if (s.notInFile.length > 0) {
      console.warn(`Nel DB ma non più nel file (non cancellate): ${s.notInFile.join(", ")}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((e: Error) => {
  console.error("Import fallito:", e.message);
  process.exitCode = 1;
});
