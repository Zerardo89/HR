import { describe, expect, it } from "vitest";
import { salaryBasis, salaryPeriod, scheduleType } from "@/lib/db/schema/enums";
import { offerInput, SALARY_BASES, SALARY_PERIODS, SCHEDULE_TYPES } from "./index";

// Test di accettazione WP-013 (dati del form offerta). NON modificarli per far passare il codice.

const form = {
  companyId: "11111111-1111-4111-8111-111111111111",
  siteId: "22222222-2222-4222-8222-222222222222",
  occupationId: "12",
  title: " Cameriere/a di sala ",
  description: "Servizio ai tavoli.",
  contractType: "fixed_term",
  schedule: "full_time",
  hoursPerWeek: "",
  salaryMin: "1.400",
  salaryMax: "1600,50",
  salaryPeriod: "month",
  salaryBasis: "gross",
  ccnl: "",
  validDays: "30",
};

describe("dati del form offerta", () => {
  it("normalizza numeri all'italiana, campi vuoti e spazi", () => {
    expect(offerInput.parse(form)).toMatchObject({
      occupationId: 12,
      title: "Cameriere/a di sala",
      hoursPerWeek: undefined,
      salaryMin: 1400,
      salaryMax: 1600.5,
      salaryPeriod: "month",
      ccnl: undefined,
      validDays: 30,
      internshipDeclaration: false,
    });
    expect(offerInput.parse({ ...form, salaryMin: "", salaryPeriod: "" })).toMatchObject({
      salaryMin: undefined,
      salaryPeriod: undefined,
    });
    expect(offerInput.parse({ ...form, internshipDeclaration: "on" }).internshipDeclaration).toBe(
      true,
    );
  });

  it("scadenza tra 1 e 60 giorni (R-ANN-07); ore settimanali plausibili", () => {
    expect(offerInput.safeParse({ ...form, validDays: "61" }).success).toBe(false);
    expect(offerInput.safeParse({ ...form, validDays: "0" }).success).toBe(false);
    expect(offerInput.safeParse({ ...form, hoursPerWeek: "70" }).success).toBe(false);
    expect(offerInput.safeParse({ ...form, salaryMin: "tanti" }).success).toBe(false);
  });

  it("le liste coincidono con gli enum del DB", () => {
    expect([...SCHEDULE_TYPES]).toEqual(scheduleType.enumValues);
    expect([...SALARY_PERIODS]).toEqual(salaryPeriod.enumValues);
    expect([...SALARY_BASES]).toEqual(salaryBasis.enumValues);
  });
});
