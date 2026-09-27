import { and, desc, eq, gt } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { companies, jobOffers, municipalities, occupations, provinces } from "@/lib/db/schema";
import type { PublicOffer } from "../domain";

export type PublicOfferResult =
  | { state: "live"; offer: PublicOffer }
  | { state: "gone"; title: string } // scaduta o chiusa: si dice, senza indicizzare
  | null; // bozza, in moderazione, rimossa o inesistente: 404

/** Offerta per la pagina pubblica (WP-014): visibile solo se pubblicata, non scaduta e di un'azienda attiva. */
export async function getPublicOffer(
  db: NodePgDatabase,
  id: string,
  now: Date,
): Promise<PublicOfferResult> {
  const [r] = await db
    .select({
      id: jobOffers.id,
      title: jobOffers.title,
      description: jobOffers.descriptionMd,
      status: jobOffers.status,
      companyName: companies.displayName,
      companyStatus: companies.status,
      municipality: municipalities.name,
      provinceAbbr: provinces.abbreviation,
      contractType: jobOffers.contractType,
      schedule: jobOffers.schedule,
      hoursPerWeek: jobOffers.hoursPerWeek,
      salaryMin: jobOffers.salaryMin,
      salaryMax: jobOffers.salaryMax,
      salaryPeriod: jobOffers.salaryPeriod,
      salaryBasis: jobOffers.salaryBasis,
      ccnl: jobOffers.ccnl,
      occupation: occupations.labelIt,
      publishedAt: jobOffers.publishedAt,
      validThrough: jobOffers.validThrough,
    })
    .from(jobOffers)
    .innerJoin(companies, eq(companies.id, jobOffers.companyId))
    .innerJoin(municipalities, eq(municipalities.istatCode, jobOffers.municipalityCode))
    .innerJoin(provinces, eq(provinces.code, municipalities.provinceCode))
    .innerJoin(occupations, eq(occupations.id, jobOffers.occupationId))
    .where(eq(jobOffers.id, id))
    .limit(1);
  // Azienda sospesa o non verificata: l'offerta sparisce del tutto, anche se era già chiusa.
  if (!r || r.companyStatus !== "verified") return null;

  const expired = !r.validThrough || r.validThrough.getTime() <= now.getTime();
  if (r.status === "expired" || r.status === "closed" || (r.status === "published" && expired)) {
    return { state: "gone", title: r.title };
  }
  if (r.status !== "published" || !r.publishedAt || !r.validThrough) {
    return null;
  }
  return {
    state: "live",
    offer: {
      id: r.id,
      title: r.title,
      description: r.description,
      companyName: r.companyName,
      municipality: r.municipality,
      provinceAbbr: r.provinceAbbr,
      contractType: r.contractType,
      schedule: r.schedule,
      hoursPerWeek: r.hoursPerWeek,
      salaryMin: r.salaryMin != null ? Number(r.salaryMin) : null,
      salaryMax: r.salaryMax != null ? Number(r.salaryMax) : null,
      salaryPeriod: r.salaryPeriod,
      salaryBasis: r.salaryBasis,
      ccnl: r.ccnl,
      occupation: r.occupation,
      publishedAt: r.publishedAt,
      validThrough: r.validThrough,
    },
  };
}

/** Offerte visibili, per la sitemap (le più recenti per prime). */
export async function listLiveOfferIds(
  db: NodePgDatabase,
  now: Date,
): Promise<{ id: string; updatedAt: Date }[]> {
  return db
    .select({ id: jobOffers.id, updatedAt: jobOffers.updatedAt })
    .from(jobOffers)
    .innerJoin(companies, eq(companies.id, jobOffers.companyId))
    .where(
      and(
        eq(jobOffers.status, "published"),
        gt(jobOffers.validThrough, now),
        eq(companies.status, "verified"),
      ),
    )
    .orderBy(desc(jobOffers.updatedAt))
    .limit(50_000);
}
