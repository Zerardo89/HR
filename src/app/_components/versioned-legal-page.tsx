import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { VersionedLegalDocument } from "@/modules/trust/domain";
import { DraftPage } from "./draft-page";
import { LegalDocument } from "./legal-document";

const day = new Intl.DateTimeFormat("it-IT", { dateStyle: "long", timeZone: "Europe/Rome" });
const date = (isoDay: string) => day.format(new Date(`${isoDay}T12:00:00Z`));

/**
 * Documento legale versionato (condizioni d'uso WP-024b, informativa privacy WP-024c): la versione in vigore e
 * l'elenco di tutte le versioni; le precedenti con `?versione=`, uguali a come sono state lette o accettate.
 */
export async function VersionedLegalPage({
  title,
  path,
  doc,
  requested,
}: {
  title: string;
  path: string;
  doc: VersionedLegalDocument;
  requested: string | string[] | undefined;
}) {
  const t = await getTranslations("legal.versions");
  const shown = (typeof requested === "string" && doc.version(requested)) || doc.version()!;
  return (
    <DraftPage title={title} paragraphs={[]}>
      <p className="font-medium">
        {t(shown.current ? "currentVersion" : "oldVersion", { date: date(shown.publishedOn) })}
      </p>
      {!shown.current && (
        <Link href={path} className="font-semibold text-primary underline underline-offset-4">
          {t("readCurrent")}
        </Link>
      )}
      <LegalDocument source={shown.text} />
      <section aria-labelledby="versioni" className="mt-6 flex flex-col gap-2">
        <h2 id="versioni" className="text-xl font-semibold">
          {t("historyTitle")}
        </h2>
        <ul className="flex list-disc flex-col gap-1 pl-6">
          {doc.history().map((v) => (
            <li key={v.id}>
              {v.current ? (
                t("historyCurrent", { date: date(v.publishedOn) })
              ) : (
                <Link
                  href={`${path}?versione=${v.id}`}
                  className="text-primary underline underline-offset-4"
                >
                  {t("historyItem", { date: date(v.publishedOn) })}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </section>
    </DraftPage>
  );
}
