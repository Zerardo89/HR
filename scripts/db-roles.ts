/**
 * Crea o aggiorna i ruoli del database (WP-027, docs/04 §5 e §7): `hr_app` per l'app web, `hr_worker` per i job.
 * Lo esegue la pipeline di deploy con l'utente proprietario, subito dopo `pnpm db:migrate` (idempotente).
 * Uso: DATABASE_URL=postgres://proprietario@… DB_APP_PASSWORD=… DB_WORKER_PASSWORD=… pnpm db:roles
 * Poi l'app web si collega come `hr_app` e il worker come `hr_worker` (ognuno col proprio DATABASE_URL).
 * Le password arrivano dai segreti del server: mai nel repo, mai nei log.
 */
import { Client } from "pg";
import { applyDbRoles } from "../src/lib/db/roles";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL mancante (serve l'utente proprietario delle tabelle).");
  process.exit(1);
}
const app = process.env.DB_APP_ROLE ?? "hr_app";
const worker = process.env.DB_WORKER_ROLE ?? "hr_worker";

async function main(connectionString: string) {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const owner = (await client.query<{ u: string }>("select current_user as u")).rows[0]!.u;
    await applyDbRoles(
      client,
      { owner, app, worker },
      { app: process.env.DB_APP_PASSWORD, worker: process.env.DB_WORKER_PASSWORD },
    );
    for (const [role, pwd] of [
      [app, process.env.DB_APP_PASSWORD],
      [worker, process.env.DB_WORKER_PASSWORD],
    ] as const) {
      console.log(
        `${role}: ${pwd ? "pronto (può collegarsi)" : "senza password: non può collegarsi"}`,
      );
    }
  } catch (error) {
    console.error("Ruoli non applicati:", (error as Error).message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

void main(url);
