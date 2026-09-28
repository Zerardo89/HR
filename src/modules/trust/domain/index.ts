// Modulo `trust` — dominio (puro): segnalazioni e decisioni motivate (DSA art. 16-17, WP-024a).
export {
  containsContactData,
  decisionCode,
  FACTS_MAX,
  FACTS_MIN,
  REPORT_DETAILS_MAX,
  REPORT_GROUNDS,
  REPORT_IP_LIMIT,
  REPORT_REASONS,
  REPORT_TARGETS,
  reportDecisionInput,
  reportInput,
  reportInputError,
  type ReportDecision,
  type ReportGround,
  type ReportInput,
  type ReportInputError,
  type ReportReason,
  type ReportTarget,
} from "./reports";
export {
  groundText,
  renderDecisionForCompany,
  renderReportOutcome,
  renderReportReceived,
  statementOfReasons,
  type RenderedEmail,
} from "./statement";
export {
  CURRENT_TERMS,
  termsHistory,
  termsOutdated,
  termsVersion,
  type TermsVersion,
} from "./terms";
