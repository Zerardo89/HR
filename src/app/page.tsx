import { getTranslations } from "next-intl/server";

const POINTS = ["freeWorkers", "freeCompanies", "salary", "privacy"] as const;

export default async function HomePage() {
  const t = await getTranslations("home");

  return (
    <main id="contenuto" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 py-12">
      <header className="flex flex-col gap-3">
        <h1 className="text-3xl font-bold leading-tight text-primary sm:text-4xl">{t("title")}</h1>
        <p className="text-lg text-foreground">{t("subtitle")}</p>
        <p className="text-base text-muted">{t("launch")}</p>
      </header>

      <section aria-labelledby="perche" className="rounded-xl border border-border bg-surface p-6">
        <h2 id="perche" className="mb-4 text-xl font-semibold">
          {t("pointsTitle")}
        </h2>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          {POINTS.map((key) => (
            <li key={key}>{t(`points.${key}`)}</li>
          ))}
        </ul>
      </section>
    </main>
  );
}
