"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/modules/identity";
import { WORKER_STATES, workerProfileInput, type WorkerState } from "../domain";
import { saveWorkerProfile, setWorkerState } from "./profile";
import { runtimeDeps } from "./runtime";

/* Server Actions del profilo (WP-017). Solo utenti `worker`; il servizio ricontrolla ruolo e stato. */

export type ProfileFormState =
  | { status: "idle" }
  | {
      status: "error";
      error: "invalid" | "occupations" | "name" | "phone" | "invalid_occupation";
    }
  | { status: "invalid_place"; options: string[] };

const all = (form: FormData, name: string) =>
  form.getAll(name).map((v) => String(v).slice(0, 1000));
const one = (form: FormData, name: string) => String(form.get(name) ?? "").slice(0, 1000);

/** Righe ripetute del form (esperienze, formazione, lingue): si tengono solo quelle compilate. */
function rows<F extends Record<string, string>>(
  form: FormData,
  fields: F,
  required: keyof F,
): Record<keyof F, string>[] {
  const keys = Object.keys(fields) as (keyof F)[];
  const columns = new Map(keys.map((k) => [k, all(form, fields[k]!)]));
  const count = Math.max(0, ...[...columns.values()].map((c) => c.length));
  return Array.from(
    { length: count },
    (_, i) =>
      Object.fromEntries(keys.map((k) => [k, columns.get(k)![i] ?? ""])) as Record<keyof F, string>,
  ).filter((row) => row[required].trim() !== "");
}

export async function saveProfileAction(
  _prev: ProfileFormState,
  form: FormData,
): Promise<ProfileFormState> {
  const user = await requireUser(["worker"]);
  const parsed = workerProfileInput.safeParse({
    occupationIds: all(form, "occupationId").filter(Boolean),
    place: one(form, "place"),
    radiusKm: one(form, "radiusKm"),
    relocationRegionCodes: all(form, "relocation"),
    experienceBand: one(form, "experienceBand"),
    availableFrom: one(form, "availableFrom"),
    contractPrefs: all(form, "contract"),
    schedulePrefs: all(form, "schedule"),
    drivingLicenses: all(form, "license"),
    languages: rows(form, { code: "langCode", level: "langLevel" }, "code"),
    state: one(form, "state"),
    monthlyCheckOptIn: form.get("monthlyCheck") === "on",
    pii: {
      firstName: one(form, "firstName"),
      lastName: one(form, "lastName"),
      phone: one(form, "phone"),
      about: one(form, "about"),
      experiences: rows(
        form,
        {
          role: "expRole",
          employer: "expEmployer",
          period: "expPeriod",
          description: "expDescription",
        },
        "role",
      ),
      education: rows(form, { title: "eduTitle", school: "eduSchool", year: "eduYear" }, "title"),
    },
  });
  if (!parsed.success) {
    const paths = parsed.error.issues.map((i) => i.path.join("."));
    const error = paths.some((p) => p.startsWith("occupationIds"))
      ? "occupations"
      : paths.some((p) => p === "pii.firstName" || p === "pii.lastName")
        ? "name"
        : paths.includes("pii.phone")
          ? "phone"
          : paths.includes("place")
            ? null
            : "invalid";
    return error ? { status: "error", error } : { status: "invalid_place", options: [] };
  }
  const result = await saveWorkerProfile(runtimeDeps(), user.id, parsed.data);
  if (result.status === "saved") redirect("/profilo?esito=saved");
  if (result.status === "not_allowed") redirect("/");
  if (result.status === "invalid_place") return result;
  return { status: "error", error: result.status };
}

/** Cambio rapido di stato dal riepilogo del profilo. */
export async function setStateAction(form: FormData): Promise<void> {
  const user = await requireUser(["worker"]);
  const state = form.get("state");
  if (!WORKER_STATES.includes(state as WorkerState)) redirect("/profilo");
  await setWorkerState(runtimeDeps(), user.id, state as WorkerState);
  redirect("/profilo?esito=state");
}
