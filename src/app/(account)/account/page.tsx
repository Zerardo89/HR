import type { Metadata } from "next";
import Link from "next/link";
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
      {user.role === "worker" && (
        <>
          <Link
            href="/profilo"
            className="self-start rounded-lg bg-primary px-4 py-3 text-lg font-semibold text-primary-foreground"
          >
            {t("profileLink")}
          </Link>
          <Link
            href="/candidature"
            className="self-start font-medium text-primary underline underline-offset-4"
          >
            {t("applicationsLink")}
          </Link>
          <Link
            href="/avvisi"
            className="self-start font-medium text-primary underline underline-offset-4"
          >
            {t("alertsLink")}
          </Link>
        </>
      )}
      {user.role === "company_member" && (
        <Link
          href="/azienda"
          className="self-start rounded-lg bg-primary px-4 py-3 text-lg font-semibold text-primary-foreground"
        >
          {t("companyArea")}
        </Link>
      )}
      <Link
        href="/account/sicurezza"
        className="self-start font-medium text-primary underline underline-offset-4"
      >
        {t("security")}
      </Link>
      <SignOutButton />
    </main>
  );
}
