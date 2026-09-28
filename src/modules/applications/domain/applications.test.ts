import { describe, expect, it } from "vitest";
import {
  APPLICATION_STATUSES,
  applyInput,
  canCompanySet,
  canWorkerWithdraw,
  companyVisibleUntil,
  visibleToCompany,
} from "./index";

// Test di accettazione WP-019 (stati e conservazione delle candidature). NON modificarli per farli passare.

describe("candidature: stati", () => {
  it("gli stati coincidono con l'enum del DB", () => {
    expect([...APPLICATION_STATUSES]).toEqual([
      "sent",
      "viewed",
      "in_review",
      "contacted",
      "rejected",
      "hired",
      "withdrawn",
      "closed",
    ]);
  });

  it("l'azienda decide solo su candidature ancora aperte; il lavoratore ritira solo se non è finita", () => {
    expect(canCompanySet("viewed", "in_review")).toBe(true);
    expect(canCompanySet("in_review", "contacted")).toBe(true);
    expect(canCompanySet("in_review", "in_review")).toBe(false);
    expect(canCompanySet("withdrawn", "contacted")).toBe(false);
    expect(canCompanySet("rejected", "hired")).toBe(false);
    expect(canWorkerWithdraw("sent")).toBe(true);
    expect(canWorkerWithdraw("contacted")).toBe(true);
    expect(canWorkerWithdraw("hired")).toBe(false);
  });
});

describe("candidature: conservazione (R-PRIV-03)", () => {
  it("visibile all'azienda fino a 6 mesi dopo la chiusura dell'offerta; mai se ritirata", () => {
    const closed = new Date("2026-11-30T10:00:00Z");
    const until = companyVisibleUntil(closed);
    expect(until.toISOString()).toBe("2027-05-30T10:00:00.000Z");
    const now = new Date("2027-05-01T00:00:00Z");
    expect(visibleToCompany({ status: "viewed", companyVisibleUntil: null }, now)).toBe(true);
    expect(visibleToCompany({ status: "viewed", companyVisibleUntil: until }, now)).toBe(true);
    expect(
      visibleToCompany({ status: "viewed", companyVisibleUntil: until }, new Date("2027-06-01")),
    ).toBe(false);
    expect(visibleToCompany({ status: "withdrawn", companyVisibleUntil: null }, now)).toBe(false);
  });
});

describe("candidature: dati del modulo", () => {
  it("messaggio facoltativo, al massimo 1000 caratteri", () => {
    const offerId = "00000000-0000-4000-8000-000000000001";
    expect(applyInput.parse({ offerId, message: "  " })).toEqual({ offerId, message: undefined });
    expect(applyInput.safeParse({ offerId, message: "x".repeat(1001) }).success).toBe(false);
    expect(applyInput.safeParse({ offerId: "nope" }).success).toBe(false);
  });
});
