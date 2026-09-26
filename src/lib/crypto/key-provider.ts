import { readFileSync, statSync } from "node:fs";
import { CryptoError, decrypt, encrypt, CRYPTO_CONSTANTS } from "./aead";
import { computeBlindIndex, type BlindIndexPurpose } from "./blind-index";

/**
 * Fornitore delle chiavi (ADR-0004). Il resto dell'app parla SOLO con questa interfaccia:
 * oggi `FileKeyProvider` (KEK da Docker secret), domani OpenBao Transit gestito dal custode delle chiavi.
 */
export interface KeyProvider {
  /** Cifra una DEK con la KEK corrente. Ritorna `"<versione>:<token>"`. */
  wrapKey(dek: Uint8Array, context: string): Promise<string>;
  /** Decifra una DEK (qualsiasi versione di KEK ancora conosciuta). */
  unwrapKey(wrapped: string, context: string): Promise<Buffer>;
  blindIndex(value: string, purpose: BlindIndexPurpose): Promise<string>;
  readonly currentKeyVersion: number;
}

/**
 * Formato dei file chiave (base64 di esattamente 32 byte, sia KEK sia chiave dell'indice cieco):
 *   - una riga con la sola chiave → versione 1
 *   - oppure più righe `N:<base64>` per la rotazione; la versione più alta è quella corrente
 *   - righe vuote e commenti `#` ignorati
 */
export function parseKeyFile(content: string): Map<number, Buffer> {
  const keys = new Map<number, Buffer>();
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "" && !l.startsWith("#"));
  for (const line of lines) {
    const match = /^(\d+):(.+)$/.exec(line);
    const version = match ? Number(match[1]) : 1;
    const key = Buffer.from(match ? match[2]! : line, "base64");
    if (key.length !== CRYPTO_CONSTANTS.KEY_BYTES) throw new CryptoError("invalid_key");
    if (keys.has(version)) throw new CryptoError("invalid_key");
    keys.set(version, key);
  }
  if (keys.size === 0) throw new CryptoError("invalid_key");
  return keys;
}

export class FileKeyProvider implements KeyProvider {
  readonly currentKeyVersion: number;

  constructor(
    private readonly keks: Map<number, Buffer>,
    private readonly indexKey: Buffer,
  ) {
    for (const kek of keks.values()) {
      if (kek.equals(indexKey)) throw new CryptoError("invalid_key"); // chiavi DIVERSE per scopi diversi
    }
    this.currentKeyVersion = Math.max(...keks.keys());
  }

  static fromFiles(kekPath: string, indexKeyPath: string): FileKeyProvider {
    for (const p of [kekPath, indexKeyPath]) warnIfTooPermissive(p);
    const keks = parseKeyFile(readFileSync(kekPath, "utf8"));
    const indexKeys = parseKeyFile(readFileSync(indexKeyPath, "utf8"));
    // L'indice cieco non ruota (cambiarlo obbligherebbe a ricalcolare tutti gli indici): si usa la versione più alta.
    const indexKey = indexKeys.get(Math.max(...indexKeys.keys()))!;
    return new FileKeyProvider(keks, indexKey);
  }

  async wrapKey(dek: Uint8Array, context: string): Promise<string> {
    const version = this.currentKeyVersion;
    return `${version}:${encrypt(this.keks.get(version)!, dek, wrapAad(version, context))}`;
  }

  async unwrapKey(wrapped: string, context: string): Promise<Buffer> {
    const sep = wrapped.indexOf(":");
    const version = Number(wrapped.slice(0, sep));
    const kek = this.keks.get(version);
    if (sep <= 0 || !Number.isInteger(version) || !kek)
      throw new CryptoError("unknown_key_version");
    return decrypt(kek, wrapped.slice(sep + 1), wrapAad(version, context));
  }

  async blindIndex(value: string, purpose: BlindIndexPurpose): Promise<string> {
    return computeBlindIndex(this.indexKey, value, purpose);
  }
}

function wrapAad(version: number, context: string): string {
  return `dek:kek${version}:${context}`;
}

function warnIfTooPermissive(path: string): void {
  if (process.platform === "win32") return;
  try {
    const mode = statSync(path).mode & 0o077;
    if (mode !== 0) {
      // Solo il percorso, mai il contenuto.
      console.warn(`[crypto] Il file chiave ${path} è leggibile da altri utenti: usa chmod 600.`);
    }
  } catch {
    // Il file mancante viene segnalato dalla lettura successiva.
  }
}
