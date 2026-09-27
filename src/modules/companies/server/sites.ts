import { and, asc, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  auditLog,
  companies,
  companyMembers,
  companySites,
  municipalities,
  provinces,
  users,
} from "@/lib/db/schema";
import { findMunicipality, type MunicipalityRef } from "@/modules/geo";
import { normalizePlaceName } from "@/modules/geo/domain";
import {
  MAX_SITES_PER_COMPANY,
  siteState,
  type SiteDecision,
  type SiteInput,
  type SiteRejectionReason,
  type SiteState,
} from "../domain";

/*
 * Sedi operative (WP-011c). Le aggiunge il titolare; contano per la zona gratuita e per le offerte solo dopo
 * l'approvazione di un moderatore (ADR-0009). Una sede rifiutata resta visibile all'azienda con il motivo.
 */

type Deps = { db: NodePgDatabase; now: () => Date };

/** Il titolare attivo dell'azienda (autorizzazione lato server: mai fidarsi del modulo). */
export async function isCompanyOwner(
  db: NodePgDatabase,
  userId: string,
  companyId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ role: companyMembers.role })
    .from(companyMembers)
    .innerJoin(users, eq(users.id, companyMembers.userId))
    .where(
      and(
        eq(companyMembers.companyId, companyId),
        eq(companyMembers.userId, userId),
        eq(users.status, "active"),
        eq(users.role, "company_member"),
      ),
    )
    .limit(1);
  return row?.role === "owner";
}

export type AddSiteResult =
  | { status: "added"; siteId: string }
  | { status: "not_allowed" }
  | { status: "place_ambiguous"; options: MunicipalityRef[] }
  | { status: "place_not_found"; suggestions: MunicipalityRef[] }
  | { status: "duplicate" }
  | { status: "too_many" };

export async function addSite(
  deps: Deps,
  userId: string,
  input: SiteInput,
): Promise<AddSiteResult> {
  if (!(await isCompanyOwner(deps.db, userId, input.companyId))) return { status: "not_allowed" };

  const lookup = await findMunicipality(deps.db, input.place);
  if (lookup.status === "ambiguous") return { status: "place_ambiguous", options: lookup.options };
  if (lookup.status === "not_found")
    return { status: "place_not_found", suggestions: lookup.suggestions };

  const existing = await deps.db
    .select({ label: companySites.label, municipalityCode: companySites.municipalityCode })
    .from(companySites)
    .where(and(eq(companySites.companyId, input.companyId), isNull(companySites.rejectedAt)));
  if (existing.length >= MAX_SITES_PER_COMPANY) return { status: "too_many" };
  const label = normalizePlaceName(input.label);
  if (
    existing.some(
      (s) => s.municipalityCode === lookup.place.code && normalizePlaceName(s.label) === label,
    )
  ) {
    return { status: "duplicate" };
  }

  const [site] = await deps.db
    .insert(companySites)
    .values({
      companyId: input.companyId,
      municipalityCode: lookup.place.code,
      label: input.label,
      isLegalSeat: false,
      createdAt: deps.now(),
    })
    .returning({ id: companySites.id });
  return { status: "added", siteId: site!.id };
}

export type CompanySiteRow = {
  id: string;
  label: string;
  municipality: string;
  provinceAbbr: string;
  isLegalSeat: boolean;
  state: SiteState;
  rejectionReason: SiteRejectionReason | null;
};

/** Sedi dell'azienda, per i suoi membri: prima la sede legale, poi in ordine di inserimento. */
export async function listCompanySites(
  db: NodePgDatabase,
  userId: string,
  companyId: string,
): Promise<CompanySiteRow[] | null> {
  const [member] = await db
    .select({ role: companyMembers.role })
    .from(companyMembers)
    .where(and(eq(companyMembers.companyId, companyId), eq(companyMembers.userId, userId)))
    .limit(1);
  if (!member) return null;
  const rows = await db
    .select({
      id: companySites.id,
      label: companySites.label,
      municipality: municipalities.name,
      provinceAbbr: provinces.abbreviation,
      isLegalSeat: companySites.isLegalSeat,
      approvedAt: companySites.approvedAt,
      rejectedAt: companySites.rejectedAt,
      rejectionReason: companySites.rejectionReason,
    })
    .from(companySites)
    .innerJoin(municipalities, eq(municipalities.istatCode, companySites.municipalityCode))
    .innerJoin(provinces, eq(provinces.code, municipalities.provinceCode))
    .where(eq(companySites.companyId, companyId))
    .orderBy(desc(companySites.isLegalSeat), asc(companySites.createdAt));
  return rows.map(({ approvedAt, rejectedAt, rejectionReason, ...r }) => ({
    ...r,
    state: siteState({ approvedAt, rejectedAt }),
    rejectionReason: rejectionReason as SiteRejectionReason | null,
  }));
}

/** Il titolare toglie una sede operativa (mai la legale). Le offerte già pubblicate restano nel loro comune. */
export async function removeSite(
  deps: Deps,
  userId: string,
  siteId: string,
): Promise<{ status: "removed" | "not_found" | "not_allowed" }> {
  const [site] = await deps.db
    .select({ companyId: companySites.companyId, isLegalSeat: companySites.isLegalSeat })
    .from(companySites)
    .where(eq(companySites.id, siteId))
    .limit(1);
  if (!site) return { status: "not_found" };
  if (site.isLegalSeat || !(await isCompanyOwner(deps.db, userId, site.companyId)))
    return { status: "not_allowed" };
  await deps.db.delete(companySites).where(eq(companySites.id, siteId));
  return { status: "removed" };
}

// ─── Moderazione ───────────────────────────────────────────────────────────────────────────────────

export type PendingSite = {
  id: string;
  companyId: string;
  companyName: string;
  companyStatus: "pending" | "verified" | "suspended";
  label: string;
  municipality: string;
  provinceAbbr: string;
  legalSeat: string | null;
  /** Distanza in linea d'aria dalla sede legale: aiuta a riconoscere sedi di comodo. */
  distanceFromLegalSeatKm: number | null;
  sameRegionAsLegalSeat: boolean | null;
  pendingSitesOfCompany: number;
  createdAt: Date;
};

export async function listPendingSites(db: NodePgDatabase): Promise<PendingSite[]> {
  const seat = alias(companySites, "seat");
  const seatPlace = alias(municipalities, "seat_place");
  const rows = await db
    .select({
      id: companySites.id,
      companyId: companies.id,
      companyName: companies.displayName,
      companyStatus: companies.status,
      label: companySites.label,
      municipality: municipalities.name,
      provinceAbbr: provinces.abbreviation,
      legalSeat: seatPlace.name,
      distanceKm: sql<
        number | null
      >`case when ${seatPlace.istatCode} is null then null else ST_Distance(${municipalities.centroid}, ${seatPlace.centroid}, false) / 1000 end`,
      sameRegion: sql<
        boolean | null
      >`case when ${seatPlace.istatCode} is null then null else ${seatPlace.regionCode} = ${municipalities.regionCode} end`,
      pendingSitesOfCompany: sql<number>`(select count(*)::int from company_sites p
        where p.company_id = ${companies.id} and p.approved_at is null and p.rejected_at is null)`,
      createdAt: companySites.createdAt,
    })
    .from(companySites)
    .innerJoin(companies, eq(companies.id, companySites.companyId))
    .innerJoin(municipalities, eq(municipalities.istatCode, companySites.municipalityCode))
    .innerJoin(provinces, eq(provinces.code, municipalities.provinceCode))
    .leftJoin(seat, and(eq(seat.companyId, companies.id), eq(seat.isLegalSeat, true)))
    .leftJoin(seatPlace, eq(seatPlace.istatCode, seat.municipalityCode))
    .where(
      and(
        isNull(companySites.approvedAt),
        isNull(companySites.rejectedAt),
        eq(companySites.isLegalSeat, false),
        ne(companies.status, "suspended"),
      ),
    )
    .orderBy(asc(companySites.createdAt))
    .limit(200);
  return rows.map(({ distanceKm, sameRegion, ...r }) => ({
    ...r,
    distanceFromLegalSeatKm: distanceKm != null ? Math.round(Number(distanceKm)) : null,
    sameRegionAsLegalSeat: sameRegion,
  }));
}

async function isActiveModerator(db: NodePgDatabase, userId: string): Promise<boolean> {
  const [u] = await db
    .select({ role: users.role, status: users.status })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return Boolean(u && u.status === "active" && (u.role === "moderator" || u.role === "admin"));
}

export type SiteDecisionResult = { status: "approved" | "rejected" | "not_found" | "not_allowed" };

/** Approva o rifiuta una sede in attesa; la decisione resta nel log di audit. */
export async function decideSite(
  deps: Deps,
  moderatorId: string,
  input: SiteDecision,
): Promise<SiteDecisionResult> {
  if (!(await isActiveModerator(deps.db, moderatorId))) return { status: "not_allowed" };
  const now = deps.now();
  const pending = and(
    eq(companySites.id, input.siteId),
    isNull(companySites.approvedAt),
    isNull(companySites.rejectedAt),
  );
  const [done] = await deps.db
    .update(companySites)
    .set(
      input.decision === "approve"
        ? { approvedAt: now }
        : { rejectedAt: now, rejectionReason: input.reason },
    )
    .where(pending)
    .returning({ id: companySites.id });
  if (!done) return { status: "not_found" };
  await deps.db.insert(auditLog).values({
    actorId: moderatorId,
    action: "company.site",
    targetTable: "company_sites",
    targetId: input.siteId,
    purpose: input.decision === "approve" ? "approve" : `reject:${input.reason}`,
    at: now,
  });
  return { status: input.decision === "approve" ? "approved" : "rejected" };
}
