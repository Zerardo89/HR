import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import {
  RECOVERY_ALPHABET,
  RECOVERY_CODE_COUNT,
  RECOVERY_CODE_LENGTH,
  TOTP_DIGITS,
  TOTP_SECRET_BYTES,
  TOTP_WINDOW,
  formatRecoveryCode,
  totpStep,
} from "../domain";

/*
 * TOTP (RFC 6238) scritto in casa con `node:crypto`: poche righe, verificate con i vettori ufficiali
 * dell'RFC (totp.test.ts). Niente librerie: meno dipendenze sul percorso di accesso (ADR-0013).
 */

export function newTotpSecret(): Buffer {
  return randomBytes(TOTP_SECRET_BYTES);
}

/** HOTP (RFC 4226 §5.3) con HMAC-SHA-1 e troncamento dinamico. */
export function hotp(secret: Uint8Array, counter: number, digits: number = TOTP_DIGITS): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", secret).update(message).digest();
  const offset = mac[mac.length - 1]! & 0x0f;
  const binary = mac.readUInt32BE(offset) & 0x7fffffff;
  return (binary % 10 ** digits).toString().padStart(digits, "0");
}

/**
 * Il passo in cui `code` è valido, cercando nella finestra ±`TOTP_WINDOW` attorno a `now`; `null` se non lo è.
 * Il chiamante rifiuta i passi già usati (un codice vale una volta sola).
 */
export function matchTotp(secret: Uint8Array, code: string, now: Date): number | null {
  const current = totpStep(now);
  const given = Buffer.from(code, "utf8");
  let matched: number | null = null;
  // Si controllano sempre tutti i passi (niente uscita anticipata): il tempo non dipende dal risultato.
  for (let step = current - TOTP_WINDOW; step <= current + TOTP_WINDOW; step++) {
    const expected = Buffer.from(hotp(secret, step), "utf8");
    if (expected.length === given.length && timingSafeEqual(expected, given)) matched ??= step;
  }
  return matched;
}

/** Codici di recupero nel formato "xxxxx-xxxxx", estratti senza distorsione (`randomInt`). */
export function newRecoveryCodes(): string[] {
  return Array.from({ length: RECOVERY_CODE_COUNT }, () => {
    let symbols = "";
    for (let i = 0; i < RECOVERY_CODE_LENGTH; i++) {
      symbols += RECOVERY_ALPHABET[randomInt(0, RECOVERY_ALPHABET.length)];
    }
    return formatRecoveryCode(symbols);
  });
}
