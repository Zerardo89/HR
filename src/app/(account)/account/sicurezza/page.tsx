import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { getTotpEnrollment, MfaSetupForm, requireUser } from "@/modules/identity";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("mfa.setup");
  return { title: t("metaTitle"), robots: { index: false } };
}

/** Attivazione della 2FA (WP-011b): obbligatoria per aziende, moderatori e admin; facoltativa per i lavoratori. */
export default async function SecurityPage() {
  const user = await requireUser(undefined, "setup");
  const t = await getTranslations("mfa.setup");
  const enrollment = user.mfa.enabled ? null : await getTotpEnrollment(user.id);
  const enabled = user.mfa.enabled || enrollment?.status === "already_enabled";

  return (
    <main id="contenuto" className="mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-10">
      <h1 className="text-3xl font-bold leading-tight text-primary">{t("title")}</h1>
      {enabled || enrollment?.status !== "pending" ? (
        <section className="flex flex-col gap-2 rounded-xl border border-primary bg-surface p-5">
          <h2 className="text-xl font-semibold">{t("enabledTitle")}</h2>
          <p>{t("enabled")}</p>
        </section>
      ) : (
        <>
          <p>{user.mfa.required ? t("required") : t("optional")}</p>
          <p>{t("step1")}</p>
          <p>{t("step2")}</p>
          <Image
            src={enrollment.qrDataUrl}
            alt={t("qrAlt")}
            width={220}
            height={220}
            unoptimized
            className="self-center rounded-lg border border-border bg-white p-2"
          />
          <a
            href={enrollment.uri}
            className="self-start rounded-lg border border-primary px-4 py-3 font-semibold text-primary"
          >
            {t("openApp")}
          </a>
          <p className="text-muted">{t("manualKey")}</p>
          <code
            aria-label={t("manualKey")}
            className="rounded-lg border border-border bg-surface px-3 py-3 font-mono text-lg tracking-wider"
          >
            {enrollment.keyGroups.join(" ")}
          </code>
          <p>{t("step3")}</p>
          <MfaSetupForm continueHref={user.role === "company_member" ? "/azienda" : "/account"} />
        </>
      )}
    </main>
  );
}
