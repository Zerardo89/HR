import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getDb } from "@/lib/db";
import { getCurrentUser } from "@/modules/identity";
import { termsOutdated } from "../domain/terms";
import { acceptTermsAction } from "../server/actions";
import { acceptedTermsVersion } from "../server/terms";

/**
 * Condizioni d'uso cambiate dopo l'ultima accettazione (WP-024b, DSA art. 14.2): avviso con il link al testo
 * e il pulsante "Accetto". Solo per chi ha fatto l'accesso; non blocca la navigazione.
 */
export async function TermsUpdateBanner() {
  const user = await getCurrentUser();
  if (!user || !termsOutdated(await acceptedTermsVersion(getDb(), user.id))) return null;
  const t = await getTranslations("trust.termsBanner");
  return (
    <section aria-label={t("label")} className="border-b border-accent bg-surface px-4 py-3">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p>
          {t("text")}{" "}
          <Link
            href="/condizioni"
            className="font-semibold text-primary underline underline-offset-4"
          >
            {t("read")}
          </Link>
        </p>
        <form action={acceptTermsAction}>
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground"
          >
            {t("accept")}
          </button>
        </form>
      </div>
    </section>
  );
}
