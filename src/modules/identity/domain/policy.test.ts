import { describe, expect, it } from "vitest";
import { userRole } from "@/lib/db/schema/enums";
import {
  emailCodeLimitReached,
  emailInput,
  formatOtp,
  LEGAL_VERSIONS,
  MemoryLimiter,
  normalizeOtpInput,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  otpChallengeStatus,
  renewedSessionExpiry,
  sessionCookieName,
  sessionExpiresAt,
  signupInput,
  USER_ROLES,
} from "./index";

// Test di accettazione WP-008 (ADR-0013), scritti dall'architetto. NON modificarli per far passare il codice.

const now = new Date("2026-10-05T10:00:00+02:00");
const minutes = (n: number) => new Date(now.getTime() - n * 60_000);
const days = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60_000);

describe("codice via email", () => {
  it("6 cifre, zeri iniziali compresi; fuori intervallo → errore", () => {
    expect(formatOtp(0)).toBe("000000");
    expect(formatOtp(42)).toBe("000042");
    expect(formatOtp(999_999)).toBe("999999");
    expect(() => formatOtp(1_000_000)).toThrow();
    expect(() => formatOtp(-1)).toThrow();
    expect(() => formatOtp(1.5)).toThrow();
  });

  it("accetta il codice scritto con spazi o trattino, rifiuta il resto", () => {
    expect(normalizeOtpInput("123456")).toBe("123456");
    expect(normalizeOtpInput(" 123 456 ")).toBe("123456");
    expect(normalizeOtpInput("123-456")).toBe("123456");
    expect(normalizeOtpInput("12345")).toBeNull();
    expect(normalizeOtpInput("1234567")).toBeNull();
    expect(normalizeOtpInput("12345a")).toBeNull();
  });

  it("vale 10 minuti e concede 5 tentativi", () => {
    expect(OTP_TTL_MS).toBe(10 * 60_000);
    expect(OTP_MAX_ATTEMPTS).toBe(5);
    const open = { attempts: 4, expiresAt: new Date(now.getTime() + 1), consumedAt: null };
    expect(otpChallengeStatus(open, now)).toBe("open");
    expect(otpChallengeStatus({ ...open, attempts: 5 }, now)).toBe("locked");
    expect(otpChallengeStatus({ ...open, expiresAt: now }, now)).toBe("expired");
    expect(otpChallengeStatus({ ...open, consumedAt: now }, now)).toBe("consumed");
  });

  it("per email: al massimo 3 codici ogni 15 minuti e 10 al giorno", () => {
    expect(emailCodeLimitReached([], now)).toBe(false);
    expect(emailCodeLimitReached([minutes(1), minutes(5)], now)).toBe(false);
    expect(emailCodeLimitReached([minutes(1), minutes(5), minutes(14)], now)).toBe(true);
    expect(emailCodeLimitReached([minutes(1), minutes(5), minutes(16)], now)).toBe(false);
    const nineInADay = Array.from({ length: 9 }, (_, i) => minutes(60 + i * 60));
    expect(emailCodeLimitReached(nineInADay, now)).toBe(false);
    expect(emailCodeLimitReached([...nineInADay, minutes(20)], now)).toBe(true);
    expect(emailCodeLimitReached([...nineInADay, minutes(25 * 60)], now)).toBe(false);
  });
});

describe("limite per IP in memoria", () => {
  it("blocca oltre il massimo nella finestra e riparte quando la finestra scorre", () => {
    const limiter = new MemoryLimiter({ windowMs: 1000, max: 2 });
    expect(limiter.hit("a", 0)).toBe(true);
    expect(limiter.hit("a", 100)).toBe(true);
    expect(limiter.hit("a", 200)).toBe(false);
    expect(limiter.hit("b", 200)).toBe(true); // chiavi indipendenti
    expect(limiter.hit("a", 1050)).toBe(true); // il primo tentativo è uscito dalla finestra
  });

  it("non cresce all'infinito: oltre il numero massimo di chiavi dimentica le più vecchie", () => {
    const limiter = new MemoryLimiter({ windowMs: 1000, max: 1 }, 3);
    for (const key of ["a", "b", "c", "d"]) limiter.hit(key, 0);
    expect(limiter.size).toBe(3);
    expect(limiter.hit("a", 1)).toBe(true); // "a" era la più vecchia ed è stata dimenticata
    expect(limiter.hit("d", 1)).toBe(false);
  });
});

describe("sessioni (docs/04 §6)", () => {
  it("30 giorni per lavoratori e aziende, 7 per moderatori e admin", () => {
    expect(sessionExpiresAt("worker", now)).toEqual(days(30));
    expect(sessionExpiresAt("company_member", now)).toEqual(days(30));
    expect(sessionExpiresAt("moderator", now)).toEqual(days(7));
    expect(sessionExpiresAt("admin", now)).toEqual(days(7));
  });

  it("rinnovo scorrevole solo sotto metà durata, mai per i ruoli privilegiati", () => {
    expect(renewedSessionExpiry("worker", days(20), now)).toBeNull();
    expect(renewedSessionExpiry("worker", days(10), now)).toEqual(days(30));
    expect(renewedSessionExpiry("admin", days(1), now)).toBeNull();
  });

  it("in HTTPS il cookie ha il prefisso __Host-", () => {
    expect(sessionCookieName(true)).toMatch(/^__Host-/);
    expect(sessionCookieName(false)).not.toMatch(/^__/);
  });

  it("i ruoli del dominio coincidono con l'enum del DB", () => {
    expect([...USER_ROLES]).toEqual(userRole.enumValues);
  });
});

describe("input", () => {
  it("email: spazi e maiuscole tolti, formato controllato, lunghezza massima", () => {
    expect(emailInput.parse("  Mario.Rossi@Esempio.IT ")).toBe("mario.rossi@esempio.it");
    expect(emailInput.safeParse("non-una-email").success).toBe(false);
    expect(emailInput.safeParse(`${"a".repeat(250)}@b.it`).success).toBe(false);
  });

  it("registrazione: maggiore età e presa visione obbligatorie; niente ruoli privilegiati", () => {
    const ok = { email: "a@esempio.it", role: "worker", adult: "on", legal: "on" };
    expect(signupInput.safeParse(ok).success).toBe(true);
    expect(signupInput.safeParse({ ...ok, role: "company_member" }).success).toBe(true);
    expect(signupInput.safeParse({ ...ok, adult: undefined }).success).toBe(false);
    expect(signupInput.safeParse({ ...ok, legal: undefined }).success).toBe(false);
    expect(signupInput.safeParse({ ...ok, role: "admin" }).success).toBe(false);
    expect(signupInput.safeParse({ ...ok, role: "moderator" }).success).toBe(false);
  });

  it("i testi legali sono ancora marcati come bozza (CLAUDE.md)", () => {
    expect(LEGAL_VERSIONS.privacyNotice).toMatch(/^bozza-/);
    expect(LEGAL_VERSIONS.terms).toMatch(/^bozza-/);
  });
});
