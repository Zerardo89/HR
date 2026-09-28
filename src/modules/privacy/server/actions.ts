"use server";

import { redirect } from "next/navigation";
import { clearSessionCookie, requireUser } from "@/modules/identity";
import { deleteAccountInput } from "../domain";
import { eraseAccount } from "./erasure";
import { runtimeDeps } from "./runtime";

/** Cancellazione dell'account dal centro privacy (WP-023): chi è entrato cancella solo sé stesso. */
export async function deleteAccountAction(form: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = deleteAccountInput.safeParse({ confirm: form.get("confirm") ?? "" });
  if (!parsed.success) redirect("/account/privacy?esito=conferma");
  await eraseAccount(runtimeDeps(), user.id, "self");
  await clearSessionCookie();
  redirect("/account-cancellato");
}
