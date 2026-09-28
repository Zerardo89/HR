import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/modules/identity";
import { deleteAccountAction, getMyConsents } from "@/modules/privacy";
import { DELETE_CONFIRM_WORD } from "@/modules/privacy/domain";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("privacyCenter");
  return { title: t("metaTitle"), robots: { index: false } };
}

const day = new Intl.DateTimeFormat("it-IT", { dateStyle: "long", timeZone: "Europe/Rome" });
const section = "flex flex-col gap-3 rounded-xl border border-border bg-surface p-5";

/** Centro privacy (WP-023, R-PRIV-04): esporta, consensi, cancella l'account. Self-service, subito. */
export default async function PrivacyCenterPage({ searchParams }: PageProps<"/account/privacy">) {
  const user = await requireUser();
  const [{ esito }, consents, t] = await Promise.all([
    searchParams,
    getMyConsents(user.id),
    getTranslations("privacyCenter"),
  ]);

  return (
    <main id="contenuto" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-bold leading-tight text-primary">{t("title")}</h1>
      <p>{t("intro")}</p>

      <section aria-labelledby="esporta" className={section}>
        <h2 id="esporta" className="text-xl font-semibold">
          {t("exportTitle")}
        </h2>
        <p>{t("exportHelp")}</p>
        <a
          href="/api/privacy/export"
          download
          className="self-start rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground"
        >
          {t("exportLink")}
        </a>
      </section>

      <section aria-labelledby="consensi" className={section}>
        <h2 id="consensi" className="text-xl font-semibold">
          {t("consentsTitle")}
        </h2>
        {consents.length === 0 ? (
          <p>{t("consentsEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {consents.map((c, i) => (
              <li key={`${c.type}-${i}`}>
                <span className="font-medium">{t(`consentTypes.${c.type}`)}</span>:{" "}
                {t("consentGranted", { date: day.format(c.grantedAt), version: c.version })}
                {c.revokedAt && `, ${t("consentRevoked", { date: day.format(c.revokedAt) })}`}
              </li>
            ))}
          </ul>
        )}
        <p className="text-sm text-muted">{t("consentsHelp")}</p>
      </section>

      <section aria-labelledby="cancella" className={`${section} border-accent`}>
        <h2 id="cancella" className="text-xl font-semibold">
          {t("deleteTitle")}
        </h2>
        <p>{t("deleteHelp")}</p>
        {esito === "conferma" && (
          <p role="alert" className="font-semibold">
            {t("deleteError")}
          </p>
        )}
        <form action={deleteAccountAction} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 font-medium">
            {t("deleteConfirmLabel", { word: DELETE_CONFIRM_WORD })}
            <input
              name="confirm"
              autoComplete="off"
              required
              className="rounded-lg border border-border bg-surface px-3 py-3 text-lg text-foreground"
            />
          </label>
          <button
            type="submit"
            className="self-start rounded-lg border border-accent px-4 py-3 font-semibold"
          >
            {t("deleteButton")}
          </button>
        </form>
      </section>

      <Link href="/account" className="self-start text-primary underline underline-offset-4">
        {t("back")}
      </Link>
    </main>
  );
}
