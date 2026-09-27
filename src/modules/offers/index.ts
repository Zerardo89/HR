import "server-only";

// Modulo `offers` — API pubblica (lato server): offerte, validatore a norma (R-ANN-*), moderazione.
import { getDb } from "@/lib/db";
import { getCompanyOfferContext, type CompanyOfferContext } from "./server/company-context";
import { listPendingOffers, type PendingOffer } from "./server/moderation";
import {
  getOfferForMember as queryOffer,
  listOffersForCompany as queryOffers,
  type CompanyOfferRow,
  type EditableOffer,
} from "./server/queries";

export type { CompanyOfferContext, CompanyOfferRow, EditableOffer, PendingOffer };
export { OfferForm, type OfferFormSite } from "./ui/offer-form";

export function getOfferContext(
  userId: string,
  companyId: string,
): Promise<CompanyOfferContext | null> {
  return getCompanyOfferContext(getDb(), userId, companyId, new Date());
}

export function listCompanyOffers(userId: string, companyId: string): Promise<CompanyOfferRow[]> {
  return queryOffers(getDb(), userId, companyId);
}

export function getOfferForEdit(userId: string, offerId: string): Promise<EditableOffer | null> {
  return queryOffer(getDb(), userId, offerId);
}

export { decideOfferAction } from "./server/moderation-actions";

export function listOffersToModerate(): Promise<PendingOffer[]> {
  return listPendingOffers(getDb());
}
