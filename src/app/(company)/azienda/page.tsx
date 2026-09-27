import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import {
  CompanyRegistrationForm,
  getCompaniesForUser,
  getPendingInvite,
} from "@/modules/companies";
import { getCompanyNationalPlan } from "@/modules/billing";
import { requireUser } from "@/modules/identity";
import { listCompanyOffers } from "@/modules/offers";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("company");
  return { title: t("metaTitle"), robots: { index: false } };
}

/** Area azienda (WP-011): registrazione, stato della verifica. Solo utenti `company_member`. */
export default async function CompanyPage({ searchParams }: PageProps<"/azienda">) {
  const user = await requireUser(["company_member"]);
  const [companies, pendingInvite, { esito }] = await Promise.all([
    getCompaniesForUser(user.id),
    getPendingInvite(),
    searchParams,
  ]);
  const t = await getTranslations("company");

  return (
    <main id="contenuto" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-bold leading-tight text-primary">{t("title")}</h1>
      {esito === "joined" && (
        <p role="status" className="rounded-lg border border-primary bg-surface px-4 py-3">
          {t("joined")}
        </p>
      )}
      {pendingInvite && (
        <p className="rounded-lg border border-accent bg-surface px-4 py-3">
          {t("pendingInvite", { company: pendingInvite.companyName })}{" "}
          <Link
            href={`/invito/${pendingInvite.token}`}
            className="font-semibold text-primary underline underline-offset-4"
          >
            {t("openInvite")}
          </Link>
        </p>
      )}

      {companies.length === 0 ? (
        <section className="flex flex-col gap-4" aria-labelledby="registra-azienda">
          <h2 id="registra-azienda" className="text-xl font-semibold">
            {t("register.title")}
          </h2>
          <p>{t("register.intro")}</p>
          <CompanyRegistrationForm />
        </section>
      ) : (
        companies.map((c) => (
          <section
            key={c.id}
            className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-6"
          >
            <h2 className="text-xl font-semibold">{c.displayName}</h2>
            <p role="status" className="font-medium">
              {t(
                `status.${c.status}${c.status === "pending" && c.kind === "agency" ? "Agency" : ""}`,
              )}
            </p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-muted">{t("legalName")}</dt>
              <dd>{c.legalName}</dd>
              <dt className="text-muted">{t("vat")}</dt>
              <dd>{c.vatNumber}</dd>
              <dt className="text-muted">{t("legalSeat")}</dt>
              <dd>{c.legalSeat ?? t("legalSeatUnknown")}</dd>
            </dl>
            <nav aria-label={t("manage")} className="flex flex-wrap gap-4">
              <Link
                href={`/azienda/sedi?azienda=${c.id}`}
                className="font-medium text-primary underline underline-offset-4"
              >
                {t("sitesLink")}
              </Link>
              {c.role === "owner" && (
                <Link
                  href={`/azienda/colleghi?azienda=${c.id}`}
                  className="font-medium text-primary underline underline-offset-4"
                >
                  {t("teamLink")}
                </Link>
              )}
            </nav>
            <CompanyPlan companyId={c.id} />
            <CompanyOffers userId={user.id} companyId={c.id} />
          </section>
        ))
      )}
    </main>
  );
}

async function CompanyOffers({ userId, companyId }: { userId: string; companyId: string }) {
  const offers = await listCompanyOffers(userId, companyId);
  const t = await getTranslations("offers");
  return (
    <div className="mt-2 flex flex-col gap-3 border-t border-border pt-4">
      <h3 className="text-lg font-semibold">{t("listTitle")}</h3>
      {offers.length === 0 ? (
        <p className="text-muted">{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {offers.map((o) => (
            <li key={o.id} className="flex flex-wrap items-center justify-between gap-2">
              <Link
                href={`/azienda/offerte/${o.id}`}
                className="text-primary underline underline-offset-4"
              >
                {o.title}
              </Link>
              <span className="text-sm text-muted">{t(`status.${o.status}`)}</span>
            </li>
          ))}
        </ul>
      )}
      <Link
        href={`/azienda/offerte/nuova?azienda=${companyId}`}
        className="self-start rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground"
      >
        {t("newTitle")}
      </Link>
    </div>
  );
}

const day = new Intl.DateTimeFormat("it-IT", { dateStyle: "long", timeZone: "Europe/Rome" });

/** Cosa può pubblicare l'azienda (WP-016): zona gratuita, o Piano Nazionale (anche dei fondatori). */
async function CompanyPlan({ companyId }: { companyId: string }) {
  const [plan, t] = await Promise.all([
    getCompanyNationalPlan(companyId),
    getTranslations("company.plan"),
  ]);
  const text = !plan
    ? t("free")
    : !plan.validTo
      ? t("nationalOpen")
      : t(plan.source === "founders" ? "founders" : "national", {
          until: day.format(plan.validTo),
        });
  return (
    <p className="text-sm">
      <span className="font-semibold">{t("title")}:</span> {text}
    </p>
  );
}
