import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { decideAction, getApplicationForCompany } from "@/modules/applications";
import { canCompanySet, COMPANY_DECISIONS } from "@/modules/applications/domain";
import { requireUser } from "@/modules/identity";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("applications.detail");
  return { title: t("metaTitle"), robots: { index: false } };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const day = new Intl.DateTimeFormat("it-IT", { dateStyle: "long", timeZone: "Europe/Rome" });
const OUTCOMES = ["updated", "not_found", "not_allowed"] as const;

/**
 * Candidatura aperta dall'azienda (WP-019). Aprirla decifra i dati del candidato: la lettura è autorizzata
 * solo per l'azienda destinataria ed è registrata (03-ARCHITETTURA §6.1).
 */
export default async function ApplicationPage({
  params,
  searchParams,
}: PageProps<"/azienda/candidature/[id]">) {
  const user = await requireUser(["company_member"]);
  const [{ id }, { esito }] = await Promise.all([params, searchParams]);
  const app = UUID.test(id) ? await getApplicationForCompany(user.id, id) : null;
  if (!app) notFound();
  const [t, ts, tb, tl, tn] = await Promise.all([
    getTranslations("applications.detail"),
    getTranslations("applications.status"),
    getTranslations("profile.bands"),
    getTranslations("profile.levels"),
    getTranslations("profile.languageNames"),
  ]);
  const outcome = OUTCOMES.find((o) => o === esito);
  const { pii, email, message } = app.applicant;
  const name = pii ? `${pii.firstName} ${pii.lastName}` : t("deleted");
  const row = "grid grid-cols-[auto_1fr] gap-x-4 gap-y-1";

  return (
    <main id="contenuto" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <p className="text-muted">{t("forOffer", { title: app.offerTitle })}</p>
      <h1 className="text-3xl font-bold leading-tight text-primary">{name}</h1>
      {outcome && (
        <p role="status" className="rounded-lg border border-primary bg-surface px-4 py-3">
          {t(`outcome.${outcome}`)}
        </p>
      )}
      <p className="font-semibold">
        {ts(app.status)} · {t("received", { date: day.format(app.createdAt) })}
      </p>

      <section
        aria-labelledby="contatti"
        className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-5"
      >
        <h2 id="contatti" className="text-xl font-semibold">
          {t("contacts")}
        </h2>
        <dl className={row}>
          <dt className="text-muted">{t("email")}</dt>
          <dd>
            {email ? (
              <a href={`mailto:${email}`} className="text-primary underline">
                {email}
              </a>
            ) : (
              "—"
            )}
          </dd>
          <dt className="text-muted">{t("phone")}</dt>
          <dd>
            {pii?.phone ? (
              <a href={`tel:${pii.phone.replace(/\s/g, "")}`} className="text-primary underline">
                {pii.phone}
              </a>
            ) : (
              "—"
            )}
          </dd>
        </dl>
        <p className="text-sm text-muted">{t("controllerNote")}</p>
      </section>

      {message && (
        <section aria-labelledby="messaggio" className="flex flex-col gap-2">
          <h2 id="messaggio" className="text-xl font-semibold">
            {t("message")}
          </h2>
          <p className="whitespace-pre-line rounded-lg border border-border bg-surface px-4 py-3">
            {message}
          </p>
        </section>
      )}

      <section
        aria-labelledby="profilo"
        className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-5"
      >
        <h2 id="profilo" className="text-xl font-semibold">
          {t("profile")}
        </h2>
        <dl className={row}>
          <dt className="text-muted">{t("occupations")}</dt>
          <dd>{app.profile.occupations.join(", ") || "—"}</dd>
          <dt className="text-muted">{t("experience")}</dt>
          <dd>{app.profile.experienceBand ? tb(app.profile.experienceBand) : "—"}</dd>
          <dt className="text-muted">{t("place")}</dt>
          <dd>{app.profile.place ?? "—"}</dd>
          <dt className="text-muted">{t("languages")}</dt>
          <dd>
            {app.profile.languages.map((l) => `${tn(l.code)} (${tl(l.level)})`).join(", ") || "—"}
          </dd>
          <dt className="text-muted">{t("licenses")}</dt>
          <dd>{app.profile.drivingLicenses.join(", ") || "—"}</dd>
          <dt className="text-muted">{t("availableFrom")}</dt>
          <dd>{app.profile.availableFrom ?? "—"}</dd>
        </dl>
        {pii?.about && <p className="whitespace-pre-line">{pii.about}</p>}
        {pii && pii.experiences.length > 0 && (
          <>
            <h3 className="mt-2 font-semibold">{t("experiences")}</h3>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {pii.experiences.map((e, i) => (
                <li key={i}>
                  {[e.role, e.employer, e.period].filter(Boolean).join(" · ")}
                  {e.description && (
                    <span className="block text-sm text-muted">{e.description}</span>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
        {pii && pii.education.length > 0 && (
          <>
            <h3 className="mt-2 font-semibold">{t("education")}</h3>
            <ul className="flex list-disc flex-col gap-1 pl-5">
              {pii.education.map((e, i) => (
                <li key={i}>{[e.title, e.school, e.year].filter(Boolean).join(" · ")}</li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="decidi" className="flex flex-col gap-3">
        <h2 id="decidi" className="text-xl font-semibold">
          {t("decide")}
        </h2>
        <div className="flex flex-wrap gap-3">
          {COMPANY_DECISIONS.filter((d) => canCompanySet(app.status, d)).map((d) => (
            <form key={d} action={decideAction}>
              <input type="hidden" name="applicationId" value={app.id} />
              <input type="hidden" name="status" value={d} />
              <button
                type="submit"
                className="rounded-lg border border-primary px-4 py-2 font-semibold text-primary"
              >
                {t(`decisions.${d}`)}
              </button>
            </form>
          ))}
        </div>
      </section>

      <Link
        href={`/azienda/candidature?offerta=${app.offerId}`}
        className="self-start text-primary underline underline-offset-4"
      >
        {t("back")}
      </Link>
    </main>
  );
}
