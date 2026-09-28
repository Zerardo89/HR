import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getInbox } from "@/modules/applications";
import { requireUser } from "@/modules/identity";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("applications.inbox");
  return { title: t("metaTitle"), robots: { index: false } };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const day = new Intl.DateTimeFormat("it-IT", { dateStyle: "long", timeZone: "Europe/Rome" });

/** Candidature di un'offerta (WP-019): nell'elenco nessun dato identificativo, si aprono una per una. */
export default async function InboxPage({ searchParams }: PageProps<"/azienda/candidature">) {
  const user = await requireUser(["company_member"]);
  const { offerta } = await searchParams;
  const inbox =
    typeof offerta === "string" && UUID.test(offerta) ? await getInbox(user.id, offerta) : null;
  if (!inbox) notFound();
  const [t, ts, tb] = await Promise.all([
    getTranslations("applications.inbox"),
    getTranslations("applications.status"),
    getTranslations("profile.bands"),
  ]);

  return (
    <main id="contenuto" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-bold leading-tight text-primary">
        {t("title", { title: inbox.offerTitle })}
      </h1>
      <p className="text-sm text-muted">{t("privacy")}</p>
      {inbox.rows.length === 0 ? (
        <p>{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {inbox.rows.map((a, i) => (
            <li
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4"
            >
              <div className="flex flex-col gap-1">
                <p className="font-semibold">
                  {t("candidate", { n: inbox.rows.length - i })} · {ts(a.status)}
                </p>
                <p className="text-sm text-muted">
                  {t("received", { date: day.format(a.createdAt) })}
                  {a.experienceBand && ` · ${tb(a.experienceBand)}`}
                  {a.provinceAbbr && ` · ${t("province", { province: a.provinceAbbr })}`}
                </p>
              </div>
              <Link
                href={`/azienda/candidature/${a.id}`}
                className="rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground"
              >
                {t("open", { n: inbox.rows.length - i })}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href="/azienda" className="self-start text-primary underline underline-offset-4">
        {t("back")}
      </Link>
    </main>
  );
}
