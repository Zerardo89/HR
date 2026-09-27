import "server-only";

// Modulo `companies` — API pubblica (lato server): aziende, sedi, membri, verifica P.IVA tramite VIES (WP-011).
import { getDb } from "@/lib/db";
import { getCompaniesForUser as queryCompanies, type MyCompany } from "./server/queries";

export type { MyCompany };
export { CompanyRegistrationForm } from "./ui/company-registration-form";

export function getCompaniesForUser(userId: string): Promise<MyCompany[]> {
  return queryCompanies(getDb(), userId);
}
