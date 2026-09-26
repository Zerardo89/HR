import { describe, expect, it } from "vitest";
import { isFoundersPeriod, parseBoolean, parseFlags } from "./flags";

describe("flag", () => {
  it("sono tutti spenti per default (default sicuri)", () => {
    const f = parseFlags({});
    expect(f.intermediationEnabled).toBe(false);
    expect(f.billingEnabled).toBe(false);
    expect(f.adsenseEnabled).toBe(false);
    expect(f.previewMode).toBe(false);
  });

  it("si accendono solo con 'true' esplicito", () => {
    expect(parseBoolean("true")).toBe(true);
    expect(parseBoolean(" TRUE ")).toBe(true);
    expect(parseBoolean("1")).toBe(false);
    expect(parseBoolean("yes")).toBe(false);
    expect(parseFlags({ INTERMEDIATION_ENABLED: "true" }).intermediationEnabled).toBe(true);
  });

  it("periodo fondatori fino al 31/01/2027 per default", () => {
    const f = parseFlags({});
    expect(isFoundersPeriod(new Date("2027-01-31T12:00:00+01:00"), f)).toBe(true);
    expect(isFoundersPeriod(new Date("2027-02-01T00:00:01+01:00"), f)).toBe(false);
  });

  it("una data non valida ricade sul default invece di rompere l'app", () => {
    const f = parseFlags({ FOUNDERS_PERIOD_UNTIL: "non-una-data" });
    expect(f.foundersPeriodUntil.toISOString()).toBe("2027-01-31T22:59:59.000Z");
  });
});
