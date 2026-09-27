import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CompanyRegistrationForm, getCompaniesForUser } from "@/modules/companies";
import { requireUser } from "@/modules/identity";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("company");
  return { title: t("metaTitle"), robots: { index: false } };
}

/** Area azienda (WP-011): registrazione, stato della verifica. Solo utenti `company_member`. */
export default async function CompanyPage() {
  const user = await requireUser(["company_member"]);
  const companies = await getCompaniesForUser(user.id);
  const t = await getTranslations("company");

  return (
    <main id="contenuto" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-bold leading-tight text-primary">{t("title")}</h1>

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
            <p className="text-muted">{t("nextSteps")}</p>
          </section>
        ))
      )}
    </main>
  );
}
