import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { findOffers, type SearchPlace } from "@/modules/matching";
import {
  parseSearchParams,
  PUBLISHED_WITHIN_DAYS,
  SEARCH_RADII_KM,
  toSearchParams,
  type RankedOffer,
  type Reason,
  type SearchQuery,
} from "@/modules/matching/domain";
import { CONTRACT_TYPES, formatSalary, SCHEDULE_TYPES } from "@/modules/offers/domain";

export async function generateMetadata({ searchParams }: PageProps<"/offerte">): Promise<Metadata> {
  const t = await getTranslations("search");
  const hasParams = Object.keys(await searchParams).length > 0;
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
    alternates: { canonical: "/offerte" },
    // Le pagine dei risultati con filtri non vanno nei motori di ricerca (contenuto duplicato).
    robots: hasParams ? { index: false, follow: true } : undefined,
  };
}

const field = "w-full rounded-lg border border-border bg-surface px-3 py-3 text-lg text-foreground";

/** Ricerca delle offerte (WP-015): modulo GET (funziona senza JavaScript), risultati con "perché la vedi". */
export default async function SearchPage({ searchParams }: PageProps<"/offerte">) {
  const query = parseSearchParams(await searchParams);
  const t = await getTranslations("search");
  const tf = await getTranslations("offers.form");
  const hasFilters =
    query.contractTypes.length > 0 ||
    query.schedules.length > 0 ||
    Boolean(query.minMonthlySalary) ||
    Boolean(query.publishedWithinDays);
  const outcome = await findOffers(query);

  return (
    <main id="contenuto" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-bold leading-tight text-primary">{t("title")}</h1>

      <form
        action="/offerte#risultati"
        method="get"
        role="search"
        className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-5"
      >
        <label className="flex flex-col gap-1 text-base font-medium">
          {t("whatLabel")}
          <input
            name="q"
            type="search"
            defaultValue={query.q}
            maxLength={80}
            autoComplete="off"
            aria-describedby="cosa-aiuto"
            className={field}
          />
          <span id="cosa-aiuto" className="text-sm font-normal text-muted">
            {t("whatHelp")}
          </span>
        </label>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr]">
          <label className="flex flex-col gap-1 text-base font-medium">
            {t("whereLabel")}
            <input
              name="dove"
              defaultValue={query.dove}
              maxLength={80}
              autoComplete="address-level2"
              aria-describedby="dove-aiuto"
              className={field}
            />
            <span id="dove-aiuto" className="text-sm font-normal text-muted">
              {t("whereHelp")}
            </span>
          </label>
          <label className="flex flex-col gap-1 text-base font-medium">
            {t("radiusLabel")}
            <select
              name="raggio"
              defaultValue={String(query.radiusKm)}
              aria-describedby="raggio-aiuto"
              className={field}
            >
              {SEARCH_RADII_KM.map((km) => (
                <option key={km} value={km}>
                  {t("radiusOption", { km: String(km) })}
                </option>
              ))}
            </select>
            <span id="raggio-aiuto" className="text-sm font-normal text-muted">
              {t("radiusHelp")}
            </span>
          </label>
        </div>

        <details open={hasFilters} className="rounded-lg border border-border px-4 py-3">
          <summary className="cursor-pointer text-base font-semibold">{t("moreFilters")}</summary>
          <div className="mt-4 flex flex-col gap-5">
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 font-medium">{t("contractLegend")}</legend>
              {CONTRACT_TYPES.map((c) => (
                <label key={c} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="contratto"
                    value={c}
                    defaultChecked={query.contractTypes.includes(c)}
                    className="size-5"
                  />
                  {tf(`contracts.${c}`)}
                </label>
              ))}
            </fieldset>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-1 font-medium">{t("scheduleLegend")}</legend>
              {SCHEDULE_TYPES.map((s) => (
                <label key={s} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="orario"
                    value={s}
                    defaultChecked={query.schedules.includes(s)}
                    className="size-5"
                  />
                  {tf(`schedules.${s}`)}
                </label>
              ))}
            </fieldset>
            <label className="flex flex-col gap-1 font-medium">
              {t("salaryLabel")}
              <input
                name="stipendio"
                type="number"
                inputMode="numeric"
                min={1}
                max={100000}
                step={1}
                defaultValue={query.minMonthlySalary}
                aria-describedby="stipendio-aiuto"
                className={field}
              />
              <span id="stipendio-aiuto" className="text-sm font-normal text-muted">
                {t("salaryHelp")}
              </span>
            </label>
            <label className="flex flex-col gap-1 font-medium">
              {t("publishedLabel")}
              <select
                name="giorni"
                defaultValue={query.publishedWithinDays ? String(query.publishedWithinDays) : ""}
                className={field}
              >
                <option value="">{t("publishedAny")}</option>
                {PUBLISHED_WITHIN_DAYS.map((d) => (
                  <option key={d} value={d}>
                    {t("publishedWithin", { days: d })}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </details>

        <button
          type="submit"
          className="w-full rounded-lg bg-primary px-4 py-3 text-lg font-semibold text-primary-foreground"
        >
          {t("submit")}
        </button>
      </form>

      {outcome.status === "place" ? (
        <PlaceProblem query={query} resolution={outcome.resolution} />
      ) : (
        <section aria-labelledby="risultati" className="flex flex-col gap-4">
          <h2 id="risultati" className="scroll-mt-4 text-2xl font-semibold">
            {t("resultsTitle", { total: outcome.page.total })}
          </h2>
          {(outcome.occupation || outcome.place) && (
            <p className="text-muted">
              {outcome.occupation && t("understoodOccupation", { label: outcome.occupation.label })}{" "}
              {outcome.place &&
                t("understoodPlace", {
                  km: String(query.radiusKm),
                  place: `${outcome.place.name} (${outcome.place.provinceAbbr})`,
                })}
            </p>
          )}
          {outcome.truncated && <p className="text-muted">{t("truncated")}</p>}
          {outcome.page.total === 0 ? (
            <p className="rounded-lg border border-border bg-surface px-4 py-3">{t("empty")}</p>
          ) : (
            <ol className="flex flex-col gap-4">
              {outcome.page.results.map((offer) => (
                <li key={offer.id}>
                  <OfferCard offer={offer} />
                </li>
              ))}
            </ol>
          )}
          {outcome.page.pageCount > 1 && (
            <nav aria-label={t("pagination")} className="flex flex-wrap items-center gap-4">
              {outcome.page.page > 1 && (
                <Link
                  href={`/offerte?${toSearchParams(query, { page: outcome.page.page - 1 })}#risultati`}
                  className="font-semibold text-primary underline underline-offset-4"
                >
                  {t("previous")}
                </Link>
              )}
              <span aria-current="page">
                {t("pageOf", {
                  page: String(outcome.page.page),
                  count: String(outcome.page.pageCount),
                })}
              </span>
              {outcome.page.page < outcome.page.pageCount && (
                <Link
                  href={`/offerte?${toSearchParams(query, { page: outcome.page.page + 1 })}#risultati`}
                  className="font-semibold text-primary underline underline-offset-4"
                >
                  {t("next")}
                </Link>
              )}
            </nav>
          )}
        </section>
      )}

      <Link href="/come-funziona" className="self-start text-primary underline underline-offset-4">
        {t("howItWorks")}
      </Link>
    </main>
  );
}

async function PlaceProblem({
  query,
  resolution,
}: {
  query: SearchQuery;
  resolution:
    | { status: "ambiguous"; options: SearchPlace[] }
    | { status: "not_found"; suggestions: SearchPlace[] };
}) {
  const t = await getTranslations("search");
  const options = resolution.status === "ambiguous" ? resolution.options : resolution.suggestions;
  return (
    <section
      id="risultati"
      role="status"
      className="flex scroll-mt-4 flex-col gap-3 rounded-xl border border-accent px-5 py-4"
    >
      <p className="font-semibold">
        {resolution.status === "ambiguous"
          ? t("ambiguousPlace", { name: query.dove ?? "" })
          : t("placeNotFound", { name: query.dove ?? "" })}
      </p>
      {options.length > 0 ? (
        <>
          {resolution.status === "not_found" && <p>{t("placeSuggestions")}</p>}
          <ul className="flex flex-col gap-2">
            {options.map((p) => {
              const label = t("placeOption", { name: p.name, province: p.provinceAbbr });
              return (
                <li key={p.code}>
                  <Link
                    href={`/offerte?${toSearchParams(query, { dove: label, page: 1 })}#risultati`}
                    className="font-semibold text-primary underline underline-offset-4"
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <p>{t("placeCheck")}</p>
      )}
    </section>
  );
}

async function OfferCard({ offer }: { offer: RankedOffer }) {
  const t = await getTranslations("search");
  const tp = await getTranslations("publicOffer");
  const tf = await getTranslations("offers.form");
  const salary = formatSalary(offer, tp) ?? t("salaryMissing");
  return (
    <article
      aria-labelledby={`offerta-${offer.id}`}
      className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-5"
    >
      <h3 id={`offerta-${offer.id}`} className="text-xl font-semibold">
        <Link href={`/offerte/${offer.id}`} className="text-primary underline underline-offset-4">
          {offer.title}
        </Link>
      </h3>
      <p className="font-medium">{offer.companyName}</p>
      <p>{t("where", { municipality: offer.municipality, province: offer.provinceAbbr })}</p>
      <p className="text-lg font-semibold">{salary}</p>
      <p className="text-muted">
        {tf(`contracts.${offer.contractType}`)} · {tf(`schedules.${offer.schedule}`)}
      </p>
      <p className="text-sm">
        <span className="font-semibold">{t("whyTitle")}</span>{" "}
        {offer.reasons.map((r) => reasonText(t, r)).join(" · ")}
      </p>
    </article>
  );
}

function reasonText(t: Awaited<ReturnType<typeof getTranslations<"search">>>, r: Reason): string {
  switch (r.kind) {
    case "same_occupation":
    case "similar_occupation":
      return t(`reasons.${r.kind}`, { label: r.label });
    case "distance":
      return t("reasons.distance", { km: r.km });
    case "published":
      return t("reasons.published", { days: r.days });
    default:
      return t(`reasons.${r.kind}`);
  }
}
