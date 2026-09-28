/**
 * Mail mensile "stai ancora cercando?" per chi è "occupato ma aperto" (WP-021, 01-PRODOTTO §6.2). Funzioni pure.
 * - Parte ogni 30 giorni dalla data di adesione (gli invii si distribuiscono nel mese).
 * - Quattro risposte: cerco (→ "Cerco lavoro"), resto aperto, nascondimi, cancella il profilo.
 * - Dopo 6 mail consecutive senza nessuna interazione: profilo nascosto e invii sospesi (minimizzazione e
 *   reputazione delle email), con un'ultima mail "ti abbiamo messo in pausa".
 */

export const MONTHLY_CHECK_DAYS = 30;
export const MAX_UNANSWERED_CHECKS = 6;
export const MONTHLY_ANSWERS = ["seeking", "open", "hide", "delete"] as const;
export type MonthlyAnswer = (typeof MONTHLY_ANSWERS)[number];

const DAY_MS = 24 * 60 * 60_000;

/** Prima data utile dopo l'adesione. */
export function firstMonthlyCheck(now: Date): Date {
  return new Date(now.getTime() + MONTHLY_CHECK_DAYS * DAY_MS);
}

/**
 * Prossimo invio: 30 giorni dopo quello previsto (così resta lo stesso giorno del mese di adesione); se il worker è
 * rimasto fermo a lungo e la data è già passata, 30 giorni da adesso.
 */
export function nextMonthlyCheck(scheduled: Date, now: Date): Date {
  const next = new Date(scheduled.getTime() + MONTHLY_CHECK_DAYS * DAY_MS);
  return next.getTime() > now.getTime()
    ? next
    : new Date(now.getTime() + MONTHLY_CHECK_DAYS * DAY_MS);
}

/** Sei mail senza risposta: la settima non parte, si mette in pausa. */
export function shouldPauseMonthlyChecks(unanswered: number): boolean {
  return unanswered >= MAX_UNANSWERED_CHECKS;
}
