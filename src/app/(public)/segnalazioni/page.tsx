import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getCurrentUser } from "@/modules/identity";
import { getPublishedOffer } from "@/modules/offers";
import { ReportForm } from "@/modules/trust";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export async function generateMetadata({
  searchParams,
}: PageProps<"/segnalazioni">): Promise<Metadata> {
  const { offerta } = await searchParams;
  const t = await getTranslations("trust.form");
  // La pagina con il modulo di una singola offerta non serve ai motori di ricerca.
  return { title: t("metaTitle"), ...(offerta ? { robots: { index: false } } : {}) };
}

/**
 * Segnalazioni (WP-024a, DSA art. 16, R-DSA-03): dal link "Segnala" di ogni offerta pubblicata, anche senza
 * account. Senza offerta la pagina spiega come segnalare.
 */
export default async function ReportPage({ searchParams }: PageProps<"/segnalazioni">) {
  const { offerta } = await searchParams;
  const t = await getTranslations("trust.form");
  const result =
    typeof offerta === "string" && UUID.test(offerta) ? await getPublishedOffer(offerta) : null;
  const offer = result?.state === "live" ? result.offer : null;
  const user = offer ? await getCurrentUser() : null;

  return (
    <main id="contenuto" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-10">
      <h1 className="text-3xl font-bold leading-tight text-primary">{t("title")}</h1>
      <p>{t("intro")}</p>
      {!offerta && <p>{t("howTo")}</p>}
      {offerta && !offer && (
        <p role="status" className="rounded-lg border border-accent px-4 py-3">
          {t("offerNotFound")}
        </p>
      )}
      {offer && (
        <>
          <p className="text-lg font-semibold">
            {t("about", { title: offer.title, company: offer.companyName })}
          </p>
          {user ? (
            <p className="text-muted">{t("signedIn")}</p>
          ) : (
            <p className="text-muted">
              {t("anonymous")}{" "}
              <Link
                href="/accedi"
                className="font-semibold text-primary underline underline-offset-4"
              >
                {t("signIn")}
              </Link>
            </p>
          )}
          <ReportForm offerId={offer.id} company={offer.companyName} />
        </>
      )}
      <p className="text-sm text-muted">{t("safety")}</p>
    </main>
  );
}
