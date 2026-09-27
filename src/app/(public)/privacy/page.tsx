import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

// Testo provvisorio: quello definitivo arriva con WP-009 (bozza di Gemini) e resta "BOZZA" fino alla revisione legale.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal");
  return { title: t("privacyTitle") };
}

export default async function PrivacyPage() {
  const t = await getTranslations("legal");
  return (
    <main id="contenuto" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-10">
      <h1 className="text-3xl font-bold leading-tight text-primary">{t("privacyTitle")}</h1>
      <p role="note" className="rounded-lg border border-accent px-3 py-2 font-semibold">
        {t("draftNotice")}
      </p>
      <p>{t("privacyDraft")}</p>
    </main>
  );
}
