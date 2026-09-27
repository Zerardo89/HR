import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  getCompaniesForUser,
  InviteForm,
  listOpenInvites,
  revokeInviteAction,
} from "@/modules/companies";
import { INVITE_TTL_DAYS, MAX_OPEN_INVITES } from "@/modules/companies/domain";
import { requireUser } from "@/modules/identity";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("company.team");
  return { title: t("metaTitle"), robots: { index: false } };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const OUTCOMES = ["sent", "revoked", "not_found", "not_allowed"] as const;
const day = new Intl.DateTimeFormat("it-IT", { dateStyle: "long", timeZone: "Europe/Rome" });

/** Colleghi (WP-011c): il titolare invita chi gestirà le offerte. Gli indirizzi email non si conservano. */
export default async function CompanyTeamPage({ searchParams }: PageProps<"/azienda/colleghi">) {
  const user = await requireUser(["company_member"]);
  const { azienda, esito } = await searchParams;
  const company =
    typeof azienda === "string" && UUID.test(azienda)
      ? (await getCompaniesForUser(user.id)).find((c) => c.id === azienda)
      : undefined;
  if (!company) notFound();
  const t = await getTranslations("company.team");
  const outcome = OUTCOMES.find((o) => o === esito);
  const invites = await listOpenInvites(user.id, company.id);

  return (
    <main id="contenuto" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-bold leading-tight text-primary">
        {t("title", { company: company.displayName })}
      </h1>
      {outcome && (
        <p role="status" className="rounded-lg border border-primary bg-surface px-4 py-3">
          {t(`outcome.${outcome}`)}
        </p>
      )}

      {invites === null ? (
        <p>{t("ownerOnly")}</p>
      ) : (
        <>
          <p>{t("intro", { days: INVITE_TTL_DAYS })}</p>
          <section aria-labelledby="invita" className="flex flex-col gap-4">
            <h2 id="invita" className="text-xl font-semibold">
              {t("inviteTitle")}
            </h2>
            {company.status === "verified" ? (
              <InviteForm companyId={company.id} />
            ) : (
              <p className="text-muted">{t("errors.company_not_verified")}</p>
            )}
          </section>
          <section aria-labelledby="inviti-aperti" className="flex flex-col gap-3">
            <h2 id="inviti-aperti" className="text-xl font-semibold">
              {t("openTitle", { count: invites.length, max: MAX_OPEN_INVITES })}
            </h2>
            {invites.length === 0 && <p className="text-muted">{t("openEmpty")}</p>}
            <ul className="flex flex-col gap-2">
              {invites.map((i) => (
                <li
                  key={i.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-surface px-4 py-3"
                >
                  <span>
                    {t(i.state === "expired" ? "inviteExpired" : "inviteOpen", {
                      sent: day.format(i.createdAt),
                      expires: day.format(i.expiresAt),
                    })}
                  </span>
                  <form action={revokeInviteAction}>
                    <input type="hidden" name="inviteId" value={i.id} />
                    <input type="hidden" name="companyId" value={company.id} />
                    <button
                      type="submit"
                      className="text-sm font-medium text-primary underline underline-offset-4"
                    >
                      {t("revoke")}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <Link href="/azienda" className="font-semibold text-primary underline underline-offset-4">
        {t("back")}
      </Link>
    </main>
  );
}
