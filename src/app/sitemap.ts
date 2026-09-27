import type { MetadataRoute } from "next";
import { getServerEnv } from "@/lib/env";
import { flags } from "@/lib/flags";
import { listOffersForSitemap } from "@/modules/offers";

// Si genera a ogni richiesta (legge il DB): le offerte cambiano di continuo (WP-014).
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getServerEnv().APP_URL;
  if (flags.previewMode) return []; // in anteprima il sito non si indicizza (WP-010)
  const offers = await listOffersForSitemap();
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/offerte`, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/come-funziona`, changeFrequency: "monthly", priority: 0.3 },
    ...offers.map((o) => ({
      url: `${base}/offerte/${o.id}`,
      lastModified: o.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
