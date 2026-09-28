import "server-only";
import { getDb } from "@/lib/db";
import { expireDueOffers } from "./server/lifecycle";

// Modulo `offers` — API per i job del worker (WP-022): niente componenti né Next.js.

/** Offerte pubblicate oltre la scadenza → "scaduta", candidature chiuse (R-ANN-07). */
export function expireOffers(): Promise<{ offersExpired: number; applicationsClosed: number }> {
  return expireDueOffers({ db: getDb(), now: () => new Date() });
}
