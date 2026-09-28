import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { companies, companySites } from "./companies";
import {
  contractType,
  offerScope,
  offerStatus,
  remoteMode,
  salaryBasis,
  salaryPeriod,
  scheduleType,
} from "./enums";
import { municipalities, occupations } from "./reference";
import { tsvector } from "./types";

/**
 * Offerte di lavoro (dati pubblici C0). Le regole R-ANN-* sono verificate dal validatore (WP-012);
 * qui il DB fa da ultima rete di sicurezza con i CHECK.
 */
export const jobOffers = pgTable(
  "job_offers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    siteId: uuid("site_id").references(() => companySites.id, { onDelete: "set null" }),
    title: varchar("title", { length: 120 }).notNull(),
    occupationId: integer("occupation_id")
      .notNull()
      .references(() => occupations.id),
    descriptionMd: text("description_md").notNull(),
    municipalityCode: char("municipality_code", { length: 6 })
      .notNull()
      .references(() => municipalities.istatCode),
    contractType: contractType("contract_type").notNull(),
    schedule: scheduleType("schedule").notNull(),
    hoursPerWeek: smallint("hours_per_week"),
    // R-ANN-01 (D.Lgs. 96/2026): retribuzione iniziale o fascia, obbligatoria per il lavoro subordinato.
    salaryMin: numeric("salary_min", { precision: 10, scale: 2 }),
    salaryMax: numeric("salary_max", { precision: 10, scale: 2 }),
    salaryPeriod: salaryPeriod("salary_period"),
    salaryBasis: salaryBasis("salary_basis").notNull().default("gross"),
    ccnl: text("ccnl"),
    remoteMode: remoteMode("remote_mode").notNull().default("on_site"),
    requirements: jsonb("requirements")
      .notNull()
      .default(sql`'{}'::jsonb`),
    isL68: boolean("is_l68").notNull().default(false),
    status: offerStatus("status").notNull().default("draft"),
    scope: offerScope("scope").notNull().default("local"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    validThrough: timestamp("valid_through", { withTimezone: true }),
    featuredUntil: timestamp("featured_until", { withTimezone: true }),
    // WP-022: promemoria "la tua offerta sta per scadere" già spedito all'azienda (si azzera al rinnovo).
    expiryNoticeAt: timestamp("expiry_notice_at", { withTimezone: true }),
    moderation: jsonb("moderation")
      .notNull()
      .default(sql`'{}'::jsonb`),
    searchTsv: tsvector("search_tsv").generatedAlwaysAs(
      sql`setweight(to_tsvector('italian_unaccent', coalesce(title, '')), 'A') || setweight(to_tsvector('italian_unaccent', coalesce(description_md, '')), 'C')`,
    ),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // R-ANN-01: fuori dalla bozza, il lavoro subordinato deve avere stipendio e periodo.
    check(
      "job_offers_salary_required",
      sql`${t.status} = 'draft' or ${t.contractType} in ('collaboration', 'self_employed', 'occasional') or (${t.salaryMin} is not null and ${t.salaryPeriod} is not null)`,
    ),
    check(
      "job_offers_salary_range",
      sql`${t.salaryMin} is null or (${t.salaryMin} > 0 and (${t.salaryMax} is null or ${t.salaryMax} >= ${t.salaryMin}))`,
    ),
    // R-ANN-07: scadenza obbligatoria entro 60 giorni dalla pubblicazione.
    check(
      "job_offers_valid_through",
      sql`${t.status} <> 'published' or (${t.publishedAt} is not null and ${t.validThrough} is not null and ${t.validThrough} <= ${t.publishedAt} + interval '60 days')`,
    ),
    check(
      "job_offers_hours_range",
      sql`${t.hoursPerWeek} is null or ${t.hoursPerWeek} between 1 and 60`,
    ),
    index("job_offers_search_gin").using("gin", t.searchTsv),
    index("job_offers_title_trgm").using("gin", sql`${t.title} gin_trgm_ops`),
    index("job_offers_status_idx").on(t.status, t.publishedAt),
    index("job_offers_company_idx").on(t.companyId),
    index("job_offers_occupation_idx").on(t.occupationId),
    index("job_offers_municipality_idx").on(t.municipalityCode),
  ],
);
