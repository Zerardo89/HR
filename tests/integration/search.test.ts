import { drizzle } from "drizzle-orm/node-postgres";
import type { PoolClient } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { parseSearchParams, type RankedOffer } from "@/modules/matching/domain";
import { findMunicipality as resolvePlace } from "@/modules/geo/server/lookup";
import { searchOffers } from "@/modules/matching/server/search";
import { prepareCatalog } from "@/modules/taxonomy/domain";
import { closePool, DATABASE_URL, inRollback, seedReference } from "./db";

// Test di accettazione WP-015 (ricerca delle offerte) sul DB reale. NON modificarli per farli passare.
// Comuni: Milano, Lodi (~30 km da Milano), Piacenza (~60 km da Milano). Mansioni di prova in gruppi finti (999/998).

const now = new Date("2026-11-10T12:00:00Z");
const DAY = 24 * 60 * 60_000;

const catalog = prepareCatalog([
  {
    id: 9101,
    slug: "t-cameriere",
    labelIt: "Cameriere di sala",
    category: "ristorazione",
    groupCode: "999",
    synonyms: ["cameriera"],
  },
  {
    id: 9102,
    slug: "t-barista",
    labelIt: "Barista",
    category: "ristorazione",
    groupCode: "999",
    synonyms: ["barman"],
  },
  {
    id: 9103,
    slug: "t-cuoco",
    labelIt: "Cuoco",
    category: "ristorazione",
    groupCode: "998",
    synonyms: [],
  },
]);

async function seed(c: PoolClient) {
  await seedReference(c);
  await c.query(`insert into occupations (id, slug, category, label_it, group_code) values
    (9101, 't-cameriere', 'ristorazione', 'Cameriere di sala', '999'),
    (9102, 't-barista', 'ristorazione', 'Barista', '999'),
    (9103, 't-cuoco', 'ristorazione', 'Cuoco', '998')`);
  const company = async (status: string) =>
    (
      await c.query<{ id: string }>(
        `insert into companies (vat_number, legal_name, display_name, status)
         values ($1, 'FINTA SRL', 'Locanda Finta', $2) returning id`,
        [`9${String(Math.floor(Math.random() * 1e10)).padStart(10, "0")}`, status],
      )
    ).rows[0]!.id;
  const verified = await company("verified");
  const pending = await company("pending");

  const ids: Record<string, string> = {};
  const offer = async (
    key: string,
    o: {
      title: string;
      occupation: number;
      municipality: string;
      description?: string;
      daysAgo?: number;
      status?: string;
      validDays?: number;
      company?: string;
      contract?: string;
      schedule?: string;
      salary?: [number, number | null, string];
    },
  ) => {
    const published =
      o.status === "draft" ? null : new Date(now.getTime() - (o.daysAgo ?? 1) * DAY);
    const valid = published ? new Date(published.getTime() + (o.validDays ?? 30) * DAY) : null;
    const [min, max, period] = o.salary ?? [1400, null, "month"];
    const { rows } = await c.query<{ id: string }>(
      `insert into job_offers (company_id, title, occupation_id, description_md, municipality_code, contract_type,
         schedule, status, salary_min, salary_max, salary_period, published_at, valid_through)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) returning id`,
      [
        o.company ?? verified,
        o.title,
        o.occupation,
        o.description ?? "Lavoro in un locale del centro, turni concordati.",
        o.municipality,
        o.contract ?? "permanent",
        o.schedule ?? "full_time",
        o.status ?? "published",
        min,
        max,
        period,
        published,
        valid,
      ],
    );
    ids[key] = rows[0]!.id;
  };

  await offer("A", { title: "Cameriere/a di sala", occupation: 9101, municipality: "015146" });
  await offer("B", { title: "Camerieri per banchetti", occupation: 9102, municipality: "098031" });
  await offer("C", {
    title: "Barista al banco",
    occupation: 9102,
    municipality: "015146",
    contract: "seasonal",
    schedule: "part_time",
    salary: [9, null, "hour"],
  });
  await offer("D", {
    title: "Aiuto in cucina",
    occupation: 9103,
    municipality: "015146",
    description: "Prepari la linea e passi i piatti al cameriere di sala.",
    daysAgo: 2,
  });
  await offer("E", { title: "Cameriere/a", occupation: 9101, municipality: "033032" });
  await offer("draft", {
    title: "Cameriere/a bozza",
    occupation: 9101,
    municipality: "015146",
    status: "draft",
  });
  await offer("expired", {
    title: "Cameriere/a scaduta",
    occupation: 9101,
    municipality: "015146",
    daysAgo: 20,
    validDays: 10,
  });
  await offer("unverified", {
    title: "Cameriere/a azienda in verifica",
    occupation: 9101,
    municipality: "015146",
    company: pending,
  });
  await offer("cook", { title: "Cuoco/a", occupation: 9103, municipality: "015146", daysAgo: 5 });
  return ids;
}

/** Solo le offerte di questo test (il DB di prova può contenerne altre), nell'ordine dato dalla ricerca. */
function mine(results: RankedOffer[], ids: Record<string, string>) {
  const byId = new Map(Object.entries(ids).map(([k, v]) => [v, k]));
  return results.flatMap((r) => (byId.has(r.id) ? [{ key: byId.get(r.id)!, r }] : []));
}

const deps = (c: PoolClient) => ({ db: drizzle(c), occupations: catalog, now: () => now });

describe.skipIf(!DATABASE_URL)("ricerca delle offerte (WP-015)", () => {
  afterAll(closePool);

  it("cameriere a Milano entro 50 km: ordine a pesi pubblici e motivi", async () => {
    await inRollback(async (c) => {
      const ids = await seed(c);
      const out = await searchOffers(
        deps(c),
        parseSearchParams({ q: "cameriere", dove: "milano", raggio: "50" }),
      );
      if (out.status !== "results") throw new Error(out.status);
      expect(out.occupation).toEqual({ id: 9101, groupCode: "999", label: "Cameriere di sala" });
      expect(out.place).toMatchObject({ code: "015146", name: "Milano", provinceAbbr: "MI" });
      const got = mine(out.page.results, ids);
      // Fuori: Piacenza (60 km), bozza, scaduta, azienda non verificata, cuoco senza "cameriere".
      expect(got.map((g) => g.key)).toEqual(["A", "B", "C", "D"]);
      expect(got[0]!.r.reasons).toEqual([
        { kind: "same_occupation", label: "Cameriere di sala" },
        { kind: "distance", km: 0 },
        { kind: "published", days: 1 },
      ]);
      expect(got[1]!.r.reasons[0]).toEqual({ kind: "title_words" }); // "Camerieri": trigrammi
      expect(got[1]!.r.reasons[1]).toEqual({ kind: "distance", km: 30 });
      expect(got[2]!.r.reasons[0]).toEqual({
        kind: "similar_occupation",
        label: "Cameriere di sala",
      });
      expect(got[3]!.r.reasons[0]).toEqual({ kind: "description_words" });
    });
  });

  it("errori di battitura e accenti; senza cosa né dove si vedono tutte le offerte valide", async () => {
    await inRollback(async (c) => {
      const ids = await seed(c);
      const typo = await searchOffers(deps(c), parseSearchParams({ q: "cameirere" }));
      if (typo.status !== "results") throw new Error(typo.status);
      expect(typo.occupation?.id).toBe(9101);
      // Senza comune, A (Milano) ed E (Piacenza) sono a pari punteggio: stessa mansione, stessa data.
      const top = mine(typo.page.results, ids).slice(0, 2);
      expect(top.map((g) => g.key).sort()).toEqual(["A", "E"]);
      for (const g of top) {
        expect(g.r.reasons[0]).toEqual({ kind: "same_occupation", label: "Cameriere di sala" });
      }

      const all = await searchOffers(deps(c), parseSearchParams({}));
      if (all.status !== "results") throw new Error(all.status);
      expect(
        mine(all.page.results, ids)
          .map((g) => g.key)
          .sort(),
      ).toEqual(["A", "B", "C", "D", "E", "cook"]);
    });
  });

  it("filtri: contratto, orario, pubblicate da, stipendio minimo al mese", async () => {
    await inRollback(async (c) => {
      const ids = await seed(c);
      const keys = async (params: Record<string, string>) => {
        const out = await searchOffers(deps(c), parseSearchParams(params));
        if (out.status !== "results") throw new Error(out.status);
        return mine(out.page.results, ids)
          .map((g) => g.key)
          .sort();
      };
      expect(await keys({ contratto: "seasonal" })).toEqual(["C"]);
      expect(await keys({ orario: "part_time" })).toEqual(["C"]);
      expect(await keys({ giorni: "1" })).toEqual(["A", "B", "C", "E"]);
      // C: 9 €/ora × 40 × 52 / 12 = 1560 €/mese; le altre 1400.
      expect(await keys({ stipendio: "1500" })).toEqual(["C"]);
    });
  });

  it("comune: maiuscole e accenti, refusi con suggerimenti, omonimi con la provincia", async () => {
    await inRollback(async (c) => {
      await seedReference(c);
      await c.query(`insert into municipalities (istat_code, name, province_code, region_code, lat, lon) values
        ('990001', 'Castro', '015', '03', 45.50, 9.20), ('990002', 'Castro', '098', '03', 45.30, 9.50)`);
      const db = drizzle(c);
      expect(await resolvePlace(db, " MILANO ")).toMatchObject({
        status: "found",
        place: { code: "015146" },
      });
      const typo = await resolvePlace(db, "Milno");
      expect(typo.status).toBe("not_found");
      expect(typo.status === "not_found" && typo.suggestions.map((s) => s.name)).toContain(
        "Milano",
      );
      const twin = await resolvePlace(db, "castro");
      expect(twin.status).toBe("ambiguous");
      expect(twin.status === "ambiguous" && twin.options.map((o) => o.provinceAbbr).sort()).toEqual(
        ["LO", "MI"],
      );
      expect(await resolvePlace(db, "Castro (lo)")).toMatchObject({
        status: "found",
        place: { code: "990002" },
      });
      const out = await searchOffers(
        { db, occupations: catalog, now: () => now },
        parseSearchParams({ dove: "Castro" }),
      );
      expect(out.status).toBe("place");
    });
  });
});
