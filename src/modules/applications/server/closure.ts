import { and, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { applications } from "@/lib/db/schema";
import { APPLICATION_STATUSES, companyVisibleUntil, isFinal } from "../domain";

/*
 * Chiusura delle candidature quando l'offerta si chiude o scade (WP-022, R-ANN-07, R-PRIV-03).
 * - Le candidature ancora aperte diventano "chiusa": il lavoratore riceverà "posizione chiusa" (job del worker).
 * - Da ora parte la finestra di 6 mesi in cui l'azienda può ancora vederle; le già decise ("non selezionata",
 *   "assunta") restano come sono, ma con la stessa finestra.
 */

type Writer = Pick<NodePgDatabase, "update">;

/** Candidature ancora aperte: inviata, vista, in valutazione, "ti contatterà". */
const OPEN = APPLICATION_STATUSES.filter((s) => !isFinal(s));

export async function closeApplicationsForOffers(
  db: Writer,
  offerIds: string[],
  now: Date,
): Promise<{ closed: number }> {
  if (offerIds.length === 0) return { closed: 0 };
  const visibleUntil = companyVisibleUntil(now);
  const closed = await db
    .update(applications)
    .set({ status: "closed", closedAt: now, companyVisibleUntil: visibleUntil })
    .where(and(inArray(applications.offerId, offerIds), inArray(applications.status, OPEN)))
    .returning({ id: applications.id });
  await db
    .update(applications)
    .set({ companyVisibleUntil: visibleUntil })
    .where(and(inArray(applications.offerId, offerIds), isNull(applications.companyVisibleUntil)));
  return { closed: closed.length };
}

/**
 * Conservazione (docs/04 §8, `retention.applications`): finita la finestra dell'azienda, il messaggio della
 * candidatura non serve più a nessuno e si cancella. Il lavoratore continua a vedere la sua candidatura.
 */
export async function purgeExpiredApplicationMessages(
  db: Writer,
  now: Date,
): Promise<{ messagesPurged: number }> {
  const purged = await db
    .update(applications)
    .set({ messageEnc: null })
    .where(and(lt(applications.companyVisibleUntil, now), isNotNull(applications.messageEnc)))
    .returning({ id: applications.id });
  return { messagesPurged: purged.length };
}
