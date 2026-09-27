// Modulo `companies` — API pura: P.IVA, risposta VIES, dati di registrazione (WP-011).
export { isValidItalianVat, normalizeVat } from "./vat";
export { parseViesAddress, parseViesResponse, type ViesAddress, type ViesResult } from "./vies";
export { COMPANY_KINDS, companyInput, type CompanyInput, type CompanyKind } from "./inputs";
