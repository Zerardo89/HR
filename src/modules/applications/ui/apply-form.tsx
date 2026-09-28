"use client";

import { useTranslations } from "next-intl";
import { useActionState, useId } from "react";
import { APPLICATION_MESSAGE_MAX } from "../domain";
import { applyAction, type ApplyState } from "../server/actions";

/** "Candidati con il tuo profilo" (WP-019): un tocco, più un messaggio facoltativo (cifrato). */
export function ApplyForm({ offerId }: { offerId: string }) {
  const t = useTranslations("applications.apply");
  const [state, action, pending] = useActionState<ApplyState, FormData>(applyAction, {
    status: "idle",
  });
  const errorId = useId();
  const error = state.status === "error" ? state : null;
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="offerId" value={offerId} />
      <label className="flex flex-col gap-2 text-base font-medium">
        {t("messageLabel")}
        <textarea
          name="message"
          rows={3}
          maxLength={APPLICATION_MESSAGE_MAX}
          defaultValue={error?.message}
          aria-describedby={error ? errorId : undefined}
          className="w-full rounded-lg border border-border bg-surface px-3 py-3 text-lg text-foreground"
        />
        <span className="text-sm font-normal text-muted">{t("messageHelp")}</span>
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
