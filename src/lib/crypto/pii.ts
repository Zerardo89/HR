import type { z } from "zod";
import { decrypt, encrypt, generateDek } from "./aead";
import type { KeyProvider } from "./key-provider";

/**
 * Cifratura dei dati personali (classi C2/C3, docs/04-PRIVACY-SICUREZZA.md §2-3).
 *
 * - Ogni utente ha la sua DEK; nel DB c'è solo la DEK cifrata con la KEK (`dek_wrapped`).
 * - Ogni valore cifrato è legato a tabella, colonna e id della riga (AAD).
 * - Distruggere `dek_wrapped` rende illeggibili i dati anche nei backup (crypto-shredding).
 * - `decryptPii` registra SEMPRE l'accesso nel log di audit PRIMA di decifrare: se l'audit fallisce,
 *   i dati non vengono restituiti (fail closed).
 */
export type PiiLocation = { table: string; column: string; rowId: string };

export type AuditEvent = {
  action: "pii.decrypt";
  actorId: string; // id utente o "system:<job>"
  targetTable: string;
  targetId: string;
  purpose: string; // es. "worker.self-view", "application.company-view"
};

export interface AuditSink {
  record(event: AuditEvent): Promise<void>;
}

export type DataKey = { dek: Buffer; dekWrapped: string; keyVersion: number };

export function aadFor(loc: PiiLocation): string {
  return `${loc.table}.${loc.column}:${loc.rowId}`;
}

export function dekContextFor(table: string, rowId: string): string {
  return `${table}:${rowId}`;
}

export async function newDataKey(provider: KeyProvider, dekContext: string): Promise<DataKey> {
  const dek = generateDek();
  const dekWrapped = await provider.wrapKey(dek, dekContext);
  return { dek, dekWrapped, keyVersion: provider.currentKeyVersion };
}

export function encryptJson(dek: Uint8Array, value: unknown, loc: PiiLocation): string {
  return encrypt(dek, Buffer.from(JSON.stringify(value), "utf8"), aadFor(loc));
}

export function decryptJson<T>(
  dek: Uint8Array,
  token: string,
  loc: PiiLocation,
  schema: z.ZodType<T>,
): T {
  const plaintext = decrypt(dek, token, aadFor(loc));
  try {
    return schema.parse(JSON.parse(plaintext.toString("utf8")));
  } finally {
    plaintext.fill(0);
  }
}

export type DecryptPiiInput<T> = {
  provider: KeyProvider;
  audit: AuditSink;
  actorId: string;
  purpose: string;
  dekWrapped: string;
  dekContext: string;
  token: string;
  location: PiiLocation;
  schema: z.ZodType<T>;
};

/** Unica via ammessa per leggere dati personali (CLAUDE.md: solo `modules/privacy` e `lib/crypto` la usano). */
export async function decryptPii<T>(input: DecryptPiiInput<T>): Promise<T> {
  await input.audit.record({
    action: "pii.decrypt",
    actorId: input.actorId,
    targetTable: input.location.table,
    targetId: input.location.rowId,
    purpose: input.purpose,
  });
  const dek = await input.provider.unwrapKey(input.dekWrapped, input.dekContext);
  try {
    return decryptJson(dek, input.token, input.location, input.schema);
  } finally {
    dek.fill(0);
  }
}
