import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  decryptPii,
  dekContextFor,
  encryptJson,
  type KeyProvider,
  type PiiLocation,
} from "@/lib/crypto";
import { users, workerProfiles } from "@/lib/db/schema";
import { workerPiiSchema, type WorkerPii } from "@/modules/profiles/domain";
import { dbAuditSink } from "./audit";

/*
 * Dati identificativi (C2) del profilo del lavoratore (WP-017, docs/04 §2-3). Questo modulo è l'unico, con
 * `lib/crypto`, che chiama `decryptPii()` (03-ARCHITETTURA §4): gli altri ricevono dati già autorizzati.
 * - Cifratura con la DEK dell'utente (`users.dek_wrapped`), legata a `worker_profiles.pii_enc` e all'utente.
 * - Lettura solo per scopi ammessi, con audit prima della decifratura (fail closed).
 */

export type PrivacyDeps = { db: NodePgDatabase; keys: KeyProvider; now: () => Date };

const location = (userId: string): PiiLocation => ({
  table: "worker_profiles",
  column: "pii_enc",
  rowId: userId,
});

/** Cifra i dati C2 del profilo con la chiave dell'utente. Restituisce il testo cifrato da salvare. */
export async function sealWorkerPii(
  deps: Pick<PrivacyDeps, "db" | "keys">,
  userId: string,
  pii: WorkerPii,
): Promise<string> {
  const [user] = await deps.db
    .select({ dekWrapped: users.dekWrapped })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user?.dekWrapped) throw new Error("chiave dell'utente non disponibile");
  const dek = await deps.keys.unwrapKey(user.dekWrapped, dekContextFor("users", userId));
  try {
    return encryptJson(dek, workerPiiSchema.parse(pii), location(userId));
  } finally {
    dek.fill(0);
  }
}

/**
 * Chi può leggere i dati C2 di un lavoratore, e perché. Oggi solo il lavoratore stesso; con le candidature
 * (WP-019) si aggiunge l'azienda destinataria, con uno scopo diverso nel log di audit.
 */
export type WorkerPiiAccess = { purpose: "worker.self-view"; actorId: string };

export async function readWorkerPii(
  deps: PrivacyDeps,
  workerUserId: string,
  access: WorkerPiiAccess,
): Promise<WorkerPii | null> {
  if (access.purpose !== "worker.self-view" || access.actorId !== workerUserId) {
    throw new Error("accesso ai dati personali non autorizzato");
  }
  const [row] = await deps.db
    .select({ dekWrapped: users.dekWrapped, piiEnc: workerProfiles.piiEnc })
    .from(workerProfiles)
    .innerJoin(users, eq(users.id, workerProfiles.userId))
    .where(eq(workerProfiles.userId, workerUserId))
    .limit(1);
  if (!row?.piiEnc || !row.dekWrapped) return null;
  return decryptPii({
    provider: deps.keys,
    audit: dbAuditSink(deps.db, deps.now),
    actorId: access.actorId,
    purpose: access.purpose,
    dekWrapped: row.dekWrapped,
    dekContext: dekContextFor("users", workerUserId),
    token: row.piiEnc,
    location: location(workerUserId),
    schema: workerPiiSchema,
  });
}
