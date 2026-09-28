import "server-only";
import { getDb } from "@/lib/db";
import { listConsents, type ConsentRow } from "./server/consents";
import { exportMyData, type MyDataExport } from "./server/export";
import { runtimeDeps } from "./server/runtime";

// Modulo `privacy` — API pubblica (lato server) per le pagine.
// Consensi, export, cancellazione con crypto-shredding, conservazione (R-PRIV-*).
// Unico modulo (con `lib/crypto`) che decifra dati personali: `decryptPii()` con audit (03-ARCHITETTURA §4).
// Struttura: domain/ (puro) · server/ (DB, servizi) · jobs.ts (per altri moduli e worker) · index.ts
export * from "./jobs";
export { deleteAccountAction } from "./server/actions";

export type { ConsentRow, MyDataExport };

// ─── Centro privacy (WP-023) ───────────────────────────────────────────────────────────────────────────

export function getMyConsents(userId: string): Promise<ConsentRow[]> {
  return listConsents(getDb(), userId);
}

export function getMyDataExport(userId: string): Promise<MyDataExport | null> {
  return exportMyData(runtimeDeps(), userId);
}
