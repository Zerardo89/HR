import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listRegions } from "@/modules/geo";
import { requireUser } from "@/modules/identity";
import { MAX_PROFILE_OCCUPATIONS } from "@/modules/profiles/domain";
import { getOwnProfile, ProfileForm } from "@/modules/profiles";
import { getOccupationCatalog, OccupationPicker } from "@/modules/taxonomy";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("profile");
  return { title: t("metaTitle"), robots: { index: false } };
}

const OUTCOMES = ["saved", "state"] as const;

/** Profilo del lavoratore (WP-017): solo il lavoratore stesso lo vede e lo modifica. */
export default async function ProfilePage({ searchParams }: PageProps<"/profilo">) {
  const user = await requireUser(["worker"]);
  const [{ esito }, profile, regions, catalog, t] = await Promise.all([
    searchParams,
    getOwnProfile(user.id),
    listRegions(),
    getOccupationCatalog(),
    getTranslations("profile"),
  ]);
  const outcome = OUTCOMES.find((o) => o === esito);

  return (
    <main id="contenuto" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-10">
      <h1 className="text-3xl font-bold leading-tight text-primary">{t("title")}</h1>
      {outcome && (
        <p role="status" className="rounded-lg border border-primary bg-surface px-4 py-3">
          {t(`outcome.${outcome}`)}
        </p>
      )}
      <p className="text-lg">{profile ? t("introEdit") : t("introNew")}</p>
      <p className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
        {t("privacyNote")}
      </p>
      <ProfileForm
        initial={profile}
        regions={regions}
        occupationFields={Array.from({ length: MAX_PROFILE_OCCUPATIONS }, (_, i) => (
          <OccupationPicker
            key={i}
            entries={catalog.entries}
            name="occupationId"
            label={t(i === 0 ? "occupationMain" : "occupationOther", { n: i + 1 })}
            required={i === 0}
            defaultId={profile?.occupations[i]?.id}
          />
        ))}
      />
      <Link href="/offerte" className="self-start text-primary underline underline-offset-4">
        {t("searchLink")}
      </Link>
    </main>
  );
}
