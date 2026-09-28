import "server-only";

// Modulo `profiles` — API pubblica (lato server).
// Profilo del lavoratore, stati (seeking/open/hidden), liste per mansione.
// I dati identificativi li cifra e decifra `modules/privacy`: qui arrivano già autorizzati.
// Struttura: domain/ (puro) · server/ (DB, servizi) · ui/ (componenti) · index.ts
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { workerProfiles } from "@/lib/db/schema";
import { getOwnWorkerProfile, type WorkerProfileView } from "./server/profile";
import { runtimeDeps } from "./server/runtime";

export type { WorkerProfileView };
export { saveProfileAction, setStateAction } from "./server/actions";
export { ProfileForm } from "./ui/profile-form";

/** Il profilo dell'utente corrente, per il lavoratore stesso (lettura dei dati cifrati registrata in audit). */
export function getOwnProfile(userId: string): Promise<WorkerProfileView | null> {
  return getOwnWorkerProfile(runtimeDeps(), userId);
}

/** Se il lavoratore ha già un profilo (senza decifrare nulla: nessuna lettura nel log di audit). */
export async function hasProfile(userId: string): Promise<boolean> {
  const [row] = await getDb()
    .select({ userId: workerProfiles.userId })
    .from(workerProfiles)
    .where(eq(workerProfiles.userId, userId))
    .limit(1);
  return Boolean(row);
}
