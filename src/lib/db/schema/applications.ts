import { index, pgTable, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { companies } from "./companies";
import { applicationStatus, contactRequestStatus } from "./enums";
import { users } from "./identity";
import { jobOffers } from "./offers";
import { encryptedText } from "./types";

/** Candidature: il lavoratore sceglie a chi inviare i suoi dati (ruoli privacy: docs/02 §4.1). */
export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    offerId: uuid("offer_id")
      .notNull()
      .references(() => jobOffers.id, { onDelete: "cascade" }),
    workerUserId: uuid("worker_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: applicationStatus("status").notNull().default("sent"),
    messageEnc: encryptedText("message_enc"), // messaggio facoltativo, cifrato con la DEK del lavoratore
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    // R-PRIV-03: dopo questa data la candidatura sparisce dalla vista dell'azienda.
    companyVisibleUntil: timestamp("company_visible_until", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("applications_offer_worker_uq").on(t.offerId, t.workerUserId),
    index("applications_worker_idx").on(t.workerUserId),
  ],
);

/** (Fase B, ADR-0007) Richiesta di contatto dell'azienda: il lavoratore accetta o rifiuta. */
export const contactRequests = pgTable(
  "contact_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    workerUserId: uuid("worker_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    offerId: uuid("offer_id").references(() => jobOffers.id, { onDelete: "set null" }),
    status: contactRequestStatus("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (t) => [
    index("contact_requests_worker_idx").on(t.workerUserId, t.status),
    index("contact_requests_company_idx").on(t.companyId, t.createdAt),
  ],
);
