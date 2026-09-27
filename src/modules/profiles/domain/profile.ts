import { z } from "zod";
import { CONTRACT_TYPES, SCHEDULE_TYPES } from "@/modules/offers/domain";

/**
 * Profilo del lavoratore (WP-017, docs/04-PRIVACY-SICUREZZA.md §2).
 * - C1 (pseudonimi, servono alla ricerca): in chiaro nel DB — mansioni, comune, raggio, esperienza, preferenze…
 * - C2 (identificativi): cifrati con la DEK dell'utente — nome, cognome, telefono, presentazione, esperienze e
 *   formazione in testo libero (contengono nomi di ex datori).
 * - Vietati (R-LAV-05, R-ANN-02): data di nascita, sesso, stato civile, nazionalità, foto, salute, stipendio
 *   precedente. Non esistono campi per chiederli: il test `profile.test.ts` lo verifica.
 */

export const WORKER_STATES = ["seeking", "open", "hidden"] as const;
export type WorkerState = (typeof WORKER_STATES)[number];

export const EXPERIENCE_BANDS = ["none", "lt1", "y1_3", "y3_5", "y5_10", "gt10"] as const;
export const LANGUAGE_LEVELS = ["a1", "a2", "b1", "b2", "c1", "c2", "native"] as const;
/** Lingue più richieste nel lavoro in Italia (ISO 639-1); l'elenco si allarga senza migrazioni. */
export const LANGUAGE_CODES = [
  "it",
  "en",
  "fr",
  "de",
  "es",
  "pt",
  "ro",
  "sq",
  "ar",
  "zh",
  "ru",
  "uk",
  "pl",
  "hi",
  "bn",
  "ur",
  "tl",
] as const;
/** Patenti e abilitazioni alla guida italiane (CQC = carta di qualificazione del conducente). */
export const DRIVING_LICENSES = [
  "AM",
  "A1",
  "A2",
  "A",
  "B",
  "BE",
  "C1",
  "C1E",
  "C",
  "CE",
  "D1",
  "D1E",
  "D",
  "DE",
  "CQC",
] as const;
export const PROFILE_RADII_KM = [5, 10, 20, 30, 50, 100] as const;
export const DEFAULT_PROFILE_RADIUS_KM = 20;
export const MAX_PROFILE_OCCUPATIONS = 5;
export const MAX_LANGUAGES = 8;
export const MAX_EXPERIENCES = 10;
export const MAX_EDUCATION = 10;
/** Codici ISTAT delle regioni (per "disponibile a trasferirmi in…"). */
export const REGION_CODES = [
  "01",
  "02",
  "03",
  "04",
  "05",
  "06",
  "07",
  "08",
  "09",
  "10",
  "11",
  "12",
  "13",
  "14",
  "15",
  "16",
  "17",
  "18",
  "19",
  "20",
] as const;

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v ? v : undefined))
    .optional();

/** Dati C2, cifrati in `worker_profiles.pii_enc` (un solo JSON, legato a tabella, colonna e utente). */
export const workerPiiSchema = z.object({
  firstName: text(1, 60),
  lastName: text(1, 60),
  /** Solo cifre, spazi e "+": serve all'azienda a cui ti candidi, se vuoi. */
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ]{6,20}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  about: optionalText(1000),
  experiences: z
    .array(
      z.object({
        role: text(1, 80),
        employer: optionalText(80),
        period: optionalText(40),
        description: optionalText(500),
      }),
    )
    .max(MAX_EXPERIENCES),
  education: z
    .array(z.object({ title: text(1, 120), school: optionalText(120), year: optionalText(10) }))
    .max(MAX_EDUCATION),
});
export type WorkerPii = z.infer<typeof workerPiiSchema>;

/** Dati C1 (in chiaro, per la ricerca e gli avvisi). Il comune arriva come testo e si risolve sul server. */
export const workerProfileInput = z.object({
  occupationIds: z
    .array(z.coerce.number().int().positive())
    .min(1)
    .max(MAX_PROFILE_OCCUPATIONS)
    .transform((ids) => [...new Set(ids)]),
  place: text(2, 80),
  radiusKm: z.coerce
    .number()
    .refine((n): n is (typeof PROFILE_RADII_KM)[number] =>
      (PROFILE_RADII_KM as readonly number[]).includes(n),
    ),
  relocationRegionCodes: z.array(z.enum(REGION_CODES)).max(REGION_CODES.length),
  experienceBand: z.enum(EXPERIENCE_BANDS),
  availableFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  contractPrefs: z.array(z.enum(CONTRACT_TYPES)),
  schedulePrefs: z.array(z.enum(SCHEDULE_TYPES)),
  drivingLicenses: z.array(z.enum(DRIVING_LICENSES)),
  languages: z
    .array(z.object({ code: z.enum(LANGUAGE_CODES), level: z.enum(LANGUAGE_LEVELS) }))
    .max(MAX_LANGUAGES)
    .refine((l) => new Set(l.map((x) => x.code)).size === l.length, { message: "duplicate" }),
  state: z.enum(WORKER_STATES),
  monthlyCheckOptIn: z.boolean(),
  pii: workerPiiSchema,
});
export type WorkerProfileInput = z.infer<typeof workerProfileInput>;

/**
 * Parole che non devono mai comparire tra i campi del profilo (R-LAV-05, R-ANN-02): se un giorno qualcuno
 * aggiunge "birthDate" o "nationality", il test fallisce.
 */
export const FORBIDDEN_FIELD_PATTERN =
  /birth|nascit|age$|^age|sex|sesso|gender|genere|marital|civile|nation|nazional|citizen|cittadin|photo|foto|picture|health|salute|disab|salary|stipend|ral$|religi|politic|union|sindac/i;

/** Tutti i nomi di campo (anche annidati) di uno schema zod a oggetti. */
export function fieldNames(schema: z.ZodType): string[] {
  const names: string[] = [];
  const visit = (s: z.ZodType) => {
    const def = (
      s as unknown as {
        def?: {
          type?: string;
          shape?: Record<string, z.ZodType>;
          element?: z.ZodType;
          innerType?: z.ZodType;
          in?: z.ZodType;
          left?: z.ZodType;
          right?: z.ZodType;
          options?: z.ZodType[];
        };
      }
    ).def;
    if (!def) return;
    if (def.shape) {
      for (const [key, child] of Object.entries(def.shape)) {
        names.push(key);
        visit(child);
      }
    }
    for (const next of [
      def.element,
      def.innerType,
      def.in,
      def.left,
      def.right,
      ...(def.options ?? []),
    ]) {
      if (next) visit(next);
    }
  };
  visit(schema);
  return names;
}
