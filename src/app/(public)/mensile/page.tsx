import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { checkMonthlyLink, monthlyAnswerAction } from "@/modules/notifications";
import { MONTHLY_CHOICES, monthlyAction } from "@/modules/notifications/domain";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("monthly");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

const OUTCOMES = ["done", "used", "invalid", "no_profile"] as const;
const link = "font-semibold text-primary underline underline-offset-4";

/**
 * Conferma della risposta alla mail mensile (WP-021). Aprire il link non cambia nulla (R-MAIL-02: programmi di
 * posta e antivirus aprono i link da soli): la risposta vale solo col pulsante. Il token è nell'indirizzo, non
 * dati personali; la pagina non dice di chi è il profilo.
 */
export default async function MonthlyPage({ searchParams }: PageProps<"/mensile">) {
  const { token, scelta, esito } = await searchParams;
  const t = await getTranslations("monthly");
  const action = monthlyAction(scelta);
  const outcome = OUTCOMES.find((o) => o === esito);

  let body;
  if (outcome === "done" && action) {
    body = (
      <p role="status" className="rounded-lg border border-primary bg-surface px-4 py-3 text-lg">
        {t(`done.${action}`)}
      </p>
    );
  } else if (outcome) {
    body = (
      <p role="status" className="rounded-lg border border-primary bg-surface px-4 py-3">
        {t(outcome === "used" ? "used" : "invalid")}
      </p>
    );
  } else {
    const state = await checkMonthlyLink(typeof token === "string" ? token : undefined);
    if (state === "invalid" || (state === "used" && action !== "stop")) {
      body = (
        <p role="status" className="rounded-lg border border-primary bg-surface px-4 py-3">
          {t(state)}
        </p>
      );
    } else if (!action) {
      body = (
        <nav aria-label={t("choose")} className="flex flex-col gap-2">
          <p>{t("choose")}</p>
          {(Object.keys(MONTHLY_CHOICES) as (keyof typeof MONTHLY_CHOICES)[]).map((c) => (
            <Link key={c} href={`/mensile?token=${String(token)}&scelta=${c}`} className={link}>
              {t(`confirm.${MONTHLY_CHOICES[c]}`)}
            </Link>
          ))}
        </nav>
      );
    } else {
      body = (
        <form action={monthlyAnswerAction} className="flex flex-col gap-4">
          <h2 className="text-2xl font-semibold">{t(`questions.${action}`)}</h2>
          <p>{t(`explain.${action}`)}</p>
          <input type="hidden" name="token" value={String(token)} />
          <input type="hidden" name="action" value={action} />
          <button
            type="submit"
            className={`self-start rounded-lg px-4 py-3 text-lg font-semibold ${
              action === "delete" ? "border border-accent" : "bg-primary text-primary-foreground"
            }`}
          >
            {t(`confirm.${action}`)}
          </button>
        </form>
      );
    }
  }

  return (
    <main id="contenuto" className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-bold leading-tight text-primary">{t("metaTitle")}</h1>
      {body}
      <div className="flex flex-wrap gap-4">
        <Link href="/profilo" className={link}>
          {t("profile")}
        </Link>
        <Link href="/offerte" className={link}>
          {t("search")}
        </Link>
      </div>
    </main>
  );
}
