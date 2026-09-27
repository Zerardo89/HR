import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildTermIndex,
  normalizeTerm,
  OCCUPATION_CATEGORIES,
  parseOccupationsCsv,
} from "./occupations-data";

// Test di accettazione WP-006 (elenco mansioni). NON modificarli per far passare i dati: correggi il CSV.

const csv = readFileSync("data/occupations.csv", "utf8");
const { rows, errors } = parseOccupationsCsv(csv);
const index = buildTermIndex(rows);
const find = (q: string) => index.get(normalizeTerm(q));

describe("elenco mansioni (data/occupations.csv)", () => {
  it("è valido: nessun errore, slug unici, codici ISCO a 4 cifre", () => {
    expect(errors).toEqual([]);
    expect(rows.length).toBeGreaterThanOrEqual(250);
  });

  it("copre tutte le 20 macro-categorie", () => {
    const used = new Set(rows.map((r) => r.category));
    expect([...used].sort()).toEqual(Object.keys(OCCUPATION_CATEGORIES).sort());
  });

  it("trova le mansioni con le parole di tutti i giorni (anche al femminile e senza accenti)", () => {
    expect(find("lavapiatti")).toBe("lavapiatti");
    expect(find("barman")).toBe("barista");
    expect(find("mulettista")).toBe("mulettista");
    expect(find("carrellista")).toBe("mulettista");
    expect(find("badante")).toBe("badante");
    expect(find("OSS")).toBe("oss");
    expect(find("cameriera")).toBe("cameriere");
    expect(find("magazziniera")).toBe("magazziniere");
    expect(find("maître")).toBe("maitre");
    expect(find("autista patente C")).toBe("autista-camion");
    expect(find("raccolta olive")).toBe("bracciante");
    expect(find("parrucchiera")).toBe("parrucchiere");
  });

  it("il gruppo ISCO (prime 3 cifre) collega mansioni affini", () => {
    const bySlug = new Map(rows.map((r) => [r.slug, r]));
    expect(bySlug.get("cuoco")!.groupCode).toBe(bySlug.get("pizzaiolo")!.groupCode);
    expect(bySlug.get("cameriere")!.groupCode).toBe(bySlug.get("barista")!.groupCode);
  });

  it("nessun termine discriminatorio nei nomi e nei sinonimi (R-ANN-03, R-ANN-04)", () => {
    const forbidden = [
      "madrelingua",
      "giovane",
      "bella presenza",
      "ragazza",
      "ragazzo",
      "italiano",
      "italiana",
    ];
    for (const r of rows) {
      for (const term of [r.labelIt, ...r.synonyms].map(normalizeTerm)) {
        for (const f of forbidden) expect(term.includes(f), `${r.slug}: "${term}"`).toBe(false);
      }
    }
  });

  it("i codici ISCO da verificare sono segnalati (needsReview) e restano una minoranza", () => {
    const toReview = rows.filter((r) => r.needsReview).length;
    expect(toReview).toBeGreaterThan(0);
    expect(toReview / rows.length).toBeLessThan(0.15);
  });
});

describe("normalizeTerm", () => {
  it("toglie accenti, maiuscole e punteggiatura", () => {
    expect(normalizeTerm("  Maître   di Sala ")).toBe("maitre di sala");
    expect(normalizeTerm("Cameriere/a")).toBe("cameriere a");
    expect(normalizeTerm("Portiere d'albergo")).toBe("portiere d albergo");
  });
});
