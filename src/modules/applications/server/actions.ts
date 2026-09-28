"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/modules/identity";
import { sendApplicationUpdateEmail } from "@/modules/notifications";
import { applyInput, companyDecisionInput } from "../domain";
import { apply, decideApplication, withdraw } from "./applications";
import { runtimeDeps } from "./runtime";

/* Server Actions delle candidature (WP-019). Ruolo verificato qui, autorizzazione fine nel servizio. */

export type ApplyState =
  | { status: "idle" }
  | {
      status: "error";
      error: "invalid" | "no_profile" | "offer_unavailable" | "already_applied" | "not_allowed";
      message: string;
    };

export async function applyAction(_prev: ApplyState, form: FormData): Promise<ApplyState> {
  const user = await requireUser(["worker"]);
  const message = String(form.get("message") ?? "").slice(0, 2000);
  const parsed = applyInput.safeParse({ offerId: form.get("offerId"), message });
  if (!parsed.success) return { status: "error", error: "invalid", message };
  const result = await apply(runtimeDeps(), user.id, parsed.data);
  if (result.status === "applied") redirect(`/offerte/${parsed.data.offerId}?esito=applied`);
  return { status: "error", error: result.status, message };
}

export async function withdrawAction(form: FormData): Promise<void> {
  const user = await requireUser(["worker"]);
  const id = z.uuid().safeParse(form.get("applicationId"));
  if (!id.success) redirect("/candidature");
  const result = await withdraw(runtimeDeps(), user.id, id.data);
  redirect(`/candidature?esito=${result.status}`);
}

export async function decideAction(form: FormData): Promise<void> {
  const user = await requireUser(["company_member"]);
  const parsed = companyDecisionInput.safeParse({
    applicationId: form.get("applicationId"),
    status: form.get("status"),
  });
  if (!parsed.success) redirect("/azienda");
  const result = await decideApplication(
    runtimeDeps(),
    user.id,
    parsed.data.applicationId,
    parsed.data.status,
  );
  if (result.status === "updated") await sendApplicationUpdateEmail(parsed.data.applicationId);
  redirect(`/azienda/candidature/${parsed.data.applicationId}?esito=${result.status}`);
}
