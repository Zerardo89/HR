import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("privacyCenter");
  return { title: t("deletedTitle"), robots: { index: false } };
}

/** Dopo la cancellazione dell'account (WP-023): nessun dato, solo la conferma. */
export default async function AccountDeletedPage() {
  const t = await getTranslations("privacyCenter");
  return (
    <main id="contenuto" className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-bold leading-tight text-primary">{t("deletedTitle")}</h1>
      <p role="status" className="text-lg">
        {t("deletedBody")}
      </p>
      <Link href="/" className="self-start font-semibold text-primary underline underline-offset-4">
        {t("home")}
      </Link>
    </main>
  );
}
