import { LEGAL_VERSIONS } from "@/modules/identity/domain";
import { PRIVACY_VERSIONS } from "../../../../content/legal/privacy";
import { versionedLegalDocument } from "./legal-versions";

/**
 * Informativa sulla privacy versionata (WP-024c, art. 13 GDPR), come le condizioni d'uso. La versione in vigore è
 * quella di cui si registra la presa visione alla registrazione (`LEGAL_VERSIONS.privacyNotice`, tabella `consents`).
 * L'informativa non si "accetta di nuovo": è informazione, non consenso; le modifiche importanti si comunicano.
 */
export const CURRENT_PRIVACY_NOTICE: string = LEGAL_VERSIONS.privacyNotice;

export const privacyNoticeDocument = versionedLegalDocument(
  PRIVACY_VERSIONS,
  CURRENT_PRIVACY_NOTICE,
);
