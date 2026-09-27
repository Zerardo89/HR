import { z } from "zod";
import { CONTRACT_TYPES, MAX_VALIDITY_DAYS } from "./validator";

export const SCHEDULE_TYPES = ["full_time", "part_time", "shifts", "weekends", "flexible"] as const;
export const SALARY_PERIODS = ["hour", "month", "year"] as const;
export const SALARY_BASES = ["gross", "net"] as const;
export const DEFAULT_VALIDITY_DAYS = 30;

/** Campo numerico facoltativo di un form: "" → undefined, "1.400,50" → 1400.5. */
const optionalAmount = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : Number(v.replace(/\./g, "").replace(",", "."))))
  .pipe(z.number().positive().max(1_000_000).optional());

const optionalInt = (min: number, max: number) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? undefined : Number(v)))
    .pipe(z.number().int().min(min).max(max).optional());

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? undefined : v));

/**
 * Dati del form dell'offerta (WP-013). Qui si controllano forma e limiti; le regole di legge (R-ANN-*)
 * le applica `validateOffer` al momento della pubblicazione (e dal vivo nel browser).
 */
export const offerInput = z.object({
  companyId: z.uuid(),
  siteId: z.uuid(),
  occupationId: z.coerce.number().int().positive(),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(8000),
  contractType: z.enum(CONTRACT_TYPES),
  schedule: z.enum(SCHEDULE_TYPES),
  hoursPerWeek: optionalInt(1, 60),
  salaryMin: optionalAmount,
  salaryMax: optionalAmount,
  salaryPeriod: z
    .enum([...SALARY_PERIODS, ""])
    .transform((v) => (v === "" ? undefined : v))
    .optional(),
  salaryBasis: z.enum(SALARY_BASES).default("gross"),
  ccnl: optionalText(120),
  validDays: z.coerce.number().int().min(1).max(MAX_VALIDITY_DAYS).default(DEFAULT_VALIDITY_DAYS),
  internshipDeclaration: z
    .literal("on")
    .optional()
    .transform((v) => v === "on"),
});

export type OfferInput = z.infer<typeof offerInput>;
