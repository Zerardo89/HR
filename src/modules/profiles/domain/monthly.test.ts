import { describe, expect, it } from "vitest";
import {
  firstMonthlyCheck,
  MAX_UNANSWERED_CHECKS,
  nextMonthlyCheck,
  shouldPauseMonthlyChecks,
} from "./monthly";

// Test di accettazione WP-021 (01-PRODOTTO §6.2): calendario della mail mensile. NON modificarli.

const DAY = 24 * 60 * 60_000;
const now = new Date("2026-11-10T08:00:00Z");

describe("mail mensile: quando", () => {
  it("la prima parte 30 giorni dopo l'adesione", () => {
    expect(firstMonthlyCheck(now)).toEqual(new Date(now.getTime() + 30 * DAY));
  });

  it("la successiva 30 giorni dopo quella prevista (resta il giorno di adesione)", () => {
    const scheduled = new Date(now.getTime() - 2 * 60 * 60_000); // prevista stamattina
    expect(nextMonthlyCheck(scheduled, now)).toEqual(new Date(scheduled.getTime() + 30 * DAY));
  });

  it("dopo un lungo fermo non ne partono tante di fila: 30 giorni da adesso", () => {
    const scheduled = new Date(now.getTime() - 90 * DAY);
    expect(nextMonthlyCheck(scheduled, now)).toEqual(new Date(now.getTime() + 30 * DAY));
  });

  it("dopo 6 mail senza risposta si mette in pausa (la settima non parte)", () => {
    expect(MAX_UNANSWERED_CHECKS).toBe(6);
    expect(shouldPauseMonthlyChecks(5)).toBe(false);
    expect(shouldPauseMonthlyChecks(6)).toBe(true);
  });
});
