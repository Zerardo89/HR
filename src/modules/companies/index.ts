import "server-only";

// Modulo `companies` — API pubblica (lato server): aziende, sedi, membri, verifica P.IVA tramite VIES (WP-011).
import { getDb } from "@/lib/db";
import { readPendingInvite } from "./server/invite-cookie";
import {
  getInvite,
  listOpenInvites as queryInvites,
  type InviteRow,
  type InviteView,
} from "./server/invites";
import { getCompaniesForUser as queryCompanies, type MyCompany } from "./server/queries";
import {
  listCompanySites as querySites,
  listPendingSites,
  type CompanySiteRow,
  type PendingSite,
} from "./server/sites";
import { listPendingCompanies, type PendingCompany } from "./server/verification";

export type { CompanySiteRow, InviteRow, InviteView, MyCompany, PendingCompany, PendingSite };
export { CompanyRegistrationForm } from "./ui/company-registration-form";
export { InviteForm } from "./ui/invite-form";
export { SiteForm } from "./ui/site-form";

const deps = () => ({ db: getDb(), now: () => new Date() });

export function getCompaniesForUser(userId: string): Promise<MyCompany[]> {
  return queryCompanies(getDb(), userId);
}

export { verifyCompanyAction } from "./server/verification-actions";
export {
  acceptInviteAction,
  continueInviteAction,
  decideSiteAction,
  removeSiteAction,
  revokeInviteAction,
} from "./server/team-actions";

export function listCompaniesToVerify(): Promise<PendingCompany[]> {
  return listPendingCompanies(getDb());
}

/** Sedi dell'azienda (solo per i suoi membri; `null` altrimenti). */
export function listCompanySites(userId: string, companyId: string) {
  return querySites(getDb(), userId, companyId);
}

export function listSitesToApprove(): Promise<PendingSite[]> {
  return listPendingSites(getDb());
}

/** Inviti aperti (solo per il titolare; `null` altrimenti). */
export function listOpenInvites(userId: string, companyId: string) {
  return queryInvites(deps(), userId, companyId);
}

export function getInviteView(token: string): Promise<InviteView> {
  return getInvite(deps(), token);
}

/** Invito lasciato in sospeso durante l'accesso (cookie tecnico), se ancora valido. */
export async function getPendingInvite(): Promise<{ token: string; companyName: string } | null> {
  const token = await readPendingInvite();
  if (!token) return null;
  const view = await getInvite(deps(), token);
  return view.status === "open" ? { token, companyName: view.companyName } : null;
}
