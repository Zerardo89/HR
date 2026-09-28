import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { KeyProvider } from "@/lib/crypto";
import {
  applications,
  companies,
  companySites,
  jobOffers,
  municipalities,
  provinces,
} from "@/lib/db/schema";
import { logger } from "@/lib/logger";
import type { Mailer } from "@/lib/mail";
import { companyMemberEmails, notificationEmail } from "@/modules/privacy";
import {
  isNotifiedApplicationStatus,
  renderApplicationUpdate,
  renderCompanyVerified,
  renderOfferOutcome,
  renderSiteOutcome,
  type RenderedEmail,
} from "../domain";

/*
 * Email di esito (WP-020c), spedite dopo che la decisione è salvata. Se l'SMTP non risponde la decisione resta
 * valida e visibile nell'area riservata: l'errore va solo nel log (né destinatario né contenuto, R-PRIV-05).
 * Gli indirizzi li decifra `modules/privacy`, con uno scopo per ogni tipo di esito.
 */

export type OutcomeDeps = {
  db: NodePgDatabase;
  keys: KeyProvider;
  mailer: Mailer;
  now: () => Date;
  appUrl: string;
};

async function deliver(
  deps: OutcomeDeps,
  kind: string,
  recipients: () => Promise<(string | null)[]>,
  email: RenderedEmail,
): Promise<number> {
  let sent = 0;
  try {
    for (const to of await recipients()) {
      if (!to) continue;
      await deps.mailer.send({ to, ...email });
      sent += 1;
    }
  } catch (error) {
    logger.warn({ err: (error as Error).name, kind }, "email di esito non spedita");
  }
  return sent;
}

type ModerationRecord = { decision?: { decision?: string; reason?: string; note?: string } };

/** Offerta approvata o rifiutata dalla moderazione → tutti i membri attivi dell'azienda. */
export async function notifyOfferOutcome(deps: OutcomeDeps, offerId: string): Promise<number> {
  const [offer] = await deps.db
    .select({
      title: jobOffers.title,
      status: jobOffers.status,
      moderation: jobOffers.moderation,
      companyId: jobOffers.companyId,
    })
    .from(jobOffers)
    .where(eq(jobOffers.id, offerId))
    .limit(1);
  const decision = (offer?.moderation as ModerationRecord | null)?.decision;
  if (!offer || !decision) return 0;
  let outcome: Parameters<typeof renderOfferOutcome>[0]["decision"];
  if (decision.decision === "approved" && offer.status === "published") {
    outcome = { approved: true };
  } else if (decision.decision === "rejected" && offer.status === "draft") {
    outcome = { approved: false, reason: decision.reason ?? "other", note: decision.note };
  } else {
    return 0;
  }
  const email = renderOfferOutcome({
    appUrl: deps.appUrl,
    offerId,
    title: offer.title,
    decision: outcome,
  });
  return deliver(
    deps,
    "offer",
    () => companyMemberEmails(deps, offer.companyId, "notification.offer-outcome"),
    email,
  );
}

/** Sede approvata o rifiutata → i titolari (sono loro a gestire le sedi). */
export async function notifySiteOutcome(deps: OutcomeDeps, siteId: string): Promise<number> {
  const [site] = await deps.db
    .select({
      companyId: companySites.companyId,
      approvedAt: companySites.approvedAt,
      rejectedAt: companySites.rejectedAt,
      reason: companySites.rejectionReason,
      municipality: municipalities.name,
      province: provinces.abbreviation,
    })
    .from(companySites)
    .innerJoin(municipalities, eq(municipalities.istatCode, companySites.municipalityCode))
    .innerJoin(provinces, eq(provinces.code, municipalities.provinceCode))
    .where(eq(companySites.id, siteId))
    .limit(1);
  if (!site || (!site.approvedAt && !site.rejectedAt)) return 0;
  const email = renderSiteOutcome({
    appUrl: deps.appUrl,
    place: `${site.municipality} (${site.province})`,
    decision: site.approvedAt
      ? { approved: true }
      : { approved: false, reason: site.reason ?? "other" },
  });
  return deliver(
    deps,
    "site",
    () =>
      companyMemberEmails(deps, site.companyId, "notification.site-outcome", { ownersOnly: true }),
    email,
  );
}

/** Azienda verificata a mano dal moderatore → tutti i membri attivi. */
export async function notifyCompanyVerified(deps: OutcomeDeps, companyId: string): Promise<number> {
  const [company] = await deps.db
    .select({ name: companies.displayName, status: companies.status })
    .from(companies)
    .where(eq(companies.id, companyId))
    .limit(1);
  if (!company || company.status !== "verified") return 0;
  return deliver(
    deps,
    "company",
    () => companyMemberEmails(deps, companyId, "notification.company-verified"),
    renderCompanyVerified({ appUrl: deps.appUrl, company: company.name }),
  );
}

/** L'azienda aggiorna la candidatura ("ti contatterà", "altri candidati", "assunta/o") → il lavoratore. */
export async function notifyApplicationUpdate(
  deps: OutcomeDeps,
  applicationId: string,
): Promise<number> {
  const [app] = await deps.db
    .select({
      status: applications.status,
      workerUserId: applications.workerUserId,
      title: jobOffers.title,
      company: companies.displayName,
    })
    .from(applications)
    .innerJoin(jobOffers, eq(jobOffers.id, applications.offerId))
    .innerJoin(companies, eq(companies.id, jobOffers.companyId))
    .where(eq(applications.id, applicationId))
    .limit(1);
  if (!app || !isNotifiedApplicationStatus(app.status)) return 0;
  return deliver(
    deps,
    "application",
    async () => [
      await notificationEmail(deps, app.workerUserId, "notification.application-status"),
    ],
    renderApplicationUpdate({
      appUrl: deps.appUrl,
      title: app.title,
      company: app.company,
      status: app.status,
    }),
  );
}
