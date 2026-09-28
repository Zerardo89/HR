import { and, asc, eq, inArray, isNotNull, lte, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  municipalities,
  occupations,
  profileOccupations,
  provinces,
  users,
  workerProfiles,
} from "@/lib/db/schema";
import { nextMonthlyCheck, type MonthlyAnswer } from "../domain";

/*
 * Profilo e mail mensile (WP-021). Solo dati C1: la mail non contiene il nome (minimizzazione) e l'indirizzo lo
 * legge `modules/privacy`. Qualsiasi risposta azzera il conto delle mail senza risposta.
 */

export type DueMonthlyCheck = {
  userId: string;
  nextCheckAt: Date;
  unansweredChecks: number;
  radiusKm: number;
  relocationRegionCodes: string[];
  place: { name: string; provinceAbbr: string; lat: number; lon: number };
  occupations: { id: number; label: string }[];
};

/** Profili "occupato ma aperto" con la mail mensile scelta e la data raggiunta (utenti attivi). */
export async function dueMonthlyChecks(
  db: NodePgDatabase,
  now: Date,
  limit = 500,
): Promise<DueMonthlyCheck[]> {
  const rows = await db
    .select({
      userId: workerProfiles.userId,
      nextCheckAt: workerProfiles.nextCheckAt,
      unansweredChecks: workerProfiles.unansweredChecks,
      radiusKm: workerProfiles.radiusKm,
      relocationRegionCodes: workerProfiles.relocationRegionCodes,
      name: municipalities.name,
      provinceAbbr: provinces.abbreviation,
      lat: municipalities.lat,
      lon: municipalities.lon,
    })
    .from(workerProfiles)
    .innerJoin(users, eq(users.id, workerProfiles.userId))
    .innerJoin(municipalities, eq(municipalities.istatCode, workerProfiles.municipalityCode))
    .innerJoin(provinces, eq(provinces.code, municipalities.provinceCode))
    .where(
      and(
        eq(workerProfiles.state, "open"),
        eq(workerProfiles.monthlyCheckOptIn, true),
        lte(workerProfiles.nextCheckAt, now),
        eq(users.status, "active"),
        eq(users.role, "worker"),
        isNotNull(users.dekWrapped),
      ),
    )
    .orderBy(asc(workerProfiles.nextCheckAt))
    .limit(limit);
  if (rows.length === 0) return [];
  const occ = await db
    .select({
      userId: profileOccupations.userId,
      id: occupations.id,
      label: occupations.labelIt,
    })
    .from(profileOccupations)
    .innerJoin(occupations, eq(occupations.id, profileOccupations.occupationId))
    .where(
      inArray(
        profileOccupations.userId,
        rows.map((r) => r.userId),
      ),
    )
    .orderBy(asc(occupations.id));
  return rows.map((r) => ({
    userId: r.userId,
    nextCheckAt: r.nextCheckAt!,
    unansweredChecks: r.unansweredChecks,
    radiusKm: r.radiusKm,
    relocationRegionCodes: r.relocationRegionCodes.map((c) => c.trim()),
    place: { name: r.name, provinceAbbr: r.provinceAbbr, lat: Number(r.lat), lon: Number(r.lon) },
    occupations: occ.filter((o) => o.userId === r.userId).map(({ id, label }) => ({ id, label })),
  }));
}

/** Mail spedita: prossimo invio fra 30 giorni, una mail senza risposta in più. */
export async function recordMonthlyCheckSent(
  db: Pick<NodePgDatabase, "update">,
  userId: string,
  scheduled: Date,
  now: Date,
): Promise<void> {
  await db
    .update(workerProfiles)
    .set({
      nextCheckAt: nextMonthlyCheck(scheduled, now),
      unansweredChecks: sql`least(${workerProfiles.unansweredChecks} + 1, 12)`,
    })
    .where(eq(workerProfiles.userId, userId));
}

/** Sei mail senza risposta: profilo nascosto e invii sospesi. */
export async function pauseMonthlyChecks(
  db: Pick<NodePgDatabase, "update">,
  userId: string,
  now: Date,
): Promise<void> {
  await db
    .update(workerProfiles)
    .set({ state: "hidden", monthlyCheckOptIn: false, nextCheckAt: null, updatedAt: now })
    .where(eq(workerProfiles.userId, userId));
}

/** Risposta dalla mail (dopo la pagina di conferma). "Cancella" elimina il profilo; l'account resta. */
export async function applyMonthlyAnswer(
  db: Pick<NodePgDatabase, "update" | "delete">,
  userId: string,
  answer: MonthlyAnswer,
  now: Date,
): Promise<{ status: "done" | "no_profile" }> {
  if (answer === "delete") {
    const deleted = await db
      .delete(workerProfiles)
      .where(eq(workerProfiles.userId, userId))
      .returning({ userId: workerProfiles.userId });
    return { status: deleted.length > 0 ? "done" : "no_profile" };
  }
  const state = answer === "seeking" ? "seeking" : answer === "hide" ? "hidden" : "open";
  const updated = await db
    .update(workerProfiles)
    .set({ state, unansweredChecks: 0, lastInteractionAt: now, updatedAt: now })
    .where(eq(workerProfiles.userId, userId))
    .returning({ userId: workerProfiles.userId });
  return { status: updated.length > 0 ? "done" : "no_profile" };
}

/** Disiscrizione dalla mail mensile (RFC 8058): niente più invii; il profilo resta com'è. */
export async function optOutMonthlyChecks(
  db: Pick<NodePgDatabase, "update">,
  userId: string,
  now: Date,
): Promise<void> {
  await db
    .update(workerProfiles)
    .set({ monthlyCheckOptIn: false, nextCheckAt: null, lastInteractionAt: now, updatedAt: now })
    .where(eq(workerProfiles.userId, userId));
}
