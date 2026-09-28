import "server-only";
import { getDb } from "@/lib/db";
import {
  deleteInactiveAccounts,
  hideInactiveProfiles,
  purgeOldAuditLog,
  purgeWaitlist,
  sendDeletionNotices,
} from "./server/retention";
import { retentionRuntimeDeps } from "./server/runtime";

// Modulo `privacy` — servizi senza componenti né Next.js, per gli altri moduli e per il worker (WP-020, WP-023).
// Le pagine usano `index.ts` (che aggiunge le Server Actions del centro privacy).
export { dbAuditSink } from "./server/audit";
export {
  readWorkerPii,
  sealWorkerPii,
  type PrivacyDeps,
  type WorkerPiiAccess,
} from "./server/worker-pii";
export {
  companyNotificationEmails,
  companyRecipient,
  readApplicantForCompany,
  sealApplicationMessage,
  type ApplicantView,
} from "./server/application-pii";
export {
  companyMemberEmails,
  NOTIFICATION_PURPOSES,
  notificationEmail,
  type NotificationPurpose,
} from "./server/notify";
export { eraseAccount, type ErasureReason, type ErasureResult } from "./server/erasure";

// ─── Job di conservazione (WP-023b, R-PRIV-03, docs/04 §8) ───────────────────────────────────────────────

/** Job `retention.accounts`: inattività 6 mesi (nascondi), 23 (preavviso), 24 (cancella). */
export async function runAccountRetention(): Promise<Record<string, number>> {
  const deps = retentionRuntimeDeps();
  return {
    ...(await hideInactiveProfiles(deps)),
    ...(await sendDeletionNotices(deps)),
    ...(await deleteInactiveAccounts(deps)),
  };
}

/** Job `retention.audit`: log di sicurezza oltre i 12 mesi. */
export function purgeAuditLog(): Promise<{ auditRowsDeleted: number }> {
  return purgeOldAuditLog(getDb(), new Date());
}

/** Job `retention.waitlist`: iscritti già registrati, e tutti dopo 6 mesi dal lancio. */
export function purgeWaitlistEntries(): Promise<{ waitlistDeleted: number }> {
  return purgeWaitlist(getDb(), new Date());
}
