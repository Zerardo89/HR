import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { VersionedLegalPage } from "@/app/_components/versioned-legal-page";
import { termsDocument } from "@/modules/trust/domain";

export async function generateMetadata({
  searchParams,
}: PageProps<"/condizioni">): Promise<Metadata> {
  const { versione } = await searchParams;
  const t = await getTranslations("legal.terms");
  // Le versioni precedenti restano leggibili ma non si indicizzano.
  return { title: t("title"), ...(versione ? { robots: { index: false } } : {}) };
}

/**
 * Condizioni d'uso (WP-024b, R-DSA-02, DSA art. 14): la versione in vigore, con regolamento degli annunci e
 * come moderiamo; le precedenti con `?versione=`, uguali a come sono state accettate.
 */
export default async function TermsPage({ searchParams }: PageProps<"/condizioni">) {
  const { versione } = await searchParams;
  const t = await getTranslations("legal.terms");
  return (
    <VersionedLegalPage
      title={t("title")}
      path="/condizioni"
      doc={termsDocument}
      requested={versione}
    />
  );
}
