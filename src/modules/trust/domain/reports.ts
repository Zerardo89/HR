import { z } from "zod";

/**
 * Segnalazioni e decisioni (DSA art. 16-17, R-DSA-03/04, WP-024a). Funzioni pure.
 * Si segnala a partire da un'offerta pubblicata: l'annuncio stesso o l'azienda che lo pubblica.
 */

export const REPORT_TARGETS = ["offer", "company"] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

/** Stessi valori dell'enum `report_reason` del DB. */
export const REPORT_REASONS = [
  "scam",
  "discriminatory",
  "payment_requested",
  "misleading",
  "illegal",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

/** Fondamento della decisione (art. 17.3.d): legge o Regolamento annunci. Testi in `trust.grounds`. */
export const REPORT_GROUNDS = [
  "discrimination",
  "payment_request",
  "scam",
  "misleading",
  "illegal_work",
  "terms",
] as const;
export type ReportGround = (typeof REPORT_GROUNDS)[number];

export const REPORT_DETAILS_MAX = 1000;
export const FACTS_MIN = 20;
export const FACTS_MAX = 1000;
/** Segnalazioni per IP (solo in memoria): abbastanza per chi segnala davvero, poche per chi vuole intasare. */
export const REPORT_IP_LIMIT = { windowMs: 15 * 60_000, max: 5 } as const;

const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
/** Almeno 9 cifre, anche separate da spazi, punti o trattini (una data ne ha 8). */
const PHONE_RE = /(?:\+|\b)\d(?:[\s.-]?\d){8,}/;

/**
 * Email o numeri di telefono in un testo libero: non li vogliamo nelle segnalazioni né nelle motivazioni
 * (R-PRIV-02: il testo è in chiaro nel DB; il moderatore vede già l'annuncio).
 */
export function containsContactData(text: string): boolean {
  return EMAIL_RE.test(text) || PHONE_RE.test(text);
}

const noContacts = (v: string | undefined) => !v || !containsContactData(v);

export const reportInput = z.object({
  offerId: z.uuid(),
  targetType: z.enum(REPORT_TARGETS),
  reason: z.enum(REPORT_REASONS),
  details: z
    .string()
    .trim()
    .max(REPORT_DETAILS_MAX)
    .optional()
    .transform((v) => v || undefined)
    .refine(noContacts, { message: "contact_data" }),
  // Art. 16.2.d: dichiarazione di buona fede.
  goodFaith: z.literal("on", { message: "good_faith" }),
});
export type ReportInput = z.infer<typeof reportInput>;

export type ReportInputError = "invalid" | "contact_data" | "good_faith";

/** Errore da mostrare: i due casi che l'utente può correggere da sé, il resto è "invalid". */
export function reportInputError(error: z.ZodError): ReportInputError {
  const messages = error.issues.map((i) => i.message);
  if (messages.includes("contact_data")) return "contact_data";
  if (messages.includes("good_faith")) return "good_faith";
  return "invalid";
}

export type ReportDecision =
  | { targetType: ReportTarget; targetId: string; decision: "dismiss" }
  | {
      targetType: ReportTarget;
      targetId: string;
      decision: "act";
      ground: ReportGround;
      facts: string;
    };

/** Decisione del moderatore: "act" = rimuovi l'annuncio o sospendi l'azienda, con fondamento e fatti. */
export const reportDecisionInput = z
  .object({
    targetType: z.enum(REPORT_TARGETS),
    targetId: z.uuid(),
    decision: z.enum(["act", "dismiss"]),
    ground: z.enum(REPORT_GROUNDS).optional(),
    facts: z.string().trim().max(FACTS_MAX).optional(),
  })
  .transform((d, ctx): ReportDecision => {
    if (d.decision === "dismiss") {
      return { targetType: d.targetType, targetId: d.targetId, decision: "dismiss" };
    }
    if (!d.ground) ctx.addIssue({ code: "custom", path: ["ground"], message: "ground" });
    if (!d.facts || d.facts.length < FACTS_MIN) {
      ctx.addIssue({ code: "custom", path: ["facts"], message: "facts" });
    } else if (containsContactData(d.facts)) {
      ctx.addIssue({ code: "custom", path: ["facts"], message: "contact_data" });
    }
    return {
      targetType: d.targetType,
      targetId: d.targetId,
      decision: "act",
      ground: d.ground ?? "terms",
      facts: d.facts ?? "",
    };
  });

/** Codice salvato in `reports.decision` e nello scopo dell'audit. */
export function decisionCode(d: ReportDecision): string {
  if (d.decision === "dismiss") return "dismiss";
  return `${d.targetType === "offer" ? "remove_offer" : "suspend_company"}:${d.ground}`;
}
