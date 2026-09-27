import { z } from "zod";
import { isValidItalianVat, normalizeVat } from "./vat";

export const COMPANY_KINDS = ["employer", "agency"] as const;
export type CompanyKind = (typeof COMPANY_KINDS)[number];

/** Registrazione dell'azienda (WP-011). La ragione sociale NON si scrive a mano: arriva da VIES (§3.2). */
export const companyInput = z
  .object({
    vat: z.string().transform(normalizeVat).refine(isValidItalianVat, { message: "vat" }),
    displayName: z.string().trim().min(2).max(80),
    kind: z.enum(COMPANY_KINDS),
    agencyAuthorization: z
      .string()
      .trim()
      .max(64)
      .optional()
      .transform((v) => (v ? v : undefined)),
  })
  .refine((c) => c.kind !== "agency" || c.agencyAuthorization, {
    message: "agencyAuthorization",
    path: ["agencyAuthorization"],
  });

export type CompanyInput = z.infer<typeof companyInput>;
