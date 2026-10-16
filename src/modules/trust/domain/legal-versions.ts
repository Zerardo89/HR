/**
 * Documenti legali versionati (WP-024b condizioni d'uso, WP-024c informativa privacy): ogni versione pubblicata resta
 * consultabile, identica a come è stata letta o accettata; quella in vigore è indicata da `LEGAL_VERSIONS`.
 */

export type LegalVersionText = { publishedOn: string; text: string };

export type LegalDocumentVersion = {
  id: string;
  publishedOn: string;
  text: string;
  current: boolean;
};

export type VersionedLegalDocument = {
  current: string;
  /** Una versione (quella in vigore se `id` manca); `null` se non esiste. */
  version(id?: string): LegalDocumentVersion | null;
  /** Tutte le versioni, dalla più recente. */
  history(): Omit<LegalDocumentVersion, "text">[];
};

export function versionedLegalDocument(
  versions: Record<string, LegalVersionText>,
  current: string,
): VersionedLegalDocument {
  return {
    current,
    version(id = current) {
      const v = Object.hasOwn(versions, id) ? versions[id] : undefined;
      return v ? { id, ...v, current: id === current } : null;
    },
    history() {
      return Object.entries(versions)
        .map(([id, v]) => ({ id, publishedOn: v.publishedOn, current: id === current }))
        .sort((a, b) => b.publishedOn.localeCompare(a.publishedOn) || b.id.localeCompare(a.id));
    },
  };
}
