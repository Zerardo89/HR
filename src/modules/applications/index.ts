import "server-only";

// Modulo `applications` — API pubblica (lato server).
// Candidature del lavoratore e casella dell'azienda (WP-019). I dati personali li legge `modules/privacy`.
// Struttura: domain/ (puro) · server/ (DB, servizi) · ui/ (componenti) · index.ts
import { getDb } from "@/lib/db";
import {
  findMyApplication,
  listApplicationsForOffer,
  listMyApplications,
  openApplication,
  type InboxRow,
  type MyApplication,
  type OpenedApplication,
} from "./server/applications";
import { runtimeDeps } from "./server/runtime";

export type { InboxRow, MyApplication, OpenedApplication };
export { applyAction, decideAction, withdrawAction } from "./server/actions";
export { ApplyForm } from "./ui/apply-form";

export function getMyApplications(workerUserId: string): Promise<MyApplication[]> {
  return listMyApplications(getDb(), workerUserId);
}

export function getMyApplicationForOffer(workerUserId: string, offerId: string) {
  return findMyApplication(getDb(), workerUserId, offerId);
}

export function getInbox(userId: string, offerId: string) {
  return listApplicationsForOffer(runtimeDeps(), userId, offerId);
}

/** Apre la candidatura per l'azienda (lettura dei dati personali autorizzata e registrata). */
export function getApplicationForCompany(
  userId: string,
  applicationId: string,
): Promise<OpenedApplication | null> {
  return openApplication(runtimeDeps(), userId, applicationId);
}
