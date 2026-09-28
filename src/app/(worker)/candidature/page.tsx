import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getMyApplications, withdrawAction } from "@/modules/applications";
import { canWorkerWithdraw } from "@/modules/applications/domain";
import { requireUser } from "@/modules/identity";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("applications.mine");
  return { title: t("metaTitle"), robots: { index: false } };
}

const day = new Intl.DateTimeFormat("it-IT", { dateStyle: "long", timeZone: "Europe/Rome" });
const OUTCOMES = ["withdrawn", "not_found", "not_allowed"] as const;

/** "Le mie candidature" (WP-019): lo stato "vista" riduce l'ansia da silenzio (docs/01 §7.1). */
export default async function MyApplicationsPage({ searchParams }: PageProps<"/candidature">) {
  const user = await requireUser(["worker"]);
  const [{ esito }, list, t, ts] = await Promise.all([
    searchParams,
    getMyApplications(user.id),
    getTranslations("applications.mine"),
    getTranslations("applications.status"),
  ]);
  const outcome = OUTCOMES.find((o) => o === esito);

  return (
    <main id="contenuto" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-bold leading-tight text-primary">{t("title")}</h1>
      {outcome && (
        <p role="status" className="rounded-lg border border-primary bg-surface px-4 py-3">
          {t(`outcome.${outcome}`)}
        </p>
      )}
      {list.length === 0 ? (
        <p>{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {list.map((a) => (
            <li key={a.id}>
              <article
                aria-labelledby={`cand-${a.id}`}
                className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-5"
              >
                <h2 id={`cand-${a.id}`} className="text-xl font-semibold">
                  <Link
                    href={`/offerte/${a.offerId}`}
                    className="text-primary underline underline-offset-4"
                  >
                    {a.offerTitle}
                  </Link>
                </h2>
                <p>
                  {a.companyName} · {a.municipality}
                </p>
                <p className="text-sm text-muted">
                  {t("sentOn", { date: day.format(a.createdAt) })}
                </p>
                <p className="font-semibold">
                  {ts(a.status)}
                  {a.viewedAt && ` · ${t("viewedOn", { date: day.format(a.viewedAt) })}`}
                </p>
                {canWorkerWithdraw(a.status) && (
                  <form action={withdrawAction}>
                    <input type="hidden" name="applicationId" value={a.id} />
                    <button
                      type="submit"
                      className="text-sm font-medium text-primary underline underline-offset-4"
                    >
                      {t("withdraw")}
                    </button>
                  </form>
                )}
              </article>
            </li>
          ))}
        </ul>
      )}
      <Link href="/offerte" className="self-start text-primary underline underline-offset-4">
        {t("search")}
      </Link>
    </main>
  );
}
