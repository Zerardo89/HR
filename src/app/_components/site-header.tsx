import Link from "next/link";
import { getTranslations } from "next-intl/server";

export async function SiteHeader() {
  const t = await getTranslations("common");
  const meta = await getTranslations("meta");
  return (
    <header className="border-b border-border bg-surface">
      <nav
        aria-label={t("mainNav")}
        className="mx-auto flex w-full max-w-2xl items-center justify-between gap-4 px-4 py-3"
      >
        <Link href="/" className="text-lg font-bold text-primary">
          {meta("siteName")}
        </Link>
        <Link
          href="/accedi"
          className="text-base font-medium text-primary underline underline-offset-4"
        >
          {t("signIn")}
        </Link>
      </nav>
    </header>
  );
}
