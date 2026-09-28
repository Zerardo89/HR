import "server-only";

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
