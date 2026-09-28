"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { isTokenShape } from "@/lib/tokens";
import { getCurrentUser, requireUser } from "@/modules/identity";
import { sendSiteOutcomeEmail } from "@/modules/notifications";
import { inviteInput, siteDecisionInput, siteInput } from "../domain";
import { clearPendingInvite, setPendingInvite } from "./invite-cookie";
import { acceptInvite, createInvite, revokeInvite } from "./invites";
import { inviteRuntimeDeps } from "./runtime";
import { addSite, decideSite, removeSite } from "./sites";

/* Server Actions di sedi e inviti (WP-011c). Ogni azione ricontrolla chi è l'utente e il suo ruolo nel servizio. */

const plain = () => ({ db: getDb(), now: () => new Date() });
const text = (form: FormData, name: string) => String(form.get(name) ?? "").slice(0, 200);

export type SiteFormState =
  | { status: "idle" }
  | {
      status: "error";
      error: "invalid" | "place_ambiguous" | "place_not_found" | "duplicate" | "too_many";
      /** Comuni tra cui scegliere ("Castro (LE)") o suggerimenti per un nome scritto male. */
      options: string[];
      values: { label: string; place: string };
    };

export async function addSiteAction(_prev: SiteFormState, form: FormData): Promise<SiteFormState> {
  const user = await requireUser(["company_member"]);
  const values = { label: text(form, "label"), place: text(form, "place") };
  const parsed = siteInput.safeParse({ companyId: form.get("companyId"), ...values });
  if (!parsed.success) return { status: "error", error: "invalid", options: [], values };
  const result = await addSite(plain(), user.id, parsed.data);
  if (result.status === "added")
    redirect(`/azienda/sedi?azienda=${parsed.data.companyId}&esito=added`);
  if (result.status === "not_allowed") redirect("/azienda");
  const places =
    result.status === "place_ambiguous"
      ? result.options
      : result.status === "place_not_found"
        ? result.suggestions
        : [];
  return {
    status: "error",
    error: result.status,
    options: places.map((p) => `${p.name} (${p.provinceAbbr})`),
    values,
  };
}

export async function removeSiteAction(form: FormData): Promise<void> {
  const user = await requireUser(["company_member"]);
  const ids = z
    .object({ siteId: z.uuid(), companyId: z.uuid() })
    .safeParse({ siteId: form.get("siteId"), companyId: form.get("companyId") });
  if (!ids.success) redirect("/azienda");
  const result = await removeSite(plain(), user.id, ids.data.siteId);
  redirect(`/azienda/sedi?azienda=${ids.data.companyId}&esito=${result.status}`);
}

export type InviteFormState =
  | { status: "idle" }
  | {
      status: "error";
      error:
        "invalid_email" | "company_not_verified" | "already_member" | "too_many" | "send_failed";
      email: string;
    };

export async function inviteAction(
  _prev: InviteFormState,
  form: FormData,
): Promise<InviteFormState> {
  const user = await requireUser(["company_member"]);
  const email = text(form, "email");
  const parsed = inviteInput.safeParse({ companyId: form.get("companyId"), email });
  if (!parsed.success) return { status: "error", error: "invalid_email", email };
  const result = await createInvite(inviteRuntimeDeps(), user.id, parsed.data);
  if (result.status === "sent")
    redirect(`/azienda/colleghi?azienda=${parsed.data.companyId}&esito=sent`);
  if (result.status === "not_allowed") redirect("/azienda");
  return { status: "error", error: result.status, email };
}

export async function revokeInviteAction(form: FormData): Promise<void> {
  const user = await requireUser(["company_member"]);
  const ids = z
    .object({ inviteId: z.uuid(), companyId: z.uuid() })
    .safeParse({ inviteId: form.get("inviteId"), companyId: form.get("companyId") });
  if (!ids.success) redirect("/azienda");
  const result = await revokeInvite(plain(), user.id, ids.data.inviteId);
  redirect(`/azienda/colleghi?azienda=${ids.data.companyId}&esito=${result.status}`);
}

/** Senza accesso: si ricorda l'invito (cookie tecnico) e si passa alla pagina di accesso. */
export async function continueInviteAction(form: FormData): Promise<void> {
  const token = form.get("token");
  if (!isTokenShape(token)) redirect("/");
  await setPendingInvite(token);
  redirect("/accedi");
}

export async function acceptInviteAction(form: FormData): Promise<void> {
  const token = form.get("token");
  if (!isTokenShape(token)) redirect("/");
  const current = await getCurrentUser();
  if (!current) {
    await setPendingInvite(token);
    redirect("/accedi");
  }
  if (current.role !== "company_member") redirect(`/invito/${token}?esito=not_company_account`);
  const user = await requireUser(["company_member"]); // anche la 2FA, obbligatoria per le aziende
  const result = await acceptInvite(plain(), user.id, token);
  if (result.status === "accepted" || result.status === "already_member") {
    await clearPendingInvite();
    redirect("/azienda?esito=joined");
  }
  if (result.status === "expired" || result.status === "used" || result.status === "not_found") {
    await clearPendingInvite();
  }
  redirect(`/invito/${token}?esito=${result.status}`);
}

/** Decisione del moderatore su una sede operativa (solo moderatori e admin, con 2FA). */
export async function decideSiteAction(form: FormData): Promise<void> {
  const user = await requireUser(["moderator", "admin"]);
  const parsed = siteDecisionInput.safeParse({
    decision: form.get("decision"),
    siteId: form.get("siteId"),
    reason: form.get("reason") ?? undefined,
  });
  if (!parsed.success) redirect("/moderazione?esito=invalid");
  const result = await decideSite(plain(), user.id, parsed.data);
  if (result.status === "approved" || result.status === "rejected") {
    await sendSiteOutcomeEmail(parsed.data.siteId);
  }
  revalidatePath("/moderazione");
  redirect(`/moderazione?esito=site_${result.status}`);
}
