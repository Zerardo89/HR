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
import { decideReportAction, getOpenReports, type OpenReportGroup } from "@/modules/trust";
import { FACTS_MAX, FACTS_MIN, REPORT_GROUNDS } from "@/modules/trust/domain";

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
  "report_removed",
  "report_suspended",
  "report_dismissed",
  "report_not_found",
  "report_not_allowed",
  "report_invalid",
] as const;

const button = "rounded-lg px-4 py-3 font-semibold";
const field =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-base text-foreground";

const day = new Intl.DateTimeFormat("it-IT", { dateStyle: "long", timeZone: "Europe/Rome" });

/**
 * Pannello del moderatore (WP-013b): segnalazioni (WP-024a), offerte in moderazione, aziende da verificare, sedi.
 * Solo dati pubblici delle aziende e degli annunci e i testi delle segnalazioni: nessun dato personale dei
 * lavoratori né l'identità di chi ha segnalato (docs/04 §5).
 */
export default async function ModerationPage({ searchParams }: PageProps<"/moderazione">) {
  await requireUser(["moderator", "admin"]);
  const { esito } = await searchParams;
  const t = await getTranslations("moderation");
  const ti = await getTranslations("offers.issues");
  const [reports, offers, companies, sites] = await Promise.all([
    getOpenReports(),
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

      <ReportsSection reports={reports} />

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

/** Segnalazioni (WP-024a): per bersaglio, dalla più vecchia; togliere o sospendere chiede fondamento e fatti. */
async function ReportsSection({ reports }: { reports: OpenReportGroup[] }) {
  const t = await getTranslations("moderation.reports");
  const tr = await getTranslations("trust.reasons");
  const tg = await getTranslations("trust.groundLabels");
  return (
    <section
      id="segnalazioni"
      aria-labelledby="segnalazioni-titolo"
      className="flex flex-col gap-4"
    >
      <h2 id="segnalazioni-titolo" className="text-2xl font-semibold">
        {t("title", { count: reports.length })}
      </h2>
      {reports.length === 0 && <p className="text-muted">{t("empty")}</p>}
      {reports.map((r) => (
        <article
          key={`${r.targetType}-${r.targetId}`}
          aria-label={`${t(r.targetType)}: ${r.title}`}
          className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5"
        >
          <p className="text-sm font-semibold uppercase text-muted">{t(r.targetType)}</p>
          <h3 className="text-xl font-semibold">
            {r.targetType === "offer" && r.status === "published" ? (
              <a href={`/offerte/${r.targetId}`} className="underline underline-offset-4">
                {r.title}
              </a>
            ) : (
              r.title
            )}
          </h3>
          {r.offer && (
            <p className="text-muted">
              {r.company} · {r.offer.municipality}
            </p>
          )}
          {r.companyInfo && (
            <p className="text-muted">
              {t("companyInfo", {
                legalName: r.companyInfo.legalName,
                vat: r.companyInfo.vatNumber,
                published: String(r.companyInfo.publishedOffers),
              })}
            </p>
          )}
          <p className="text-sm">{t("targetStatus", { status: t(`statuses.${r.status}`) })}</p>
          <p className="font-medium">
            {t("count", { count: r.count, date: day.format(r.firstAt) })}
          </p>
          {r.offer && <p className="whitespace-pre-line text-sm">{r.offer.description}</p>}
          <div>
            <p className="text-sm font-medium">{t("reasonsLabel")}</p>
            <ul className="list-disc pl-5 text-sm">
              {r.reasons.map((x) => (
                <li key={x.reason}>
                  {tr(x.reason)} ({x.count})
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium">{t("detailsLabel")}</p>
            {r.details.length === 0 ? (
              <p className="text-sm text-muted">{t("noDetails")}</p>
            ) : (
              <ul className="list-disc pl-5 text-sm">
                {r.details.map((d, n) => (
                  <li key={n} className="whitespace-pre-line">
                    {d}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <form action={decideReportAction} className="flex flex-1 flex-col gap-2">
              <input type="hidden" name="targetType" value={r.targetType} />
              <input type="hidden" name="targetId" value={r.targetId} />
              <label className="flex flex-col gap-1 text-sm font-medium">
                {t("ground")}
                <select name="ground" required className={field}>
                  {REPORT_GROUNDS.map((g) => (
                    <option key={g} value={g}>
                      {tg(g)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                {t("facts")}
                <textarea
                  name="facts"
                  required
                  minLength={FACTS_MIN}
                  maxLength={FACTS_MAX}
                  rows={3}
                  className={field}
                />
              </label>
              <button
                type="submit"
                name="decision"
                value="act"
                className={`${button} border border-accent`}
              >
                {t(r.targetType === "offer" ? "removeOffer" : "suspendCompany")}
              </button>
            </form>
            <form action={decideReportAction}>
              <input type="hidden" name="targetType" value={r.targetType} />
              <input type="hidden" name="targetId" value={r.targetId} />
              <button
                type="submit"
                name="decision"
                value="dismiss"
                className={`${button} bg-primary text-primary-foreground`}
              >
                {t("dismiss")}
              </button>
            </form>
          </div>
        </article>
      ))}
    </section>
  );
}
