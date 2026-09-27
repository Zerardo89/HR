// Modulo `offers` — API pura: validatore degli annunci a norma (WP-012).
export { TERM_RULES, type Severity, type TermRule } from "./terms";
export {
  CONTRACT_TYPES,
  FIRST_OFFERS_IN_MODERATION,
  MAX_VALIDITY_DAYS,
  MIN_DESCRIPTION_LENGTH,
  SALARY_OPTIONAL_CONTRACTS,
  validateOffer,
  type ContractType,
  type Hint,
  type Issue,
  type OfferContext,
  type OfferDraft,
  type OfferField,
  type SalaryPeriod,
  type ValidationResult,
} from "./validator";
