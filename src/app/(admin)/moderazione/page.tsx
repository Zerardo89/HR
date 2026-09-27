import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  decideSiteAction,
  listCompaniesToVerify,
  listSitesToApprove,
  verifyCompanyAction,
} from "@/modules/companies";
import { SITE_REJECTION_REASONS } from "@/modules/companies/domain";
import { requireUser } from "@/modules/identity";
import { decideOfferAction, listOffersToModerate } from "@/modules/offers";
import { REJECTION_REASONS } from "@/modules/offers/domain";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("moderation");
  return { title: t("metaTitle"), robots: { index: false } };
}

const OUTCOMES = [
  "approved",
  "rejected",
  "not_found",
  "not_allowed",
  "company_not_verified",
  "invalid",
  "company_verified",
  "company_not_found",
  "company_not_allowed",
  "site_approved",
  "site_rejected",
  "site_not_found",
  "site_not_allowed",
] as const;

const button = "rounded-lg px-4 py-3 font-semibold";
const field =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-base text-foreground";

/**
 * Pannello del moderatore (WP-013b): offerte in moderazione e aziende da verificare.
 * Solo dati pubblici delle aziende e degli annunci: nessun dato personale dei lavoratori (docs/04 §5).
 */
export default async function ModerationPage({ searchParams }: PageProps<"/moderazione">) {
  await requireUser(["moderator", "admin"]);
  const { esito } = await searchParams;
  const t = await getTranslations("moderation");
  const ti = await getTranslations("offers.issues");
  const [offers, companies, sites] = await Promise.all([
    listOffersToModerate(),
    listCompaniesToVerify(),
    listSitesToApprove(),
  ]);
  const outcome = OUTCOMES.find((o) => o === esito);

  return (
    <main id="contenuto" className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 py-10">
      <h1 className="text-3xl font-bold leading-tight text-primary">{t("title")}</h1>
      {outcome && (
        <p role="status" className="rounded-lg border border-primary bg-surface px-4 py-3">
          {t(`outcome.${outcome}`)}
        </p>
      )}

      <section aria-labelledby="offerte-da-moderare" className="flex flex-col gap-4">
        <h2 id="offerte-da-moderare" className="text-2xl font-semibold">
          {t("offersTitle", { count: offers.length })}
        </h2>
        {offers.length === 0 && <p className="text-muted">{t("offersEmpty")}</p>}
        {offers.map((o) => (
          <article
            key={o.id}
            aria-label={o.title}
            className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5"
          >
            <h3 className="text-xl font-semibold">{o.title}</h3>
            <p className="text-muted">
              {o.companyName} · {o.municipality} · {o.salary ?? t("noSalary")}
            </p>
            <p className="whitespace-pre-line">{o.description}</p>
            {o.issues.length > 0 && (
              <ul className="list-disc pl-5 text-sm">
                {o.issues.map((i, n) => (
                  <li key={`${i.code}-${n}`}>{ti(i.code)}</li>
                ))}
              </ul>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <form action={decideOfferAction}>
                <input type="hidden" name="offerId" value={o.id} />
                <button
                  type="submit"
                  name="decision"
                  value="approve"
                  className={`${button} bg-primary text-primary-foreground`}
                >
                  {t("approve")}
                </button>
              </form>
              <form action={decideOfferAction} className="flex flex-1 flex-col gap-2">
                <input type="hidden" name="offerId" value={o.id} />
                <label className="flex flex-col gap-1 text-sm font-medium">
                  {t("reason")}
                  <select name="reason" required className={field}>
                    {REJECTION_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {t(`reasons.${r}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-sm font-medium">
                  {t("note")}
                  <textarea name="note" maxLength={500} rows={2} className={field} />
                </label>
                <button
                  type="submit"
                  name="decision"
                  value="reject"
                  className={`${button} border border-accent`}
                >
                  {t("reject")}
                </button>
              </form>
            </div>
          </article>
        ))}
      </section>

      <section aria-labelledby="aziende-da-verificare" className="flex flex-col gap-4">
        <h2 id="aziende-da-verificare" className="text-2xl font-semibold">
          {t("companiesTitle", { count: companies.length })}
        </h2>
        {companies.length === 0 && <p className="text-muted">{t("companiesEmpty")}</p>}
        {companies.map((c) => (
          <article
            key={c.id}
            aria-label={c.displayName}
            className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-5"
          >
            <h3 className="text-xl font-semibold">{c.displayName}</h3>
            <p>
              {c.legalName} · P.IVA {c.vatNumber} · {t(`kinds.${c.kind}`)}
            </p>
            {c.agencyAuthorization && <p>{t("authorization", { value: c.agencyAuthorization })}</p>}
            <p className="text-sm text-muted">{t("vies", { status: c.viesStatus ?? "—" })}</p>
            <p className="text-sm text-muted">
              {t(c.kind === "agency" ? "checkAgency" : "checkVat")}
            </p>
            <form action={verifyCompanyAction}>
              <input type="hidden" name="companyId" value={c.id} />
              <button type="submit" className={`${button} bg-primary text-primary-foreground`}>
                {t("verify")}
              </button>
            </form>
          </article>
        ))}
      </section>

      <section aria-labelledby="sedi-da-approvare" className="flex flex-col gap-4">
        <h2 id="sedi-da-approvare" className="text-2xl font-semibold">
          {t("sitesTitle", { count: sites.length })}
        </h2>
        {sites.length === 0 && <p className="text-muted">{t("sitesEmpty")}</p>}
        {sites.map((s) => (
          <article
            key={s.id}
            aria-label={`${s.companyName} · ${s.label}`}
            className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-5"
          >
            <h3 className="text-xl font-semibold">
              {s.companyName} · {s.label}
            </h3>
            <p>
              {s.municipality} ({s.provinceAbbr})
            </p>
            <p className="text-sm text-muted">
              {s.legalSeat
                ? t("siteDistance", {
                    km: String(s.distanceFromLegalSeatKm ?? 0),
                    seat: s.legalSeat,
                    region: t(s.sameRegionAsLegalSeat ? "siteSameRegion" : "siteOtherRegion"),
                  })
                : t("siteNoLegalSeat")}
            </p>
            {s.pendingSitesOfCompany > 3 && (
              <p className="text-sm font-medium">
                {t("siteManyPending", { count: s.pendingSitesOfCompany })}
              </p>
            )}
            <p className="text-sm text-muted">{t("siteCheck")}</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <form action={decideSiteAction}>
                <input type="hidden" name="siteId" value={s.id} />
                <button
                  type="submit"
                  name="decision"
                  value="approve"
                  className={`${button} bg-primary text-primary-foreground`}
                >
                  {t("siteApprove")}
                </button>
              </form>
              <form action={decideSiteAction} className="flex flex-1 flex-col gap-2">
                <input type="hidden" name="siteId" value={s.id} />
                <label className="flex flex-col gap-1 text-sm font-medium">
                  {t("reason")}
                  <select name="reason" required className={field}>
                    {SITE_REJECTION_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {t(`siteReasons.${r}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  name="decision"
                  value="reject"
                  className={`${button} border border-accent`}
                >
                  {t("siteReject")}
                </button>
              </form>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
