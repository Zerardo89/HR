import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { parseNormalizedMunicipalities } from "@/modules/geo/domain";
import { importMunicipalities } from "@/modules/geo";
import { DATABASE_URL } from "./db";

// Test di accettazione WP-005 (import idempotente). Usa un DB di test: scrive davvero e poi ripulisce.

const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL, max: 2 }) : undefined;
afterAll(async () => {
  // Pulizia: comuni del campione, poi province e regioni rimaste senza riferimenti.
  await pool?.query("delete from municipalities where istat_code = any($1)", [codes()]);
  await pool?.query(
    "delete from provinces p where not exists (select 1 from municipalities m where m.province_code = p.code)",
  );
  await pool?.query(
    "delete from regions r where not exists (select 1 from provinces p where p.region_code = r.code)",
  );
  await pool?.end();
});

function codes(): string[] {
  return parseNormalizedMunicipalities(
    readFileSync("tests/fixtures/municipalities-sample.csv", "utf8"),
  ).rows.map((r) => r.istat_code);
}

describe.skipIf(!DATABASE_URL)("import dei comuni (WP-005)", () => {
  it("importa il campione, è idempotente e aggiorna i dati cambiati", async () => {
    const { rows } = parseNormalizedMunicipalities(
      readFileSync("tests/fixtures/municipalities-sample.csv", "utf8"),
    );
    const first = await importMunicipalities(pool!, rows);
    expect(first).toEqual({ regions: 7, provinces: 10, municipalities: 10 });

    await importMunicipalities(
      pool!,
      rows.map((r) => (r.istat_code === "098031" ? { ...r, population: 45000 } : r)),
    );
    const { rows: check } = await pool!.query(
      `select count(*)::int as n, max(population) filter (where istat_code = '098031') as lodi
       from municipalities where istat_code = any($1)`,
      [codes()],
    );
    expect(check[0]).toEqual({ n: 10, lodi: 45000 });
  });

  it("dopo l'import funziona la ricerca nel raggio con PostGIS", async () => {
    const { rows } = await pool!.query<{ istat_code: string }>(
      `select m.istat_code from municipalities m, municipalities p
       where p.istat_code = '033032' and m.istat_code <> p.istat_code
         and ST_DWithin(p.centroid, m.centroid, 50000, false)
         and m.istat_code = any($1)
       order by m.istat_code`,
      [codes()],
    );
    expect(rows.map((r) => r.istat_code)).toEqual(["098031"]); // da Piacenza entro 50 km: solo Lodi
  });
});
