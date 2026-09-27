import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

/**
 * Pagina legale o informativa in bozza: il testo definitivo arriva con Gemini (G-03) e resta marcato
 * "BOZZA" finché un professionista non l'ha revisionato (CLAUDE.md).
 */
export async function DraftPage({
  title,
  paragraphs,
  children,
}: {
  title: string;
  paragraphs: string[];
  children?: ReactNode;
}) {
  const t = await getTranslations("legal");
  return (
    <main id="contenuto" className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-10">
      <h1 className="text-3xl font-bold leading-tight text-primary">{title}</h1>
      <p role="note" className="rounded-lg border border-accent px-3 py-2 font-semibold">
        {t("draftNotice")}
      </p>
      {paragraphs.map((p) => (
        <p key={p}>{p}</p>
      ))}
      {children}
    </main>
  );
}
