import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { VersionedLegalPage } from "@/app/_components/versioned-legal-page";
import { privacyNoticeDocument } from "@/modules/trust/domain";

export async function generateMetadata({ searchParams }: PageProps<"/privacy">): Promise<Metadata> {
  const { versione } = await searchParams;
  const t = await getTranslations("legal.privacy");
  // Le versioni precedenti restano leggibili ma non si indicizzano.
  return { title: t("title"), ...(versione ? { robots: { index: false } } : {}) };
}

/**
 * Informativa sulla privacy (WP-024c, art. 13 GDPR): la versione in vigore e tutte le precedenti con `?versione=`,
 * uguali a come sono state lette alla registrazione.
 */
export default async function PrivacyPage({ searchParams }: PageProps<"/privacy">) {
  const { versione } = await searchParams;
  const t = await getTranslations("legal.privacy");
  return (
    <VersionedLegalPage
      title={t("title")}
      path="/privacy"
      doc={privacyNoticeDocument}
      requested={versione}
    />
  );
}
