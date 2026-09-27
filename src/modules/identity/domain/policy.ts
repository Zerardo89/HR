/**
 * Regole dell'accesso (ADR-0013). Funzioni pure: nessun DB, nessuna API di Node.
 * I numeri qui sono vincolanti: i test di accettazione di WP-008 li verificano.
 */

export const USER_ROLES = ["worker", "company_member", "moderator", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

/** Ruoli che una persona può scegliere da sola; moderatori e admin si nominano solo da script. */
export const SELF_SIGNUP_ROLES = ["worker", "company_member"] as const;
export type SelfSignupRole = (typeof SELF_SIGNUP_ROLES)[number];

export function isPrivilegedRole(role: UserRole): boolean {
  return role === "moderator" || role === "admin";
}

// ─── Codice via email ───────────────────────────────────────────────────────────────────────────────

export const OTP_DIGITS = 6;
export const OTP_TTL_MS = 10 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;

/** Codici inviati alla stessa email: al massimo 3 ogni 15 minuti e 10 al giorno. */
export const EMAIL_CODE_LIMITS = [
  { windowMs: 15 * 60_000, max: 3 },
  { windowMs: 24 * 60 * 60_000, max: 10 },
] as const;

/** Limiti per IP, tenuti solo in memoria (l'IP non si salva). */
export const IP_LIMITS = {
  codeRequests: { windowMs: 15 * 60_000, max: 10 },
  codeChecks: { windowMs: 15 * 60_000, max: 30 },
} as const;

export const SIGNUP_TICKET_TTL_MS = 30 * 60_000;

/** Da un intero casuale in [0, 10^6) al codice a 6 cifre (con gli zeri iniziali). */
export function formatOtp(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value >= 10 ** OTP_DIGITS) {
    throw new RangeError("valore fuori intervallo");
  }
  return value.toString().padStart(OTP_DIGITS, "0");
}

/** Accetta "123 456" o "123-456" (come lo scrivono le persone); `null` se non sono 6 cifre. */
export function normalizeOtpInput(input: string): string | null {
  const digits = input.replace(/[\s-]/g, "");
  return /^\d{6}$/.test(digits) ? digits : null;
}

export type OtpChallengeState = { attempts: number; expiresAt: Date; consumedAt: Date | null };
export type OtpChallengeStatus = "open" | "consumed" | "expired" | "locked";

export function otpChallengeStatus(c: OtpChallengeState, now: Date): OtpChallengeStatus {
  if (c.consumedAt) return "consumed";
  if (c.expiresAt.getTime() <= now.getTime()) return "expired";
  if (c.attempts >= OTP_MAX_ATTEMPTS) return "locked";
  return "open";
}

/** `sentAt` = istanti di invio dei codici recenti per la stessa email (bastano quelli delle ultime 24 ore). */
export function emailCodeLimitReached(sentAt: readonly Date[], now: Date): boolean {
  return EMAIL_CODE_LIMITS.some(
    ({ windowMs, max }) =>
      sentAt.filter((d) => now.getTime() - d.getTime() < windowMs).length >= max,
  );
}

// ─── Sessioni ──────────────────────────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60_000;

/** docs/04 §6: 30 giorni con rinnovo per lavoratori e aziende; 7 giorni fissi per moderatori e admin. */
export const SESSION_TTL_DAYS: Record<UserRole, number> = {
  worker: 30,
  company_member: 30,
  moderator: 7,
  admin: 7,
};

/** Durata del cookie: la più lunga; la validità vera la decide la riga nel DB. */
export const SESSION_COOKIE_MAX_AGE_S = 30 * 24 * 60 * 60;

export function sessionExpiresAt(role: UserRole, now: Date): Date {
  return new Date(now.getTime() + SESSION_TTL_DAYS[role] * DAY_MS);
}

/** Rinnovo scorrevole: solo per i ruoli non privilegiati, quando manca meno di metà della durata. */
export function renewedSessionExpiry(role: UserRole, expiresAt: Date, now: Date): Date | null {
  if (isPrivilegedRole(role)) return null;
  const ttlMs = SESSION_TTL_DAYS[role] * DAY_MS;
  return expiresAt.getTime() - now.getTime() < ttlMs / 2 ? sessionExpiresAt(role, now) : null;
}

/** Il prefisso `__Host-` (solo HTTPS, niente Domain, Path=/) impedisce ai sottodomini di sovrascrivere il cookie. */
export function sessionCookieName(secure: boolean): string {
  return secure ? "__Host-sessione" : "sessione";
}

export function signupCookieName(secure: boolean): string {
  return secure ? "__Host-registrazione" : "registrazione";
}

/** Versioni dei testi legali accettati alla registrazione (restano "bozza" fino alla revisione del professionista). */
export const LEGAL_VERSIONS = {
  privacyNotice: "bozza-2026-09-27",
  terms: "bozza-2026-09-27",
} as const;
