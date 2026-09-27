import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCompaniesForUser } from "@/modules/companies";
import { requireUser } from "@/modules/identity";
import { getOfferContext, OfferForm } from "@/modules/offers";
import { getOccupationCatalog, OccupationPicker } from "@/modules/taxonomy";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("offers");
  return { title: t("newTitle"), robots: { index: false } };
}

/** Nuova offerta (WP-013). `?azienda=<id>` se l'utente gestisce più aziende; altrimenti la sua. */
export default async function NewOfferPage({ searchParams }: PageProps<"/azienda/offerte/nuova">) {
  const user = await requireUser(["company_member"]);
  const { azienda } = await searchParams;
  const companies = await getCompaniesForUser(user.id);
  const companyId = typeof azienda === "string" ? azienda : companies[0]?.id;
  if (!companyId) redirect("/azienda");
  const ctx = await getOfferContext(user.id, companyId);
  if (!ctx) redirect("/azienda");
  const t = await getTranslations("offers");

  return (
    <main id="contenuto" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-bold leading-tight text-primary">{t("newTitle")}</h1>
      <p className="text-muted">{ctx.displayName}</p>
      {ctx.sites.length === 0 ? (
        <div className="flex flex-col gap-3">
          <p role="status">{t("noSites")}</p>
          <Link href="/azienda" className="font-semibold text-primary underline underline-offset-4">
            {t("backToCompany")}
          </Link>
        </div>
      ) : (
        <OfferForm
          nowIso={new Date().toISOString()}
          companyId={ctx.companyId}
          company={ctx.validatorCompany}
          sites={ctx.sites}
          occupationField={
            <OccupationPicker
              entries={(await getOccupationCatalog()).entries}
              name="occupationId"
            />
          }
        />
      )}
    </main>
  );
}
