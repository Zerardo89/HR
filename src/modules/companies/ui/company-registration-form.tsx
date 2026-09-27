"use client";

import { useTranslations } from "next-intl";
import { useActionState, useId, useState } from "react";
import { registerCompanyAction, type RegisterState } from "../server/actions";

const field = "w-full rounded-lg border border-border bg-surface px-3 py-3 text-lg text-foreground";
const choice = "flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-3";

/** Registrazione dell'azienda: P.IVA (verificata su VIES), nome visibile nelle offerte, tipo. */
export function CompanyRegistrationForm() {
  const t = useTranslations("company.register");
  const [state, action, pending] = useActionState<RegisterState, FormData>(registerCompanyAction, {
    status: "idle",
  });
  const [kind, setKind] = useState<"employer" | "agency">("employer");
  const errorId = useId();
  const error = state.status === "error" ? t(`errors.${state.error}`) : null;
  const values = state.status === "error" ? state.values : undefined;

  return (
    <form
      action={action}
      className="flex flex-col gap-5"
      aria-describedby={error ? errorId : undefined}
    >
      <label className="flex flex-col gap-2 text-base font-medium">
        {t("vatLabel")}
        <input
          name="vat"
          defaultValue={values?.vat}
          required
          inputMode="numeric"
          autoComplete="off"
          maxLength={20}
          className={field}
        />
        <span className="text-sm font-normal text-muted">{t("vatHelp")}</span>
      </label>

      <label className="flex flex-col gap-2 text-base font-medium">
        {t("displayNameLabel")}
        <input
          name="displayName"
          defaultValue={values?.displayName}
          required
          minLength={2}
          maxLength={80}
          className={field}
        />
        <span className="text-sm font-normal text-muted">{t("displayNameHelp")}</span>
      </label>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-base font-medium">{t("kindLegend")}</legend>
        {(["employer", "agency"] as const).map((value) => (
          <label key={value} className={choice}>
            <input
              type="radio"
              name="kind"
              value={value}
              checked={kind === value}
              onChange={() => setKind(value)}
              className="size-5 shrink-0"
            />
            {t(`kinds.${value}`)}
          </label>
        ))}
      </fieldset>

      {kind === "agency" && (
        <label className="flex flex-col gap-2 text-base font-medium">
          {t("agencyAuthorizationLabel")}
          <input
            name="agencyAuthorization"
            defaultValue={values?.agencyAuthorization}
            required
            maxLength={64}
            className={field}
          />
          <span className="text-sm font-normal text-muted">{t("agencyAuthorizationHelp")}</span>
        </label>
      )}

      {error && (
        <p id={errorId} role="alert" className="rounded-lg border border-accent px-3 py-2">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-primary px-4 py-3 text-lg font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? t("pending") : t("submit")}
      </button>
    </form>
  );
}
