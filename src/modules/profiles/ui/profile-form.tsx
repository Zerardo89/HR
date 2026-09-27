"use client";

import { useTranslations } from "next-intl";
import { startTransition, useActionState, useState, type FormEvent, type ReactNode } from "react";
import { CONTRACT_TYPES, SCHEDULE_TYPES } from "@/modules/offers/domain";
import {
  DEFAULT_PROFILE_RADIUS_KM,
  DRIVING_LICENSES,
  EXPERIENCE_BANDS,
  LANGUAGE_CODES,
  LANGUAGE_LEVELS,
  MAX_EDUCATION,
  MAX_EXPERIENCES,
  MAX_LANGUAGES,
  PROFILE_RADII_KM,
  WORKER_STATES,
} from "../domain";
import { saveProfileAction, type ProfileFormState } from "../server/actions";
import type { WorkerProfileView } from "../server/profile";

const field = "w-full rounded-lg border border-border bg-surface px-3 py-3 text-lg text-foreground";
const labelCls = "flex flex-col gap-2 text-base font-medium";
const box = "flex flex-col gap-4 rounded-xl border border-border bg-surface p-5";
const check = "flex items-center gap-2";

/** Righe da mostrare: quelle già compilate più una vuota (almeno `min`, al massimo `max`). */
const rowCount = (filled: number, min: number, max: number) =>
  Math.min(max, Math.max(min, filled + 1));

/**
 * Profilo guidato (WP-017). Nome, telefono, presentazione, esperienze e formazione si cifrano sul server
 * (li leggono solo il lavoratore e, in futuro, le aziende a cui si candida). Niente foto, età, sesso,
 * nazionalità o stipendio precedente (R-LAV-05): i campi non esistono.
 */
export function ProfileForm({
  initial,
  regions,
  occupationFields,
}: {
  initial: WorkerProfileView | null;
  regions: { code: string; name: string }[];
  occupationFields: ReactNode;
}) {
  const t = useTranslations("profile");
  const tf = useTranslations("offers.form");
  const [state, action, pending] = useActionState<ProfileFormState, FormData>(saveProfileAction, {
    status: "idle",
  });
  const [place, setPlace] = useState(initial?.place ?? "");
  // Invio senza l'azzeramento automatico di React 19 (vedi il form dell'offerta, WP-016).
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    startTransition(() => action(data));
  };
  const pii = initial?.pii;
  const languages = initial?.languages ?? [];
  const experiences = pii?.experiences ?? [];
  const education = pii?.education ?? [];

  return (
    <form action={action} onSubmit={submit} className="flex flex-col gap-6">
      <fieldset className={box}>
        <legend className="px-1 text-xl font-semibold">{t("stateLegend")}</legend>
        {WORKER_STATES.map((s) => (
          <label key={s} className="flex items-start gap-3">
            <input
              type="radio"
              name="state"
              value={s}
              defaultChecked={(initial?.state ?? "seeking") === s}
              className="mt-1 size-5 shrink-0"
            />
            <span>
              <span className="font-semibold">{t(`states.${s}.label`)}</span>
              <span className="block text-sm text-muted">{t(`states.${s}.help`)}</span>
            </span>
          </label>
        ))}
        <label className={check}>
          <input
            type="checkbox"
            name="monthlyCheck"
            defaultChecked={initial?.monthlyCheckOptIn ?? false}
            className="size-5"
          />
          {t("monthlyCheck")}
        </label>
      </fieldset>

      <fieldset className={box}>
        <legend className="px-1 text-xl font-semibold">{t("whoLegend")}</legend>
        <p className="text-sm text-muted">{t("whoHelp")}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelCls}>
            {t("firstName")}
            <input
              name="firstName"
              required
              maxLength={60}
              autoComplete="given-name"
              defaultValue={pii?.firstName}
              className={field}
            />
          </label>
          <label className={labelCls}>
            {t("lastName")}
            <input
              name="lastName"
              required
              maxLength={60}
              autoComplete="family-name"
              defaultValue={pii?.lastName}
              className={field}
            />
          </label>
        </div>
        <label className={labelCls}>
          {t("phone")}
          <input
            name="phone"
            type="tel"
            maxLength={20}
            autoComplete="tel"
            defaultValue={pii?.phone}
            className={field}
          />
          <span className="text-sm font-normal text-muted">{t("phoneHelp")}</span>
        </label>
        <label className={labelCls}>
          {t("about")}
          <textarea
            name="about"
            rows={4}
            maxLength={1000}
            defaultValue={pii?.about}
            className={field}
          />
          <span className="text-sm font-normal text-muted">{t("aboutHelp")}</span>
        </label>
      </fieldset>

      <fieldset className={box}>
        <legend className="px-1 text-xl font-semibold">{t("workLegend")}</legend>
        {occupationFields}
        <label className={labelCls}>
          {t("experienceBand")}
          <select
            name="experienceBand"
            defaultValue={initial?.experienceBand ?? "none"}
            className={field}
          >
            {EXPERIENCE_BANDS.map((b) => (
              <option key={b} value={b}>
                {t(`bands.${b}`)}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      <fieldset className={box}>
        <legend className="px-1 text-xl font-semibold">{t("whereLegend")}</legend>
        <label className={labelCls}>
          {t("place")}
          <input
            name="place"
            required
            maxLength={80}
            value={place}
            onChange={(e) => setPlace(e.target.value)}
            autoComplete="address-level2"
            className={field}
          />
          <span className="text-sm font-normal text-muted">{t("placeHelp")}</span>
        </label>
        {state.status === "invalid_place" && (
          <div
            role="alert"
            className="flex flex-col gap-2 rounded-lg border border-accent px-3 py-2"
          >
            <p>{t(state.options.length > 0 ? "placeChoose" : "placeNotFound")}</p>
            <ul className="flex flex-wrap gap-2">
              {state.options.map((option) => (
                <li key={option}>
                  <button
                    type="button"
                    onClick={() => setPlace(option)}
                    className="rounded-lg border border-primary px-3 py-2 font-medium text-primary"
                  >
                    {option}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <label className={labelCls}>
          {t("radius")}
          <select
            name="radiusKm"
            defaultValue={String(initial?.radiusKm ?? DEFAULT_PROFILE_RADIUS_KM)}
            className={field}
          >
            {PROFILE_RADII_KM.map((km) => (
              <option key={km} value={km}>
                {t("radiusOption", { km: String(km) })}
              </option>
            ))}
          </select>
        </label>
        {regions.length > 0 && (
          <details className="rounded-lg border border-border px-4 py-3">
            <summary className="cursor-pointer font-medium">{t("relocation")}</summary>
            <p className="mt-2 text-sm text-muted">{t("relocationHelp")}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {regions.map((r) => (
                <label key={r.code} className={check}>
                  <input
                    type="checkbox"
                    name="relocation"
                    value={r.code}
                    defaultChecked={initial?.relocationRegionCodes.includes(r.code)}
                    className="size-5"
                  />
                  {r.name}
                </label>
              ))}
            </div>
          </details>
        )}
      </fieldset>

      <fieldset className={box}>
        <legend className="px-1 text-xl font-semibold">{t("wishLegend")}</legend>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-medium">{t("contracts")}</legend>
          {CONTRACT_TYPES.map((c) => (
            <label key={c} className={check}>
              <input
                type="checkbox"
                name="contract"
                value={c}
                defaultChecked={initial?.contractPrefs.includes(c)}
                className="size-5"
              />
              {tf(`contracts.${c}`)}
            </label>
          ))}
        </fieldset>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-medium">{t("schedules")}</legend>
          {SCHEDULE_TYPES.map((s) => (
            <label key={s} className={check}>
              <input
                type="checkbox"
                name="schedule"
                value={s}
                defaultChecked={initial?.schedulePrefs.includes(s)}
                className="size-5"
              />
              {tf(`schedules.${s}`)}
            </label>
          ))}
        </fieldset>
        <label className={labelCls}>
          {t("availableFrom")}
          <input
            name="availableFrom"
            type="date"
            defaultValue={initial?.availableFrom ?? ""}
            className={field}
          />
        </label>
      </fieldset>

      <fieldset className={box}>
        <legend className="px-1 text-xl font-semibold">{t("skillsLegend")}</legend>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-medium">{t("licenses")}</legend>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {DRIVING_LICENSES.map((l) => (
              <label key={l} className={check}>
                <input
                  type="checkbox"
                  name="license"
                  value={l}
                  defaultChecked={initial?.drivingLicenses.includes(l)}
                  className="size-5"
                />
                {l}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 font-medium">{t("languages")}</legend>
          {Array.from({ length: rowCount(languages.length, 2, MAX_LANGUAGES) }, (_, i) => (
            <div key={i} className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1 text-sm">
                {t("language", { n: i + 1 })}
                <select name="langCode" defaultValue={languages[i]?.code ?? ""} className={field}>
                  <option value="">—</option>
                  {LANGUAGE_CODES.map((c) => (
                    <option key={c} value={c}>
                      {t(`languageNames.${c}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm">
                {t("level", { n: i + 1 })}
                <select
                  name="langLevel"
                  defaultValue={languages[i]?.level ?? "b1"}
                  className={field}
                >
                  {LANGUAGE_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {t(`levels.${l}`)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ))}
        </fieldset>
      </fieldset>

      <fieldset className={box}>
        <legend className="px-1 text-xl font-semibold">{t("experiencesLegend")}</legend>
        <p className="text-sm text-muted">{t("experiencesHelp")}</p>
        {Array.from({ length: rowCount(experiences.length, 2, MAX_EXPERIENCES) }, (_, i) => (
          <div key={i} className="grid gap-3 border-t border-border pt-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm">
              {t("expRole", { n: i + 1 })}
              <input
                name="expRole"
                maxLength={80}
                defaultValue={experiences[i]?.role}
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t("expEmployer", { n: i + 1 })}
              <input
                name="expEmployer"
                maxLength={80}
                defaultValue={experiences[i]?.employer}
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t("expPeriod", { n: i + 1 })}
              <input
                name="expPeriod"
                maxLength={40}
                defaultValue={experiences[i]?.period}
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm sm:col-span-3">
              {t("expDescription", { n: i + 1 })}
              <textarea
                name="expDescription"
                rows={2}
                maxLength={500}
                defaultValue={experiences[i]?.description}
                className={field}
              />
            </label>
          </div>
        ))}
      </fieldset>

      <fieldset className={box}>
        <legend className="px-1 text-xl font-semibold">{t("educationLegend")}</legend>
        {Array.from({ length: rowCount(education.length, 1, MAX_EDUCATION) }, (_, i) => (
          <div key={i} className="grid gap-3 border-t border-border pt-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm">
              {t("eduTitle", { n: i + 1 })}
              <input
                name="eduTitle"
                maxLength={120}
                defaultValue={education[i]?.title}
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t("eduSchool", { n: i + 1 })}
              <input
                name="eduSchool"
                maxLength={120}
                defaultValue={education[i]?.school}
                className={field}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t("eduYear", { n: i + 1 })}
              <input
                name="eduYear"
                maxLength={10}
                inputMode="numeric"
                defaultValue={education[i]?.year}
                className={field}
              />
            </label>
          </div>
        ))}
      </fieldset>

      {state.status === "error" && (
        <p role="alert" className="rounded-lg border border-accent px-3 py-2">
          {t(`errors.${state.error}`)}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-primary px-4 py-3 text-lg font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? t("saving") : t("save")}
      </button>
    </form>
  );
}
