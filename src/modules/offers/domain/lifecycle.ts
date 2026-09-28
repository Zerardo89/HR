import { z } from "zod";
import { MAX_VALIDITY_DAYS } from "./validator";

/**
 * Ciclo di vita dell'offerta pubblicata (WP-022, R-ANN-07). Funzioni pure.
 * - Scadenza: al più 60 giorni; passata la data l'offerta non si vede più (subito, anche prima del job) e i
 *   candidati ricevono "posizione chiusa".
 * - Rinnovo: solo negli ultimi 7 giorni prima della scadenza, per altri 1-60 giorni. Rinnovare ogni giorno per
 *   restare in cima alla ricerca (la "freschezza" pesa nel punteggio, ADR-0005) non si può.
 * - Chiusura: l'azienda chiude quando vuole un'offerta pubblicata; i candidati ricevono "posizione chiusa".
 */

export const RENEWAL_WINDOW_DAYS = 7;
/** Promemoria all'azienda: tre giorni prima della scadenza, una volta sola. */
export const EXPIRY_NOTICE_DAYS = 3;
export const RENEWAL_DAYS = [15, 30, 45, 60] as const;

const DAY_MS = 24 * 60 * 60_000;

type OfferStatus = "draft" | "pending_review" | "published" | "expired" | "closed" | "removed";

/** Lo stato come lo vede chi guarda: una pubblicata oltre la scadenza è già "scaduta". */
export function effectiveStatus(
  status: OfferStatus,
  validThrough: Date | null,
  now: Date,
): OfferStatus {
  if (status === "published" && (!validThrough || validThrough.getTime() <= now.getTime())) {
    return "expired";
  }
  return status;
}

export function canCloseOffer(status: OfferStatus): boolean {
  return status === "published";
}

/** Le offerte che scadono entro questa data sono rinnovabili. */
export function renewalWindowEnd(now: Date): Date {
  return new Date(now.getTime() + RENEWAL_WINDOW_DAYS * DAY_MS);
}

export function canRenewOffer(status: OfferStatus, validThrough: Date | null, now: Date): boolean {
  if (effectiveStatus(status, validThrough, now) !== "published" || !validThrough) return false;
  return validThrough.getTime() <= renewalWindowEnd(now).getTime();
}

/** Data dalla quale si potrà rinnovare (per dirlo all'azienda). */
export function renewableFrom(validThrough: Date): Date {
  return new Date(validThrough.getTime() - RENEWAL_WINDOW_DAYS * DAY_MS);
}

export function renewedValidThrough(now: Date, days: number): Date {
  return new Date(now.getTime() + Math.min(days, MAX_VALIDITY_DAYS) * DAY_MS);
}

export function needsExpiryNotice(
  validThrough: Date | null,
  noticeAt: Date | null,
  now: Date,
): boolean {
  if (!validThrough || noticeAt) return false;
  const left = validThrough.getTime() - now.getTime();
  return left > 0 && left <= EXPIRY_NOTICE_DAYS * DAY_MS;
}

export const closeOfferInput = z.object({ offerId: z.uuid() });

export const renewOfferInput = z.object({
  offerId: z.uuid(),
  days: z.coerce
    .number()
    .int()
    .refine((d) => (RENEWAL_DAYS as readonly number[]).includes(d)),
});
