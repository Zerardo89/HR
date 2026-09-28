import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { SiteFooter } from "@/app/_components/site-footer";
import { SiteHeader } from "@/app/_components/site-header";
import { flags } from "@/lib/flags";
import { TermsUpdateBanner } from "@/modules/trust";
import "./globals.css";

// I flag (es. PREVIEW_MODE) si leggono a runtime: la stessa immagine Docker gira in anteprima e in produzione.
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta");
  return {
    title: { default: t("title"), template: `%s · ${t("siteName")}` },
    description: t("description"),
    // In anteprima il sito non deve comparire su Google (WP-010).
    robots: flags.previewMode ? { index: false, follow: false } : undefined,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#3f6b52" },
    { media: "(prefers-color-scheme: dark)", color: "#141816" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const t = await getTranslations("common");

  return (
    <html lang={locale} className="h-full antialiased">
      <body className="flex min-h-dvh flex-col">
        <a
          href="#contenuto"
          className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:rounded focus:bg-surface focus:px-3 focus:py-2"
        >
          {t("skipToContent")}
        </a>
        {flags.previewMode && (
          <div
            role="status"
            className="bg-accent px-4 py-2 text-center text-sm font-medium text-white"
          >
            {t("previewBanner")}
          </div>
        )}
        <SiteHeader />
        <TermsUpdateBanner />
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
        <SiteFooter />
      </body>
    </html>
  );
}
