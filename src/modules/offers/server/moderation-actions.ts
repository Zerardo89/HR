"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { requireUser } from "@/modules/identity";
import { sendOfferOutcomeEmail } from "@/modules/notifications";
import { moderationDecisionInput } from "../domain";
import { decideOffer } from "./moderation";

/** Approva o rifiuta un'offerta (solo moderatori e admin, con 2FA: `requireUser`). */
export async function decideOfferAction(form: FormData): Promise<void> {
  const user = await requireUser(["moderator", "admin"]);
  const parsed = moderationDecisionInput.safeParse({
    decision: form.get("decision"),
    offerId: form.get("offerId"),
    reason: form.get("reason") ?? undefined,
    note: form.get("note") ?? undefined,
  });
  if (!parsed.success) redirect("/moderazione?esito=invalid");
  const result = await decideOffer({ db: getDb(), now: () => new Date() }, user.id, parsed.data);
  if (result.status === "approved" || result.status === "rejected") {
    await sendOfferOutcomeEmail(parsed.data.offerId);
  }
  revalidatePath("/moderazione");
  redirect(`/moderazione?esito=${result.status}`);
}
