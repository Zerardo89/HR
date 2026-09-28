import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { checkUnsubscribeLink, unsubscribeAction } from "@/modules/notifications";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("alerts.unsubscribe");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

/**
 * Disiscrizione dagli avvisi dal link dell'email (WP-020). Aprire la pagina non cambia nulla (R-MAIL-02: i
 * programmi di posta e gli antivirus aprono i link da soli); si conferma con il pulsante. Il POST "un clic" del
 * programma di posta (RFC 8058) va invece a `/api/avvisi/disiscrizione`.
 */
export default async function UnsubscribePage({
  searchParams,
}: PageProps<"/avvisi/disiscrizione">) {
  const { token, esito } = await searchParams;
  const t = await getTranslations("alerts.unsubscribe");
  const state =
    esito === "done" || esito === "invalid"
      ? esito
      : await checkUnsubscribeLink(typeof token === "string" ? token : undefined);

  return (
    <main id="contenuto" className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-bold leading-tight text-primary">{t("title")}</h1>
      {state === "valid" ? (
        <form action={unsubscribeAction} className="flex flex-col gap-4">
          <p>{t("body")}</p>
          <input type="hidden" name="token" value={String(token)} />
          <button
            type="submit"
            className="self-start rounded-lg bg-primary px-4 py-3 text-lg font-semibold text-primary-foreground"
          >
            {t("submit")}
          </button>
        </form>
      ) : (
        <p role="status" className="rounded-lg border border-primary bg-surface px-4 py-3">
          {t(state)}
        </p>
      )}
      <Link href="/avvisi" className="self-start text-primary underline underline-offset-4">
        {t("manage")}
      </Link>
    </main>
  );
}
