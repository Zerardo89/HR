"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { requireUser } from "@/modules/identity";
import { closeOfferInput, renewOfferInput } from "../domain";
import { closeOffer, renewOffer } from "./lifecycle";

/* Chiusura e rinnovo dall'area azienda (WP-022). Ruolo qui, appartenenza all'azienda nel servizio. */

export async function closeOfferAction(form: FormData): Promise<void> {
  const user = await requireUser(["company_member"]);
  const parsed = closeOfferInput.safeParse({ offerId: form.get("offerId") });
  if (!parsed.success) redirect("/azienda");
  const result = await closeOffer(
    { db: getDb(), now: () => new Date() },
    user.id,
    parsed.data.offerId,
  );
  revalidatePath(`/offerte/${parsed.data.offerId}`);
  redirect(`/azienda/offerte/${parsed.data.offerId}?esito=${result.status}`);
}

export async function renewOfferAction(form: FormData): Promise<void> {
  const user = await requireUser(["company_member"]);
  const parsed = renewOfferInput.safeParse({
    offerId: form.get("offerId"),
    days: form.get("days"),
  });
  if (!parsed.success) redirect("/azienda");
  const result = await renewOffer(
    { db: getDb(), now: () => new Date() },
    user.id,
    parsed.data.offerId,
    parsed.data.days,
  );
  redirect(`/azienda/offerte/${parsed.data.offerId}?esito=${result.status}`);
}
