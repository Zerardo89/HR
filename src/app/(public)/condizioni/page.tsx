import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { DraftPage } from "@/app/_components/draft-page";
import { LegalDocument } from "@/app/_components/legal-document";
import { termsHistory, termsVersion } from "@/modules/trust/domain";

const day = new Intl.DateTimeFormat("it-IT", { dateStyle: "long", timeZone: "Europe/Rome" });
const date = (isoDay: string) => day.format(new Date(`${isoDay}T12:00:00Z`));

export async function generateMetadata({
  searchParams,
}: PageProps<"/condizioni">): Promise<Metadata> {
  const { versione } = await searchParams;
  const t = await getTranslations("legal.terms");
  // Le versioni precedenti restano leggibili ma non si indicizzano.
  return { title: t("title"), ...(versione ? { robots: { index: false } } : {}) };
}

/**
 * Condizioni d'uso (WP-024b, R-DSA-02, DSA art. 14): la versione in vigore, con regolamento degli annunci e
 * come moderiamo; le precedenti con `?versione=`, uguali a come sono state accettate.
 */
export default async function TermsPage({ searchParams }: PageProps<"/condizioni">) {
  const { versione } = await searchParams;
  const t = await getTranslations("legal.terms");
  const doc = (typeof versione === "string" && termsVersion(versione)) || termsVersion()!;
  return (
    <DraftPage title={t("title")} paragraphs={[]}>
      <p className="font-medium">
        {t(doc.current ? "currentVersion" : "oldVersion", { date: date(doc.publishedOn) })}
      </p>
      {!doc.current && (
        <Link
          href="/condizioni"
          className="font-semibold text-primary underline underline-offset-4"
        >
          {t("readCurrent")}
        </Link>
      )}
      <LegalDocument source={doc.text} />
      <section aria-labelledby="versioni" className="mt-6 flex flex-col gap-2">
        <h2 id="versioni" className="text-xl font-semibold">
          {t("historyTitle")}
        </h2>
        <ul className="flex list-disc flex-col gap-1 pl-6">
          {termsHistory().map((v) => (
            <li key={v.id}>
              {v.current ? (
                t("historyCurrent", { date: date(v.publishedOn) })
              ) : (
                <Link
                  href={`/condizioni?versione=${v.id}`}
                  className="text-primary underline underline-offset-4"
                >
                  {t("historyItem", { date: date(v.publishedOn) })}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>
    </DraftPage>
  );
}
