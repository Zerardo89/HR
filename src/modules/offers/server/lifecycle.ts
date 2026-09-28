import { and, eq, gt, inArray, lte, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { auditLog, companyMembers, jobOffers, users } from "@/lib/db/schema";
import { closeApplicationsForOffers } from "@/modules/applications/jobs";
import { canCloseOffer, canRenewOffer, renewalWindowEnd, renewedValidThrough } from "../domain";
import type { OfferDeps } from "./deps";

/*
 * Ciclo di vita dell'offerta pubblicata (WP-022, R-ANN-07): chiusura dall'azienda, rinnovo negli ultimi 7 giorni,
 * scadenza automatica (job `offers.lifecycle`). Chiudere o far scadere un'offerta chiude le candidature aperte
 * nella stessa transazione; l'email "posizione chiusa" la spedisce poi il worker.
 */

/** L'utente è membro attivo (titolare o selezionatore) dell'azienda dell'offerta? */
async function memberOffer(db: NodePgDatabase, userId: string, offerId: string) {
  const [row] = await db
    .select({
      status: jobOffers.status,
      validThrough: jobOffers.validThrough,
      companyId: jobOffers.companyId,
    })
    .from(jobOffers)
    .innerJoin(
      companyMembers,
      and(eq(companyMembers.companyId, jobOffers.companyId), eq(companyMembers.userId, userId)),
    )
    .innerJoin(users, eq(users.id, companyMembers.userId))
    .where(
      and(
        eq(jobOffers.id, offerId),
        eq(users.status, "active"),
        eq(users.role, "company_member"),
        inArray(companyMembers.role, ["owner", "recruiter"]),
      ),
    )
    .limit(1);
  return row ?? null;
}

export type LifecycleResult = { status: "closed" | "renewed" | "not_found" | "not_allowed" };

export async function closeOffer(
  deps: OfferDeps,
  userId: string,
  offerId: string,
): Promise<LifecycleResult> {
  const offer = await memberOffer(deps.db, userId, offerId);
  if (!offer) return { status: "not_found" };
  if (!canCloseOffer(offer.status)) return { status: "not_allowed" };
  const now = deps.now();
  const done = await deps.db.transaction(async (tx) => {
    const [row] = await tx
      .update(jobOffers)
      .set({ status: "closed", updatedAt: now })
      .where(and(eq(jobOffers.id, offerId), eq(jobOffers.status, "published")))
      .returning({ id: jobOffers.id });
    if (!row) return false;
    await closeApplicationsForOffers(tx, [offerId], now);
    await tx.insert(auditLog).values({
      actorId: userId,
      action: "offer.close",
      targetTable: "job_offers",
      targetId: offerId,
      at: now,
    });
    return true;
  });
  return { status: done ? "closed" : "not_allowed" };
}

/** Rinnovo: nuova data di pubblicazione e nuova scadenza (la regola dei 60 giorni resta valida). */
export async function renewOffer(
  deps: OfferDeps,
  userId: string,
  offerId: string,
  days: number,
): Promise<LifecycleResult> {
  const offer = await memberOffer(deps.db, userId, offerId);
  if (!offer) return { status: "not_found" };
  const now = deps.now();
  if (!canRenewOffer(offer.status, offer.validThrough, now)) return { status: "not_allowed" };
  const [row] = await deps.db
    .update(jobOffers)
    .set({
      publishedAt: now,
      validThrough: renewedValidThrough(now, days),
      expiryNoticeAt: null,
      updatedAt: now,
      moderation: sql`${jobOffers.moderation} || ${JSON.stringify({ renewedAt: now.toISOString() })}::jsonb`,
    })
    // Rinnovo concorrente: dopo il primo la scadenza esce dalla finestra e il secondo non scrive nulla.
    // (Niente confronto sulla data letta: Postgres ha i microsecondi, JavaScript solo i millisecondi.)
    .where(
      and(
        eq(jobOffers.id, offerId),
        eq(jobOffers.status, "published"),
        gt(jobOffers.validThrough, now),
        lte(jobOffers.validThrough, renewalWindowEnd(now)),
      ),
    )
    .returning({ id: jobOffers.id });
  if (!row) return { status: "not_allowed" };
  await deps.db.insert(auditLog).values({
    actorId: userId,
    action: "offer.renew",
    targetTable: "job_offers",
    targetId: offerId,
    purpose: `days:${days}`,
    at: now,
  });
  return { status: "renewed" };
}

/** Job: le offerte pubblicate oltre la scadenza diventano "scaduta" e le loro candidature si chiudono. */
export async function expireDueOffers(
  deps: OfferDeps,
): Promise<{ offersExpired: number; applicationsClosed: number }> {
  const now = deps.now();
  return deps.db.transaction(async (tx) => {
    const expired = await tx
      .update(jobOffers)
      .set({ status: "expired", updatedAt: now })
      .where(and(eq(jobOffers.status, "published"), lte(jobOffers.validThrough, now)))
      .returning({ id: jobOffers.id });
    const { closed } = await closeApplicationsForOffers(
      tx,
      expired.map((o) => o.id),
      now,
    );
    return { offersExpired: expired.length, applicationsClosed: closed };
  });
}
