import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { companies, companyMembers, companySites, municipalities } from "@/lib/db/schema";

export type MyCompany = {
  id: string;
  displayName: string;
  legalName: string;
  vatNumber: string;
  kind: "employer" | "agency";
  status: "pending" | "verified" | "suspended";
  role: "owner" | "recruiter";
  legalSeat: string | null;
};

/** Le aziende di cui l'utente fa parte (autorizzazione: solo le proprie). */
export async function getCompaniesForUser(
  db: NodePgDatabase,
  userId: string,
): Promise<MyCompany[]> {
  return db
    .select({
      id: companies.id,
      displayName: companies.displayName,
      legalName: companies.legalName,
      vatNumber: companies.vatNumber,
      kind: companies.kind,
      status: companies.status,
      role: companyMembers.role,
      legalSeat: municipalities.name,
    })
    .from(companyMembers)
    .innerJoin(companies, eq(companies.id, companyMembers.companyId))
    .leftJoin(
      companySites,
      and(eq(companySites.companyId, companies.id), eq(companySites.isLegalSeat, true)),
    )
    .leftJoin(municipalities, eq(municipalities.istatCode, companySites.municipalityCode))
    .where(eq(companyMembers.userId, userId))
    .orderBy(companies.displayName);
}
