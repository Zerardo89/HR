import "server-only";
import { getServerEnv } from "@/lib/env";
import { FileKeyProvider, type KeyProvider } from "./key-provider";

/**
 * Modulo crittografico (ADR-0004) — scritto e mantenuto dall'architetto, non delegato ai modelli locali.
 * Oggi le chiavi vengono da file (Docker secrets); nella Fase 2 da OpenBao Transit (docs/04 §4).
 */
export { CryptoError, generateDek } from "./aead";
export {
  normalizeEmail,
  normalizePhone,
  type BlindIndexPurpose,
  type MacPurpose,
} from "./blind-index";
export { FileKeyProvider, type KeyProvider } from "./key-provider";
export {
  aadFor,
  decryptCredential,
  decryptPii,
  dekContextFor,
  encryptJson,
  newDataKey,
  type AuditEvent,
  type AuditSink,
  type DataKey,
  type PiiLocation,
} from "./pii";

let provider: KeyProvider | undefined;

export function getKeyProvider(): KeyProvider {
  if (!provider) {
    const env = getServerEnv();
    provider = FileKeyProvider.fromFiles(env.KEK_FILE, env.BLIND_INDEX_KEY_FILE);
  }
  return provider;
}
