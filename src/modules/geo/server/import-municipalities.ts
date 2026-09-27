import type { Pool, PoolClient } from "pg";
import type { MunicipalityRow } from "../domain";

export type ImportSummary = { regions: number; provinces: number; municipalities: number };

/**
 * Importa (upsert) regioni, province e comuni in una sola transazione (WP-005). Idempotente.
 * Riceve il pool dall'esterno: usabile dallo script CLI e dai test di integrazione.
 */
export async function importMunicipalities(
  pool: Pool,
  rows: readonly MunicipalityRow[],
): Promise<ImportSummary> {
  const regions = new Map<string, string>();
  const provinces = new Map<string, { name: string; abbr: string; region: string }>();
  for (const r of rows) {
    regions.set(r.region_code, r.region_name);
    provinces.set(r.province_code, {
      name: r.province_name,
      abbr: r.province_abbr,
      region: r.region_code,
    });
  }

  const client: PoolClient = await pool.connect();
  try {
    await client.query("begin");
    for (const [code, name] of regions) {
      await client.query(
        `insert into regions (code, name) values ($1, $2)
         on conflict (code) do update set name = excluded.name`,
        [code, name],
      );
    }
    for (const [code, p] of provinces) {
      await client.query(
        `insert into provinces (code, name, abbreviation, region_code) values ($1, $2, $3, $4)
         on conflict (code) do update set name = excluded.name, abbreviation = excluded.abbreviation,
           region_code = excluded.region_code`,
        [code, p.name, p.abbr, p.region],
      );
    }
    // A lotti da 500 per non creare query enormi.
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500);
      const values: unknown[] = [];
      const tuples = batch.map((r, j) => {
        values.push(
          r.istat_code,
          r.name,
          r.province_code,
          r.region_code,
          r.population,
          r.lat,
          r.lon,
        );
        const b = j * 7;
        return `($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7})`;
      });
      await client.query(
        `insert into municipalities (istat_code, name, province_code, region_code, population, lat, lon)
         values ${tuples.join(", ")}
         on conflict (istat_code) do update set name = excluded.name, province_code = excluded.province_code,
           region_code = excluded.region_code, population = excluded.population, lat = excluded.lat, lon = excluded.lon`,
        values,
      );
    }
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
  return { regions: regions.size, provinces: provinces.size, municipalities: rows.length };
}
