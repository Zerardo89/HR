import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseOccupationsCsv } from "@/modules/taxonomy/domain";
import { importOccupations } from "@/modules/taxonomy/server/import-occupations";
import { DATABASE_URL } from "./db";

// Test di accettazione WP-006 (import delle mansioni) sul DB reale. NON modificarli per farli passare.

const { rows } = parseOccupationsCsv(readFileSync("data/occupations.csv", "utf8"));

describe.skipIf(!DATABASE_URL)("import delle mansioni (WP-006)", () => {
  let pool: Pool;
  beforeAll(() => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 2 });
  });
  afterAll(async () => {
    await importOccupations(pool, rows); // lascia il DB allineato al file
    await pool?.end();
  });

  it("è idempotente: il secondo import non cambia nulla", async () => {
    await importOccupations(pool, rows);
    expect(await importOccupations(pool, rows)).toMatchObject({ inserted: 0, updated: 0 });
    const { rows: db } = await pool.query(
      `select slug, category, group_code, synonyms from occupations where slug = any($1::text[])`,
      [["lavapiatti", "aiuto-cuoco", "barista"]],
    );
    expect(db).toHaveLength(3);
    const bySlug = new Map(db.map((r) => [r.slug, r]));
    expect(bySlug.get("lavapiatti").group_code).toBe(bySlug.get("aiuto-cuoco").group_code);
    expect(bySlug.get("barista").synonyms).toContain("barman");
  });

  it("aggiorna le mansioni modificate nel file e non cancella quelle tolte", async () => {
    const [firstRow, ...others] = rows;
    const renamed = { ...firstRow!, labelIt: `${firstRow!.labelIt} (prova)` };
    expect(await importOccupations(pool, [renamed, ...others])).toMatchObject({
      inserted: 0,
      updated: 1,
    });

    const summary = await importOccupations(pool, others);
    expect(summary.notInFile).toContain(firstRow!.slug);
    const { rows: still } = await pool.query(`select 1 from occupations where slug = $1`, [
      firstRow!.slug,
    ]);
    expect(still).toHaveLength(1);
  });
});
