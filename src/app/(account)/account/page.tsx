import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { requireUser, SignOutButton } from "@/modules/identity";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("account");
  return { title: t("metaTitle"), robots: { index: false } };
}

export default async function AccountPage() {
  const user = await requireUser();
  const t = await getTranslations("account");

  return (
    <main id="contenuto" className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-bold leading-tight text-primary">{t("title")}</h1>
      <p className="text-lg">{t("signedInAs", { role: t(`roles.${user.role}`) })}</p>
      <p className="text-muted">{t("comingSoon")}</p>
      <SignOutButton />
    </main>
  );
}
