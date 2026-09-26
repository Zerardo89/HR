/**
 * Applica le migrazioni in db/migrations (ADR-0003). In produzione lo esegue solo la pipeline di deploy
 * (docs/04-PRIVACY-SICUREZZA.md §5: niente accesso manuale al DB).
 * Uso: DATABASE_URL=postgres://… pnpm db:migrate
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL mancante.");
  process.exit(1);
}

async function main(connectionString: string) {
  const pool = new Pool({ connectionString, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: "./db/migrations" });
    console.log("Migrazioni applicate.");
  } catch (error) {
    // Solo il messaggio: gli errori di Postgres possono contenere valori nel campo `detail`.
    console.error("Migrazione fallita:", (error as Error).message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void main(url);
