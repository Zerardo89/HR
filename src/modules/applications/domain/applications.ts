import { z } from "zod";

/**
 * Candidature (WP-019, 03-ARCHITETTURA §6.1). Funzioni pure.
 * - Il lavoratore si candida con il suo profilo e, se vuole, un messaggio (cifrato con la sua chiave).
 * - L'azienda vede i dati identificativi solo aprendo la candidatura (decifratura autorizzata e registrata).
 * - R-PRIV-03: la candidatura resta visibile all'azienda fino a 6 mesi dopo la chiusura dell'offerta.
 */

export const APPLICATION_STATUSES = [
  "sent",
  "viewed",
  "in_review",
  "contacted",
  "rejected",
  "hired",
  "withdrawn",
  "closed",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_MESSAGE_MAX = 1000;
export const COMPANY_VISIBILITY_MONTHS = 6;

/** Stati che l'azienda può impostare dopo aver aperto la candidatura. */
export const COMPANY_DECISIONS = ["in_review", "contacted", "rejected", "hired"] as const;
export type CompanyDecision = (typeof COMPANY_DECISIONS)[number];

/** Stati finali: la candidatura non si modifica più (né dall'azienda né dal lavoratore). */
const FINAL: readonly ApplicationStatus[] = ["withdrawn", "closed", "hired", "rejected"];

export function isFinal(status: ApplicationStatus): boolean {
  return FINAL.includes(status);
}

export function canCompanySet(from: ApplicationStatus, to: CompanyDecision): boolean {
  return !isFinal(from) && from !== to;
}

export function canWorkerWithdraw(status: ApplicationStatus): boolean {
  return !isFinal(status);
}

/** L'azienda vede la candidatura se non è ritirata e non è scaduta la finestra di conservazione. */
export function visibleToCompany(
  a: { status: ApplicationStatus; companyVisibleUntil: Date | null },
  now: Date,
): boolean {
  if (a.status === "withdrawn") return false;
  return a.companyVisibleUntil === null || a.companyVisibleUntil.getTime() > now.getTime();
}

/** Fine della visibilità per l'azienda: 6 mesi dopo la chiusura dell'offerta (R-PRIV-03). */
export function companyVisibleUntil(offerClosedAt: Date): Date {
  const d = new Date(offerClosedAt);
  d.setUTCMonth(d.getUTCMonth() + COMPANY_VISIBILITY_MONTHS);
  return d;
}

export const applyInput = z.object({
  offerId: z.uuid(),
  message: z
    .string()
    .trim()
    .max(APPLICATION_MESSAGE_MAX)
    .transform((v) => (v ? v : undefined))
    .optional(),
});
export type ApplyInput = z.infer<typeof applyInput>;

export const companyDecisionInput = z.object({
  applicationId: z.uuid(),
  status: z.enum(COMPANY_DECISIONS),
});
