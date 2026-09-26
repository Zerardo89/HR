import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  date,
  index,
  integer,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import {
  alertFrequency,
  contractType,
  experienceBand,
  languageLevel,
  scheduleType,
  workerState,
} from "./enums";
import { users } from "./identity";
import { municipalities, occupations, skills } from "./reference";
import { encryptedText } from "./types";

/**
 * Profilo del lavoratore.
 * - Campi C1 (pseudonimi, servono alla ricerca) IN CHIARO: mansioni, comune, raggio, esperienza…
 * - Campi C2 (identificativi) CIFRATI in `pii_enc` con la DEK dell'utente: nome, cognome, telefono,
 *   presentazione, esperienze e formazione in testo libero (contengono nomi di ex datori).
 * - Vietati per legge/minimizzazione (R-LAV-05, R-ANN-02): data di nascita, sesso, stato civile,
 *   nazionalità, foto, salute (salvo L.68 opt-in cifrato), retribuzione precedente.
 */
export const workerProfiles = pgTable(
  "worker_profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    state: workerState("state").notNull().default("seeking"),
    municipalityCode: char("municipality_code", { length: 6 })
      .notNull()
      .references(() => municipalities.istatCode),
    radiusKm: smallint("radius_km").notNull().default(25),
    relocationRegionCodes: char("relocation_region_codes", { length: 2 })
      .array()
      .notNull()
      .default(sql`'{}'::char(2)[]`),
    experienceBand: experienceBand("experience_band").notNull().default("none"),
    availableFrom: date("available_from"),
    contractPrefs: contractType("contract_prefs")
      .array()
      .notNull()
      .default(sql`'{}'`),
    schedulePrefs: scheduleType("schedule_prefs")
      .array()
      .notNull()
      .default(sql`'{}'`),
    drivingLicenses: varchar("driving_licenses", { length: 8 })
      .array()
      .notNull()
      .default(sql`'{}'::varchar(8)[]`),
    piiEnc: encryptedText("pii_enc"),
    // L. 68/99 (dato sanitario, art. 9 GDPR): consenso esplicito, chiave dedicata — rilascio 1.2.
    l68Enc: encryptedText("l68_enc"),
    monthlyCheckOptIn: boolean("monthly_check_opt_in").notNull().default(false),
    nextCheckAt: timestamp("next_check_at", { withTimezone: true }),
    unansweredChecks: smallint("unanswered_checks").notNull().default(0),
    lastInteractionAt: timestamp("last_interaction_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("worker_profiles_radius_range", sql`${t.radiusKm} between 5 and 200`),
    check("worker_profiles_unanswered_range", sql`${t.unansweredChecks} between 0 and 12`),
    index("worker_profiles_state_idx").on(t.state),
    index("worker_profiles_municipality_idx").on(t.municipalityCode),
    index("worker_profiles_next_check_idx").on(t.nextCheckAt),
  ],
);

/** Le "liste della propria mansione" (fino a 5 mansioni per lavoratore, limite applicativo). */
export const profileOccupations = pgTable(
  "profile_occupations",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => workerProfiles.userId, { onDelete: "cascade" }),
    occupationId: integer("occupation_id")
      .notNull()
      .references(() => occupations.id),
    years: smallint("years"),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.occupationId] }),
    index("profile_occupations_occ_idx").on(t.occupationId),
  ],
);

export const profileSkills = pgTable(
  "profile_skills",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => workerProfiles.userId, { onDelete: "cascade" }),
    skillId: integer("skill_id")
      .notNull()
      .references(() => skills.id),
  },
  (t) => [primaryKey({ columns: [t.userId, t.skillId] })],
);

export const profileLanguages = pgTable(
  "profile_languages",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => workerProfiles.userId, { onDelete: "cascade" }),
    languageCode: varchar("language_code", { length: 3 }).notNull(), // ISO 639
    level: languageLevel("level").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.languageCode] })],
);

/** Ricerche salvate → avvisi email (WP-020). */
export const savedSearches = pgTable("saved_searches", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  query: text("query"),
  occupationIds: integer("occupation_ids")
    .array()
    .notNull()
    .default(sql`'{}'::integer[]`),
  municipalityCode: char("municipality_code", { length: 6 }).references(
    () => municipalities.istatCode,
  ),
  radiusKm: smallint("radius_km").notNull().default(25),
  frequency: alertFrequency("frequency").notNull().default("weekly"),
  lastSentAt: timestamp("last_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
