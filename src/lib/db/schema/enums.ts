import { pgEnum } from "drizzle-orm/pg-core";

// Nomi in inglese secondo il glossario (docs/03-ARCHITETTURA.md §9).

export const userRole = pgEnum("user_role", ["worker", "company_member", "moderator", "admin"]);
export const userStatus = pgEnum("user_status", ["active", "suspended", "deleted"]);

/** Stato del lavoratore: 🟢 cerco · 🟡 occupato ma aperto · ⚪ non visibile (docs/01-PRODOTTO.md §6). */
export const workerState = pgEnum("worker_state", ["seeking", "open", "hidden"]);
export const experienceBand = pgEnum("experience_band", [
  "none",
  "lt1",
  "y1_3",
  "y3_5",
  "y5_10",
  "gt10",
]);
export const languageLevel = pgEnum("language_level", [
  "a1",
  "a2",
  "b1",
  "b2",
  "c1",
  "c2",
  "native",
]);

/** R-ANN-05: la tipologia contrattuale è sempre indicata. */
export const contractType = pgEnum("contract_type", [
  "permanent", // tempo indeterminato
  "fixed_term", // tempo determinato
  "apprenticeship", // apprendistato
  "agency", // somministrazione
  "internship", // tirocinio extracurricolare
  "seasonal", // stagionale
  "collaboration", // collaborazione
  "self_employed", // lavoro autonomo / P.IVA
  "occasional", // lavoro occasionale
]);
export const scheduleType = pgEnum("schedule_type", [
  "full_time",
  "part_time",
  "shifts",
  "weekends",
  "flexible",
]);
export const remoteMode = pgEnum("remote_mode", ["on_site", "hybrid", "remote"]);
export const salaryPeriod = pgEnum("salary_period", ["hour", "month", "year"]);
export const salaryBasis = pgEnum("salary_basis", ["gross", "net"]);

export const companyKind = pgEnum("company_kind", ["employer", "agency"]);
export const companyStatus = pgEnum("company_status", ["pending", "verified", "suspended"]);
export const memberRole = pgEnum("member_role", ["owner", "recruiter"]);

export const offerStatus = pgEnum("offer_status", [
  "draft",
  "pending_review",
  "published",
  "expired",
  "closed",
  "removed",
]);
export const offerScope = pgEnum("offer_scope", ["local", "national"]);

export const applicationStatus = pgEnum("application_status", [
  "sent",
  "viewed",
  "in_review",
  "contacted",
  "rejected",
  "hired",
  "withdrawn",
  "closed",
]);
export const contactRequestStatus = pgEnum("contact_request_status", [
  "pending",
  "accepted",
  "declined",
  "expired",
]);
export const alertFrequency = pgEnum("alert_frequency", ["daily", "weekly"]);

export const consentType = pgEnum("consent_type", [
  "privacy_notice",
  "terms",
  "monthly_check",
  "job_alerts",
  "marketing",
  "l68_health",
  "waitlist_launch",
]);
export const emailAction = pgEnum("email_action", [
  "monthly_seeking",
  "monthly_open",
  "monthly_hide",
  "monthly_delete",
  "waitlist_confirm",
  "unsubscribe",
]);

export const reportTargetType = pgEnum("report_target_type", ["offer", "company"]);
export const reportReason = pgEnum("report_reason", [
  "scam",
  "discriminatory",
  "illegal",
  "misleading",
  "payment_requested",
  "other",
]);
export const reportStatus = pgEnum("report_status", ["open", "actioned", "dismissed"]);

export const entitlementOwner = pgEnum("entitlement_owner", ["company", "user"]);
export const entitlementProduct = pgEnum("entitlement_product", [
  "supporter",
  "national",
  "featured",
]);
export const entitlementSource = pgEnum("entitlement_source", [
  "stripe",
  "crowdfunding",
  "promo",
  "founders",
]);
export const adSlot = pgEnum("ad_slot", [
  "home_sponsor",
  "results_native",
  "offer_training",
  "offer_bottom",
]);
export const waitlistKind = pgEnum("waitlist_kind", ["worker", "company"]);
