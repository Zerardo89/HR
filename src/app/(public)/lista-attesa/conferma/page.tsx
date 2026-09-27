import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { isTokenShape } from "@/lib/tokens";
import { ConfirmForm } from "@/modules/waitlist";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("waitlist.confirm");
  // Il token è nell'URL: niente indicizzazione e niente Referer verso altri siti.
  return { title: t("title"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}

export default async function ConfirmWaitlistPage({
  searchParams,
}: PageProps<"/lista-attesa/conferma">) {
  const { t: token } = await searchParams;
  const t = await getTranslations("waitlist.confirm");

  return (
    <main id="contenuto" className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-bold leading-tight text-primary">{t("title")}</h1>
      {isTokenShape(token) ? <ConfirmForm token={token} /> : <p role="status">{t("invalid")}</p>}
    </main>
  );
}
