import { describe, expect, it } from "vitest";
import { normalizeRecoveryInput, formatRecoveryCode } from "../domain";
import { base32Encode, hotp, matchTotp, newRecoveryCode, otpauthUri, totp, totpStep } from "./totp";

// Test di accettazione WP-011b: TOTP conforme all'RFC 6238 (vettori ufficiali, Appendice B, SHA-1).

const rfcSecret = Buffer.from("12345678901234567890", "ascii");
const at = (seconds: number) => new Date(seconds * 1000);

describe("TOTP (RFC 6238)", () => {
  it("riproduce i vettori di prova ufficiali (8 cifre)", () => {
    expect(totp(rfcSecret, at(59), 8)).toBe("94287082");
    expect(totp(rfcSecret, at(1111111109), 8)).toBe("07081804");
    expect(totp(rfcSecret, at(1111111111), 8)).toBe("14050471");
    expect(totp(rfcSecret, at(1234567890), 8)).toBe("89005924");
    expect(totp(rfcSecret, at(2000000000), 8)).toBe("69279037");
  });

  it("6 cifre di default; HOTP dell'RFC 4226", () => {
    expect(totp(rfcSecret, at(59))).toBe("287082");
    expect(hotp(rfcSecret, 0)).toBe("755224");
    expect(hotp(rfcSecret, 9)).toBe("520489");
  });

  it("base32 come lo leggono le app (RFC 4648)", () => {
    expect(base32Encode(rfcSecret)).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(base32Encode(Buffer.from("f"))).toBe("MY");
  });

  it("accetta il periodo vicino (orologio sfasato) ma mai due volte lo stesso codice", () => {
    const now = at(1234567890);
    const code = totp(rfcSecret, now);
    const step = totpStep(now);
    expect(matchTotp(rfcSecret, code, now, null)).toBe(step);
    expect(matchTotp(rfcSecret, code, new Date(now.getTime() + 30_000), null)).toBe(step);
    expect(matchTotp(rfcSecret, code, new Date(now.getTime() + 90_000), null)).toBeNull();
    expect(matchTotp(rfcSecret, code, now, step)).toBeNull(); // già usato
    expect(matchTotp(rfcSecret, "000000", now, null)).toBeNull();
  });

  it("URI otpauth per il QR code, senza email né dati personali", () => {
    const uri = otpauthUri("GEZDGNBV", "HR", "Azienda");
    expect(uri).toBe(
      "otpauth://totp/HR%3AAzienda?secret=GEZDGNBV&issuer=HR&algorithm=SHA1&digits=6&period=30",
    );
  });
});

describe("codici di recupero", () => {
  it("10 caratteri senza lettere ambigue; si possono scrivere con spazi, trattini e minuscole", () => {
    const code = newRecoveryCode();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
    const shown = formatRecoveryCode(code);
    expect(shown).toMatch(/^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
    expect(normalizeRecoveryInput(shown.toLowerCase())).toBe(code);
    expect(normalizeRecoveryInput(" ABCDE fghjk ")).toBe("ABCDEFGHJK");
    expect(normalizeRecoveryInput("123456")).toBeNull();
    expect(normalizeRecoveryInput("ABCDE-FGHIO")).toBeNull(); // I e O non esistono
  });
});
