import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { flags } from "@/lib/flags";
import { getCurrentUser, SignInFlow } from "@/modules/identity";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("auth");
  return { title: t("metaTitle"), robots: { index: false } };
}

// `?tipo=lavoratore|azienda` preseleziona il ruolo nella registrazione (dai pulsanti della home).
export default async function SignInPage({ searchParams }: PageProps<"/accedi">) {
  if (await getCurrentUser()) redirect("/account");
  const { tipo } = await searchParams;
  const initialRole =
    tipo === "azienda" ? "company_member" : tipo === "lavoratore" ? "worker" : undefined;
  const t = await getTranslations("auth");

  return (
    <main id="contenuto" className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-bold leading-tight text-primary">{t("title")}</h1>
      <SignInFlow initialRole={initialRole} preview={flags.previewMode} />
    </main>
  );
}
