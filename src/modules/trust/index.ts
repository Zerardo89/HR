import "server-only";

// Modulo `trust` — API pubblica (lato server).
// Segnalazioni DSA e decisioni motivate (R-DSA-03/04, WP-024a).
// Struttura: domain/ (puro) · server/ (DB, servizi) · ui/ (componenti) · index.ts
import { getDb } from "@/lib/db";
import { listOpenReports, type OpenReportGroup } from "./server/reports";

export type { OpenReportGroup };
export { decideReportAction, submitReportAction } from "./server/actions";
export { ReportForm } from "./ui/report-form";

/** Coda del moderatore (la pagina controlla il ruolo; qui solo dati pubblici e testi delle segnalazioni). */
export function getOpenReports(): Promise<OpenReportGroup[]> {
  return listOpenReports(getDb());
}
