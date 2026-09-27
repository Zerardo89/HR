import { z } from "zod";
import {
  CONTRACT_TYPES,
  SCHEDULE_TYPES,
  type ContractType,
  type SalaryPeriod,
} from "@/modules/offers/domain";

/**
 * Ricerca delle offerte (WP-015, ADR-0005): filtri rigidi scelti da chi cerca + punteggio a pesi fissi e pubblici,
 * con i motivi mostrati accanto a ogni risultato ("perché la vedi", R-PRIV-06, R-DSA-06). Funzioni pure.
 * Nessun dato di chi cerca entra nel punteggio oltre a ciò che scrive nel modulo (R-LAV-01, R-LAV-06).
 */

/** Pesi pubblici (docs/01-PRODOTTO.md §8). Competenze e preferenze valgono solo con un profilo (WP-017). */
export const SCORE_WEIGHTS = {
  occupation: 40,
  distance: 25,
  skills: 20,
  freshness: 10,
  preferences: 5,
} as const;

export const SEARCH_RADII_KM = [5, 10, 20, 30, 50, 100] as const;
export const DEFAULT_RADIUS_KM = 20;
export const PUBLISHED_WITHIN_DAYS = [1, 7, 30] as const;
export const FRESHNESS_DAYS = 30;
export const PAGE_SIZE = 20;
export const MAX_PAGE = 50;
/** Oltre questo numero di offerte candidate si tengono le più recenti (bastano per l'area pilota; poi si rivede). */
export const MAX_CANDIDATES = 1000;
/** Stipendio: un anno = 13 mensilità (tredicesima); un'ora × ore settimanali (40 se non indicate) × 52 / 12. */
export const MONTHS_PER_YEAR_SALARY = 13;
export const DEFAULT_HOURS_PER_WEEK = 40;

const DAY_MS = 24 * 60 * 60_000;

const oneOf = <T extends readonly number[]>(values: T) =>
  z
    .string()
    .regex(/^\d{1,3}$/)
    .transform(Number)
    .refine((n): n is T[number] => values.includes(n));

const list = <T extends readonly string[]>(values: T) =>
  z
    .union([z.string(), z.array(z.string())])
    .transform((v) => (Array.isArray(v) ? v : [v]))
    .transform((v) => [...new Set(v.filter((x): x is T[number] => values.includes(x)))]);

const text = (max: number) =>
  z
    .string()
    .transform((v) => v.replace(/\s+/g, " ").trim().slice(0, max))
    .transform((v) => (v.length > 0 ? v : undefined));

const positiveInt = (max: number) =>
  z
    .string()
    .regex(/^\d{1,7}$/)
    .transform(Number)
    .refine((n) => n >= 1 && n <= max);

/** Parametri dell'indirizzo della pagina di ricerca: ciò che non è valido si ignora (mai un errore). */
const searchParamsShape = {
  q: text(80),
  dove: text(80),
  raggio: oneOf(SEARCH_RADII_KM),
  contratto: list(CONTRACT_TYPES),
  orario: list(SCHEDULE_TYPES),
  stipendio: positiveInt(100_000),
  giorni: oneOf(PUBLISHED_WITHIN_DAYS),
  pagina: positiveInt(MAX_PAGE),
};

export type SearchQuery = {
  q?: string;
  /** Comune scritto da chi cerca; "Castro (LE)" distingue i comuni con lo stesso nome. */
  dove?: string;
  radiusKm: (typeof SEARCH_RADII_KM)[number];
  contractTypes: ContractType[];
  schedules: (typeof SCHEDULE_TYPES)[number][];
  minMonthlySalary?: number;
  publishedWithinDays?: (typeof PUBLISHED_WITHIN_DAYS)[number];
  page: number;
};

export function parseSearchParams(
  params: Record<string, string | string[] | undefined>,
): SearchQuery {
  const pick = <K extends keyof typeof searchParamsShape>(key: K) => {
    const raw = params[key];
    const value = Array.isArray(raw) && key !== "contratto" && key !== "orario" ? raw[0] : raw;
    if (value === undefined) return undefined;
    const parsed = searchParamsShape[key].safeParse(value);
    return parsed.success ? (parsed.data as z.output<(typeof searchParamsShape)[K]>) : undefined;
  };
  return {
    q: pick("q"),
    dove: pick("dove"),
    radiusKm: pick("raggio") ?? DEFAULT_RADIUS_KM,
    contractTypes: pick("contratto") ?? [],
    schedules: pick("orario") ?? [],
    minMonthlySalary: pick("stipendio"),
    publishedWithinDays: pick("giorni"),
    page: pick("pagina") ?? 1,
  };
}

/** Di nuovo in parametri dell'indirizzo (link di paginazione, scelta tra comuni omonimi). */
export function toSearchParams(query: SearchQuery, overrides: Partial<SearchQuery> = {}): string {
  const q = { ...query, ...overrides };
  const p = new URLSearchParams();
  if (q.q) p.set("q", q.q);
  if (q.dove) p.set("dove", q.dove);
  if (q.radiusKm !== DEFAULT_RADIUS_KM) p.set("raggio", String(q.radiusKm));
  for (const c of q.contractTypes) p.append("contratto", c);
  for (const s of q.schedules) p.append("orario", s);
  if (q.minMonthlySalary) p.set("stipendio", String(q.minMonthlySalary));
  if (q.publishedWithinDays) p.set("giorni", String(q.publishedWithinDays));
  if (q.page > 1) p.set("pagina", String(q.page));
  return p.toString();
}

// ─── Punteggio e motivi ────────────────────────────────────────────────────────────────────────────

/** Offerta candidata (già passata dai filtri rigidi nel DB). Solo dati dell'annuncio: nessun dato di persone. */
export type SearchCandidate = {
  id: string;
  title: string;
  companyName: string;
  municipality: string;
  provinceAbbr: string;
  contractType: ContractType;
  schedule: (typeof SCHEDULE_TYPES)[number];
  hoursPerWeek: number | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: SalaryPeriod | null;
  salaryBasis: "gross" | "net";
  publishedAt: Date;
  occupationId: number;
  occupationGroup: string | null;
  /** Distanza dal comune cercato (km, linea d'aria tra centroidi); `null` se non si cerca per luogo. */
  distanceKm: number | null;
  /** Le parole cercate sono nel titolo (full-text o trigrammi, ADR-0003) / solo nella descrizione. */
  titleMatch: boolean;
  descriptionMatch: boolean;
};

export type SearchContext = {
  /** Mansione riconosciuta nel testo cercato (tassonomia, WP-006), se c'è. */
  occupation: { id: number; groupCode: string | null; label: string } | null;
  hasText: boolean;
  radiusKm: number | null;
  now: Date;
};

export type Reason =
  | { kind: "same_occupation"; label: string }
  | { kind: "title_words" }
  | { kind: "similar_occupation"; label: string }
  | { kind: "description_words" }
  | { kind: "distance"; km: number }
  | { kind: "published"; days: number };

export type RankedOffer = SearchCandidate & { score: number; reasons: Reason[] };

function relevance(c: SearchCandidate, ctx: SearchContext): { factor: number; reason?: Reason } {
  if (!ctx.occupation && !ctx.hasText) return { factor: 1 }; // nessun "cosa": la pertinenza non distingue
  const occ = ctx.occupation;
  if (occ && c.occupationId === occ.id)
    return { factor: 1, reason: { kind: "same_occupation", label: occ.label } };
  if (c.titleMatch) return { factor: 1, reason: { kind: "title_words" } };
  if (occ?.groupCode && c.occupationGroup === occ.groupCode)
    return { factor: 0.5, reason: { kind: "similar_occupation", label: occ.label } };
  if (c.descriptionMatch) return { factor: 0.5, reason: { kind: "description_words" } };
  return { factor: 0 };
}

export function ageInDays(publishedAt: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - publishedAt.getTime()) / DAY_MS));
}

export function scoreOffer(
  c: SearchCandidate,
  ctx: SearchContext,
): { score: number; reasons: Reason[] } {
  const reasons: Reason[] = [];
  const rel = relevance(c, ctx);
  if (rel.reason) reasons.push(rel.reason);

  let proximity = 1; // senza luogo, la vicinanza non distingue
  if (ctx.radiusKm && c.distanceKm !== null) {
    proximity = Math.max(0, 1 - c.distanceKm / ctx.radiusKm);
    reasons.push({ kind: "distance", km: Math.round(c.distanceKm) });
  }

  const days = ageInDays(c.publishedAt, ctx.now);
  const freshness = Math.max(0, 1 - days / FRESHNESS_DAYS);
  reasons.push({ kind: "published", days });

  const score =
    SCORE_WEIGHTS.occupation * rel.factor +
    SCORE_WEIGHTS.distance * proximity +
    SCORE_WEIGHTS.freshness * freshness;
  return { score: Math.round(score * 100) / 100, reasons };
}

/** Stipendio mensile equivalente (lordo o netto come indicato), con la cifra più alta dell'offerta. */
export function monthlyEquivalent(
  c: Pick<SearchCandidate, "salaryMin" | "salaryMax" | "salaryPeriod" | "hoursPerWeek">,
): number | null {
  const amount = c.salaryMax ?? c.salaryMin;
  if (amount == null || !c.salaryPeriod) return null;
  switch (c.salaryPeriod) {
    case "month":
      return amount;
    case "year":
      return amount / MONTHS_PER_YEAR_SALARY;
    case "hour":
      return (amount * (c.hoursPerWeek ?? DEFAULT_HOURS_PER_WEEK) * 52) / 12;
  }
}

export type SearchPage = {
  results: RankedOffer[];
  total: number;
  page: number;
  pageCount: number;
};

/** Filtro sullo stipendio minimo, punteggio, ordine (punteggio, poi più recente, poi id) e pagina. */
export function rankOffers(
  candidates: readonly SearchCandidate[],
  ctx: SearchContext,
  options: { minMonthlySalary?: number; page: number },
): SearchPage {
  const kept = options.minMonthlySalary
    ? candidates.filter((c) => (monthlyEquivalent(c) ?? 0) >= options.minMonthlySalary!)
    : candidates;
  const ranked = kept
    .filter((c) => relevance(c, ctx).factor > 0) // con un "cosa", fuori ciò che non c'entra
    .map((c) => ({ ...c, ...scoreOffer(c, ctx) }))
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.publishedAt.getTime() - a.publishedAt.getTime() ||
        a.id.localeCompare(b.id),
    );
  const pageCount = Math.max(1, Math.ceil(ranked.length / PAGE_SIZE));
  const page = Math.min(options.page, pageCount);
  return {
    results: ranked.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    total: ranked.length,
    page,
    pageCount,
  };
}
