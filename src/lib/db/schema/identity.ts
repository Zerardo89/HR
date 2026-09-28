import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  char,
  check,
  index,
  integer,
  pgTable,
  smallint,
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
  // 2FA (WP-011b, ADR-0013): segreto TOTP cifrato con la KEK come una chiave (`KeyProvider.wrapKey`);
  // attivo solo dopo la conferma; `totp_last_step` impedisce di riusare lo stesso codice.
  totpSecretEnc: text("totp_secret_enc"),
  totpEnabledAt: timestamp("totp_enabled_at", { withTimezone: true }),
  totpLastStep: bigint("totp_last_step", { mode: "number" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
  // R-PRIV-03 (WP-023b): preavviso di cancellazione per inattività spedito (si azzera se l'utente torna).
  deletionNoticeAt: timestamp("deletion_notice_at", { withTimezone: true }),
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

// ─── Accesso (ADR-0013) ────────────────────────────────────────────────────────────────────────────
// Nessun dato in chiaro: l'email è solo come indice cieco, codici e token solo come HMAC/SHA-256.
// Le righe scadute si eliminano con il job di pulizia (`deleteExpiredAuthRows`).

/** Codici a 6 cifre inviati per email: 10 minuti, 5 tentativi, un solo codice attivo per email. */
export const authOtpChallenges = pgTable(
  "auth_otp_challenges",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    emailBidx: text("email_bidx").notNull(),
    codeMac: text("code_mac").notNull(), // HMAC(chiave indice, "<id>:<codice>"), mai il codice
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("auth_otp_challenges_email_idx").on(t.emailBidx, t.createdAt),
    index("auth_otp_challenges_expires_idx").on(t.expiresAt),
    check("auth_otp_challenges_attempts_range", sql`${t.attempts} between 0 and 5`),
  ],
);

/** Sessioni: nel cookie un token casuale di 256 bit, qui solo il suo SHA-256. Niente IP né user agent. */
export const authSessions = pgTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(), // SHA-256 (base64url) del token
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    // 2FA: la sessione vale per le pagine riservate solo dopo il secondo passaggio (se l'utente ha la 2FA).
    mfaVerifiedAt: timestamp("mfa_verified_at", { withTimezone: true }),
    mfaAttempts: smallint("mfa_attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("auth_sessions_user_idx").on(t.userId),
    index("auth_sessions_expires_idx").on(t.expiresAt),
  ],
);

/** Dopo il codice giusto per un'email senza account: 30 minuti per completare la registrazione. */
export const authSignupTickets = pgTable(
  "auth_signup_tickets",
  {
    id: text("id").primaryKey(), // SHA-256 (base64url) del token
    emailBidx: text("email_bidx").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("auth_signup_tickets_expires_idx").on(t.expiresAt)],
);

/** Codici di recupero della 2FA (10, monouso): nel DB solo il MAC, mai il codice. */
export const authRecoveryCodes = pgTable(
  "auth_recovery_codes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    codeMac: text("code_mac").notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("auth_recovery_codes_user_idx").on(t.userId)],
);
