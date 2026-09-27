import { z } from "zod";
import { csvToRecords } from "@/modules/geo/domain";

/**
 * Elenco delle mansioni (WP-006): `data/occupations.csv`, generato da `scripts/data-src/occupations.py`.
 * Ogni mansione ha: slug stabile, etichetta inclusiva, macro-categoria (per icone e filtri),
 * codice ISCO-08 a 4 cifre (le prime 3 = gruppo di "mansioni affini", ADR-0005) e sinonimi colloquiali.
 */
export const OCCUPATION_CATEGORIES = {
  ristorazione: "Ristorazione e bar",
  turismo: "Turismo, alberghi ed eventi",
  commercio: "Commercio e vendita",
  logistica: "Logistica e magazzino",
  trasporti: "Trasporti e guida",
  edilizia: "Edilizia e cantieri",
  impianti: "Impianti e manutenzione",
  industria: "Industria e produzione",
  artigianato: "Artigianato",
  auto: "Auto e officine",
  agricoltura: "Agricoltura e animali",
  sanita: "Sanità",
  assistenza: "Assistenza e cura della persona",
  benessere: "Bellezza, benessere e sport",
  pulizie: "Pulizie e servizi",
  sicurezza: "Sicurezza e vigilanza",
  ufficio: "Ufficio e amministrazione",
  informatica: "Informatica, digitale e comunicazione",
  istruzione: "Istruzione e formazione",
  tecnici: "Tecnici e ingegneria",
} as const;

export type OccupationCategory = keyof typeof OCCUPATION_CATEGORIES;

const categoryKeys = Object.keys(OCCUPATION_CATEGORIES) as [
  OccupationCategory,
  ...OccupationCategory[],
];

const rowSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "slug non valido (minuscole e trattini)"),
  label_it: z.string().min(2).max(80),
  category: z.enum(categoryKeys),
  isco_code: z.string().regex(/^\d{4}$/, "codice ISCO-08 di 4 cifre"),
  synonyms: z.string(),
  note: z.string().optional(),
});

export type Occupation = {
  slug: string;
  labelIt: string;
  category: OccupationCategory;
  iscoCode: string;
  groupCode: string; // prime 3 cifre ISCO: "mansioni affini"
  synonyms: string[];
  needsReview: boolean;
};

/** Normalizzazione per confronti e ricerca: minuscole, senza accenti, solo lettere/cifre, spazi singoli. */
export function normalizeTerm(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type OccupationsParseResult = {
  rows: Occupation[];
  errors: { line: number; message: string }[];
};

export function parseOccupationsCsv(text: string): OccupationsParseResult {
  const rows: Occupation[] = [];
  const errors: OccupationsParseResult["errors"] = [];
  const slugs = new Set<string>();
  const terms = new Map<string, string>(); // termine normalizzato → slug che lo "possiede"

  csvToRecords(text, ",").forEach((record, i) => {
    const line = i + 2;
    const parsed = rowSchema.safeParse(record);
    if (!parsed.success) {
      errors.push({
        line,
        message: parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; "),
      });
      return;
    }
    const r = parsed.data;
    if (slugs.has(r.slug)) {
      errors.push({ line, message: `slug duplicato: ${r.slug}` });
      return;
    }
    slugs.add(r.slug);

    const synonyms = r.synonyms
      .split("|")
      .map((s) => s.trim())
      .filter((s) => s !== "");
    // L'etichetta e i sinonimi non devono appartenere a un'altra mansione (la ricerca sarebbe ambigua).
    for (const term of [r.label_it, ...synonyms]) {
      const key = normalizeTerm(term);
      const owner = terms.get(key);
      if (owner && owner !== r.slug) {
        errors.push({ line, message: `"${term}" è già usato da ${owner}` });
      }
      terms.set(key, r.slug);
    }

    rows.push({
      slug: r.slug,
      labelIt: r.label_it,
      category: r.category,
      iscoCode: r.isco_code,
      groupCode: r.isco_code.slice(0, 3),
      synonyms,
      needsReview: (r.note ?? "").trim() !== "",
    });
  });
  return { rows, errors };
}

/** Indice termine normalizzato → slug (etichette + sinonimi + slug), per l'autocompletamento. */
export function buildTermIndex(rows: readonly Occupation[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const r of rows) {
    for (const term of [r.slug.replace(/-/g, " "), r.labelIt, ...r.synonyms]) {
      const key = normalizeTerm(term);
      if (!index.has(key)) index.set(key, r.slug);
    }
  }
  return index;
}
