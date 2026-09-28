import { randomUUID } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CURRENT_TERMS } from "@/modules/trust/domain";
import { acceptCurrentTerms, acceptedTermsVersion } from "@/modules/trust/server/terms";
import { DATABASE_URL } from "./db";

// Test di accettazione WP-024b (R-DSA-02, DSA art. 14.2): nuova accettazione delle condizioni aggiornate.

let pool: Pool;
const created: string[] = [];

async function user(termsVersion: string | null) {
  const id = randomUUID();
  await pool.query(
    `insert into users (id, role, email_bidx, email_enc, key_version, adult_declared_at)
     values ($1, 'worker', $2, 'v1.finto', 1, now())`,
    [id, `bidx-finto-${id}`],
  );
  created.push(id);
  if (termsVersion) {
    await pool.query(
      `insert into consents (user_id, type, version, granted_at) values ($1, 'terms', $2, now() - interval '1 day')`,
      [id, termsVersion],
    );
  }
  return id;
}

const termsRows = async (id: string) =>
  (
    await pool.query(
      `select version from consents where user_id = $1 and type = 'terms' order by granted_at`,
      [id],
    )
  ).rows.map((r) => r.version);

describe.skipIf(!DATABASE_URL)("condizioni d'uso versionate (WP-024b)", () => {
  beforeAll(() => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 2 });
  });
  afterAll(async () => {
    await pool.query(`delete from users where id = any($1::uuid[])`, [created]);
    await pool?.end();
  });

  it("chi aveva accettato la versione precedente accetta la nuova: resta la prova di entrambe", async () => {
    const id = await user("bozza-2026-09-27");
    const db = drizzle(pool);
    expect(await acceptedTermsVersion(db, id)).toBe("bozza-2026-09-27");
    await acceptCurrentTerms(db, id, new Date());
    await acceptCurrentTerms(db, id, new Date()); // ripetere non aggiunge righe
    expect(await acceptedTermsVersion(db, id)).toBe(CURRENT_TERMS);
    expect(await termsRows(id)).toEqual(["bozza-2026-09-27", CURRENT_TERMS]);
  });

  it("senza nessuna accettazione registrata: null, poi la versione in vigore", async () => {
    const id = await user(null);
    const db = drizzle(pool);
    expect(await acceptedTermsVersion(db, id)).toBeNull();
    await acceptCurrentTerms(db, id, new Date());
    expect(await termsRows(id)).toEqual([CURRENT_TERMS]);
  });
});
