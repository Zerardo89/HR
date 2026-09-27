"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/modules/identity";
import { companyInput } from "../domain";
import { registerCompany } from "./register";
import { runtimeDeps } from "./runtime";

export type RegisterValues = { vat: string; displayName: string; agencyAuthorization: string };

export type RegisterState =
  | { status: "idle" }
  | {
      status: "error";
      error: "invalid" | "vat" | "agency_authorization" | "already_registered" | "vat_invalid";
      /** Ciò che l'utente aveva scritto: React svuota il form dopo l'invio, così non si perde nulla. */
      values: RegisterValues;
    };

/** Autorizzazione lato server: solo utenti con ruolo `company_member` (CLAUDE.md). */
export async function registerCompanyAction(
  _prev: RegisterState,
  form: FormData,
): Promise<RegisterState> {
  const user = await requireUser(["company_member"]);
  const text = (name: string) => String(form.get(name) ?? "").slice(0, 200);
  const values = {
    vat: text("vat"),
    displayName: text("displayName"),
    agencyAuthorization: text("agencyAuthorization"),
  };
  const parsed = companyInput.safeParse({ ...values, kind: form.get("kind") });
  if (!parsed.success) {
    const messages = parsed.error.issues.map((i) => i.message);
    const error = messages.includes("vat")
      ? "vat"
      : messages.includes("agencyAuthorization")
        ? "agency_authorization"
        : "invalid";
    return { status: "error", error, values };
  }

  const result = await registerCompany(runtimeDeps(), user.id, parsed.data);
  if (result.status === "created") redirect("/azienda");
  if (result.status === "not_allowed") redirect("/");
  return { status: "error", error: result.status, values };
}
