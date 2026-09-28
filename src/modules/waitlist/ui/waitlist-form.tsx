"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState, useId } from "react";
import { joinWaitlistAction, type JoinState } from "../server/actions";

export type ProvinceOption = { code: string; name: string };

const field = "w-full rounded-lg border border-border bg-surface px-3 py-3 text-lg text-foreground";
const choice = "flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-3";

/** Iscrizione alla lista d'attesa: email + chi sei + provincia (facoltativa) + consenso esplicito. */
export function WaitlistForm({ provinces }: { provinces: ProvinceOption[] }) {
  const t = useTranslations("waitlist");
  const [state, action, pending] = useActionState<JoinState, FormData>(joinWaitlistAction, {
    status: "idle",
  });
  const errorId = useId();

  if (state.status === "sent") {
    return (
      <p role="status" className="rounded-lg border border-primary bg-surface px-4 py-3 text-lg">
        {t("sent")}
      </p>
    );
  }

  const error = state.status === "error" ? t(`errors.${state.error}`) : null;
  const values = state.status === "error" ? state.values : undefined;

  return (
    <form
      key={state.status === "error" ? state.attempt : "new"}
      action={action}
      className="flex flex-col gap-4"
      aria-describedby={error ? errorId : undefined}
    >
      <label className="flex flex-col gap-2 text-base font-medium">
        {t("emailLabel")}
        <input
          type="email"
          name="email"
          defaultValue={values?.email}
          required
          autoComplete="email"
          inputMode="email"
          maxLength={254}
          className={field}
        />
      </label>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-base font-medium">{t("kindLegend")}</legend>
        {(["worker", "company"] as const).map((kind) => (
          <label key={kind} className={choice}>
            <input
              type="radio"
              name="kind"
              value={kind}
              required
              defaultChecked={values?.kind === kind}
              className="size-5 shrink-0"
            />
            {t(`kinds.${kind}`)}
          </label>
        ))}
      </fieldset>

      {provinces.length > 0 && (
        <label className="flex flex-col gap-2 text-base font-medium">
          {t("provinceLabel")}
          <select name="province" defaultValue={values?.province ?? ""} className={field}>
            <option value="">{t("provinceNone")}</option>
            {provinces.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="flex flex-col gap-2">
        <label className="flex items-start gap-3">
          <input type="checkbox" name="consent" required className="mt-1 size-5 shrink-0" />
          {t("consentLabel")}
        </label>
        <Link
          href="/privacy"
          target="_blank"
          className="pl-8 text-base font-medium text-primary underline underline-offset-4"
        >
          {t("privacyLink")}
        </Link>
      </div>

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
