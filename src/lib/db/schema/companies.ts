import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  check,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { companyKind, companyStatus, memberRole } from "./enums";
import { users } from "./identity";
import { municipalities } from "./reference";

/** Aziende (dati pubblici C0). R-LAV-02: il nome è sempre visibile nelle offerte (niente annunci anonimi). */
export const companies = pgTable(
  "companies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vatNumber: char("vat_number", { length: 11 }).notNull().unique(), // P.IVA italiana
    legalName: text("legal_name").notNull(),
    displayName: text("display_name").notNull(),
    kind: companyKind("kind").notNull().default("employer"),
    // R-LAV-03: le agenzie per il lavoro indicano gli estremi dell'autorizzazione ministeriale.
    agencyAuthorization: varchar("agency_authorization", { length: 64 }),
    status: companyStatus("status").notNull().default("pending"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("companies_vat_digits", sql`${t.vatNumber} ~ '^[0-9]{11}$'`),
    check(
      "companies_agency_authorization",
      sql`${t.kind} <> 'agency' or ${t.agencyAuthorization} is not null`,
    ),
  ],
);

/**
 * Sedi: la legale (da VIES) e le operative (approvate dal moderatore).
 * Solo le sedi con `approved_at` contano per la zona gratuita (ADR-0009).
 */
export const companySites = pgTable(
  "company_sites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    municipalityCode: char("municipality_code", { length: 6 })
      .notNull()
      .references(() => municipalities.istatCode),
    label: text("label").notNull(),
    isLegalSeat: boolean("is_legal_seat").notNull().default(false),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("company_sites_company_idx").on(t.companyId)],
);

export const companyMembers = pgTable(
  "company_members",
  {
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: memberRole("role").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.companyId, t.userId] }),
    index("company_members_user_idx").on(t.userId),
  ],
);

/** ADR-0007: il lavoratore può bloccare un'azienda (es. il datore attuale): non lo vedrà mai. */
export const workerCompanyBlocks = pgTable(
  "worker_company_blocks",
  {
    workerUserId: uuid("worker_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.workerUserId, t.companyId] })],
);
