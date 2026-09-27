import { createHmac, randomBytes, randomInt } from "node:crypto";
import { RECOVERY_ALPHABET, TOTP_DIGITS, TOTP_PERIOD_S, TOTP_WINDOW } from "../domain";

/**
 * TOTP (RFC 6238) con HMAC-SHA1, 30 secondi, 6 cifre: il formato che leggono tutte le app di autenticazione
 * (Google Authenticator, Microsoft Authenticator, Aegis, 2FAS…). Scritto qui, senza librerie: sono poche righe
 * verificate con i vettori di prova dell'RFC.
 */

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function newTotpSecret(): Buffer {
  return randomBytes(20); // 160 bit, come raccomanda l'RFC 4226
}

export function hotp(secret: Uint8Array, counter: number, digits = TOTP_DIGITS): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", secret).update(buf).digest();
  const offset = mac[mac.length - 1]! & 0x0f;
  const code = (mac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits;
  return code.toString().padStart(digits, "0");
}

export function totpStep(now: Date): number {
  return Math.floor(now.getTime() / 1000 / TOTP_PERIOD_S);
}

export function totp(secret: Uint8Array, now: Date, digits = TOTP_DIGITS): string {
  return hotp(secret, totpStep(now), digits);
}

/**
 * Restituisce il periodo (step) del codice se è valido e più recente dell'ultimo usato, altrimenti `null`.
 * Il chiamante salva lo step: lo stesso codice non vale due volte.
 */
export function matchTotp(
  secret: Uint8Array,
  code: string,
  now: Date,
  lastStep: number | null,
): number | null {
  const current = totpStep(now);
  for (let delta = -TOTP_WINDOW; delta <= TOTP_WINDOW; delta++) {
    const step = current + delta;
    if (lastStep !== null && step <= lastStep) continue;
    if (hotp(secret, step) === code) return step;
  }
  return null;
}

/** URI da mettere nel QR code o nel link che apre l'app di autenticazione sul telefono. */
export function otpauthUri(secretBase32: string, issuer: string, account: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_S),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

export function newRecoveryCode(): string {
  let code = "";
  for (let i = 0; i < 10; i++) code += RECOVERY_ALPHABET[randomInt(0, RECOVERY_ALPHABET.length)];
  return code;
}
