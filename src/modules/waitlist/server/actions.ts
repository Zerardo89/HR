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

export type JoinState =
  | { status: "idle" }
  | { status: "sent" }
  | { status: "error"; error: "invalid" | "rate_limited" | "send_failed" };

export async function joinWaitlistAction(_prev: JoinState, form: FormData): Promise<JoinState> {
  const parsed = waitlistInput.safeParse({
    email: form.get("email"),
    kind: form.get("kind"),
    province: form.get("province") ?? undefined,
    consent: form.get("consent"),
  });
  if (!parsed.success) return { status: "error", error: "invalid" };

  const ip = clientIp(await headers());
  if (ip && !ipLimiter().hit(ip, Date.now())) return { status: "error", error: "rate_limited" };

  const result = await joinWaitlist(runtimeDeps(), parsed.data);
  return result.status === "sent" ? { status: "sent" } : { status: "error", error: "send_failed" };
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
