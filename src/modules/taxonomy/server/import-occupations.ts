import type { Pool } from "pg";
import type { Occupation } from "../domain";

export type OccupationImportSummary = { inserted: number; updated: number; notInFile: string[] };

/**
 * Importa (upsert per `slug`) le mansioni di data/occupations.csv in una transazione (WP-006). Idempotente.
 * Le mansioni tolte dal file NON si cancellano (offerte e profili le usano): si elencano in `notInFile`.
 */
export async function importOccupations(
  pool: Pool,
  rows: readonly Occupation[],
): Promise<OccupationImportSummary> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    let inserted = 0;
    let updated = 0;
    for (const r of rows) {
      const { rows: result } = await client.query<{ inserted: boolean; changed: boolean }>(
        `insert into occupations (slug, category, label_it, synonyms, isco_code, group_code)
         values ($1, $2, $3, $4, $5, $6)
         on conflict (slug) do update set category = excluded.category, label_it = excluded.label_it,
           synonyms = excluded.synonyms, isco_code = excluded.isco_code, group_code = excluded.group_code
         where (occupations.category, occupations.label_it, occupations.synonyms, occupations.isco_code,
                occupations.group_code)
           is distinct from (excluded.category, excluded.label_it, excluded.synonyms, excluded.isco_code,
                excluded.group_code)
         returning (xmax = 0) as inserted, true as changed`,
        [r.slug, r.category, r.labelIt, r.synonyms, r.iscoCode, r.groupCode],
      );
      if (result[0]?.inserted) inserted++;
      else if (result[0]?.changed) updated++;
    }
    const { rows: stale } = await client.query<{ slug: string }>(
      `select slug from occupations where not (slug = any($1::text[])) order by slug`,
      [rows.map((r) => r.slug)],
    );
    await client.query("commit");
    return { inserted, updated, notInFile: stale.map((s) => s.slug) };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
