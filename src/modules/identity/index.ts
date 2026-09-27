import "server-only";

// Modulo `identity` — API pubblica (lato server): utenti, ruoli, accesso con codice via email, sessioni (ADR-0013).
// Struttura: domain/ (puro) · server/ (DB, servizi) · ui/ (componenti) · index.ts
export { getCurrentUser, requireUser } from "./server/current-user";
export { deleteExpiredAuthRows, deleteUserSessions, type SessionUser } from "./server/sessions";
export { runtimeDeps as identityRuntimeDeps } from "./server/runtime";
export { getTotpEnrollment, type TotpEnrollmentView } from "./server/enrollment";
export { MfaSetupForm } from "./ui/mfa-setup-form";
export { MfaVerifyForm } from "./ui/mfa-verify-form";
export { SignInFlow } from "./ui/sign-in-flow";
export { SignOutButton } from "./ui/sign-out-button";
