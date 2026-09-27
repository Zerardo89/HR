import { Pool, type PoolClient } from "pg";

export const DATABASE_URL = process.env.DATABASE_URL;

let pool: Pool | undefined;

function getPool(): Pool {
  if (!DATABASE_URL) throw new Error("DATABASE_URL mancante per i test di integrazione");
  pool ??= new Pool({ connectionString: DATABASE_URL, max: 2 });
  return pool;
}

/** Esegue `fn` in una transazione annullata alla fine: i test non lasciano tracce nel DB. */
export async function inRollback<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("begin");
    return await fn(client);
  } finally {
    await client.query("rollback");
    client.release();
  }
}

/** Esegue `sql` in un savepoint e restituisce l'errore Postgres (o null), senza rompere la transazione. */
export async function expectDbError(c: PoolClient, sql: string, params: unknown[] = []) {
  await c.query("savepoint t");
  try {
    await c.query(sql, params);
    await c.query("release savepoint t");
    return null;
  } catch (e) {
    await c.query("rollback to savepoint t");
    return e as { code?: string; constraint?: string; message: string };
  }
}

export async function closePool(): Promise<void> {
  await pool?.end();
  pool = undefined;
}

/** Dati di riferimento minimi e sintetici (codici ISTAT reali, nessun dato personale). */
export async function seedReference(c: PoolClient): Promise<void> {
  await c.query(
    `insert into regions (code, name) values ('03','Lombardia'), ('08','Emilia-Romagna') on conflict do nothing`,
  );
  await c.query(
    `insert into provinces (code, name, abbreviation, region_code) values
      ('015','Milano','MI','03'), ('098','Lodi','LO','03'), ('033','Piacenza','PC','08')
     on conflict do nothing`,
  );
  await c.query(
    `insert into municipalities (istat_code, name, province_code, region_code, lat, lon) values
      ('015146','Milano','015','03',45.4642,9.1900),
      ('098031','Lodi','098','03',45.3097,9.5037),
      ('033032','Piacenza','033','08',45.0526,9.6934)
     on conflict do nothing`,
  );
  await c.query(`insert into occupations (id, slug, category, label_it, synonyms, isco_code, group_code) values
      (9001,'test-cameriere','ristorazione','Cameriere di sala','{cameriera,"cameriere/a"}','5131','513')`);
}
