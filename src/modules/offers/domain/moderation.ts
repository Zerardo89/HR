import { z } from "zod";

/**
 * Decisioni del moderatore sulle offerte (WP-013b). Il rifiuto è sempre motivato (DSA art. 17): l'azienda vede
 * il motivo e può correggere e ripresentare. Il moderatore vede solo l'annuncio, nessun dato personale.
 */
export const REJECTION_REASONS = [
  "discriminatory",
  "salary",
  "payment_request",
  "scam_suspected",
  "incomplete",
  "other",
] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];

export const moderationDecisionInput = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve"), offerId: z.uuid() }),
  z.object({
    decision: z.literal("reject"),
    offerId: z.uuid(),
    reason: z.enum(REJECTION_REASONS),
    // Nota per l'azienda: parla dell'annuncio, niente dati personali (limite di lunghezza come nelle segnalazioni).
    note: z
      .string()
      .trim()
      .max(500)
      .optional()
      .transform((v) => (v ? v : undefined)),
  }),
]);

export type ModerationDecision = z.infer<typeof moderationDecisionInput>;
