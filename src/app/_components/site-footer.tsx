import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ORGANIZATION_FIELDS, organization } from "@/lib/organization";

const LINKS = [
  ["/chi-siamo", "about"],
  ["/privacy", "privacy"],
  ["/cookie", "cookies"],
  ["/condizioni", "terms"],
  ["/contatti", "contacts"],
  ["/segnalazioni", "reports"],
] as const;

/** Piè di pagina con i dati dell'ente su ogni pagina (R-LAV-04, R-CONS-04). */
export async function SiteFooter() {
  const t = await getTranslations("footer");
  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-6 text-sm">
        <nav aria-label={t("linksLabel")}>
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {LINKS.map(([href, key]) => (
              <li key={href}>
                <Link href={href} className="text-primary underline underline-offset-4">
                  {t(`links.${key}`)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-muted">
          {ORGANIZATION_FIELDS.map((field) => (
            <div key={field} className="contents">
              <dt>{t(`organization.${field}`)}</dt>
              <dd>{organization[field] ?? t("pending")}</dd>
            </div>
          ))}
        </dl>
        <p className="text-muted">{t("nonProfit")}</p>
      </div>
    </footer>
  );
}
