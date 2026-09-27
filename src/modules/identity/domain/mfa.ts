import type { UserRole } from "./policy";

/**
 * Secondo fattore (WP-011b, ADR-0013 punto 8): codice TOTP da un'app di autenticazione, dopo il codice via email.
 * Funzioni pure: il calcolo HMAC del TOTP è in `server/totp.ts`.
 */

/** 2FA obbligatoria per aziende, moderatori e admin (docs/04 §5). */
export function requiresMfa(role: UserRole): boolean {
  return role !== "worker";
}

// ─── TOTP (RFC 6238): SHA-1, 30 secondi, 6 cifre — i parametri che tutte le app capiscono ───────────────

export const TOTP_PERIOD_S = 30;
export const TOTP_DIGITS = 6;
/** Passi accettati prima e dopo quello corrente: tollera orologi sfasati di ±30 secondi. */
export const TOTP_WINDOW = 1;
/** 160 bit, la lunghezza della chiave di HMAC-SHA-1 (RFC 4226 §4). */
export const TOTP_SECRET_BYTES = 20;

/** Il passo in cui cade l'istante `now` (numero di periodi dall'epoca Unix). */
export function totpStep(now: Date): number {
  return Math.floor(now.getTime() / 1000 / TOTP_PERIOD_S);
}

// ─── Passo in più dopo il codice email ─────────────────────────────────────────────────────────────

/** Dal codice email giusto: 10 minuti e 5 tentativi per il codice dell'app (come il codice email). */
export const MFA_TICKET_TTL_MS = 10 * 60_000;
export const MFA_MAX_ATTEMPTS = 5;

export function mfaCookieName(secure: boolean): string {
  return secure ? "__Host-verifica" : "verifica";
}

/** Sessione nata all'attivazione, valida solo dopo "Li ho salvati, continua" (vedi `server/cookies.ts`). */
export function pendingSessionCookieName(secure: boolean): string {
  return secure ? "__Host-sessione-nuova" : "sessione-nuova";
}

// ─── Base32 (RFC 4648 §6), il formato dei segreti nelle app di autenticazione ────────────────────────

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Uint8Array): string {
  let out = "";
  let buffer = 0;
  let bits = 0;
  for (const byte of bytes) {
    buffer = (buffer << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(buffer >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(buffer << (5 - bits)) & 31];
  return out;
}

/** Accetta minuscole, spazi e `=` finali (come lo copiano le persone); `null` se non è base32. */
export function base32Decode(input: string): Uint8Array | null {
  const clean = input.replace(/[\s=]/g, "").toUpperCase();
  if (!/^[A-Z2-7]*$/.test(clean)) return null;
  const out: number[] = [];
  let buffer = 0;
  let bits = 0;
  for (const char of clean) {
    buffer = (buffer << 5) | BASE32.indexOf(char);
    bits += 5;
    if (bits >= 8) {
      out.push((buffer >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Uint8Array.from(out);
}

/** Il segreto a gruppi di 4 caratteri, per chi lo copia a mano nell'app. */
export function formatSecretForDisplay(secret: string): string {
  return secret.replace(/(.{4})(?=.)/g, "$1 ");
}

/** Link `otpauth://` che le app leggono dal QR (formato "Key Uri" di Google Authenticator). */
export function otpauthUri(secret: string, issuer: string, account: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_PERIOD_S),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}

// ─── Codici di recupero ────────────────────────────────────────────────────────────────────────────

export const RECOVERY_CODE_COUNT = 10;
/** 10 caratteri da 32 simboli = 50 bit: con 5 tentativi per accesso non si indovinano. */
export const RECOVERY_CODE_LENGTH = 10;
/** Alfabeto di Crockford: niente i, l, o, u (si confondono con 1, 0, v). */
export const RECOVERY_ALPHABET = "0123456789abcdefghjkmnpqrstvwxyz";

/** Da 10 simboli già estratti a "xxxxx-xxxxx", come si mostra e si salva nel DB (solo HMAC). */
export function formatRecoveryCode(symbols: string): string {
  return `${symbols.slice(0, 5)}-${symbols.slice(5)}`;
}

/** Accetta maiuscole, spazi, trattini e le lettere che si confondono; `null` se non è un codice possibile. */
export function normalizeRecoveryInput(input: string): string | null {
  const clean = input.toLowerCase().replace(/[\s-]/g, "").replace(/[il]/g, "1").replace(/o/g, "0");
  if (clean.length !== RECOVERY_CODE_LENGTH) return null;
  for (const char of clean) if (!RECOVERY_ALPHABET.includes(char)) return null;
  return formatRecoveryCode(clean);
}
