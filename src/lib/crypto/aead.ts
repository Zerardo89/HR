import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * AES-256-GCM (ADR-0004).
 * Formato del testo cifrato: `v1.<iv>.<tag>.<ciphertext>` in base64url.
 * - IV casuale di 12 byte a ogni cifratura (mai riusato con la stessa chiave).
 * - Tag di autenticazione di 16 byte: ogni modifica del testo cifrato viene rilevata.
 * - AAD (dati associati): lega il testo cifrato al suo contesto (es. tabella, colonna, id riga),
 *   così non si può copiare un valore cifrato da una riga all'altra.
 */
const FORMAT_VERSION = "v1";
const ALGORITHM = "aes-256-gcm";
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

export class CryptoError extends Error {
  // Messaggi volutamente generici: nessun dettaglio su chiavi o contenuti.
  constructor(
    public readonly reason:
      "invalid_key" | "invalid_format" | "decryption_failed" | "unknown_key_version",
  ) {
    super(`Errore crittografico: ${reason}`);
    this.name = "CryptoError";
  }
}

function assertKey(key: Uint8Array): void {
  if (key.length !== KEY_BYTES) throw new CryptoError("invalid_key");
}

export function encrypt(key: Uint8Array, plaintext: Uint8Array, aad: string): string {
  assertKey(key);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [FORMAT_VERSION, iv, tag, ciphertext]
    .map((p) => (typeof p === "string" ? p : p.toString("base64url")))
    .join(".");
}

export function decrypt(key: Uint8Array, token: string, aad: string): Buffer {
  assertKey(key);
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== FORMAT_VERSION) throw new CryptoError("invalid_format");
  const [, ivB64, tagB64, ctB64] = parts as [string, string, string, string];
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const ciphertext = Buffer.from(ctB64, "base64url");
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) throw new CryptoError("invalid_format");
  try {
    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
    decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch {
    throw new CryptoError("decryption_failed");
  }
}

export function generateDek(): Buffer {
  return randomBytes(KEY_BYTES);
}

export const CRYPTO_CONSTANTS = { KEY_BYTES, IV_BYTES, TAG_BYTES } as const;
