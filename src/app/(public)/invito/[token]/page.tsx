import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { acceptInviteAction, continueInviteAction, getInviteView } from "@/modules/companies";
import { getCurrentUser, SignOutButton } from "@/modules/identity";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("invite");
  return { title: t("metaTitle"), robots: { index: false, follow: false } };
}

const OUTCOMES = ["wrong_account", "not_company_account", "expired", "used", "not_found"] as const;
const button =
  "w-full rounded-lg bg-primary px-4 py-3 text-lg font-semibold text-primary-foreground";

/** Invito a unirsi a un'azienda (WP-011c): si accetta solo con l'account azienda dell'email invitata. */
export default async function InvitePage({ params, searchParams }: PageProps<"/invito/[token]">) {
  const { token } = await params;
  const { esito } = await searchParams;
  const t = await getTranslations("invite");
  const [invite, user] = await Promise.all([getInviteView(token), getCurrentUser()]);
  const outcome = OUTCOMES.find((o) => o === esito);

  return (
    <main id="contenuto" className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-bold leading-tight text-primary">{t("title")}</h1>
      {outcome && (
        <p role="alert" className="rounded-lg border border-accent px-4 py-3">
          {t(`outcome.${outcome}`)}
        </p>
      )}

      {invite.status !== "open" ? (
        <>
          <p>{t(`state.${invite.status}`)}</p>
          <Link href="/" className="font-semibold text-primary underline underline-offset-4">
            {t("backHome")}
          </Link>
        </>
      ) : (
        <>
          <p className="text-lg">{t("intro", { company: invite.companyName })}</p>
          <p className="text-muted">{t("recruiterRole")}</p>
          {!user ? (
            <form action={continueInviteAction} className="flex flex-col gap-3">
              <input type="hidden" name="token" value={token} />
              <p>{t("signInFirst")}</p>
              <button type="submit" className={button}>
                {t("signIn")}
              </button>
            </form>
          ) : user.role !== "company_member" ? (
            <div className="flex flex-col gap-3">
              <p>{t("wrongRole")}</p>
              <SignOutButton />
            </div>
          ) : (
            <form action={acceptInviteAction} className="flex flex-col gap-3">
              <input type="hidden" name="token" value={token} />
              <button type="submit" className={button}>
                {t("accept", { company: invite.companyName })}
              </button>
            </form>
          )}
        </>
      )}
    </main>
  );
}
