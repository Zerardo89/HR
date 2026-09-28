import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/modules/identity";
import { getOfferContext, getOfferForEdit, OfferForm } from "@/modules/offers";
import { getOccupationCatalog, OccupationPicker } from "@/modules/taxonomy";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("offers");
  return { title: t("editTitle"), robots: { index: false } };
}

/** Offerta dell'azienda: esito dell'ultimo salvataggio, stato, modifica se è ancora bozza o in moderazione. */
export default async function OfferPage({
  params,
  searchParams,
}: PageProps<"/azienda/offerte/[id]">) {
  const user = await requireUser(["company_member"]);
  const { id } = await params;
  const { esito } = await searchParams;
  const offer = /^[0-9a-f-]{36}$/.test(id) ? await getOfferForEdit(user.id, id) : null;
  if (!offer) notFound();
  const ctx = await getOfferContext(user.id, offer.companyId);
  if (!ctx) notFound();
  const t = await getTranslations("offers");
  const editable = offer.status === "draft" || offer.status === "pending_review";
  const outcome =
    esito === "draft" || esito === "pending_review" || esito === "published" ? esito : null;

  return (
    <main id="contenuto" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-bold leading-tight text-primary">{offer.values.title}</h1>
      {outcome && (
        <p role="status" className="rounded-lg border border-primary bg-surface px-4 py-3 text-lg">
          {t(`outcome.${outcome}`)}
        </p>
      )}
      <p>
        {t("statusLabel")}: <strong>{t(`status.${offer.status}`)}</strong>
      </p>
      {offer.status === "published" && (
        <Link
          href={`/offerte/${offer.id}`}
          className="self-start font-semibold text-primary underline underline-offset-4"
        >
          {t("viewPublic")}
        </Link>
      )}
      {offer.status !== "draft" && offer.status !== "pending_review" && (
        <Link
          href={`/azienda/candidature?offerta=${offer.id}`}
          className="self-start rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground"
        >
          {t("applicationsLink")}
        </Link>
      )}
      {offer.rejection && (
        <div role="note" className="flex flex-col gap-1 rounded-lg border border-accent px-4 py-3">
          <p className="font-semibold">{t("rejected")}</p>
          <p>{t(`rejectionReasons.${offer.rejection.reason}`)}</p>
          {offer.rejection.note && <p className="whitespace-pre-line">{offer.rejection.note}</p>}
        </div>
      )}
      {editable ? (
        <OfferForm
          nowIso={new Date().toISOString()}
          companyId={ctx.companyId}
          company={ctx.validatorCompany}
          sites={ctx.sites}
          offerId={offer.id}
          initial={offer.values}
          occupationField={
            <OccupationPicker
              entries={(await getOccupationCatalog()).entries}
              name="occupationId"
              defaultId={Number(offer.values.occupationId)}
            />
          }
        />
      ) : (
        <p className="text-muted">{t("notEditable")}</p>
      )}
      <Link href="/azienda" className="font-semibold text-primary underline underline-offset-4">
        {t("backToCompany")}
      </Link>
    </main>
  );
}
