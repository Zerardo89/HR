import { and, eq, gt, isNull, lte } from "drizzle-orm";
import { applications, companies, jobOffers } from "@/lib/db/schema";
import { logger } from "@/lib/logger";
import { EXPIRY_NOTICE_DAYS } from "@/modules/offers/domain";
import { companyMemberEmails, notificationEmail } from "@/modules/privacy";
import { renderExpiryNotice, renderPositionClosed } from "../domain";
import type { OutcomeDeps } from "./outcomes";

/*
 * Email del ciclo di vita dell'offerta (WP-022), spedite dal job `offers.lifecycle` (ogni mattina alle 7:30):
 * - promemoria all'azienda tre giorni prima della scadenza (una volta sola, si azzera al rinnovo);
 * - "posizione chiusa" ai candidati le cui candidature si sono chiuse (offerta chiusa o scaduta).
 * Prima si spedisce, poi si segna: se l'SMTP non risponde, si riprova al giro dopo. Nei log solo numeri.
 */

const BATCH = 1000;

export type LifecycleEmailSummary = { sent: number; failures: number };

export async function sendExpiryNotices(deps: OutcomeDeps): Promise<LifecycleEmailSummary> {
  const now = deps.now();
  const until = new Date(now.getTime() + EXPIRY_NOTICE_DAYS * 24 * 60 * 60_000);
  const offers = await deps.db
    .select({
      id: jobOffers.id,
      title: jobOffers.title,
      companyId: jobOffers.companyId,
      validThrough: jobOffers.validThrough,
    })
    .from(jobOffers)
    .where(
      and(
        eq(jobOffers.status, "published"),
        gt(jobOffers.validThrough, now),
        lte(jobOffers.validThrough, until),
        isNull(jobOffers.expiryNoticeAt),
      ),
    )
    .limit(BATCH);

  const summary: LifecycleEmailSummary = { sent: 0, failures: 0 };
  for (const offer of offers) {
    try {
      const email = renderExpiryNotice({
        appUrl: deps.appUrl,
        offerId: offer.id,
        title: offer.title,
        validThrough: offer.validThrough!,
      });
      for (const to of await companyMemberEmails(
        deps,
        offer.companyId,
        "notification.offer-expiry",
      )) {
        await deps.mailer.send({ to, ...email });
        summary.sent += 1;
      }
      await deps.db
        .update(jobOffers)
        .set({ expiryNoticeAt: now })
        .where(eq(jobOffers.id, offer.id));
    } catch (error) {
      summary.failures += 1;
      logger.warn({ err: (error as Error).name }, "promemoria di scadenza non spedito");
    }
  }
  return summary;
}

export async function sendPositionClosedEmails(deps: OutcomeDeps): Promise<LifecycleEmailSummary> {
  const pending = await deps.db
    .select({
      id: applications.id,
      workerUserId: applications.workerUserId,
      title: jobOffers.title,
      offerStatus: jobOffers.status,
      company: companies.displayName,
    })
    .from(applications)
    .innerJoin(jobOffers, eq(jobOffers.id, applications.offerId))
    .innerJoin(companies, eq(companies.id, jobOffers.companyId))
    .where(and(eq(applications.status, "closed"), isNull(applications.closureNotifiedAt)))
    .limit(BATCH);

  const summary: LifecycleEmailSummary = { sent: 0, failures: 0 };
  for (const app of pending) {
    try {
      const to = await notificationEmail(deps, app.workerUserId, "notification.position-closed");
      // Account cancellato o sospeso: niente da spedire, ma la candidatura non resta "da avvisare".
      if (to) {
        await deps.mailer.send({
          to,
          ...renderPositionClosed({
            appUrl: deps.appUrl,
            title: app.title,
            company: app.company,
            reason: app.offerStatus === "expired" ? "expired" : "closed",
          }),
        });
        summary.sent += 1;
      }
      // Segnata subito dopo l'invio: se il processo si ferma a metà giro, nessun doppione.
      await deps.db
        .update(applications)
        .set({ closureNotifiedAt: deps.now() })
        .where(eq(applications.id, app.id));
    } catch (error) {
      summary.failures += 1;
      logger.warn({ err: (error as Error).name }, "avviso di posizione chiusa non spedito");
    }
  }
  return summary;
}
