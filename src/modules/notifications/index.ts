import "server-only";

// Modulo `notifications` — API pubblica (lato server).
// Avvisi email per le ricerche salvate (WP-020), controllo mensile ogni 30 giorni (WP-021), template.
// Struttura: domain/ (puro) · server/ (DB, servizi) · jobs.ts (per il worker) · index.ts
import { getDb } from "@/lib/db";
import type { SearchQuery } from "@/modules/matching/domain";
import { hasAlertFor, listAlerts, type SavedAlert } from "./server/saved-searches";
import {
  notifyApplicationUpdate,
  notifyCompanyVerified,
  notifyOfferOutcome,
  notifySiteOutcome,
} from "./server/outcomes";
import { outcomeRuntimeDeps, runtimeDeps } from "./server/runtime";
import { checkUnsubscribeToken, unsubscribeWithToken } from "./server/unsubscribe";

export type { SavedAlert };
export {
  deleteAlertAction,
  saveAlertAction,
  setAlertFrequencyAction,
  unsubscribeAction,
} from "./server/actions";

export function getMyAlerts(userId: string) {
  return listAlerts(getDb(), userId);
}

export function hasAlertForSearch(userId: string, query: SearchQuery): Promise<boolean> {
  return hasAlertFor(getDb(), userId, query);
}

export function checkUnsubscribeLink(token: unknown) {
  return checkUnsubscribeToken(runtimeDeps(), token);
}

/** Per il POST "un clic" (RFC 8058) della route `/api/avvisi/disiscrizione`. */
export function unsubscribeOneClick(token: unknown) {
  return unsubscribeWithToken(runtimeDeps(), token);
}

// ─── Email di esito (WP-020c): da chiamare DOPO che la decisione è salvata ─────────────────────────────

export function sendOfferOutcomeEmail(offerId: string): Promise<number> {
  return notifyOfferOutcome(outcomeRuntimeDeps(), offerId);
}

export function sendSiteOutcomeEmail(siteId: string): Promise<number> {
  return notifySiteOutcome(outcomeRuntimeDeps(), siteId);
}

export function sendCompanyVerifiedEmail(companyId: string): Promise<number> {
  return notifyCompanyVerified(outcomeRuntimeDeps(), companyId);
}

export function sendApplicationUpdateEmail(applicationId: string): Promise<number> {
  return notifyApplicationUpdate(outcomeRuntimeDeps(), applicationId);
}
