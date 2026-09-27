import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  getCompaniesForUser,
  listCompanySites,
  removeSiteAction,
  SiteForm,
} from "@/modules/companies";
import { MAX_SITES_PER_COMPANY } from "@/modules/companies/domain";
import { requireUser } from "@/modules/identity";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("company.sites");
  return { title: t("metaTitle"), robots: { index: false } };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const OUTCOMES = ["added", "removed", "not_found", "not_allowed"] as const;

/** Sedi dell'azienda (WP-011c): tutti i membri le vedono, solo il titolare le aggiunge o le toglie. */
export default async function CompanySitesPage({ searchParams }: PageProps<"/azienda/sedi">) {
  const user = await requireUser(["company_member"]);
  const { azienda, esito } = await searchParams;
  const company =
    typeof azienda === "string" && UUID.test(azienda)
      ? (await getCompaniesForUser(user.id)).find((c) => c.id === azienda)
      : undefined;
  if (!company) notFound();
  const sites = (await listCompanySites(user.id, company.id)) ?? [];
  const t = await getTranslations("company.sites");
  const outcome = OUTCOMES.find((o) => o === esito);
  const isOwner = company.role === "owner";
  const active = sites.filter((s) => s.state !== "rejected").length;

  return (
    <main id="contenuto" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-bold leading-tight text-primary">
        {t("title", { company: company.displayName })}
      </h1>
      {outcome && (
        <p role="status" className="rounded-lg border border-primary bg-surface px-4 py-3">
          {t(`outcome.${outcome}`)}
        </p>
      )}
      <p>{t("intro")}</p>

      <ul className="flex flex-col gap-3">
        {sites.map((s) => (
          <li
            key={s.id}
            className="flex flex-col gap-1 rounded-xl border border-border bg-surface p-4"
          >
            <p className="font-semibold">
              {s.label} · {s.municipality} ({s.provinceAbbr})
            </p>
            <p className="text-sm">
              {s.isLegalSeat ? t("legalSeat") : t(`state.${s.state}`)}
              {s.state === "rejected" &&
                s.rejectionReason &&
                ` — ${t(`reasons.${s.rejectionReason}`)}`}
            </p>
            {isOwner && !s.isLegalSeat && (
              <form action={removeSiteAction}>
                <input type="hidden" name="siteId" value={s.id} />
                <input type="hidden" name="companyId" value={company.id} />
                <button
                  type="submit"
                  className="text-sm font-medium text-primary underline underline-offset-4"
                >
                  {t("remove")}
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>

      {isOwner ? (
        active < MAX_SITES_PER_COMPANY ? (
          <section aria-labelledby="nuova-sede" className="flex flex-col gap-4">
            <h2 id="nuova-sede" className="text-xl font-semibold">
              {t("addTitle")}
            </h2>
            <p className="text-muted">{t("addIntro")}</p>
            <SiteForm companyId={company.id} />
          </section>
        ) : (
          <p className="text-muted">{t("limit", { max: MAX_SITES_PER_COMPANY })}</p>
        )
      ) : (
        <p className="text-muted">{t("ownerOnly")}</p>
      )}

      <Link href="/azienda" className="font-semibold text-primary underline underline-offset-4">
        {t("back")}
      </Link>
    </main>
  );
}
