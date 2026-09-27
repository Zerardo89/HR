import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  formatSecretForDisplay,
  mfaCookieName,
  normalizeRecoveryInput,
  otpauthUri,
  requiresMfa,
  totpStep,
  USER_ROLES,
} from "./index";

// Test di accettazione WP-011b (2FA TOTP), scritti dall'architetto. NON modificarli per far passare il codice.

describe("chi deve dare il secondo fattore", () => {
  it("aziende, moderatori e admin sì; chi cerca lavoro no", () => {
    expect(USER_ROLES.filter(requiresMfa)).toEqual(["company_member", "moderator", "admin"]);
  });
});

describe("base32 (RFC 4648 §10)", () => {
  const vectors: [string, string][] = [
    ["", ""],
    ["f", "MY"],
    ["fo", "MZXQ"],
    ["foo", "MZXW6"],
    ["foob", "MZXW6YQ"],
    ["fooba", "MZXW6YTB"],
    ["foobar", "MZXW6YTBOI"],
  ];
  it.each(vectors)("%j ↔ %s", (plain, encoded) => {
    expect(base32Encode(Buffer.from(plain))).toBe(encoded);
    expect(Buffer.from(base32Decode(encoded)!).toString()).toBe(plain);
  });

  it("accetta minuscole, spazi e `=`; rifiuta caratteri fuori alfabeto", () => {
    expect(Buffer.from(base32Decode("mzxw 6ytb oi==")!).toString()).toBe("foobar");
    expect(base32Decode("MZXW1")).toBeNull();
  });

  it("il segreto si mostra a gruppi di 4", () => {
    expect(formatSecretForDisplay("ABCDEFGHIJ")).toBe("ABCD EFGH IJ");
  });
});

describe("link per l'app di autenticazione", () => {
  it("otpauth://totp con emittente, SHA1, 6 cifre, 30 secondi", () => {
    const [path, query] = otpauthUri("JBSWY3DPEHPK3PXP", "HR", "persona.finta@esempio.it").split(
      "?",
    );
    expect(decodeURIComponent(path!)).toBe("otpauth://totp/HR:persona.finta@esempio.it");
    expect(Object.fromEntries(new URLSearchParams(query))).toEqual({
      secret: "JBSWY3DPEHPK3PXP",
      issuer: "HR",
      algorithm: "SHA1",
      digits: "6",
      period: "30",
    });
  });
});

describe("passo TOTP", () => {
  it("cambia ogni 30 secondi", () => {
    expect(totpStep(new Date(59_000))).toBe(1);
    expect(totpStep(new Date(60_000))).toBe(2);
  });
});

describe("codici di recupero digitati", () => {
  it("normalizza maiuscole, spazi e trattini nel formato xxxxx-xxxxx", () => {
    expect(normalizeRecoveryInput(" ABCDE FGH23 ")).toBe("abcde-fgh23");
    expect(normalizeRecoveryInput("abcde-fgh23")).toBe("abcde-fgh23");
  });

  it("le lettere che si confondono diventano cifre (i, l → 1; o → 0)", () => {
    expect(normalizeRecoveryInput("IlOab-cdefg")).toBe("110ab-cdefg");
  });

  it("rifiuta lunghezze sbagliate e simboli fuori alfabeto", () => {
    expect(normalizeRecoveryInput("abcde-fgh2")).toBeNull();
    expect(normalizeRecoveryInput("abcde-fgh2u")).toBeNull();
    expect(normalizeRecoveryInput("abcde-fgh2!")).toBeNull();
  });
});

describe("cookie del secondo fattore", () => {
  it("prefisso __Host- in HTTPS", () => {
    expect(mfaCookieName(true)).toBe("__Host-verifica");
    expect(mfaCookieName(false)).toBe("verifica");
  });
});
