import "server-only";

// Modulo `waitlist` — lista d'attesa pre-lancio con doppia conferma (WP-009).
export { ConfirmForm } from "./ui/confirm-form";
export { WaitlistForm } from "./ui/waitlist-form";
export { deleteUnconfirmedWaitlist } from "./server/waitlist";
export { runtimeDeps as waitlistRuntimeDeps } from "./server/runtime";
