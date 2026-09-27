import { and, count, desc, eq, inArray, lte } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  companies,
  companyMembers,
  companySites,
  jobOffers,
  municipalities,
  regionalInternshipMinimums,
} from "@/lib/db/schema";
import type { OfferContext } from "../domain";

export type OfferSite = {
  id: string;
  label: string;
  municipalityCode: string;
  municipalityName: string;
  regionCode: string;
  lat: number;
  lon: number;
  /** R-LAV-10: indennità minima mensile dei tirocini nella regione (null = tabella non ancora compilata). */
  internshipMonthlyMinimum: number | null;
};

export type CompanyOfferContext = {
  companyId: string;
  displayName: string;
  role: "owner" | "recruiter";
  validatorCompany: OfferContext["company"];
  /** Solo le sedi approvate: definiscono la zona gratuita dell'azienda (ADR-0009). */
  sites: OfferSite[];
};

/**
 * Contesto per creare offerte, SOLO se l'utente è membro dell'azienda (autorizzazione lato server).
 * `null` = non autorizzato o azienda inesistente.
 */
export async function getCompanyOfferContext(
  db: NodePgDatabase,
  userId: string,
  companyId: string,
  now: Date,
): Promise<CompanyOfferContext | null> {
  const [row] = await db
    .select({
      id: companies.id,
      displayName: companies.displayName,
      status: companies.status,
      kind: companies.kind,
      agencyAuthorization: companies.agencyAuthorization,
      role: companyMembers.role,
    })
    .from(companyMembers)
    .innerJoin(companies, eq(companies.id, companyMembers.companyId))
    .where(and(eq(companyMembers.userId, userId), eq(companyMembers.companyId, companyId)))
    .limit(1);
  if (!row) return null;

  const [published] = await db
    .select({ n: count() })
    .from(jobOffers)
    .where(
      and(
        eq(jobOffers.companyId, companyId),
        inArray(jobOffers.status, ["published", "expired", "closed"]),
      ),
    );

  const siteRows = await db
    .select({
      id: companySites.id,
      label: companySites.label,
      municipalityCode: companySites.municipalityCode,
      municipalityName: municipalities.name,
      regionCode: municipalities.regionCode,
      lat: municipalities.lat,
      lon: municipalities.lon,
      approvedAt: companySites.approvedAt,
    })
    .from(companySites)
    .innerJoin(municipalities, eq(municipalities.istatCode, companySites.municipalityCode))
    .where(eq(companySites.companyId, companyId))
    .orderBy(desc(companySites.isLegalSeat), companySites.label);

  const sites: OfferSite[] = [];
  for (const s of siteRows) {
    if (!s.approvedAt) continue;
    sites.push({
      id: s.id,
      label: s.label,
      municipalityCode: s.municipalityCode,
      municipalityName: s.municipalityName,
      regionCode: s.regionCode,
      lat: s.lat,
      lon: s.lon,
      internshipMonthlyMinimum: await internshipMinimum(db, s.regionCode, now),
    });
  }

  return {
    companyId: row.id,
    displayName: row.displayName,
    role: row.role,
    validatorCompany: {
      status: row.status,
      kind: row.kind,
      agencyAuthorization: row.agencyAuthorization,
      displayName: row.displayName,
      publishedOffers: published?.n ?? 0,
    },
    sites,
  };
}

/** R-LAV-10: indennità minima mensile dei tirocini in vigore nella regione (null = tabella non compilata). */
export async function internshipMinimum(
  db: NodePgDatabase,
  regionCode: string,
  now: Date,
): Promise<number | null> {
  const [minimum] = await db
    .select({ eur: regionalInternshipMinimums.monthlyMinEur })
    .from(regionalInternshipMinimums)
    .where(
      and(
        eq(regionalInternshipMinimums.regionCode, regionCode),
        lte(regionalInternshipMinimums.validFrom, now.toISOString().slice(0, 10)),
      ),
    )
    .orderBy(desc(regionalInternshipMinimums.validFrom))
    .limit(1);
  return minimum ? Number(minimum.eur) : null;
}
