import { and, desc, eq, gt, gte, inArray, or, sql, type SQL } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { companies, jobOffers, municipalities, occupations, provinces } from "@/lib/db/schema";

/*
 * Offerte per un profilo (WP-021, mail mensile; 01-PRODOTTO §5.3 e §6.2): pubblicate negli ultimi giorni, della
 * stessa mansione (o simile, stesso gruppo ISCO) e nel raggio del lavoratore, oppure nelle regioni in cui ha detto
 * di volersi trasferire. Chi decide se un'offerta "per trasferimento" può arrivare (Piano Nazionale dell'azienda,
 * ADR-0009) è il chiamante: qui si segnala solo con `inRadius = false`.
 * Ordine spiegabile: stessa mansione, poi nel raggio, poi più recente.
 */

export type ProfileOfferQuery = {
  occupationIds: number[];
  lat: number;
  lon: number;
  radiusKm: number;
  relocationRegionCodes: string[];
  publishedSince: Date;
  now: Date;
  limit: number;
};

export type ProfileOffer = {
  id: string;
  title: string;
  companyId: string;
  companyName: string;
  municipality: string;
  provinceAbbr: string;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryPeriod: "hour" | "month" | "year" | null;
  salaryBasis: "gross" | "net";
  publishedAt: Date;
  sameOccupation: boolean;
  inRadius: boolean;
};

export async function findOffersForProfile(
  db: NodePgDatabase,
  q: ProfileOfferQuery,
): Promise<ProfileOffer[]> {
  if (q.occupationIds.length === 0) return [];
  const point = sql`ST_SetSRID(ST_MakePoint(${q.lon}::float8, ${q.lat}::float8), 4326)::geography`;
  const inRadius: SQL<boolean> = sql<boolean>`ST_DWithin(${municipalities.centroid}, ${point}, ${q.radiusKm * 1000}::float8, false)`;
  const sameOccupation: SQL<boolean> = sql<boolean>`${jobOffers.occupationId} in (${sql.join(
    q.occupationIds.map((id) => sql`${id}::int`),
    sql`, `,
  )})`;
  const groups = sql`(select o.group_code from occupations o where o.id in (${sql.join(
    q.occupationIds.map((id) => sql`${id}::int`),
    sql`, `,
  )}) and o.group_code is not null)`;
  const where = [
    eq(jobOffers.status, "published"),
    gt(jobOffers.validThrough, q.now),
    gte(jobOffers.publishedAt, q.publishedSince),
    eq(companies.status, "verified"),
    or(sameOccupation, sql`${occupations.groupCode} in ${groups}`),
    q.relocationRegionCodes.length > 0
      ? or(inRadius, inArray(municipalities.regionCode, q.relocationRegionCodes))
      : inRadius,
  ];
  const rows = await db
    .select({
      id: jobOffers.id,
      title: jobOffers.title,
      companyId: companies.id,
      companyName: companies.displayName,
      municipality: municipalities.name,
      provinceAbbr: provinces.abbreviation,
      salaryMin: jobOffers.salaryMin,
      salaryMax: jobOffers.salaryMax,
      salaryPeriod: jobOffers.salaryPeriod,
      salaryBasis: jobOffers.salaryBasis,
      publishedAt: jobOffers.publishedAt,
      sameOccupation,
      inRadius,
    })
    .from(jobOffers)
    .innerJoin(companies, eq(companies.id, jobOffers.companyId))
    .innerJoin(municipalities, eq(municipalities.istatCode, jobOffers.municipalityCode))
    .innerJoin(provinces, eq(provinces.code, municipalities.provinceCode))
    .innerJoin(occupations, eq(occupations.id, jobOffers.occupationId))
    .where(and(...where))
    .orderBy(desc(sameOccupation), desc(inRadius), desc(jobOffers.publishedAt), jobOffers.id)
    .limit(q.limit);
  return rows.map((r) => ({
    ...r,
    salaryMin: r.salaryMin != null ? Number(r.salaryMin) : null,
    salaryMax: r.salaryMax != null ? Number(r.salaryMax) : null,
    publishedAt: r.publishedAt!,
  }));
}
