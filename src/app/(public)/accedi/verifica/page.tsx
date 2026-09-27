import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getCurrentUser, MfaVerifyForm } from "@/modules/identity";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("mfa.verify");
  return { title: t("metaTitle"), robots: { index: false } };
}

/** Secondo passaggio (WP-011b): serve solo a chi ha la 2FA attiva e non l'ha ancora fatto in questa sessione. */
export default async function VerifySecondFactorPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/accedi");
  if (!user.mfa.enabled || user.mfa.verified) redirect("/account");
  const t = await getTranslations("mfa.verify");

  return (
    <main id="contenuto" className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-bold leading-tight text-primary">{t("title")}</h1>
      <MfaVerifyForm />
    </main>
  );
}
