import { describe, expect, it } from "vitest";
import { waitlistKind } from "@/lib/db/schema/enums";
import {
  canResendConfirmation,
  CONFIRM_TOKEN_TTL_MS,
  RESEND_COOLDOWN_MS,
  WAITLIST_KINDS,
  waitlistInput,
} from "./index";

// Test di accettazione WP-009 (lista d'attesa), scritti dall'architetto. NON modificarli per far passare il codice.

const ok = { email: " Persona@Esempio.it ", kind: "worker", province: "016", consent: "on" };

describe("iscrizione alla lista d'attesa", () => {
  it("email normalizzata, provincia facoltativa, consenso obbligatorio", () => {
    expect(waitlistInput.parse(ok)).toEqual({
      email: "persona@esempio.it",
      kind: "worker",
      province: "016",
      consent: "on",
    });
    expect(waitlistInput.parse({ ...ok, province: "" }).province).toBeUndefined();
    expect(waitlistInput.parse({ ...ok, province: undefined }).province).toBeUndefined();
    expect(waitlistInput.safeParse({ ...ok, consent: undefined }).success).toBe(false);
    expect(waitlistInput.safeParse({ ...ok, consent: null }).success).toBe(false);
  });

  it("rifiuta tipi e codici provincia non validi", () => {
    expect(waitlistInput.safeParse({ ...ok, kind: "admin" }).success).toBe(false);
    expect(waitlistInput.safeParse({ ...ok, province: "16" }).success).toBe(false);
    expect(waitlistInput.safeParse({ ...ok, province: "Milano" }).success).toBe(false);
    expect(waitlistInput.safeParse({ ...ok, email: "non-una-email" }).success).toBe(false);
  });

  it("il link di conferma vale 7 giorni; una nuova email solo dopo 10 minuti", () => {
    expect(CONFIRM_TOKEN_TTL_MS).toBe(7 * 24 * 60 * 60_000);
    expect(RESEND_COOLDOWN_MS).toBe(10 * 60_000);
    const now = new Date("2026-10-05T10:00:00Z");
    expect(canResendConfirmation(null, now)).toBe(true);
    expect(canResendConfirmation(new Date(now.getTime() - 9 * 60_000), now)).toBe(false);
    expect(canResendConfirmation(new Date(now.getTime() - 10 * 60_000), now)).toBe(true);
  });

  it("i tipi coincidono con l'enum del DB", () => {
    expect([...WAITLIST_KINDS]).toEqual(waitlistKind.enumValues);
  });
});
