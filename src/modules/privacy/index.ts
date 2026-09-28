import "server-only";

// Modulo `privacy` — API pubblica (lato server).
// Consensi, export, cancellazione con crypto-shredding, conservazione (R-PRIV-*).
// Unico modulo (con `lib/crypto`) che decifra dati personali: `decryptPii()` con audit (03-ARCHITETTURA §4).
// Struttura: domain/ (puro) · server/ (DB, servizi) · ui/ (componenti) · index.ts
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
