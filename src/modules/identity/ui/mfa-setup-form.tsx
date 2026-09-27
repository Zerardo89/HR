"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useActionState, useId } from "react";
import { confirmTotpAction, type MfaSetupState } from "../server/actions";

/** Conferma dell'attivazione con un codice dell'app; poi mostra UNA volta i codici di recupero. */
export function MfaSetupForm({ continueHref }: { continueHref: string }) {
  const t = useTranslations("mfa.setup");
  const [state, action, pending] = useActionState<MfaSetupState, FormData>(confirmTotpAction, {
    status: "idle",
  });
  const errorId = useId();

  if (state.status === "enabled") {
    return (
      <section aria-labelledby="codici-recupero" className="flex flex-col gap-4">
        <h2 id="codici-recupero" className="text-xl font-semibold">
          {t("recoveryTitle")}
        </h2>
        <p>{t("recoveryIntro")}</p>
        <ul
          aria-label={t("recoveryTitle")}
          className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-surface p-4 font-mono text-lg"
        >
          {state.recoveryCodes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <Link
          href={continueHref}
          className="self-start rounded-lg bg-primary px-4 py-3 text-lg font-semibold text-primary-foreground"
        >
          {t("continue")}
        </Link>
      </section>
    );
  }

  const error = state.status === "error" ? t(`errors.${state.error}`) : null;
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-base font-medium">
        {t("codeLabel")}
        <input
          name="code"
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 \-]{6,7}"
          maxLength={7}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="w-full rounded-lg border border-border bg-surface px-3 py-3 text-lg tracking-[0.3em] text-foreground"
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
        {pending ? t("pending") : t("confirm")}
      </button>
    </form>
  );
}
