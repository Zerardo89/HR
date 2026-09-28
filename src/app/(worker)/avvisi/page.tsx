import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { requireUser } from "@/modules/identity";
import { toSearchParams } from "@/modules/matching/domain";
import { deleteAlertAction, getMyAlerts, setAlertFrequencyAction } from "@/modules/notifications";
import {
  ALERT_FREQUENCIES,
  describeAlert,
  MAX_SAVED_SEARCHES,
} from "@/modules/notifications/domain";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("alerts.page");
  return { title: t("metaTitle"), robots: { index: false } };
}

const day = new Intl.DateTimeFormat("it-IT", { dateStyle: "long", timeZone: "Europe/Rome" });
const OUTCOMES = [
  "saved",
  "duplicate",
  "limit",
  "invalid",
  "not_allowed",
  "updated",
  "deleted",
  "not_found",
] as const;
const field = "rounded-lg border border-border bg-surface px-3 py-2 text-base text-foreground";

/** Avvisi del lavoratore (WP-020): ricerche salvate, frequenza, eliminazione. */
export default async function AlertsPage({ searchParams }: PageProps<"/avvisi">) {
  const user = await requireUser(["worker"]);
  const [{ esito }, { alerts, active }, t, tf] = await Promise.all([
    searchParams,
    getMyAlerts(user.id),
    getTranslations("alerts.page"),
    getTranslations("alerts.frequencies"),
  ]);
  const outcome = OUTCOMES.find((o) => o === esito);

  return (
    <main id="contenuto" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-bold leading-tight text-primary">{t("title")}</h1>
      {outcome && (
        <p role="status" className="rounded-lg border border-primary bg-surface px-4 py-3">
          {t(`outcome.${outcome}`, { max: String(MAX_SAVED_SEARCHES) })}
        </p>
      )}
      <p>{t("intro", { max: String(MAX_SAVED_SEARCHES) })}</p>
      {!active && alerts.length > 0 && (
        <p role="note" className="rounded-lg border border-accent px-4 py-3">
          {t("paused")}{" "}
          <Link href="/profilo" className="font-semibold text-primary underline underline-offset-4">
            {t("profileLink")}
          </Link>
        </p>
      )}
      {alerts.length === 0 ? (
        <p>{t("empty")}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {alerts.map((a, i) => {
            const n = String(i + 1);
            return (
              <li key={a.id}>
                <article
                  aria-labelledby={`avviso-${a.id}`}
                  className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5"
                >
                  <h2 id={`avviso-${a.id}`} className="text-xl font-semibold">
                    {t("alertName", { n })}
                  </h2>
                  <p className="text-lg">{describeAlert(a.query)}</p>
                  <p className="text-sm text-muted">
                    {a.lastSentAt
                      ? t("lastSent", { date: day.format(a.lastSentAt) })
                      : t("neverSent")}
                  </p>
                  <Link
                    href={`/offerte?${toSearchParams(a.query)}#risultati`}
                    className="self-start font-semibold text-primary underline underline-offset-4"
                  >
                    {t("see")}
                  </Link>
                  <div className="flex flex-wrap items-end gap-3">
                    <form action={setAlertFrequencyAction} className="flex items-end gap-2">
                      <input type="hidden" name="id" value={a.id} />
                      <label className="flex flex-col gap-1 text-sm font-medium">
                        {t("frequencyLabel", { n })}
                        <select name="frequency" defaultValue={a.frequency} className={field}>
                          {ALERT_FREQUENCIES.map((f) => (
                            <option key={f} value={f}>
                              {tf(f)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="submit"
                        className="rounded-lg border border-primary px-3 py-2 font-semibold text-primary"
                      >
                        {t("change")}
                      </button>
                    </form>
                    <form action={deleteAlertAction}>
                      <input type="hidden" name="id" value={a.id} />
                      <button
                        type="submit"
                        aria-label={`${t("delete")} ${n}`}
                        className="rounded-lg border border-accent px-3 py-2 font-semibold"
                      >
                        {t("delete")}
                      </button>
                    </form>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
      <Link
        href="/offerte"
        className="self-start font-semibold text-primary underline underline-offset-4"
      >
        {t("search")}
      </Link>
      <Link href="/account" className="self-start text-primary underline underline-offset-4">
        {t("back")}
      </Link>
    </main>
  );
}
