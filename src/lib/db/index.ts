import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { getServerEnv } from "@/lib/env";

/**
 * Connessione al DB (ADR-0003). Il pool si crea al primo uso, così `next build` non richiede un DB.
 * In produzione Postgres non espone porte all'esterno (docs/04-PRIVACY-SICUREZZA.md §5).
 */
let pool: Pool | undefined;
let database: NodePgDatabase | undefined;

export function getPool(): Pool {
  pool ??= new Pool({ connectionString: getServerEnv().DATABASE_URL, max: 10 });
  return pool;
}

export function getDb(): NodePgDatabase {
  database ??= drizzle(getPool());
  return database;
}

export async function pingDb(timeoutMs = 2000): Promise<boolean> {
  try {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), timeoutMs),
    );
    await Promise.race([getPool().query("select 1"), timeout]);
    return true;
  } catch {
    return false;
  }
}
