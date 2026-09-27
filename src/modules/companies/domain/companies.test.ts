import { describe, expect, it } from "vitest";
import { companyKind } from "@/lib/db/schema/enums";
import {
  COMPANY_KINDS,
  companyInput,
  isValidItalianVat,
  normalizeVat,
  parseViesAddress,
  parseViesResponse,
} from "./index";

// Test di accettazione WP-011 (registrazione aziende), scritti dall'architetto. NON modificarli per far passare il codice.

describe("Partita IVA", () => {
  it("controlla la cifra di controllo e scarta i numeri impossibili", () => {
    expect(isValidItalianVat("11111111115")).toBe(true);
    expect(isValidItalianVat("11111111116")).toBe(false); // ultima cifra sbagliata
    expect(isValidItalianVat("1111111111")).toBe(false); // 10 cifre
    expect(isValidItalianVat("00000000000")).toBe(false);
    expect(isValidItalianVat("1111111111a")).toBe(false);
  });

  it("accetta il prefisso IT, spazi, punti e trattini", () => {
    expect(normalizeVat(" IT 111.111-111.15 ")).toBe("11111111115");
    expect(normalizeVat("it11111111115")).toBe("11111111115");
  });
});

describe("risposta VIES", () => {
  it("valida: ragione sociale e indirizzo ripuliti", () => {
    expect(
      parseViesResponse({
        isValid: true,
        userError: "VALID",
        name: "AZIENDA FINTA SRL",
        address: "VIA ROMA 1 \n20121 MILANO MI\n",
      }),
    ).toEqual({
      status: "valid",
      name: "AZIENDA FINTA SRL",
      address: "VIA ROMA 1\n20121 MILANO MI",
    });
    expect(parseViesResponse({ isValid: true, name: "---", address: "---" })).toEqual({
      status: "valid",
      name: null,
      address: null,
    });
  });

  it("numero non valido ≠ servizio non disponibile (in quel caso l'azienda resta in verifica)", () => {
    expect(parseViesResponse({ isValid: false, userError: "INVALID" })).toEqual({
      status: "invalid",
    });
    expect(parseViesResponse({ isValid: false, userError: "MS_UNAVAILABLE" })).toEqual({
      status: "unavailable",
    });
    expect(parseViesResponse({ isValid: false, userError: "TIMEOUT" })).toEqual({
      status: "unavailable",
    });
    expect(parseViesResponse("<html>errore</html>")).toEqual({ status: "unavailable" });
  });

  it("dall'indirizzo ricava CAP, comune e sigla della provincia", () => {
    expect(parseViesAddress("VIA ROMA 1\n20121 MILANO MI")).toEqual({
      cap: "20121",
      city: "MILANO",
      provinceAbbr: "MI",
    });
    expect(parseViesAddress("VIA DANTE 3\n26900 SANT'ANGELO LODIGIANO LO\n")).toMatchObject({
      city: "SANT'ANGELO LODIGIANO",
      provinceAbbr: "LO",
    });
    expect(parseViesAddress("INDIRIZZO SENZA CAP")).toBeNull();
    expect(parseViesAddress(null)).toBeNull();
  });
});

describe("dati di registrazione", () => {
  const ok = { vat: "IT11111111115", displayName: "Trattoria Finta", kind: "employer" };

  it("P.IVA normalizzata e controllata, nome visibile obbligatorio", () => {
    expect(companyInput.parse(ok)).toEqual({
      vat: "11111111115",
      displayName: "Trattoria Finta",
      kind: "employer",
      agencyAuthorization: undefined,
    });
    expect(companyInput.safeParse({ ...ok, vat: "12345678901" }).success).toBe(false);
    expect(companyInput.safeParse({ ...ok, displayName: " " }).success).toBe(false);
  });

  it("un'agenzia per il lavoro deve indicare l'autorizzazione (R-LAV-03)", () => {
    expect(companyInput.safeParse({ ...ok, kind: "agency" }).success).toBe(false);
    expect(
      companyInput.safeParse({ ...ok, kind: "agency", agencyAuthorization: "Prot. 00/0000" })
        .success,
    ).toBe(true);
  });

  it("i tipi coincidono con l'enum del DB", () => {
    expect([...COMPANY_KINDS]).toEqual(companyKind.enumValues);
  });
});
