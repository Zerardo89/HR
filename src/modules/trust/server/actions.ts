"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clientIp } from "@/lib/client-ip";
import { getDb } from "@/lib/db";
import { getCurrentUser, requireUser } from "@/modules/identity";
import {
  REPORT_DETAILS_MAX,
  reportDecisionInput,
  reportInput,
  reportInputError,
  type ReportInputError,
} from "../domain";
import { decideReports, submitReport } from "./reports";
import { reportLimiter, runtimeDeps } from "./runtime";
import { acceptCurrentTerms } from "./terms";

/*
 * Server Actions delle segnalazioni (WP-024a). Next.js controlla `Origin` e `Host` (CSRF).
 * Segnalare non richiede l'accesso (R-DSA-03): protezione con il limite per IP (solo in memoria).
 */

export type ReportValues = { targetType: string; reason: string; details: string };

export type ReportState =
  | { status: "idle" }
  | { status: "done" }
  | {
      status: "error";
      error: ReportInputError | "rate_limited" | "not_found";
      /** Ciò che l'utente aveva scritto: React svuota il form dopo l'invio. */
      values: ReportValues;
      /** Cambia a ogni invio: il form si ricrea con i valori scritti (una `select` non si ripristina da sola). */
      attempt: number;
    };

export async function submitReportAction(_prev: ReportState, form: FormData): Promise<ReportState> {
  const text = (name: string, max: number) => String(form.get(name) ?? "").slice(0, max);
  const values = {
    targetType: text("targetType", 16),
    reason: text("reason", 32),
    details: text("details", REPORT_DETAILS_MAX),
  };
  const parsed = reportInput.safeParse({
    offerId: form.get("offerId"),
    targetType: form.get("targetType"),
    reason: form.get("reason"),
    details: form.get("details") ?? undefined,
    goodFaith: form.get("goodFaith") ?? undefined,
  });
  const attempt = Date.now();
  if (!parsed.success) {
    return { status: "error", error: reportInputError(parsed.error), values, attempt };
  }
  const ip = clientIp(await headers());
  if (ip && !reportLimiter().hit(ip, attempt)) {
    return { status: "error", error: "rate_limited", values, attempt };
  }
  const user = await getCurrentUser();
  const result = await submitReport(runtimeDeps(), user?.id ?? null, parsed.data);
  return result.status === "received"
    ? { status: "done" }
    : { status: "error", error: "not_found", values, attempt };
}

/** Decisione sulle segnalazioni (solo moderatori e admin, con 2FA: `requireUser`). */
export async function decideReportAction(form: FormData): Promise<void> {
  const user = await requireUser(["moderator", "admin"]);
  const parsed = reportDecisionInput.safeParse({
    targetType: form.get("targetType"),
    targetId: form.get("targetId"),
    decision: form.get("decision"),
    ground: form.get("ground") || undefined,
    facts: form.get("facts") || undefined,
  });
  if (!parsed.success) redirect("/moderazione?esito=report_invalid");
  const result = await decideReports(runtimeDeps(), user.id, parsed.data);
  revalidatePath("/moderazione");
  redirect(`/moderazione?esito=report_${result.status}`);
}

/** "Accetto" le condizioni d'uso aggiornate (WP-024b): registra la versione in vigore. */
export async function acceptTermsAction(): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await acceptCurrentTerms(getDb(), user.id, new Date());
  revalidatePath("/", "layout");
}
