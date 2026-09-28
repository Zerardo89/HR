import "server-only";
import { getDb } from "@/lib/db";
import { deleteExpiredAuthRows } from "./server/sessions";

// Modulo `identity` — API per i job del worker (WP-020): niente componenti né Next.js.

export { recordActivity } from "./server/activity";

/** Pulizia giornaliera: sessioni, biglietti di registrazione e codici scaduti. */
export async function cleanupAuthRows(): Promise<{ authRowsDeleted: number }> {
  return { authRowsDeleted: await deleteExpiredAuthRows({ db: getDb(), now: () => new Date() }) };
}
