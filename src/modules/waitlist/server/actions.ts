"use server";

import { headers } from "next/headers";
import { clientIp } from "@/lib/client-ip";
import { isTokenShape } from "@/lib/tokens";
import { waitlistInput } from "../domain";
import { ipLimiter, runtimeDeps } from "./runtime";
import { confirmWaitlist, joinWaitlist } from "./waitlist";

/*
 * Server Actions della lista d'attesa. Next.js controlla `Origin` e `Host` (CSRF).
 * Nessun login richiesto: la protezione è la doppia conferma via email + i limiti di frequenza.
 */

export type JoinValues = { email: string; kind: string; province: string };

export type JoinState =
  | { status: "idle" }
  | { status: "sent" }
  | {
      status: "error";
      error: "invalid" | "rate_limited" | "send_failed";
      /** Ciò che l'utente aveva scritto: React svuota il form dopo l'invio. */
      values: JoinValues;
    };

export async function joinWaitlistAction(_prev: JoinState, form: FormData): Promise<JoinState> {
  const text = (name: string) => String(form.get(name) ?? "").slice(0, 254);
  const values = { email: text("email"), kind: text("kind"), province: text("province") };
  const parsed = waitlistInput.safeParse({
    email: form.get("email"),
    kind: form.get("kind"),
    province: form.get("province") ?? undefined,
    consent: form.get("consent"),
  });
  if (!parsed.success) return { status: "error", error: "invalid", values };

  const ip = clientIp(await headers());
  if (ip && !ipLimiter().hit(ip, Date.now())) {
    return { status: "error", error: "rate_limited", values };
  }

  const result = await joinWaitlist(runtimeDeps(), parsed.data);
  return result.status === "sent"
    ? { status: "sent" }
    : { status: "error", error: "send_failed", values };
}

export type ConfirmState = { status: "idle" | "confirmed" | "already_confirmed" | "invalid" };

/** La conferma avviene solo con il POST del pulsante, mai aprendo il link (R-MAIL-02). */
export async function confirmWaitlistAction(
  _prev: ConfirmState,
  form: FormData,
): Promise<ConfirmState> {
  const token = form.get("token");
  if (!isTokenShape(token)) return { status: "invalid" };
  return confirmWaitlist(runtimeDeps(), token);
}
