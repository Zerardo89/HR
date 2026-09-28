import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { DraftPage } from "@/app/_components/draft-page";
import { organization } from "@/lib/organization";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.contacts");
  return { title: t("title") };
}

const link = "font-semibold text-primary underline underline-offset-4";

/**
 * Contatti e punto di contatto unico (WP-024b, R-DSA-01, DSA art. 11-12): per chi usa il servizio e per le
 * autorità. L'indirizzo arriva da `lib/organization` quando l'associazione è costituita.
 */
export default async function ContactsPage() {
  const t = await getTranslations("legal.contacts");
  return (
    <DraftPage title={t("title")} paragraphs={[t("intro")]}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        <dt className="font-medium">{t("emailLabel")}</dt>
        <dd>{organization.contactEmail ?? t("pending")}</dd>
        <dt className="font-medium">{t("pecLabel")}</dt>
        <dd>{organization.pec ?? t("pending")}</dd>
        <dt className="font-medium">{t("languagesLabel")}</dt>
        <dd>{t("languages")}</dd>
      </dl>
      <p>{t("human")}</p>
      <p>
        {t("reports")}{" "}
        <Link href="/segnalazioni" className={link}>
          {t("reportsLink")}
        </Link>
      </p>
      <p>{t("review")}</p>
      <p>
        {t("data")}{" "}
        <Link href="/account/privacy" className={link}>
          {t("dataLink")}
        </Link>
      </p>
    </DraftPage>
  );
}
