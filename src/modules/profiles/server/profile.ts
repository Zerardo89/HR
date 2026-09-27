import { eq, inArray } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { KeyProvider } from "@/lib/crypto";
import {
  municipalities,
  occupations,
  profileLanguages,
  profileOccupations,
  provinces,
  users,
  workerProfiles,
} from "@/lib/db/schema";
import { findMunicipality } from "@/modules/geo";
import { readWorkerPii, sealWorkerPii } from "@/modules/privacy";
import type { WorkerPii, WorkerProfileInput, WorkerState } from "../domain";

/*
 * Profilo del lavoratore (WP-017). Dati di ricerca (C1) in chiaro nelle colonne; dati identificativi (C2)
 * cifrati da `modules/privacy` con la chiave dell'utente. Solo utenti `worker` attivi.
 */

export type ProfileDeps = { db: NodePgDatabase; keys: KeyProvider; now: () => Date };

const DAY_MS = 24 * 60 * 60_000;
/** La prima mail "stai ancora cercando?" parte 30 giorni dopo l'adesione (docs/01 §6.2, WP-021). */
const MONTHLY_CHECK_DAYS = 30;

async function isActiveWorker(db: NodePgDatabase, userId: string): Promise<boolean> {
  const [u] = await db
    .select({ role: users.role, status: users.status })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return u?.role === "worker" && u.status === "active";
}

export type SaveProfileResult =
  | { status: "saved" }
  | { status: "not_allowed" | "invalid_occupation" }
  | { status: "invalid_place"; options: string[] };

export async function saveWorkerProfile(
  deps: ProfileDeps,
  userId: string,
  input: WorkerProfileInput,
): Promise<SaveProfileResult> {
  if (!(await isActiveWorker(deps.db, userId))) return { status: "not_allowed" };

  const lookup = await findMunicipality(deps.db, input.place);
  if (lookup.status !== "found") {
    const places = lookup.status === "ambiguous" ? lookup.options : lookup.suggestions;
    return {
      status: "invalid_place",
      options: places.map((p) => `${p.name} (${p.provinceAbbr})`),
    };
  }
  const known = await deps.db
    .select({ id: occupations.id })
    .from(occupations)
    .where(inArray(occupations.id, input.occupationIds));
  if (known.length !== input.occupationIds.length) return { status: "invalid_occupation" };

  const now = deps.now();
  const piiEnc = await sealWorkerPii(deps, userId, input.pii);
  const [existing] = await deps.db
    .select({ nextCheckAt: workerProfiles.nextCheckAt })
    .from(workerProfiles)
    .where(eq(workerProfiles.userId, userId))
    .limit(1);
  const nextCheckAt = input.monthlyCheckOptIn
    ? (existing?.nextCheckAt ?? new Date(now.getTime() + MONTHLY_CHECK_DAYS * DAY_MS))
    : null;

  const values = {
    state: input.state,
    municipalityCode: lookup.place.code,
    radiusKm: input.radiusKm,
    relocationRegionCodes: input.relocationRegionCodes,
    experienceBand: input.experienceBand,
    availableFrom: input.availableFrom ?? null,
    contractPrefs: input.contractPrefs,
    schedulePrefs: input.schedulePrefs,
    drivingLicenses: input.drivingLicenses,
    piiEnc,
    monthlyCheckOptIn: input.monthlyCheckOptIn,
    nextCheckAt,
    lastInteractionAt: now,
    updatedAt: now,
  };

  await deps.db.transaction(async (tx) => {
    await tx
      .insert(workerProfiles)
      .values({ userId, ...values, createdAt: now })
      .onConflictDoUpdate({ target: workerProfiles.userId, set: values });
    await tx.delete(profileOccupations).where(eq(profileOccupations.userId, userId));
    await tx
      .insert(profileOccupations)
      .values(input.occupationIds.map((occupationId) => ({ userId, occupationId })));
    await tx.delete(profileLanguages).where(eq(profileLanguages.userId, userId));
    if (input.languages.length > 0) {
      await tx
        .insert(profileLanguages)
        .values(input.languages.map((l) => ({ userId, languageCode: l.code, level: l.level })));
    }
  });
  return { status: "saved" };
}

export type WorkerProfileView = {
  state: WorkerState;
  occupations: { id: number; label: string }[];
  /** "Lodi (LO)": pronto per il campo del comune. */
  place: string;
  radiusKm: number;
  relocationRegionCodes: string[];
  experienceBand: WorkerProfileInput["experienceBand"];
  availableFrom: string | null;
  contractPrefs: WorkerProfileInput["contractPrefs"];
  schedulePrefs: WorkerProfileInput["schedulePrefs"];
  drivingLicenses: string[];
  languages: { code: string; level: string }[];
  monthlyCheckOptIn: boolean;
  /** Decifrati per il lavoratore stesso (lettura registrata nel log di audit). */
  pii: WorkerPii | null;
};

/** Il proprio profilo (`null` se non c'è ancora). Solo per il lavoratore che lo possiede. */
export async function getOwnWorkerProfile(
  deps: ProfileDeps,
  userId: string,
): Promise<WorkerProfileView | null> {
  const [p] = await deps.db
    .select({
      state: workerProfiles.state,
      municipality: municipalities.name,
      province: provinces.abbreviation,
      radiusKm: workerProfiles.radiusKm,
      relocationRegionCodes: workerProfiles.relocationRegionCodes,
      experienceBand: workerProfiles.experienceBand,
      availableFrom: workerProfiles.availableFrom,
      contractPrefs: workerProfiles.contractPrefs,
      schedulePrefs: workerProfiles.schedulePrefs,
      drivingLicenses: workerProfiles.drivingLicenses,
      monthlyCheckOptIn: workerProfiles.monthlyCheckOptIn,
    })
    .from(workerProfiles)
    .innerJoin(municipalities, eq(municipalities.istatCode, workerProfiles.municipalityCode))
    .innerJoin(provinces, eq(provinces.code, municipalities.provinceCode))
    .where(eq(workerProfiles.userId, userId))
    .limit(1);
  if (!p) return null;
  const [occ, langs, pii] = await Promise.all([
    deps.db
      .select({ id: occupations.id, label: occupations.labelIt })
      .from(profileOccupations)
      .innerJoin(occupations, eq(occupations.id, profileOccupations.occupationId))
      .where(eq(profileOccupations.userId, userId)),
    deps.db
      .select({ code: profileLanguages.languageCode, level: profileLanguages.level })
      .from(profileLanguages)
      .where(eq(profileLanguages.userId, userId)),
    readWorkerPii(deps, userId, { purpose: "worker.self-view", actorId: userId }),
  ]);
  return {
    state: p.state,
    occupations: occ,
    place: `${p.municipality} (${p.province})`,
    radiusKm: p.radiusKm,
    relocationRegionCodes: p.relocationRegionCodes.map((c) => c.trim()),
    experienceBand: p.experienceBand,
    availableFrom: p.availableFrom,
    contractPrefs: p.contractPrefs,
    schedulePrefs: p.schedulePrefs,
    drivingLicenses: p.drivingLicenses,
    languages: langs,
    monthlyCheckOptIn: p.monthlyCheckOptIn,
    pii,
  };
}

/** Cambio rapido di stato (cerco / aperto / nascosto) senza toccare il resto del profilo. */
export async function setWorkerState(
  deps: Pick<ProfileDeps, "db" | "now">,
  userId: string,
  state: WorkerState,
): Promise<{ status: "updated" | "no_profile" }> {
  const now = deps.now();
  const [done] = await deps.db
    .update(workerProfiles)
    .set({ state, lastInteractionAt: now, updatedAt: now, unansweredChecks: 0 })
    .where(eq(workerProfiles.userId, userId))
    .returning({ userId: workerProfiles.userId });
  return { status: done ? "updated" : "no_profile" };
}
