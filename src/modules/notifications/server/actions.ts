"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/modules/identity";
import { alertFrequencyInput, alertIdInput, saveAlertInput } from "../domain";
import { deleteAlert, saveAlert, setAlertFrequency } from "./saved-searches";
import { runtimeDeps } from "./runtime";
import { unsubscribeWithToken } from "./unsubscribe";

/* Server Actions degli avvisi (WP-020). Ruolo verificato qui, proprietà dell'avviso nel servizio. */

export async function saveAlertAction(form: FormData): Promise<void> {
  const user = await requireUser(["worker"]);
  const parsed = saveAlertInput.safeParse({
    params: form.get("params"),
    frequency: form.get("frequency"),
  });
  if (!parsed.success) redirect("/avvisi?esito=invalid");
  const result = await saveAlert(runtimeDeps(), user.id, parsed.data);
  redirect(`/avvisi?esito=${result.status}`);
}

export async function setAlertFrequencyAction(form: FormData): Promise<void> {
  const user = await requireUser(["worker"]);
  const parsed = alertFrequencyInput.safeParse({
    id: form.get("id"),
    frequency: form.get("frequency"),
  });
  if (!parsed.success) redirect("/avvisi");
  const result = await setAlertFrequency(
    runtimeDeps(),
    user.id,
    parsed.data.id,
    parsed.data.frequency,
  );
  redirect(`/avvisi?esito=${result.status}`);
}

export async function deleteAlertAction(form: FormData): Promise<void> {
  const user = await requireUser(["worker"]);
  const parsed = alertIdInput.safeParse({ id: form.get("id") });
  if (!parsed.success) redirect("/avvisi");
  const result = await deleteAlert(runtimeDeps(), user.id, parsed.data.id);
  redirect(`/avvisi?esito=${result.status}`);
}

/** Pulsante della pagina di conferma: il token è la sola prova (si arriva dall'email, anche senza accesso). */
export async function unsubscribeAction(form: FormData): Promise<void> {
  const token = form.get("token");
  const result = await unsubscribeWithToken(runtimeDeps(), token);
  redirect(`/avvisi/disiscrizione?esito=${result.status}`);
}
