import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DraftPage } from "@/app/_components/draft-page";
import { ORGANIZATION_FIELDS, organization } from "@/lib/organization";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("legal.about");
  return { title: t("title") };
}

/** R-LAV-04: dati del legale rappresentante e dell'ente, in una pagina dedicata. */
export default async function AboutPage() {
  const t = await getTranslations("legal.about");
  const f = await getTranslations("footer");
  return (
    <DraftPage title={t("title")} paragraphs={[t("p1"), t("p2")]}>
      <h2 className="mt-4 text-xl font-semibold">{t("organizationTitle")}</h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        {ORGANIZATION_FIELDS.map((field) => (
          <div key={field} className="contents">
            <dt className="font-medium">{f(`organization.${field}`)}</dt>
            <dd>{organization[field] ?? f("pending")}</dd>
          </div>
        ))}
      </dl>
    </DraftPage>
  );
}
