"use client";

import { useTranslations } from "next-intl";
import { useActionState, useId, useState } from "react";
import { addSiteAction, type SiteFormState } from "../server/team-actions";

const field = "w-full rounded-lg border border-border bg-surface px-3 py-3 text-lg text-foreground";

/** Nuova sede operativa: nome della sede e comune. Resta "in attesa" finché un moderatore non la approva. */
export function SiteForm({ companyId }: { companyId: string }) {
  const t = useTranslations("company.sites");
  const [state, action, pending] = useActionState<SiteFormState, FormData>(addSiteAction, {
    status: "idle",
  });
  const errorId = useId();
  const [place, setPlace] = useState("");
  const [shownState, setShownState] = useState(state);
  // Dopo un errore il comune scritto resta nel campo (React svuota il form dopo l'invio).
  if (state !== shownState) {
    setShownState(state);
    if (state.status === "error") setPlace(state.values.place);
  }
  const error = state.status === "error" ? state : null;

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="companyId" value={companyId} />
      <label className="flex flex-col gap-2 text-base font-medium">
        {t("labelLabel")}
        <input
          name="label"
          required
          minLength={2}
          maxLength={80}
          defaultValue={error?.values.label}
          className={field}
        />
        <span className="text-sm font-normal text-muted">{t("labelHelp")}</span>
      </label>
      <label className="flex flex-col gap-2 text-base font-medium">
        {t("placeLabel")}
        <input
          name="place"
          required
          minLength={2}
          maxLength={80}
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          autoComplete="address-level2"
          className={field}
        />
      </label>
      {error && (
        <div
          id={errorId}
          role="alert"
          className="flex flex-col gap-2 rounded-lg border border-accent px-3 py-2"
        >
          <p>{t(`errors.${error.error}`)}</p>
          {error.options.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {error.options.map((option) => (
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
          )}
        </div>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-primary px-4 py-3 text-lg font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? t("pending") : t("add")}
      </button>
    </form>
  );
}
