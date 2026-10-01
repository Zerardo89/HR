import { describe, expect, it } from "vitest";
import {
  inviteAttemptAllowed,
  IP_LIMITS,
  MemoryLimiter,
  normalizeInviteCode,
  parseInviteCodes,
  signupInput,
} from "../domain";
import { inviteCodeAccepted } from "./invite";

// Test di accettazione WP-010b: codici invito dell'anteprima. NON modificarli per farli passare.

describe("codici invito: formato", () => {
  it("si normalizzano come li scrivono le persone (minuscole, spazi, trattini)", () => {
    expect(normalizeInviteCode(" tstr-2026 abcd ")).toBe("TSTR2026ABCD");
  });

  it("la configurazione accetta più codici separati da virgole", () => {
    expect(parseInviteCodes("TSTR-2026-ABCD, prova-tester-1")).toEqual([
      "TSTR2026ABCD",
      "PROVATESTER1",
    ]);
  });

  it("rifiuta codici corti (meno di 10 caratteri), vuoti o con simboli strani", () => {
    expect(() => parseInviteCodes("")).toThrow();
    expect(() => parseInviteCodes("ABC-123")).toThrow();
    expect(() => parseInviteCodes("TSTR-2026-ABCD,")).toThrow();
    expect(() => parseInviteCodes("TSTR2026ABCD€")).toThrow();
  });
});

describe("codici invito: controllo", () => {
  const codes = parseInviteCodes("TSTR-2026-ABCD");

  it("accetta il codice giusto anche scritto in modo diverso", () => {
    expect(inviteCodeAccepted("tstr 2026 abcd", codes)).toBe(true);
  });

  it("rifiuta codici sbagliati, vuoti o mancanti", () => {
    expect(inviteCodeAccepted("TSTR-2026-ABCE", codes)).toBe(false);
    expect(inviteCodeAccepted("TSTR-2026-ABC", codes)).toBe(false);
    expect(inviteCodeAccepted("", codes)).toBe(false);
    expect(inviteCodeAccepted(undefined, codes)).toBe(false);
  });

  it("con un elenco vuoto non entra nessuno", () => {
    expect(inviteCodeAccepted("TSTR-2026-ABCD", [])).toBe(false);
  });

  it("un codice lungo (64 caratteri) scritto a gruppi con i trattini entra nel modulo e vale", () => {
    const long = "A".repeat(64);
    const grouped = long.match(/.{4}/g)!.join("-"); // 79 caratteri
    const form = { email: "a@esempio.it", role: "worker", adult: "on", legal: "on" };
    expect(signupInput.safeParse({ ...form, inviteCode: grouped }).success).toBe(true);
    expect(inviteCodeAccepted(grouped, parseInviteCodes(long))).toBe(true);
  });
});

describe("codici invito: limite dei tentativi (revisione ChatGPT WP-010b)", () => {
  const now = Date.parse("2026-10-05T08:00:00Z");

  it("per IP: dopo 30 tentativi in 15 minuti il successivo è rifiutato", () => {
    const limiter = new MemoryLimiter(IP_LIMITS.codeChecks);
    for (let i = 0; i < IP_LIMITS.codeChecks.max; i++) {
      expect(inviteAttemptAllowed(limiter, "203.0.113.7", now)).toBe(true);
    }
    expect(inviteAttemptAllowed(limiter, "203.0.113.7", now)).toBe(false);
    expect(inviteAttemptAllowed(limiter, "203.0.113.8", now)).toBe(true);
    expect(inviteAttemptAllowed(limiter, "203.0.113.7", now + 15 * 60_000)).toBe(true);
  });

  it("senza IP (intestazione mancante) il limite non si aggira: conteggio comune", () => {
    const limiter = new MemoryLimiter(IP_LIMITS.codeChecks);
    for (let i = 0; i < IP_LIMITS.codeChecks.max; i++) {
      expect(inviteAttemptAllowed(limiter, null, now)).toBe(true);
    }
    expect(inviteAttemptAllowed(limiter, null, now)).toBe(false);
  });
});
