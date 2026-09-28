import { LEGAL_VERSIONS } from "@/modules/identity/domain";
import { TERMS_VERSIONS } from "../../../../content/legal/condizioni";

/**
 * Condizioni d'uso versionate (WP-024b, R-DSA-02, DSA art. 14). La versione in vigore è quella accettata alla
 * registrazione (`LEGAL_VERSIONS.terms`); le precedenti restano consultabili, uguali a come sono state accettate.
 */

export const CURRENT_TERMS: string = LEGAL_VERSIONS.terms;

export type TermsVersion = { id: string; publishedOn: string; text: string; current: boolean };

/** Una versione (quella in vigore se `id` manca); `null` se non esiste. */
export function termsVersion(id: string = CURRENT_TERMS): TermsVersion | null {
  const v = Object.hasOwn(TERMS_VERSIONS, id) ? TERMS_VERSIONS[id] : undefined;
  return v ? { id, ...v, current: id === CURRENT_TERMS } : null;
}

/** Tutte le versioni, dalla più recente. */
export function termsHistory(): Omit<TermsVersion, "text">[] {
  return Object.entries(TERMS_VERSIONS)
    .map(([id, v]) => ({ id, publishedOn: v.publishedOn, current: id === CURRENT_TERMS }))
    .sort((a, b) => b.publishedOn.localeCompare(a.publishedOn) || b.id.localeCompare(a.id));
}

/** Da accettare di nuovo: l'ultima versione accettata non è quella in vigore (o non ce n'è nessuna). */
export function termsOutdated(acceptedVersion: string | null): boolean {
  return acceptedVersion !== CURRENT_TERMS;
}
