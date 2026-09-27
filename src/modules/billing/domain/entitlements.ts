/**
 * Diritti delle aziende (ADR-0010, docs/05-MONETIZZAZIONE.md). Funzioni pure.
 * - Piano Nazionale (`national`): pubblicare offerte fuori dalla zona gratuita (regione ∪ 50 km, ADR-0009).
 * - Periodo fondatori: le aziende registrate entro il 31/12/2026 hanno il Nazionale gratis fino a fine periodo
 *   (`FOUNDERS_PERIOD_UNTIL`, di norma 31/01/2027). Si calcola dalla data di registrazione: nessuna riga da creare.
 * Nessun diritto riguarda i lavoratori o il loro posto nei risultati (R-LAV-01).
 */

export const ENTITLEMENT_PRODUCTS = ["supporter", "national", "featured"] as const;
export type EntitlementProduct = (typeof ENTITLEMENT_PRODUCTS)[number];
export type EntitlementSource = "stripe" | "crowdfunding" | "promo" | "founders";

/** Registrate entro questa data = aziende fondatrici (docs/05 §4). */
export const FOUNDERS_REGISTRATION_DEADLINE = new Date("2026-12-31T23:59:59+01:00");

export type Entitlement = {
  product: EntitlementProduct;
  validFrom: Date;
  validTo: Date | null;
  source: EntitlementSource;
};

/** Piano Nazionale gratuito del periodo fondatori, se l'azienda ne ha diritto. */
export function foundersGrant(
  companyCreatedAt: Date,
  foundersPeriodUntil: Date,
): Entitlement | null {
  if (companyCreatedAt.getTime() > FOUNDERS_REGISTRATION_DEADLINE.getTime()) return null;
  if (foundersPeriodUntil.getTime() <= companyCreatedAt.getTime()) return null;
  return {
    product: "national",
    validFrom: companyCreatedAt,
    validTo: foundersPeriodUntil,
    source: "founders",
  };
}

export function isActive(e: Entitlement, now: Date): boolean {
  return (
    e.validFrom.getTime() <= now.getTime() &&
    (e.validTo === null || e.validTo.getTime() > now.getTime())
  );
}

/** Il diritto attivo che dura di più (per dire "fino al …"), o `null`. */
export function activeEntitlement(
  entitlements: readonly Entitlement[],
  product: EntitlementProduct,
  now: Date,
): Entitlement | null {
  const active = entitlements.filter((e) => e.product === product && isActive(e, now));
  if (active.length === 0) return null;
  return active.reduce((best, e) =>
    best.validTo === null || (e.validTo !== null && e.validTo.getTime() <= best.validTo.getTime())
      ? best
      : e,
  );
}
