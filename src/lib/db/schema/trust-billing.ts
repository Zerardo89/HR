import { sql } from "drizzle-orm";
import { check, index, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import {
  adSlot,
  entitlementOwner,
  entitlementProduct,
  entitlementSource,
  reportReason,
  reportStatus,
  reportTargetType,
} from "./enums";
import { users } from "./identity";

/**
 * Segnalazioni DSA (art. 16-17, R-DSA-03/04). Anche anonime.
 * `details`: testo libero limitato; l'interfaccia chiede di NON inserire dati personali.
 */
export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    targetType: reportTargetType("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    reason: reportReason("reason").notNull(),
    details: varchar("details", { length: 1000 }),
    reporterUserId: uuid("reporter_user_id").references(() => users.id, { onDelete: "set null" }),
    status: reportStatus("status").notNull().default("open"),
    decision: text("decision"),
    statementOfReasons: text("statement_of_reasons"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (t) => [
    index("reports_status_idx").on(t.status, t.createdAt),
    check(
      "reports_decision_motivated",
      sql`${t.status} <> 'actioned' or ${t.statementOfReasons} is not null`,
    ),
  ],
);

/** Diritti acquisiti (Sostenitore, Piano Nazionale, In evidenza) — ADR-0010. */
export const entitlements = pgTable(
  "entitlements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerType: entitlementOwner("owner_type").notNull(),
    ownerId: uuid("owner_id").notNull(),
    product: entitlementProduct("product").notNull(),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull(),
    validTo: timestamp("valid_to", { withTimezone: true }),
    source: entitlementSource("source").notNull(),
    externalRef: text("external_ref").unique(), // es. id evento/abbonamento Stripe (idempotenza)
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("entitlements_owner_idx").on(t.ownerType, t.ownerId, t.product),
    check("entitlements_period", sql`${t.validTo} is null or ${t.validTo} > ${t.validFrom}`),
  ],
);

/** Spazi venduti direttamente (sponsor del territorio, formazione): contestuali, senza tracciamento (R-ADS-05). */
export const adPlacements = pgTable("ad_placements", {
  id: uuid("id").primaryKey().defaultRandom(),
  slot: adSlot("slot").notNull(),
  advertiser: text("advertiser").notNull(),
  creative: jsonb("creative").notNull(),
  geoScope: jsonb("geo_scope")
    .notNull()
    .default(sql`'{}'::jsonb`),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
