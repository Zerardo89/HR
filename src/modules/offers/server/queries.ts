import { and, desc, eq, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { companyMembers, jobOffers, municipalities, provinces } from "@/lib/db/schema";
import { effectiveStatus, OTHER_PLACE } from "../domain";

export type CompanyOfferRow = {
  id: string;
  title: string;
  status: "draft" | "pending_review" | "published" | "expired" | "closed" | "removed";
  validThrough: Date | null;
  updatedAt: Date;
};

/** Offerte delle aziende di cui l'utente è membro (autorizzazione: solo le proprie). Stato effettivo (WP-022). */
export async function listOffersForCompany(
  db: NodePgDatabase,
  userId: string,
  companyId: string,
  now: Date = new Date(),
): Promise<CompanyOfferRow[]> {
  const rows = await db
    .select({
      id: jobOffers.id,
      title: jobOffers.title,
      status: jobOffers.status,
      validThrough: jobOffers.validThrough,
      updatedAt: jobOffers.updatedAt,
    })
    .from(jobOffers)
    .innerJoin(
      companyMembers,
      and(eq(companyMembers.companyId, jobOffers.companyId), eq(companyMembers.userId, userId)),
    )
    .where(eq(jobOffers.companyId, companyId))
    .orderBy(desc(jobOffers.updatedAt));
  return rows.map((r) => ({ ...r, status: effectiveStatus(r.status, r.validThrough, now) }));
}

export type EditableOffer = {
  id: string;
  companyId: string;
  /** Stato effettivo: una pubblicata oltre la scadenza è già "scaduta" (WP-022). */
  status: CompanyOfferRow["status"];
  /** Stato salvato nel DB (per chiusura e rinnovo). */
  storedStatus: CompanyOfferRow["status"];
  validThrough: Date | null;
  values: Record<string, string>;
  /** Ultimo rifiuto del moderatore (DSA art. 17: l'azienda vede il motivo), se l'offerta è tornata bozza. */
  rejection: { reason: string; note?: string } | null;
};

/** Offerta da modificare, solo se appartiene a un'azienda dell'utente. Valori già pronti per il form. */
export async function getOfferForMember(
  db: NodePgDatabase,
  userId: string,
  offerId: string,
  now: Date = new Date(),
): Promise<EditableOffer | null> {
  const [o] = await db
    .select({ offer: jobOffers, place: municipalities.name, province: provinces.abbreviation })
    .from(jobOffers)
    .innerJoin(
      companyMembers,
      and(eq(companyMembers.companyId, jobOffers.companyId), eq(companyMembers.userId, userId)),
    )
    .innerJoin(municipalities, eq(municipalities.istatCode, jobOffers.municipalityCode))
    .innerJoin(provinces, eq(provinces.code, municipalities.provinceCode))
    .where(and(eq(jobOffers.id, offerId), inArray(companyMembers.role, ["owner", "recruiter"])))
    .limit(1);
  if (!o) return null;
  const offer = o.offer;
  const moderation = offer.moderation as {
    validDays?: number;
    decision?: { decision?: string; reason?: string; note?: string };
  };
  const rejected = offer.status === "draft" && moderation.decision?.decision === "rejected";
  return {
    id: offer.id,
    companyId: offer.companyId,
    status: effectiveStatus(offer.status, offer.validThrough, now),
    storedStatus: offer.status,
    validThrough: offer.validThrough,
    values: {
      // Senza sede = luogo di lavoro scritto a mano ("altro comune", WP-016).
      siteId: offer.siteId ?? OTHER_PLACE,
      place: offer.siteId ? "" : `${o.place} (${o.province})`,
      occupationId: String(offer.occupationId),
      title: offer.title,
      description: offer.descriptionMd,
      contractType: offer.contractType,
      schedule: offer.schedule,
      hoursPerWeek: offer.hoursPerWeek != null ? String(offer.hoursPerWeek) : "",
      salaryMin: offer.salaryMin != null ? String(Number(offer.salaryMin)) : "",
      salaryMax: offer.salaryMax != null ? String(Number(offer.salaryMax)) : "",
      salaryPeriod: offer.salaryPeriod ?? "",
      salaryBasis: offer.salaryBasis,
      ccnl: offer.ccnl ?? "",
      validDays: String(moderation.validDays ?? 30),
    },
    rejection: rejected
      ? { reason: moderation.decision?.reason ?? "other", note: moderation.decision?.note }
      : null,
  };
}
