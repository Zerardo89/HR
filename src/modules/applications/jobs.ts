import "server-only";
import { getDb } from "@/lib/db";
import { purgeExpiredApplicationMessages } from "./server/closure";

// Modulo `applications` — API per i job del worker e per gli altri moduli (WP-022): niente componenti né Next.js.
export { closeApplicationsForOffers } from "./server/closure";

/** Job `retention.applications`: messaggi delle candidature oltre la finestra di visibilità dell'azienda. */
export function purgeApplicationMessages(): Promise<{ messagesPurged: number }> {
  return purgeExpiredApplicationMessages(getDb(), new Date());
}
