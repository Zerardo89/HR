import { describe, expect, it } from "vitest";
import { normalizeInviteCode, parseInviteCodes } from "../domain";
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
});
