import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/modules/identity";
import {
  closeOfferAction,
  getOfferContext,
  getOfferForEdit,
  OfferForm,
  renewOfferAction,
} from "@/modules/offers";
import {
  canRenewOffer,
  RENEWAL_DAYS,
  RENEWAL_WINDOW_DAYS,
  renewableFrom,
} from "@/modules/offers/domain";
import { getOccupationCatalog, OccupationPicker } from "@/modules/taxonomy";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("offers");
  return { title: t("editTitle"), robots: { index: false } };
}

const day = new Intl.DateTimeFormat("it-IT", { dateStyle: "long", timeZone: "Europe/Rome" });
const OUTCOMES = [
  "draft",
  "pending_review",
  "published",
  "closed",
  "renewed",
  "not_allowed",
  "not_found",
] as const;

/**
 * Offerta dell'azienda: esito dell'ultima azione, stato, modifica se è ancora bozza o in moderazione;
 * se è pubblicata, scadenza, rinnovo (negli ultimi 7 giorni) e chiusura (WP-022).
 */
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
  const outcome = OUTCOMES.find((o) => o === esito) ?? null;
  const now = new Date();
  const expiry = offer.validThrough ? day.format(offer.validThrough) : "";

  return (
    <main id="contenuto" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-bold leading-tight text-primary">{offer.values.title}</h1>
      {outcome && (
        <p role="status" className="rounded-lg border border-primary bg-surface px-4 py-3 text-lg">
          {t(`outcome.${outcome}`, { date: expiry })}
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
      {offer.status === "published" && offer.validThrough && (
        <OfferLifecycle
          offerId={offer.id}
          expiry={expiry}
          renewable={canRenewOffer(offer.storedStatus, offer.validThrough, now)}
          renewableFrom={day.format(renewableFrom(offer.validThrough))}
        />
      )}
      {(offer.status === "expired" || offer.status === "closed") && (
        <div role="note" className="flex flex-col gap-2 rounded-lg border border-border px-4 py-3">
          <p>
            {offer.status === "expired"
              ? t("lifecycle.expiredNote", { date: expiry })
              : t("lifecycle.closedNote")}
          </p>
          <Link
            href="/azienda/offerte/nuova"
            className="self-start font-semibold text-primary underline underline-offset-4"
          >
            {t("lifecycle.newOffer")}
          </Link>
        </div>
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

async function OfferLifecycle({
  offerId,
  expiry,
  renewable,
  renewableFrom,
}: {
  offerId: string;
  expiry: string;
  renewable: boolean;
  renewableFrom: string;
}) {
  const t = await getTranslations("offers.lifecycle");
  const button = "self-start rounded-lg px-4 py-3 font-semibold";
  return (
    <>
      <p className="text-lg">{t("expiresOn", { date: expiry })}</p>
      <section
        aria-labelledby="rinnovo"
        className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5"
      >
        <h2 id="rinnovo" className="text-xl font-semibold">
          {t("renewTitle")}
        </h2>
        {renewable ? (
          <form action={renewOfferAction} className="flex flex-col gap-3">
            <p>{t("renewHelp")}</p>
            <input type="hidden" name="offerId" value={offerId} />
            <label className="flex flex-col gap-1 font-medium">
              {t("renewDays")}
              <select
                name="days"
                defaultValue="30"
                className="rounded-lg border border-border bg-surface px-3 py-3 text-lg text-foreground"
              >
                {RENEWAL_DAYS.map((d) => (
                  <option key={d} value={d}>
                    {t("renewOption", { days: String(d) })}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className={`${button} bg-primary text-primary-foreground`}>
              {t("renew")}
            </button>
          </form>
        ) : (
          <p className="text-muted">
            {t("renewableFrom", { date: renewableFrom, days: String(RENEWAL_WINDOW_DAYS) })}
          </p>
        )}
      </section>
      <section
        aria-labelledby="chiusura"
        className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5"
      >
        <h2 id="chiusura" className="text-xl font-semibold">
          {t("closeTitle")}
        </h2>
        <form action={closeOfferAction} className="flex flex-col gap-3">
          <p>{t("closeHelp")}</p>
          <input type="hidden" name="offerId" value={offerId} />
          <button type="submit" className={`${button} border border-accent`}>
            {t("close")}
          </button>
        </form>
      </section>
    </>
  );
}
