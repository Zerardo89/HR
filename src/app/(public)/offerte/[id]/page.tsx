import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getServerEnv } from "@/lib/env";
import { getPublishedOffer } from "@/modules/offers";
import { jobPostingJsonLd, serializeJsonLd, type PublicOffer } from "@/modules/offers/domain";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const euroFormat = (digits: number) =>
  new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: digits,
  });
const euroWhole = euroFormat(0);
const euroCents = euroFormat(2);
const euro = (n: number) => (Number.isInteger(n) ? euroWhole : euroCents).format(n);
const day = new Intl.DateTimeFormat("it-IT", { dateStyle: "long", timeZone: "Europe/Rome" });

async function load(id: string) {
  return UUID.test(id) ? getPublishedOffer(id) : null;
}

function salaryText(
  o: PublicOffer,
  t: (key: string, values?: Record<string, string>) => string,
): string | null {
  if (o.salaryMin == null || !o.salaryPeriod) return null;
  const amount =
    o.salaryMax != null && o.salaryMax !== o.salaryMin
      ? t("salaryRange", { min: euro(o.salaryMin), max: euro(o.salaryMax) })
      : euro(o.salaryMin);
  return t("salary", {
    amount,
    period: t(`periods.${o.salaryPeriod}`),
    basis: t(`bases.${o.salaryBasis}`),
  });
}

export async function generateMetadata({ params }: PageProps<"/offerte/[id]">): Promise<Metadata> {
  const { id } = await params;
  const result = await load(id);
  const t = await getTranslations("publicOffer");
  if (!result) return { title: t("notFound"), robots: { index: false } };
  if (result.state === "gone") return { title: result.title, robots: { index: false } };
  const o = result.offer;
  return {
    title: t("metaTitle", { title: o.title, municipality: o.municipality }),
    description: [
      t("metaDescription", {
        company: o.companyName,
        title: o.title,
        municipality: o.municipality,
      }),
      salaryText(o, t),
    ]
      .filter(Boolean)
      .join(" "),
    alternates: { canonical: `/offerte/${o.id}` },
  };
}

/** Pagina pubblica dell'offerta (WP-014): SSR, dati strutturati JobPosting, stipendio sempre in vista (R-ANN-01). */
export default async function PublicOfferPage({ params }: PageProps<"/offerte/[id]">) {
  const { id } = await params;
  const result = await load(id);
  if (!result) notFound();
  const t = await getTranslations("publicOffer");
  const tc = await getTranslations("offers.form");

  if (result.state === "gone") {
    return (
      <main
        id="contenuto"
        className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-10"
      >
        <h1 className="text-3xl font-bold leading-tight text-primary">{result.title}</h1>
        <p role="status" className="rounded-lg border border-accent px-4 py-3">
          {t("gone")}
        </p>
        <Link href="/" className="font-semibold text-primary underline underline-offset-4">
          {t("backHome")}
        </Link>
      </main>
    );
  }

  const o = result.offer;
  const salary = salaryText(o, t);
  const jsonLd = jobPostingJsonLd(o, `${getServerEnv().APP_URL}/offerte/${o.id}`);

  return (
    <main id="contenuto" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <script
        type="application/ld+json"
        // Dati strutturati per Google for Jobs: JSON con "<" già neutralizzato (serializeJsonLd, guida Next.js).
        // nosemgrep
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      <header className="flex flex-col gap-2">
        <p className="text-lg font-semibold text-muted">{o.companyName}</p>
        <h1 className="text-3xl font-bold leading-tight text-primary">{o.title}</h1>
        <p className="text-lg">
          {o.municipality} ({o.provinceAbbr}) · {o.occupation}
        </p>
      </header>

      <dl className="grid grid-cols-1 gap-3 rounded-xl border border-border bg-surface p-5 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted">{t("salaryLabel")}</dt>
          <dd className="text-xl font-semibold">{salary ?? t("salaryNotRequired")}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">{t("contractLabel")}</dt>
          <dd className="font-medium">{tc(`contracts.${o.contractType}`)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">{t("scheduleLabel")}</dt>
          <dd className="font-medium">
            {tc(`schedules.${o.schedule}`)}
            {o.hoursPerWeek ? ` · ${t("hours", { hours: String(o.hoursPerWeek) })}` : ""}
          </dd>
        </div>
        {o.ccnl && (
          <div>
            <dt className="text-sm text-muted">{t("ccnlLabel")}</dt>
            <dd className="font-medium">{o.ccnl}</dd>
          </div>
        )}
        <div>
          <dt className="text-sm text-muted">{t("publishedLabel")}</dt>
          <dd>{day.format(o.publishedAt)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">{t("validThroughLabel")}</dt>
          <dd>{day.format(o.validThrough)}</dd>
        </div>
      </dl>

      <section aria-labelledby="descrizione" className="flex flex-col gap-2">
        <h2 id="descrizione" className="text-xl font-semibold">
          {t("descriptionTitle")}
        </h2>
        <p className="whitespace-pre-line">{o.description}</p>
      </section>

      <section className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5">
        <p className="font-medium">{t("applySoon")}</p>
        <p className="text-sm text-muted">{t("safety")}</p>
        <Link
          href="/segnalazioni"
          className="self-start text-sm text-primary underline underline-offset-4"
        >
          {t("report")}
        </Link>
      </section>
    </main>
  );
}
