import { getTranslations } from "next-intl/server";
import { signOutAction } from "../server/actions";

export async function SignOutButton() {
  const t = await getTranslations("account");
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className="rounded-lg border border-border bg-surface px-4 py-3 text-base font-semibold text-foreground"
      >
        {t("signOut")}
      </button>
    </form>
  );
}
