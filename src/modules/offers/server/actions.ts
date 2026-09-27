"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { requireUser } from "@/modules/identity";
import { offerInput, type Issue } from "../domain";
import { saveOffer } from "./save-offer";

export type SaveOfferState =
  | { status: "idle" }
  | { status: "blocked"; issues: Issue[] }
  | {
      status: "error";
      error: "invalid" | "not_allowed" | "invalid_site" | "invalid_occupation" | "not_editable";
    };

const FIELDS = [
  "companyId",
  "siteId",
  "occupationId",
  "title",
  "description",
  "contractType",
  "schedule",
  "hoursPerWeek",
  "salaryMin",
  "salaryMax",
  "salaryPeriod",
  "salaryBasis",
  "ccnl",
  "validDays",
  "internshipDeclaration",
] as const;

/** Salva la bozza o pubblica (WP-013). Autorizzazione lato server: ruolo azienda + membro dell'azienda. */
export async function saveOfferAction(
  _prev: SaveOfferState,
  form: FormData,
): Promise<SaveOfferState> {
  const user = await requireUser(["company_member"]);
  const raw = Object.fromEntries(
    FIELDS.map((f) => [f, form.get(f) === null ? undefined : String(form.get(f))]),
  );
  const parsed = offerInput.safeParse(raw);
  if (!parsed.success) return { status: "error", error: "invalid" };
  const offerId = z.uuid().safeParse(form.get("offerId"));
  const mode = form.get("intent") === "publish" ? "publish" : "draft";

  const result = await saveOffer(
    { db: getDb(), now: () => new Date() },
    user.id,
    parsed.data,
    mode,
    offerId.success ? offerId.data : undefined,
  );
  if (result.status === "saved")
    redirect(`/azienda/offerte/${result.offerId}?esito=${result.offerStatus}`);
  if (result.status === "blocked") return { status: "blocked", issues: result.issues };
  return { status: "error", error: result.status };
}
