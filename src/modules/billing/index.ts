import "server-only";

// Modulo `billing` — API pubblica (lato server).
// Entitlement e pagamenti Stripe (ADR-0010, dietro BILLING_ENABLED).
// Struttura: domain/ (puro) · server/ (DB, servizi) · ui/ (componenti) · index.ts
import { getDb } from "@/lib/db";
import { activeEntitlement, type Entitlement } from "./domain";
import { loadCompanyEntitlements } from "./server/entitlements";

export { loadCompanyEntitlements };

/** Piano Nazionale attivo per l'azienda (per dirlo nell'area azienda), o `null`. */
export async function getCompanyNationalPlan(companyId: string): Promise<Entitlement | null> {
  return activeEntitlement(
    await loadCompanyEntitlements(getDb(), companyId),
    "national",
    new Date(),
  );
}
