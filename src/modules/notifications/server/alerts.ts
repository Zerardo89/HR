import { and, asc, eq, inArray, isNotNull, lte } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { KeyProvider } from "@/lib/crypto";
import { savedSearches, users, workerProfiles } from "@/lib/db/schema";
import { logger } from "@/lib/logger";
import type { Mailer } from "@/lib/mail";
import { findMunicipality } from "@/modules/geo";
import { rankOffers } from "@/modules/matching/domain";
import { findCandidates, recognizeOccupation } from "@/modules/matching/jobs";
import { notificationEmail } from "@/modules/privacy/jobs";
import type { PreparedCatalog } from "@/modules/taxonomy/domain";
import {
  ALERT_OFFERS_PER_SEARCH,
  alertQuery,
  alertsActiveFor,
  isAlertDue,
  renderAlertEmail,
  type AlertFrequency,
  type AlertSection,
} from "../domain";
import { createUnsubscribeToken } from "./unsubscribe";

/*
 * Invio degli avvisi (job `alerts.send`, ogni giorno alle 8 ora italiana, WP-020).
 * Per ogni persona: le ricerche dovute, le offerte pubblicate dopo l'ultimo controllo, UNA email.
 * Prima si spedisce, poi si segna il controllo: se l'SMTP non risponde, le offerte restano per il giro dopo.
 */

export type AlertJobDeps = {
  db: NodePgDatabase;
  keys: KeyProvider;
  mailer: Mailer;
  now: () => Date;
  appUrl: string;
  occupations: PreparedCatalog;
};

export type AlertRunSummary = { people: number; emails: number; failures: number };

type DueSearch = {
  id: string;
  userId: string;
  params: string;
  frequency: AlertFrequency;
  checkedUntil: Date;
};

async function dueSearches(db: NodePgDatabase, now: Date): Promise<DueSearch[]> {
  // Prefiltro largo nel DB (almeno ~un giorno), la regola esatta nel dominio.
  const rows = await db
    .select({
      id: savedSearches.id,
      userId: savedSearches.userId,
      params: savedSearches.params,
      frequency: savedSearches.frequency,
      checkedUntil: savedSearches.checkedUntil,
      state: workerProfiles.state,
    })
    .from(savedSearches)
    .innerJoin(users, eq(users.id, savedSearches.userId))
    .leftJoin(workerProfiles, eq(workerProfiles.userId, savedSearches.userId))
    .where(
      and(
        eq(users.status, "active"),
        eq(users.role, "worker"),
        isNotNull(users.dekWrapped),
        lte(savedSearches.checkedUntil, new Date(now.getTime() - 20 * 60 * 60_000)),
      ),
    )
    .orderBy(asc(savedSearches.userId), asc(savedSearches.createdAt));
  return rows.filter(
    (r) => alertsActiveFor(r.state ?? null) && isAlertDue(r.frequency, r.checkedUntil, now),
  );
}

async function newOffers(
  deps: AlertJobDeps,
  search: DueSearch,
  now: Date,
): Promise<AlertSection | null> {
  const query = alertQuery(search.params);
  let place = null;
  if (query.dove) {
    const found = await findMunicipality(deps.db, query.dove);
    if (found.status !== "found") return null; // comune non più riconosciuto (fusione ISTAT): si salta
    place = found.place;
  }
  const occupation = recognizeOccupation(deps.occupations, query.q);
  const { candidates } = await findCandidates(deps.db, {
    text: query.q,
    occupation,
    place,
    radiusKm: query.radiusKm,
    query,
    now,
    publishedWindow: { after: search.checkedUntil, until: now },
  });
  const page = rankOffers(
    candidates,
    { occupation, hasText: Boolean(query.q), radiusKm: place ? query.radiusKm : null, now },
    { minMonthlySalary: query.minMonthlySalary, page: 1 },
  );
  if (page.total === 0) return null;
  return {
    query,
    frequency: search.frequency,
    offers: page.results.slice(0, ALERT_OFFERS_PER_SEARCH),
    total: page.total,
  };
}

export async function sendDueAlerts(deps: AlertJobDeps): Promise<AlertRunSummary> {
  const now = deps.now();
  const byUser = new Map<string, DueSearch[]>();
  for (const s of await dueSearches(deps.db, now)) {
    byUser.set(s.userId, [...(byUser.get(s.userId) ?? []), s]);
  }

  const summary: AlertRunSummary = { people: byUser.size, emails: 0, failures: 0 };
  for (const [userId, searches] of byUser) {
    const sections: AlertSection[] = [];
    for (const s of searches) {
      const section = await newOffers(deps, s, now);
      if (section) sections.push(section);
    }

    let sent = false;
    if (sections.length > 0) {
      try {
        const to = await notificationEmail(deps, userId, "notification.job-alert");
        if (to) {
          const token = await createUnsubscribeToken(deps.db, userId, now);
          const unsubscribeUrl = `${deps.appUrl}/api/avvisi/disiscrizione?token=${token}`;
          const { subject, text } = renderAlertEmail({
            sections,
            appUrl: deps.appUrl,
            unsubscribeUrl: `${deps.appUrl}/avvisi/disiscrizione?token=${token}`,
          });
          await deps.mailer.send({
            to,
            subject,
            text,
            headers: {
              "List-Unsubscribe": `<${unsubscribeUrl}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          });
          sent = true;
          summary.emails += 1;
        }
      } catch (error) {
        // Né destinatario né contenuto nei log (R-PRIV-05): le offerte restano per il prossimo giro.
        summary.failures += 1;
        logger.warn({ err: (error as Error).name }, "avviso non spedito");
        continue;
      }
    }

    await deps.db
      .update(savedSearches)
      .set(sent ? { checkedUntil: now, lastSentAt: now } : { checkedUntil: now })
      .where(
        inArray(
          savedSearches.id,
          searches.map((s) => s.id),
        ),
      );
  }
  return summary;
}
