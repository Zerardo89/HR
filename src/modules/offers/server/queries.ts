import { and, desc, eq, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { companyMembers, jobOffers } from "@/lib/db/schema";

export type CompanyOfferRow = {
  id: string;
  title: string;
  status: "draft" | "pending_review" | "published" | "expired" | "closed" | "removed";
  validThrough: Date | null;
  updatedAt: Date;
};

/** Offerte delle aziende di cui l'utente è membro (autorizzazione: solo le proprie). */
export async function listOffersForCompany(
  db: NodePgDatabase,
  userId: string,
  companyId: string,
): Promise<CompanyOfferRow[]> {
  return db
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
}

export type EditableOffer = {
  id: string;
  companyId: string;
  status: CompanyOfferRow["status"];
  values: Record<string, string>;
};

/** Offerta da modificare, solo se appartiene a un'azienda dell'utente. Valori già pronti per il form. */
export async function getOfferForMember(
  db: NodePgDatabase,
  userId: string,
  offerId: string,
): Promise<EditableOffer | null> {
  const [o] = await db
    .select({ offer: jobOffers })
    .from(jobOffers)
    .innerJoin(
      companyMembers,
      and(eq(companyMembers.companyId, jobOffers.companyId), eq(companyMembers.userId, userId)),
    )
    .where(and(eq(jobOffers.id, offerId), inArray(companyMembers.role, ["owner", "recruiter"])))
    .limit(1);
  if (!o) return null;
  const offer = o.offer;
  const moderation = offer.moderation as { validDays?: number };
  return {
    id: offer.id,
    companyId: offer.companyId,
    status: offer.status,
    values: {
      siteId: offer.siteId ?? "",
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
  };
}
