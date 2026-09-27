// Modulo `companies` — API pura: P.IVA, risposta VIES, dati di registrazione (WP-011).
export { isValidItalianVat, normalizeVat } from "./vat";
export { parseViesAddress, parseViesResponse, type ViesAddress, type ViesResult } from "./vies";
export { COMPANY_KINDS, companyInput, type CompanyInput, type CompanyKind } from "./inputs";
export {
  INVITE_TTL_DAYS,
  inviteExpiresAt,
  inviteInput,
  inviteState,
  MAX_INVITES_PER_DAY,
  MAX_OPEN_INVITES,
  MAX_SITES_PER_COMPANY,
  SITE_REJECTION_REASONS,
  siteDecisionInput,
  siteInput,
  siteState,
  type InviteInput,
  type InviteState,
  type SiteDecision,
  type SiteInput,
  type SiteRejectionReason,
  type SiteState,
} from "./team";
