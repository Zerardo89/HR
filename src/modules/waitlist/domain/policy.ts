import { z } from "zod";
import { emailInput } from "@/modules/identity/domain";

/**
 * Lista d'attesa pre-lancio (WP-009): email cifrata, doppia conferma (double opt-in).
 * L'iscrizione è reale anche in anteprima e sopravvive all'azzeramento del 27/10 (docs/06-ROADMAP.md).
 */

export const WAITLIST_KINDS = ["worker", "company"] as const;
export type WaitlistKind = (typeof WAITLIST_KINDS)[number];

/** Il link di conferma vale 7 giorni; poi l'iscrizione non confermata viene cancellata. */
export const CONFIRM_TOKEN_TTL_MS = 7 * 24 * 60 * 60_000;
export const UNCONFIRMED_RETENTION_MS = CONFIRM_TOKEN_TTL_MS;

/** Tra due email di conferma allo stesso indirizzo passano almeno 10 minuti. */
export const RESEND_COOLDOWN_MS = 10 * 60_000;

/** Iscrizioni dallo stesso IP (solo in memoria). */
export const WAITLIST_IP_LIMIT = { windowMs: 15 * 60_000, max: 5 } as const;

/** Versione del testo del consenso "avvisami al lancio" (cambia se cambia il testo in messages/it.json). */
export const WAITLIST_CONSENT_VERSION = "2026-09-27";

export const waitlistInput = z.object({
  email: emailInput,
  kind: z.enum(WAITLIST_KINDS),
  // Facoltativa: codice ISTAT a 3 cifre; "" (nessuna scelta) diventa undefined.
  province: z
    .string()
    .regex(/^(\d{3})?$/)
    .optional()
    .transform((v) => (v ? v : undefined)),
  consent: z.literal("on"),
});

export type WaitlistInput = z.infer<typeof waitlistInput>;

export function canResendConfirmation(lastSentAt: Date | null, now: Date): boolean {
  return lastSentAt === null || now.getTime() - lastSentAt.getTime() >= RESEND_COOLDOWN_MS;
}
