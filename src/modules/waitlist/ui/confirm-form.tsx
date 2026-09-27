"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { confirmWaitlistAction, type ConfirmState } from "../server/actions";

/** Pagina aperta dal link nell'email: si conferma solo premendo il pulsante (R-MAIL-02). */
export function ConfirmForm({ token }: { token: string }) {
  const t = useTranslations("waitlist.confirm");
  const [state, action, pending] = useActionState<ConfirmState, FormData>(confirmWaitlistAction, {
    status: "idle",
  });

  if (state.status !== "idle") {
    return (
      <p role="status" className="rounded-lg border border-primary bg-surface px-4 py-3 text-lg">
        {t(state.status)}
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <p>{t("intro")}</p>
      <input type="hidden" name="token" value={token} />
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-primary px-4 py-3 text-lg font-semibold text-primary-foreground disabled:opacity-60"
      >
        {pending ? t("pending") : t("button")}
      </button>
    </form>
  );
}
