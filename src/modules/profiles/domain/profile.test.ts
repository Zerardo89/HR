import { describe, expect, it } from "vitest";
import {
  fieldNames,
  FORBIDDEN_FIELD_PATTERN,
  MAX_PROFILE_OCCUPATIONS,
  workerPiiSchema,
  workerProfileInput,
} from "./index";

// Test di accettazione WP-017 (profilo del lavoratore), scritti dall'architetto. NON modificarli per farli passare.

const pii = {
  firstName: "Mario",
  lastName: "Rossi",
  phone: "+39 333 000 0000",
  about: "Cameriere con esperienza in sala e banco.",
  experiences: [{ role: "Cameriere", employer: "Trattoria Finta", period: "2021-2024" }],
  education: [{ title: "Diploma alberghiero", school: "Istituto Finto", year: "2019" }],
};

const input = {
  occupationIds: ["12", "7", "12"],
  place: "Lodi",
  radiusKm: "20",
  relocationRegionCodes: ["03"],
  experienceBand: "y1_3",
  availableFrom: "",
  contractPrefs: ["permanent"],
  schedulePrefs: ["part_time"],
  drivingLicenses: ["B"],
  languages: [
    { code: "it", level: "native" },
    { code: "en", level: "b1" },
  ],
  state: "seeking",
  monthlyCheckOptIn: false,
  pii,
};

describe("profilo: dati ammessi", () => {
  it("valori validi; mansioni senza doppioni; campi vuoti facoltativi → assenti", () => {
    const p = workerProfileInput.parse(input);
    expect(p.occupationIds).toEqual([12, 7]);
    expect(p.radiusKm).toBe(20);
    expect(p.availableFrom).toBeUndefined();
    expect(workerPiiSchema.parse({ ...pii, phone: "", about: "" })).toMatchObject({
      phone: undefined,
      about: undefined,
    });
  });

  it("limiti: almeno una e al massimo 5 mansioni; raggio tra i valori previsti; lingue non ripetute", () => {
    expect(workerProfileInput.safeParse({ ...input, occupationIds: [] }).success).toBe(false);
    const six = Array.from({ length: MAX_PROFILE_OCCUPATIONS + 1 }, (_, i) => String(i + 1));
    expect(workerProfileInput.safeParse({ ...input, occupationIds: six }).success).toBe(false);
    expect(workerProfileInput.safeParse({ ...input, radiusKm: "37" }).success).toBe(false);
    expect(
      workerProfileInput.safeParse({
        ...input,
        languages: [
          { code: "en", level: "b1" },
          { code: "en", level: "c1" },
        ],
      }).success,
    ).toBe(false);
    expect(workerPiiSchema.safeParse({ ...pii, phone: "chiamami" }).success).toBe(false);
    expect(workerPiiSchema.safeParse({ ...pii, firstName: "" }).success).toBe(false);
  });
});

describe("profilo: campi vietati (R-LAV-05, R-ANN-02)", () => {
  it("nessun campo per data di nascita, sesso, nazionalità, foto, salute, stipendio precedente…", () => {
    const names = fieldNames(workerProfileInput);
    expect(names).toContain("firstName"); // lo scanner vede anche i campi annidati
    expect(names).toContain("role");
    expect(names.filter((n) => FORBIDDEN_FIELD_PATTERN.test(n))).toEqual([]);
  });

  it("il controllo riconosce davvero i nomi vietati", () => {
    for (const bad of [
      "birthDate",
      "sesso",
      "nationality",
      "photoUrl",
      "previousSalary",
      "maritalStatus",
    ]) {
      expect(FORBIDDEN_FIELD_PATTERN.test(bad)).toBe(true);
    }
  });

  it("campi sconosciuti nei dati cifrati si scartano (niente dati in più di nascosto)", () => {
    const parsed = workerPiiSchema.parse({ ...pii, birthDate: "1990-01-01" } as unknown);
    expect(parsed).not.toHaveProperty("birthDate");
  });
});
