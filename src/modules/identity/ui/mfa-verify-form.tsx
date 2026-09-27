"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState, useId } from "react";
import { verifySecondFactorAction, type MfaVerifyState } from "../server/actions";

/** Secondo passaggio dopo il codice email: codice dell'app di autenticazione o codice di recupero. */
export function MfaVerifyForm() {
  const t = useTranslations("mfa.verify");
  const [state, action, pending] = useActionState<MfaVerifyState, FormData>(
    verifySecondFactorAction,
    {
      status: "idle",
    },
  );
  const errorId = useId();

  if (state.status === "locked") {
    return (
      <div className="flex flex-col gap-4">
        <p role="alert" className="rounded-lg border border-accent px-3 py-2">
          {t("errors.locked")}
        </p>
        <Link href="/accedi" className="font-semibold text-primary underline underline-offset-4">
          {t("restart")}
        </Link>
      </div>
    );
  }

  const error =
    state.status === "wrong_code"
      ? t("errors.wrong_code", { attemptsLeft: state.attemptsLeft })
      : null;
  return (
    <form action={action} className="flex flex-col gap-4">
      <p>{t("intro")}</p>
      <label className="flex flex-col gap-2 text-base font-medium">
        {t("codeLabel")}
        <input
          name="code"
          required
          autoComplete="one-time-code"
          maxLength={16}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="w-full rounded-lg border border-border bg-surface px-3 py-3 text-lg tracking-[0.2em] text-foreground"
        />
      </label>
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
