import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DraftPage } from "@/app/_components/draft-page";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.reports");
  return { title: t("title") };
}

export default async function Page() {
  const t = await getTranslations("legal.reports");
  return <DraftPage title={t("title")} paragraphs={[t("p1"), t("p2")]} />;
}
