import { and, asc, count, eq, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { consents, savedSearches, users, workerProfiles } from "@/lib/db/schema";
import { findMunicipality } from "@/modules/geo";
import type { SearchQuery } from "@/modules/matching/domain";
import {
  alertParams,
  alertQuery,
  alertsActiveFor,
  canSaveAlert,
  JOB_ALERTS_CONSENT_VERSION,
  MAX_SAVED_SEARCHES,
  type AlertFrequency,
} from "../domain";

/*
 * Ricerche salvate del lavoratore (WP-020). Il lavoratore le crea dalla pagina di ricerca e le gestisce in
 * `/avvisi`. La richiesta esplicita ("Avvisami") è registrata come consenso `job_alerts` (02 §5).
 */

export type AlertDeps = { db: NodePgDatabase; now: () => Date };

export type SaveAlertResult = {
  status: "saved" | "duplicate" | "limit" | "invalid" | "not_allowed";
};

export async function saveAlert(
  deps: AlertDeps,
  userId: string,
  input: { params: string; frequency: AlertFrequency },
): Promise<SaveAlertResult> {
  const query = alertQuery(input.params);
  if (!canSaveAlert(query)) return { status: "invalid" };
  // Il comune si salva nella forma "Nome (PR)": resta univoco anche per i comuni omonimi.
  if (query.dove) {
    const place = await findMunicipality(deps.db, query.dove);
    if (place.status !== "found") return { status: "invalid" };
    query.dove = `${place.place.name} (${place.place.provinceAbbr})`;
  }
  const params = alertParams(query);
  const now = deps.now();

  return deps.db.transaction(async (tx) => {
    // Blocca la riga dell'utente: due salvataggi simultanei non superano il limite.
    const [user] = await tx
      .select({ role: users.role, status: users.status })
      .from(users)
      .where(eq(users.id, userId))
      .for("update")
      .limit(1);
    if (!user || user.role !== "worker" || user.status !== "active") {
      return { status: "not_allowed" as const };
    }
    const [{ n }] = (await tx
      .select({ n: count() })
      .from(savedSearches)
      .where(eq(savedSearches.userId, userId))) as [{ n: number }];
    const inserted =
      n < MAX_SAVED_SEARCHES
        ? await tx
            .insert(savedSearches)
            .values({
              userId,
              params,
              frequency: input.frequency,
              checkedUntil: now,
              createdAt: now,
            })
            .onConflictDoNothing()
            .returning({ id: savedSearches.id })
        : [];
    if (inserted.length === 0) {
      const [same] = await tx
        .select({ id: savedSearches.id })
        .from(savedSearches)
        .where(and(eq(savedSearches.userId, userId), eq(savedSearches.params, params)))
        .limit(1);
      return { status: same ? ("duplicate" as const) : ("limit" as const) };
    }
    const [active] = await tx
      .select({ id: consents.id })
      .from(consents)
      .where(
        and(
          eq(consents.userId, userId),
          eq(consents.type, "job_alerts"),
          isNull(consents.revokedAt),
        ),
      )
      .limit(1);
    if (!active) {
      await tx.insert(consents).values({
        userId,
        type: "job_alerts",
        version: JOB_ALERTS_CONSENT_VERSION,
        grantedAt: now,
      });
    }
    return { status: "saved" as const };
  });
}

export type SavedAlert = {
  id: string;
  params: string;
  query: SearchQuery;
  frequency: AlertFrequency;
  lastSentAt: Date | null;
  createdAt: Date;
};

export async function listAlerts(
  db: NodePgDatabase,
  userId: string,
): Promise<{ alerts: SavedAlert[]; active: boolean }> {
  const [rows, [profile]] = await Promise.all([
    db
      .select({
        id: savedSearches.id,
        params: savedSearches.params,
        frequency: savedSearches.frequency,
        lastSentAt: savedSearches.lastSentAt,
        createdAt: savedSearches.createdAt,
      })
      .from(savedSearches)
      .where(eq(savedSearches.userId, userId))
      .orderBy(asc(savedSearches.createdAt)),
    db
      .select({ state: workerProfiles.state })
      .from(workerProfiles)
      .where(eq(workerProfiles.userId, userId))
      .limit(1),
  ]);
  return {
    alerts: rows.map((r) => ({ ...r, query: alertQuery(r.params) })),
    active: alertsActiveFor(profile?.state ?? null),
  };
}

/** C'è già un avviso per questa ricerca? (la pagina di ricerca mostra "Hai già un avviso"). */
export async function hasAlertFor(
  db: NodePgDatabase,
  userId: string,
  query: SearchQuery,
): Promise<boolean> {
  const [row] = await db
    .select({ id: savedSearches.id })
    .from(savedSearches)
    .where(and(eq(savedSearches.userId, userId), eq(savedSearches.params, alertParams(query))))
    .limit(1);
  return Boolean(row);
}

export async function setAlertFrequency(
  deps: AlertDeps,
  userId: string,
  id: string,
  frequency: AlertFrequency,
): Promise<{ status: "updated" | "not_found" }> {
  const updated = await deps.db
    .update(savedSearches)
    .set({ frequency })
    .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)))
    .returning({ id: savedSearches.id });
  return { status: updated.length > 0 ? "updated" : "not_found" };
}

/** Elimina l'avviso; senza più avvisi il consenso `job_alerts` si chiude. */
export async function deleteAlert(
  deps: AlertDeps,
  userId: string,
  id: string,
): Promise<{ status: "deleted" | "not_found" }> {
  return deps.db.transaction(async (tx) => {
    const deleted = await tx
      .delete(savedSearches)
      .where(and(eq(savedSearches.id, id), eq(savedSearches.userId, userId)))
      .returning({ id: savedSearches.id });
    if (deleted.length === 0) return { status: "not_found" as const };
    const [left] = await tx
      .select({ id: savedSearches.id })
      .from(savedSearches)
      .where(eq(savedSearches.userId, userId))
      .limit(1);
    if (!left) await revokeAlertsConsent(tx, userId, deps.now());
    return { status: "deleted" as const };
  });
}

export async function revokeAlertsConsent(
  db: Pick<NodePgDatabase, "update">,
  userId: string,
  now: Date,
): Promise<void> {
  await db
    .update(consents)
    .set({ revokedAt: now })
    .where(
      and(eq(consents.userId, userId), eq(consents.type, "job_alerts"), isNull(consents.revokedAt)),
    );
}
