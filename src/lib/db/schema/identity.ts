import { sql } from "drizzle-orm";
import {
  bigserial,
  char,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { consentType, emailAction, userRole, userStatus, waitlistKind } from "./enums";
import { provinces } from "./reference";
import { encryptedText } from "./types";

/**
 * Utenti. NESSUNA email in chiaro (ADR-0004, ADR-0008):
 * - `email_bidx`: indice cieco HMAC per trovare l'utente al login
 * - `email_enc`: email cifrata con la DEK dell'utente
 * - `dek_wrapped`: DEK dell'utente cifrata con la KEK. Cancellarla = crypto-shredding di tutti i suoi dati.
 */
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  role: userRole("role").notNull(),
  status: userStatus("status").notNull().default("active"),
  emailBidx: text("email_bidx").notNull().unique(),
  emailEnc: encryptedText("email_enc").notNull(),
  dekWrapped: text("dek_wrapped"), // null dopo la cancellazione (crypto-shredding)
  keyVersion: integer("key_version").notNull(),
  // R-LAV-09: solo la dichiarazione di maggiore età, MAI la data di nascita.
  adultDeclaredAt: timestamp("adult_declared_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
});

/** Registro dei consensi e delle prese visione (versione del testo accettato). */
export const consents = pgTable(
  "consents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    waitlistId: uuid("waitlist_id").references(() => waitlist.id, { onDelete: "cascade" }),
    type: consentType("type").notNull(),
    version: varchar("version", { length: 32 }).notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [index("consents_user_idx").on(t.userId)],
);

/** Token monouso per le azioni dalle email (si salva solo l'hash). R-MAIL-02: si consumano con POST. */
export const emailActionTokens = pgTable(
  "email_action_tokens",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    waitlistId: uuid("waitlist_id").references(() => waitlist.id, { onDelete: "cascade" }),
    action: emailAction("action").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("email_action_tokens_expires_idx").on(t.expiresAt)],
);

/**
 * Log di audit APPEND-ONLY (docs/04-PRIVACY-SICUREZZA.md §7): un trigger (migrazione 0002)
 * impedisce UPDATE e DELETE. Niente dati personali: solo id, azioni, motivi.
 */
export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    actorId: text("actor_id").notNull(),
    action: varchar("action", { length: 64 }).notNull(),
    targetTable: varchar("target_table", { length: 64 }),
    targetId: text("target_id"),
    purpose: varchar("purpose", { length: 64 }),
    ipHash: text("ip_hash"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_log_target_idx").on(t.targetTable, t.targetId),
    index("audit_log_at_idx").on(t.at),
  ],
);

/** Lista d'attesa pre-lancio (WP-009): email cifrata, double opt-in. Sopravvive alla fine dell'anteprima. */
export const waitlist = pgTable("waitlist", {
  id: uuid("id").primaryKey().defaultRandom(),
  emailBidx: text("email_bidx").notNull().unique(),
  emailEnc: encryptedText("email_enc").notNull(),
  dekWrapped: text("dek_wrapped"),
  keyVersion: integer("key_version").notNull(),
  kind: waitlistKind("kind").notNull(),
  provinceCode: char("province_code", { length: 3 }).references(() => provinces.code),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .default(sql`now()`),
});
