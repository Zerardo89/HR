/**
 * Importa i comuni nel DB (idempotente). Uso: DATABASE_URL=postgres://… pnpm geo:import [data/municipalities.csv]
 */
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { parseNormalizedMunicipalities } from "../src/modules/geo/domain";
import { importMunicipalities } from "../src/modules/geo/server/import-municipalities";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL mancante.");
  const file = process.argv[2] ?? "data/municipalities.csv";
  const { rows, errors } = parseNormalizedMunicipalities(readFileSync(file, "utf8"));
  if (errors.length > 0) {
    console.error(`${errors.length} righe non valide (import annullato):`);
    for (const e of errors.slice(0, 20)) console.error(`  riga ${e.line}: ${e.message}`);
    process.exitCode = 1;
    return;
  }
  const pool = new Pool({ connectionString: url, max: 1 });
  try {
    const s = await importMunicipalities(pool, rows);
    console.log(
      `Importati: ${s.regions} regioni, ${s.provinces} province, ${s.municipalities} comuni.`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((e: Error) => {
  console.error("Import fallito:", e.message);
  process.exitCode = 1;
});
