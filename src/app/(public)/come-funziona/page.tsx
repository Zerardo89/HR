import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SCORE_WEIGHTS } from "@/modules/matching/domain";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("howItWorks");
  return { title: t("metaTitle"), alternates: { canonical: "/come-funziona" } };
}

const CRITERIA = Object.keys(SCORE_WEIGHTS) as (keyof typeof SCORE_WEIGHTS)[];

/** Trasparenza sull'ordinamento (R-DSA-06, R-PRIV-06): i pesi vengono dal codice, non da un testo da aggiornare. */
export default async function HowItWorksPage() {
  const t = await getTranslations("howItWorks");
  return (
    <main id="contenuto" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-bold leading-tight text-primary">{t("title")}</h1>
      <p className="text-lg">{t("intro")}</p>

      <section aria-labelledby="filtri" className="flex flex-col gap-2">
        <h2 id="filtri" className="text-xl font-semibold">
          {t("filtersTitle")}
        </h2>
        <p>{t("filters")}</p>
      </section>

      <section aria-labelledby="punteggio" className="flex flex-col gap-3">
        <h2 id="punteggio" className="text-xl font-semibold">
          {t("scoreTitle")}
        </h2>
        <p>{t("scoreIntro")}</p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-border">
                <th scope="col" className="py-2 pr-3">
                  {t("tableCriterion")}
                </th>
                <th scope="col" className="py-2 pr-3">
                  {t("tablePoints")}
                </th>
                <th scope="col" className="py-2">
                  {t("tableHow")}
                </th>
              </tr>
            </thead>
            <tbody>
              {CRITERIA.map((key) => (
                <tr key={key} className="border-b border-border align-top">
                  <th scope="row" className="py-2 pr-3 font-medium">
                    {t(`criteria.${key}.name`)}
                  </th>
                  <td className="py-2 pr-3">{SCORE_WEIGHTS[key]}</td>
                  <td className="py-2">{t(`criteria.${key}.how`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="stipendio" className="flex flex-col gap-2">
        <h2 id="stipendio" className="text-xl font-semibold">
          {t("salaryTitle")}
        </h2>
        <p>{t("salary")}</p>
      </section>

      <section aria-labelledby="mai" className="flex flex-col gap-2">
        <h2 id="mai" className="text-xl font-semibold">
          {t("neverTitle")}
        </h2>
        <p>{t("never")}</p>
      </section>

      <Link
        href="/offerte"
        className="self-start font-semibold text-primary underline underline-offset-4"
      >
        {t("backToSearch")}
      </Link>
    </main>
  );
}
