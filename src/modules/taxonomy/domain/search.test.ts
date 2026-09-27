import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseOccupationsCsv } from "./occupations-data";
import { prepareCatalog, searchOccupations, type CatalogEntry } from "./search";

// Test di accettazione WP-006 (ricerca delle mansioni), scritti dall'architetto. NON modificarli per far passare il codice.
// Nota: la specifica iniziale chiedeva che "aiuto cucina" trovasse il lavapiatti; nell'elenco definitivo è un
// sinonimo di "Aiuto cuoco/a", che sta nello stesso gruppo ISCO del lavapiatti (mansioni affini, ADR-0005).

const { rows } = parseOccupationsCsv(readFileSync("data/occupations.csv", "utf8"));
const entries: CatalogEntry[] = rows.map((r, i) => ({
  id: i + 1,
  slug: r.slug,
  labelIt: r.labelIt,
  category: r.category,
  groupCode: r.groupCode,
  synonyms: r.synonyms,
}));
const catalog = prepareCatalog(entries);
const first = (q: string) => searchOccupations(catalog, q)[0]?.entry.slug;
const bySlug = new Map(entries.map((e) => [e.slug, e]));

describe("ricerca delle mansioni", () => {
  it("trova la mansione con le parole di tutti i giorni, staccate o attaccate", () => {
    expect(first("lavapiatti")).toBe("lavapiatti");
    expect(first("lava piatti")).toBe("lavapiatti");
    expect(first("Aiuto cucina")).toBe("aiuto-cuoco");
    expect(bySlug.get("aiuto-cuoco")!.groupCode).toBe(bySlug.get("lavapiatti")!.groupCode);
  });

  it("tollera gli errori di battitura", () => {
    expect(first("magazinier")).toBe("magazziniere");
    expect(first("cameirere")).toBe("cameriere");
    expect(first("pizaiolo")).toBe("pizzaiolo");
  });

  it("femminile, sigle e sinonimi; segnala quale sinonimo ha trovato", () => {
    expect(first("cameriera")).toBe("cameriere");
    expect(first("OSS")).toBe("oss");
    expect(first("badante")).toBe("badante");
    const barman = searchOccupations(catalog, "barman")[0]!;
    expect(barman.entry.slug).toBe("barista");
    expect(barman.matchedSynonym).toBe("barman");
  });

  it("il termine esatto vince sul prefisso", () => {
    expect(first("cuoco")).toBe("cuoco");
    expect(first("aiuto cuoco")).toBe("aiuto-cuoco");
  });

  it("scrivendo l'inizio della parola compaiono subito i suggerimenti", () => {
    expect(first("magaz")).toBe("magazziniere");
    expect(first("piz")).toBe("pizzaiolo");
  });

  it("niente risultati per meno di 2 caratteri; mai più di 10", () => {
    expect(searchOccupations(catalog, "")).toEqual([]);
    expect(searchOccupations(catalog, "a")).toEqual([]);
    expect(searchOccupations(catalog, "addetto").length).toBeLessThanOrEqual(10);
    expect(searchOccupations(catalog, "addetto", 3)).toHaveLength(3);
    expect(searchOccupations(catalog, "zzzzqqq")).toEqual([]);
  });

  it("è veloce: meno di 50 ms per ricerca (in media molto meno)", () => {
    const queries = ["lava", "magazinier", "cameriera", "autista patente c", "addetto", "oss"];
    const start = performance.now();
    for (let i = 0; i < 50; i++) for (const q of queries) searchOccupations(catalog, q);
    const average = (performance.now() - start) / (50 * queries.length);
    expect(average).toBeLessThan(50);
  });
});
