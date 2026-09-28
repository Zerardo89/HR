"use client";

import { useTranslations } from "next-intl";
import { useActionState, useId } from "react";
import { REPORT_DETAILS_MAX, REPORT_REASONS } from "../domain";
import { submitReportAction, type ReportState } from "../server/actions";

const field = "w-full rounded-lg border border-border bg-surface px-3 py-3 text-lg text-foreground";

/** "Segnala" (WP-024a, DSA art. 16): l'annuncio o l'azienda, il motivo, cosa non va, buona fede. */
export function ReportForm({ offerId, company }: { offerId: string; company: string }) {
  const t = useTranslations("trust.form");
  const tr = useTranslations("trust.reasons");
  const [state, action, pending] = useActionState<ReportState, FormData>(submitReportAction, {
    status: "idle",
  });
  const errorId = useId();
  const helpId = useId();

  if (state.status === "done") {
    return (
      <p role="status" className="rounded-lg border border-primary bg-surface px-4 py-3">
        {t("done")}
      </p>
    );
  }
  const error = state.status === "error" ? state : null;
  const values = error?.values;
  return (
    <form key={error?.attempt ?? "new"} action={action} className="flex flex-col gap-5">
      <input type="hidden" name="offerId" value={offerId} />
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-base font-medium">{t("targetLegend")}</legend>
        <label className="flex items-center gap-3 text-lg">
          <input
            type="radio"
            name="targetType"
            value="offer"
            defaultChecked={values?.targetType !== "company"}
            className="h-5 w-5"
          />
          {t("targetOffer")}
        </label>
        <label className="flex items-center gap-3 text-lg">
          <input
            type="radio"
            name="targetType"
            value="company"
            defaultChecked={values?.targetType === "company"}
            className="h-5 w-5"
          />
          {t("targetCompany", { company })}
        </label>
      </fieldset>
      <label className="flex flex-col gap-2 text-base font-medium">
        {t("reasonLabel")}
        <select name="reason" required defaultValue={values?.reason ?? ""} className={field}>
          <option value="" disabled />
          {REPORT_REASONS.map((r) => (
            <option key={r} value={r}>
              {tr(r)}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-2 text-base font-medium">
        {t("detailsLabel")}
        <textarea
          name="details"
          rows={4}
          maxLength={REPORT_DETAILS_MAX}
          defaultValue={values?.details}
          aria-describedby={error ? `${helpId} ${errorId}` : helpId}
          className={field}
        />
        <span id={helpId} className="text-sm font-normal text-muted">
          {t("detailsHelp")}
        </span>
      </label>
      <label className="flex items-start gap-3 text-base">
        <input type="checkbox" name="goodFaith" required className="mt-1 h-5 w-5" />
        {t("goodFaith")}
      </label>
      {error && (
        <p id={errorId} role="alert" className="rounded-lg border border-accent px-3 py-2">
          {t(`errors.${error.error}`)}
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
