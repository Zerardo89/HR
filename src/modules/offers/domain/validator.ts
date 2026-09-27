import { normalizeTerm } from "@/modules/taxonomy/domain";
import { TERM_RULES, type Severity } from "./terms";

/**
 * Validatore degli annunci a norma (WP-012, docs/02-REGOLE-DEL-GIOCO.md §3). Funzione pura: la usano il
 * form (anteprima mentre l'azienda scrive), il server (prima di salvare) e i test di accettazione.
 * Esito: `blocked` (da correggere), `moderation` (pubblicabile solo dopo un moderatore), `publish`.
 * Nessuna IA: solo regole scritte a mano (R-AI-01).
 */

export const CONTRACT_TYPES = [
  "permanent",
  "fixed_term",
  "apprenticeship",
  "agency",
  "internship",
  "seasonal",
  "collaboration",
  "self_employed",
  "occasional",
] as const;
export type ContractType = (typeof CONTRACT_TYPES)[number];

/** Lavoro non subordinato: lo stipendio è facoltativo (R-ANN-01, stesso elenco del CHECK nel DB). */
export const SALARY_OPTIONAL_CONTRACTS: readonly ContractType[] = [
  "collaboration",
  "self_employed",
  "occasional",
];

export const MAX_VALIDITY_DAYS = 60; // R-ANN-07
export const FIRST_OFFERS_IN_MODERATION = 3; // §3.2: le prime 3 offerte di un'azienda nuova
export const MIN_DESCRIPTION_LENGTH = 80;

export type SalaryPeriod = "hour" | "month" | "year";

export type OfferDraft = {
  title: string;
  description: string;
  contractType: ContractType;
  salaryMin?: number | null;
  salaryMax?: number | null;
  salaryPeriod?: SalaryPeriod | null;
  ccnl?: string | null;
  validThrough?: Date | null;
  /** R-LAV-10: il tirocinio dichiara che non sostituisce lavoro subordinato. */
  internshipDeclaration?: boolean;
  /** Domande di preselezione facoltative dell'azienda (R-ANN-02). */
  screeningQuestions?: readonly string[];
};

export type OfferContext = {
  now: Date;
  company: {
    status: "pending" | "verified" | "suspended";
    kind: "employer" | "agency";
    agencyAuthorization: string | null;
    displayName: string;
    publishedOffers: number;
  };
  /** Indennità minima mensile dei tirocini nella regione della sede (tabella curata a mano); null = non nota. */
  internshipMonthlyMinimum?: number | null;
};

export type OfferField = keyof OfferDraft | "company";

export type Issue = {
  code: string;
  rule: string;
  severity: Severity;
  field: OfferField;
  /** Il pezzo di testo che ha fatto scattare la regola (per evidenziarlo nel form). */
  match?: string;
};

/** Consigli non bloccanti (R-ANN-03 titolo per entrambi i sessi, R-ANN-06 CCNL). */
export type Hint = { code: "title_gender" | "ccnl_missing"; rule: string };

export type ValidationResult = {
  decision: "blocked" | "moderation" | "publish";
  issues: Issue[];
  hints: Hint[];
};

const DAY_MS = 24 * 60 * 60_000;

/** Soglie di plausibilità dello stipendio: fuori da qui probabilmente è un errore di periodo (ora/mese/anno). */
const SALARY_PLAUSIBLE: Record<SalaryPeriod, [number, number]> = {
  hour: [4, 150],
  month: [300, 20_000],
  year: [4_000, 250_000],
};

const TITLE_GENDER_MARKERS =
  /\/[ae]\b|\(m\s*\/\s*f|\bm\s*\/\s*f\b|\(f\s*\/\s*m|\bf\s*\/\s*m\b|\be\/o\b/i;

function checkText(field: OfferField, text: string, contract: ContractType): Issue[] {
  const normalized = normalizeTerm(text);
  const issues: Issue[] = [];
  for (const r of TERM_RULES) {
    const m = r.pattern.exec(normalized);
    if (!m) continue;
    // In apprendistato i limiti di età sono di legge: non si blocca, decide il moderatore.
    const severity =
      r.code === "age_limit" && contract === "apprenticeship" ? "review" : r.severity;
    issues.push({ code: r.code, rule: r.rule, severity, field, match: m[0] });
  }
  return issues;
}

function checkSalary(d: OfferDraft, ctx: OfferContext): Issue[] {
  const issues: Issue[] = [];
  const has = d.salaryMin != null;
  const required = !SALARY_OPTIONAL_CONTRACTS.includes(d.contractType);
  if (!has) {
    if (required)
      issues.push({
        code: "salary_missing",
        rule: "R-ANN-01",
        severity: "error",
        field: "salaryMin",
      });
    return issues;
  }
  const min = d.salaryMin!;
  if (!(min > 0))
    issues.push({
      code: "salary_invalid",
      rule: "R-ANN-01",
      severity: "error",
      field: "salaryMin",
    });
  if (d.salaryMax != null && d.salaryMax < min) {
    issues.push({ code: "salary_range", rule: "R-ANN-01", severity: "error", field: "salaryMax" });
  }
  if (!d.salaryPeriod) {
    issues.push({
      code: "salary_period_missing",
      rule: "R-ANN-01",
      severity: "error",
      field: "salaryPeriod",
    });
    return issues;
  }
  const [low, high] = SALARY_PLAUSIBLE[d.salaryPeriod];
  if (min > 0 && (min < low || (d.salaryMax ?? min) > high)) {
    issues.push({
      code: "salary_implausible",
      rule: "R-ANN-01",
      severity: "review",
      field: "salaryMin",
    });
  }
  if (d.contractType === "internship") {
    const minimum = ctx.internshipMonthlyMinimum;
    if (minimum == null) {
      issues.push({
        code: "internship_minimum_unknown",
        rule: "R-LAV-10",
        severity: "review",
        field: "salaryMin",
      });
    } else if (d.salaryPeriod !== "month" || min < minimum) {
      issues.push({
        code: "internship_below_minimum",
        rule: "R-LAV-10",
        severity: "error",
        field: "salaryMin",
      });
    }
  }
  return issues;
}

export function validateOffer(d: OfferDraft, ctx: OfferContext): ValidationResult {
  const issues: Issue[] = [];
  const { company, now } = ctx;

  // R-LAV-02 annunci non anonimi (azienda verificata); R-LAV-03 agenzie autorizzate
  if (company.status !== "verified" || company.displayName.trim() === "") {
    issues.push({
      code: "company_not_verified",
      rule: "R-LAV-02",
      severity: "error",
      field: "company",
    });
  }
  if (company.kind === "agency" && !company.agencyAuthorization?.trim()) {
    issues.push({
      code: "agency_authorization_missing",
      rule: "R-LAV-03",
      severity: "error",
      field: "company",
    });
  }

  // Testi
  const title = d.title.trim();
  if (title.length < 3 || title.length > 120) {
    issues.push({ code: "title_length", rule: "R-ANN-05", severity: "error", field: "title" });
  }
  if (d.description.trim().length < MIN_DESCRIPTION_LENGTH) {
    issues.push({
      code: "description_too_short",
      rule: "R-ANN-08",
      severity: "error",
      field: "description",
    });
  }
  issues.push(...checkText("title", d.title, d.contractType));
  issues.push(...checkText("description", d.description, d.contractType));
  for (const q of d.screeningQuestions ?? [])
    issues.push(...checkText("screeningQuestions", q, d.contractType));
  if (/https?:\/\/|\bwww\./i.test(d.description)) {
    issues.push({
      code: "external_link",
      rule: "R-ANN-08",
      severity: "review",
      field: "description",
    });
  }

  // R-ANN-01 stipendio, R-LAV-10 tirocini
  issues.push(...checkSalary(d, ctx));
  if (d.contractType === "internship" && !d.internshipDeclaration) {
    issues.push({
      code: "internship_declaration_missing",
      rule: "R-LAV-10",
      severity: "error",
      field: "internshipDeclaration",
    });
  }

  // R-ANN-07 scadenza: obbligatoria, futura, entro 60 giorni
  if (!d.validThrough) {
    issues.push({
      code: "valid_through_missing",
      rule: "R-ANN-07",
      severity: "error",
      field: "validThrough",
    });
  } else if (d.validThrough.getTime() <= now.getTime()) {
    issues.push({
      code: "valid_through_past",
      rule: "R-ANN-07",
      severity: "error",
      field: "validThrough",
    });
  } else if (d.validThrough.getTime() > now.getTime() + MAX_VALIDITY_DAYS * DAY_MS) {
    issues.push({
      code: "valid_through_too_far",
      rule: "R-ANN-07",
      severity: "error",
      field: "validThrough",
    });
  }

  // §3.2: le prime offerte di un'azienda nuova passano sempre dal moderatore
  if (company.publishedOffers < FIRST_OFFERS_IN_MODERATION) {
    issues.push({ code: "first_offers", rule: "R-ANN-08", severity: "review", field: "company" });
  }

  const hints: Hint[] = [];
  if (!TITLE_GENDER_MARKERS.test(title)) hints.push({ code: "title_gender", rule: "R-ANN-03" });
  if (!SALARY_OPTIONAL_CONTRACTS.includes(d.contractType) && !d.ccnl?.trim()) {
    hints.push({ code: "ccnl_missing", rule: "R-ANN-06" });
  }

  const decision = issues.some((i) => i.severity === "error")
    ? "blocked"
    : issues.length > 0
      ? "moderation"
      : "publish";
  return { decision, issues, hints };
}
