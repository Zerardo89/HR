import { and, desc, eq, gt, gte, inArray, sql, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { companies, jobOffers, municipalities, occupations, provinces } from "@/lib/db/schema";
import { findMunicipality, type MunicipalityLookup, type MunicipalityRef } from "@/modules/geo";
import { searchOccupations, type PreparedCatalog } from "@/modules/taxonomy/domain";
import {
  MAX_CANDIDATES,
  rankOffers,
  type SearchCandidate,
  type SearchContext,
  type SearchPage,
  type SearchQuery,
} from "../domain";

/*
 * Ricerca delle offerte (WP-015). Il DB applica i filtri rigidi (stato, scadenza, azienda verificata, raggio,
 * contratto, orario, data, parole o mansione); il punteggio e i motivi li calcola il dominio puro (ADR-0005).
 * Nessun limite di zona per chi cerca: la zona gratuita riguarda solo avvisi e mail (ADR-0009).
 */

export type SearchDeps = { db: NodePgDatabase; occupations: PreparedCatalog; now: () => Date };

export type SearchPlace = MunicipalityRef;
export type PlaceResolution = MunicipalityLookup;

/** Soglia per riconoscere una mansione nel testo: corrispondenza piena, iniziale o refuso lieve (WP-006). */
const OCCUPATION_MIN_SCORE = 0.5;

export type OccupationMatch = { id: number; groupCode: string | null; label: string };

export function recognizeOccupation(
  catalog: PreparedCatalog,
  text: string | undefined,
): OccupationMatch | null {
  if (!text) return null;
  const [top] = searchOccupations(catalog, text, 1);
  return top && top.score >= OCCUPATION_MIN_SCORE
    ? { id: top.entry.id, groupCode: top.entry.groupCode, label: top.entry.labelIt }
    : null;
}

type CandidateFilters = {
  text?: string;
  occupation: OccupationMatch | null;
  place: SearchPlace | null;
  radiusKm: number;
  query: SearchQuery;
  now: Date;
};

export async function findCandidates(
  db: NodePgDatabase,
  f: CandidateFilters,
): Promise<{ candidates: SearchCandidate[]; truncated: boolean }> {
  const tsQuery = f.text ? sql`plainto_tsquery('italian_unaccent', ${f.text}::text)` : null;
  // ADR-0003 (aggiornamento WP-004): lo stemmer non unifica singolare/plurale → anche trigrammi sul titolo.
  const titleMatch: SQL<boolean> = f.text
    ? sql<boolean>`(to_tsvector('italian_unaccent', ${jobOffers.title}) @@ ${tsQuery}
        or word_similarity(unaccent(${f.text}::text), unaccent(${jobOffers.title})) >= 0.6)`
    : sql<boolean>`false`;
  const descriptionMatch: SQL<boolean> = f.text
    ? sql<boolean>`(${jobOffers.searchTsv} @@ ${tsQuery})`
    : sql<boolean>`false`;
  const point = f.place
    ? sql`ST_SetSRID(ST_MakePoint(${f.place.lon}::float8, ${f.place.lat}::float8), 4326)::geography`
    : null;
  const distanceKm: SQL<number | null> = point
    ? sql<number>`ST_Distance(${municipalities.centroid}, ${point}, false) / 1000`
    : sql<null>`null`;

  const relevance: SQL[] = [];
  if (f.text) relevance.push(titleMatch, descriptionMatch);
  if (f.occupation) {
    relevance.push(eq(jobOffers.occupationId, f.occupation.id));
    if (f.occupation.groupCode) relevance.push(eq(occupations.groupCode, f.occupation.groupCode));
  }
  const { query, now } = f;

  const rows = await db
    .select({
      id: jobOffers.id,
      title: jobOffers.title,
      companyName: companies.displayName,
      municipality: municipalities.name,
      provinceAbbr: provinces.abbreviation,
      contractType: jobOffers.contractType,
      schedule: jobOffers.schedule,
      hoursPerWeek: jobOffers.hoursPerWeek,
      salaryMin: jobOffers.salaryMin,
      salaryMax: jobOffers.salaryMax,
      salaryPeriod: jobOffers.salaryPeriod,
      salaryBasis: jobOffers.salaryBasis,
      publishedAt: jobOffers.publishedAt,
      occupationId: jobOffers.occupationId,
      occupationGroup: occupations.groupCode,
      distanceKm,
      titleMatch,
      descriptionMatch,
    })
    .from(jobOffers)
    .innerJoin(companies, eq(companies.id, jobOffers.companyId))
    .innerJoin(municipalities, eq(municipalities.istatCode, jobOffers.municipalityCode))
    .innerJoin(provinces, eq(provinces.code, municipalities.provinceCode))
    .innerJoin(occupations, eq(occupations.id, jobOffers.occupationId))
    .where(
      and(
        eq(jobOffers.status, "published"),
        gt(jobOffers.validThrough, now),
        eq(companies.status, "verified"),
        point
          ? sql`ST_DWithin(${municipalities.centroid}, ${point}, ${f.radiusKm * 1000}::float8, false)`
          : undefined,
        query.contractTypes.length > 0
          ? inArray(jobOffers.contractType, query.contractTypes)
          : undefined,
        query.schedules.length > 0 ? inArray(jobOffers.schedule, query.schedules) : undefined,
        query.publishedWithinDays
          ? gte(
              jobOffers.publishedAt,
              new Date(now.getTime() - query.publishedWithinDays * 24 * 60 * 60_000),
            )
          : undefined,
        relevance.length > 0 ? sql`(${sql.join(relevance, sql` or `)})` : undefined,
      ),
    )
    .orderBy(desc(jobOffers.publishedAt), jobOffers.id)
    .limit(MAX_CANDIDATES + 1);

  const candidates = rows.slice(0, MAX_CANDIDATES).flatMap((r): SearchCandidate[] =>
    r.publishedAt
      ? [
          {
            ...r,
            publishedAt: r.publishedAt,
            salaryMin: r.salaryMin != null ? Number(r.salaryMin) : null,
            salaryMax: r.salaryMax != null ? Number(r.salaryMax) : null,
            distanceKm: r.distanceKm != null ? Number(r.distanceKm) : null,
          },
        ]
      : [],
  );
  return { candidates, truncated: rows.length > MAX_CANDIDATES };
}

export type SearchOutcome =
  | {
      status: "results";
      occupation: OccupationMatch | null;
      place: SearchPlace | null;
      page: SearchPage;
      truncated: boolean;
    }
  | { status: "place"; resolution: Exclude<PlaceResolution, { status: "found" }> };

export async function searchOffers(deps: SearchDeps, query: SearchQuery): Promise<SearchOutcome> {
  const now = deps.now();
  let place: SearchPlace | null = null;
  if (query.dove) {
    const resolution = await findMunicipality(deps.db, query.dove);
    if (resolution.status !== "found") return { status: "place", resolution };
    place = resolution.place;
  }
  const occupation = recognizeOccupation(deps.occupations, query.q);
  const { candidates, truncated } = await findCandidates(deps.db, {
    text: query.q,
    occupation,
    place,
    radiusKm: query.radiusKm,
    query,
    now,
  });
  const ctx: SearchContext = {
    occupation,
    hasText: Boolean(query.q),
    radiusKm: place ? query.radiusKm : null,
    now,
  };
  const page = rankOffers(candidates, ctx, {
    minMonthlySalary: query.minMonthlySalary,
    page: query.page,
  });
  return { status: "results", occupation, place, page, truncated };
}
