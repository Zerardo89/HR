import { describe, expect, it } from "vitest";
import { RECOVERY_CODE_COUNT, normalizeRecoveryInput, totpStep } from "../domain";
import { hotp, matchTotp, newRecoveryCodes, newTotpSecret } from "./totp";

// Test di accettazione WP-011b: vettori ufficiali di RFC 4226 (appendice D) e RFC 6238 (appendice B, SHA-1).

const RFC_SECRET = Buffer.from("12345678901234567890", "ascii");

describe("HOTP (RFC 4226, appendice D)", () => {
  const expected = [
    "755224",
    "287082",
    "359152",
    "969429",
    "338314",
    "254676",
    "287922",
    "162583",
    "399871",
    "520489",
  ];
  it.each(expected.map((code, counter) => [counter, code] as const))(
    "contatore %i → %s",
    (counter, code) => {
      expect(hotp(RFC_SECRET, counter)).toBe(code);
    },
  );
});

describe("TOTP (RFC 6238, appendice B, SHA-1, 8 cifre)", () => {
  const vectors: [number, string][] = [
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ];
  it.each(vectors)("t = %i → %s", (seconds, code) => {
    expect(hotp(RFC_SECRET, totpStep(new Date(seconds * 1000)), 8)).toBe(code);
  });
});

describe("verifica del codice", () => {
  const now = new Date("2026-10-05T08:00:10Z");
  const step = totpStep(now);

  it("accetta il passo corrente e quelli vicini (±30 secondi), dicendo quale", () => {
    for (const s of [step - 1, step, step + 1]) {
      expect(matchTotp(RFC_SECRET, hotp(RFC_SECRET, s), now)).toBe(s);
    }
  });

  it("rifiuta codici più vecchi o più nuovi di un passo", () => {
    expect(matchTotp(RFC_SECRET, hotp(RFC_SECRET, step - 2), now)).toBeNull();
    expect(matchTotp(RFC_SECRET, hotp(RFC_SECRET, step + 2), now)).toBeNull();
  });

  it("rifiuta un codice di un altro segreto", () => {
    expect(matchTotp(newTotpSecret(), hotp(RFC_SECRET, step), now)).toBeNull();
  });
});

describe("segreti e codici di recupero", () => {
  it("segreto di 160 bit, sempre diverso", () => {
    const a = newTotpSecret();
    expect(a).toHaveLength(20);
    expect(a.equals(newTotpSecret())).toBe(false);
  });

  it("10 codici diversi, già nel formato normalizzato", () => {
    const codes = newRecoveryCodes();
    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT);
    for (const code of codes) expect(normalizeRecoveryInput(code)).toBe(code);
  });
});
