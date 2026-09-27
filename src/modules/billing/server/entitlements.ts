import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { companies, entitlements } from "@/lib/db/schema";
import { flags } from "@/lib/flags";
import { foundersGrant, type Entitlement } from "../domain";

/**
 * Diritti di un'azienda: righe `entitlements` (Stripe, promo, crowdfunding) + periodo fondatori, calcolato
 * dalla data di registrazione (nessuna riga da creare o da ricordarsi di togliere).
 */
export async function loadCompanyEntitlements(
  db: NodePgDatabase,
  companyId: string,
  foundersPeriodUntil: Date = flags.foundersPeriodUntil,
): Promise<Entitlement[]> {
  const [company] = await db
    .select({ createdAt: companies.createdAt })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  if (!company) return [];
  const rows = await db
    .select({
      product: entitlements.product,
      validFrom: entitlements.validFrom,
      validTo: entitlements.validTo,
      source: entitlements.source,
    })
    .from(entitlements)
    .where(and(eq(entitlements.ownerType, "company"), eq(entitlements.ownerId, companyId)));
  const founders = foundersGrant(company.createdAt, foundersPeriodUntil);
  return founders ? [...rows, founders] : rows;
}
