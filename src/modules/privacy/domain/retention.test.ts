import { describe, expect, it } from "vitest";
import { canDeleteInactive, monthsBefore, scheduledDeletion, waitlistExpired } from "./retention";

// Test di accettazione WP-023b (R-PRIV-03): soglie di conservazione. NON modificarli per farli passare.

const DAY = 24 * 60 * 60_000;
const now = new Date("2029-06-15T04:15:00Z");

describe("cancellazione per inattività", () => {
  const old = monthsBefore(now, 25);
  it("serve un preavviso spedito da almeno 30 giorni", () => {
    expect(canDeleteInactive(old, null, now)).toBe(false);
    expect(canDeleteInactive(old, new Date(now.getTime() - 29 * DAY), now)).toBe(false);
    expect(canDeleteInactive(old, new Date(now.getTime() - 30 * DAY), now)).toBe(true);
  });

  it("chi è tornato dopo il preavviso non si cancella", () => {
    const notice = new Date(now.getTime() - 40 * DAY);
    expect(canDeleteInactive(new Date(notice.getTime() + DAY), notice, now)).toBe(false);
  });

  it("meno di 24 mesi di inattività: non si cancella", () => {
    const notice = new Date(now.getTime() - 40 * DAY);
    expect(canDeleteInactive(monthsBefore(now, 23), notice, now)).toBe(false);
  });

  it("la data annunciata è 30 giorni dopo il preavviso", () => {
    expect(scheduledDeletion(old, now)).toEqual(new Date(now.getTime() + 30 * DAY));
  });

  it("si cancella proprio il giorno annunciato, anche se il job gira qualche secondo prima", () => {
    const notice = new Date(now.getTime() - 30 * DAY + 5_000);
    expect(canDeleteInactive(old, notice, now)).toBe(true);
  });

  it("se i 24 mesi cadono dopo i 30 giorni, la data annunciata è quella dei 24 mesi", () => {
    const last = new Date("2027-08-01T01:00:00Z");
    const notice = new Date("2029-07-01T02:15:00Z"); // primo giorno con 23 mesi pieni
    expect(scheduledDeletion(last, notice)).toEqual(new Date("2029-08-01T01:00:00Z"));
    expect(canDeleteInactive(last, notice, new Date("2029-07-31T02:15:00Z"))).toBe(false);
    expect(canDeleteInactive(last, notice, new Date("2029-08-01T02:15:00Z"))).toBe(true);
  });
});

describe("date", () => {
  it("mesi indietro senza sforare: dal 31 al 30 aprile, non al 1 maggio", () => {
    expect(monthsBefore(new Date("2027-10-31T10:00:00Z"), 6)).toEqual(
      new Date("2027-04-30T10:00:00Z"),
    );
    expect(monthsBefore(new Date("2028-03-31T10:00:00Z"), 1)).toEqual(
      new Date("2028-02-29T10:00:00Z"),
    );
    expect(monthsBefore(new Date("2029-06-15T04:15:00Z"), 24)).toEqual(
      new Date("2027-06-15T04:15:00Z"),
    );
  });
});

describe("lista d'attesa", () => {
  it("dopo 6 mesi dal lancio (01/11/2026) si cancella tutta", () => {
    expect(waitlistExpired(new Date("2027-04-30T21:00:00Z"))).toBe(false);
    expect(waitlistExpired(new Date("2027-05-01T00:00:00+02:00"))).toBe(true);
  });
});
