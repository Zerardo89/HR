"use client";

import { useTranslations } from "next-intl";
import { useActionState, useId } from "react";
import { inviteAction, type InviteFormState } from "../server/team-actions";

/** Invito a un collega: solo l'email, che serve per spedire il link e non si conserva. */
export function InviteForm({ companyId }: { companyId: string }) {
  const t = useTranslations("company.team");
  const [state, action, pending] = useActionState<InviteFormState, FormData>(inviteAction, {
    status: "idle",
  });
  const errorId = useId();
  const error = state.status === "error" ? state : null;

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="companyId" value={companyId} />
      <label className="flex flex-col gap-2 text-base font-medium">
        {t("emailLabel")}
        <input
          name="email"
          type="email"
          required
          maxLength={254}
          autoComplete="off"
          defaultValue={error?.email}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className="w-full rounded-lg border border-border bg-surface px-3 py-3 text-lg text-foreground"
        />
        <span className="text-sm font-normal text-muted">{t("emailHelp")}</span>
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
        {pending ? t("pending") : t("send")}
      </button>
    </form>
  );
}
