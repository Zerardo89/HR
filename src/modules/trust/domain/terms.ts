import { LEGAL_VERSIONS } from "@/modules/identity/domain";
import { TERMS_VERSIONS } from "../../../../content/legal/condizioni";
import { versionedLegalDocument, type LegalDocumentVersion } from "./legal-versions";

/**
 * Condizioni d'uso versionate (WP-024b, R-DSA-02, DSA art. 14). La versione in vigore è quella accettata alla
 * registrazione (`LEGAL_VERSIONS.terms`); le precedenti restano consultabili, uguali a come sono state accettate.
 */

export const CURRENT_TERMS: string = LEGAL_VERSIONS.terms;

export type TermsVersion = LegalDocumentVersion;

export const termsDocument = versionedLegalDocument(TERMS_VERSIONS, CURRENT_TERMS);

/** Una versione (quella in vigore se `id` manca); `null` se non esiste. */
export function termsVersion(id: string = CURRENT_TERMS): TermsVersion | null {
  return termsDocument.version(id);
}

/** Tutte le versioni, dalla più recente. */
export function termsHistory(): Omit<TermsVersion, "text">[] {
  return termsDocument.history();
}

/** Da accettare di nuovo: l'ultima versione accettata non è quella in vigore (o non ce n'è nessuna). */
export function termsOutdated(acceptedVersion: string | null): boolean {
  return acceptedVersion !== CURRENT_TERMS;
}
