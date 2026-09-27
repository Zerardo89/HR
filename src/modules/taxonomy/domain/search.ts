import { normalizeTerm, type OccupationCategory } from "./occupations-data";

/**
 * Ricerca delle mansioni per l'autocompletamento (WP-006). Pura e in memoria: l'elenco è piccolo (~300 voci),
 * quindi gira uguale sul server e nel browser, senza chiamate al DB a ogni tasto.
 * Ordine: termine identico → inizia per → una parola inizia per → contiene → somiglianza (errori di battitura).
 */
export type CatalogEntry = {
  id: number;
  slug: string;
  labelIt: string;
  category: OccupationCategory;
  groupCode: string | null;
  synonyms: readonly string[];
};

export type SearchHit = {
  entry: CatalogEntry;
  score: number;
  /** Il sinonimo che ha dato la corrispondenza, se diverso dall'etichetta (es. "barman" → Barista). */
  matchedSynonym?: string;
};

type Term = {
  raw: string;
  norm: string;
  compact: string;
  words: string[];
  grams: Set<string>;
  isLabel: boolean;
};
type Prepared = { entry: CatalogEntry; terms: Term[] };
export type PreparedCatalog = readonly Prepared[];

export const MIN_QUERY_LENGTH = 2;
export const DEFAULT_LIMIT = 10;
const SIMILARITY_THRESHOLD = 0.35;

function trigrams(value: string): Set<string> {
  const padded = `  ${value} `;
  const grams = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) grams.add(padded.slice(i, i + 3));
  return grams;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let shared = 0;
  for (const g of a) if (b.has(g)) shared++;
  return shared / (a.size + b.size - shared);
}

/**
 * Distanza di modifica con trasposizioni (Damerau-Levenshtein "ristretta"): una lettera in più, in meno,
 * sbagliata o due lettere invertite contano 1. Le trigrammi da sole capiscono male le inversioni ("cameirere").
 */
function editDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[] = new Array<number>(rows * cols);
  for (let i = 0; i < rows; i++) d[i * cols] = i;
  for (let j = 0; j < cols; j++) d[j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(
        d[(i - 1) * cols + j]! + 1,
        d[i * cols + j - 1]! + 1,
        d[(i - 1) * cols + j - 1]! + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, d[(i - 2) * cols + j - 2]! + 1);
      }
      d[i * cols + j] = v;
    }
  }
  return d[rows * cols - 1]!;
}

/** Somiglianza per gli errori di battitura: solo da 4 lettere in su e tra parole di lunghezza simile. */
function typoSimilarity(q: string, t: string): number {
  if (q.length < 4 || Math.abs(q.length - t.length) > 3) return 0;
  return 1 - editDistance(q, t) / Math.max(q.length, t.length);
}

function term(raw: string, isLabel: boolean): Term {
  const norm = normalizeTerm(raw);
  const compact = norm.replace(/ /g, "");
  return { raw, norm, compact, words: norm.split(" "), grams: trigrams(compact), isLabel };
}

/** Prepara l'elenco una volta sola (termini normalizzati e trigrammi); poi ogni ricerca costa pochi microsecondi. */
export function prepareCatalog(entries: readonly CatalogEntry[]): PreparedCatalog {
  return entries.map((entry) => ({
    entry,
    terms: [term(entry.labelIt, true), ...entry.synonyms.map((s) => term(s, false))],
  }));
}

function scoreTerm(t: Term, q: string, qc: string, qGrams: Set<string>): number {
  if (t.norm === q || t.compact === qc) return 1;
  if (t.norm.startsWith(q) || t.compact.startsWith(qc)) return 0.9;
  if (t.words.some((w) => w.startsWith(q))) return 0.8;
  if (t.compact.includes(qc)) return 0.7;
  let similarity = Math.max(jaccard(qGrams, t.grams), typoSimilarity(qc, t.compact));
  if (!q.includes(" ")) {
    // Una sola parola del termine conta un po' meno del termine intero.
    for (const w of t.words) {
      const s = Math.max(jaccard(qGrams, trigrams(w)), typoSimilarity(q, w));
      similarity = Math.max(similarity, 0.95 * s);
    }
  }
  return similarity >= SIMILARITY_THRESHOLD ? 0.6 * similarity : 0;
}

export function searchOccupations(
  catalog: PreparedCatalog,
  query: string,
  limit = DEFAULT_LIMIT,
): SearchHit[] {
  const q = normalizeTerm(query);
  if (q.length < MIN_QUERY_LENGTH) return [];
  const qc = q.replace(/ /g, "");
  const qGrams = trigrams(qc);

  const hits: SearchHit[] = [];
  for (const { entry, terms } of catalog) {
    let best = 0;
    let bestTerm: Term | undefined;
    for (const t of terms) {
      // A parità di punteggio vince l'etichetta sul sinonimo.
      const s = scoreTerm(t, q, qc, qGrams) + (t.isLabel ? 0.001 : 0);
      if (s > best) {
        best = s;
        bestTerm = t;
      }
    }
    if (best > 0.001 && bestTerm) {
      hits.push({
        entry,
        score: best,
        matchedSynonym: bestTerm.isLabel ? undefined : bestTerm.raw,
      });
    }
  }
  hits.sort((a, b) => b.score - a.score || a.entry.labelIt.localeCompare(b.entry.labelIt, "it"));
  // Niente rumore: fuori i suggerimenti con meno della metà del punteggio del primo ("commessa" → non "Gommista").
  const floor = (hits[0]?.score ?? 0) / 2;
  return hits.filter((h) => h.score >= floor).slice(0, limit);
}
