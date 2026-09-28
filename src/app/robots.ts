import type { MetadataRoute } from "next";
import { getServerEnv } from "@/lib/env";
import { flags } from "@/lib/flags";

// Letto a ogni richiesta: la stessa immagine gira in anteprima (tutto bloccato) e in produzione (WP-010).
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  if (flags.previewMode) return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/account",
        "/profilo",
        "/candidature",
        "/azienda",
        "/moderazione",
        "/accedi",
        "/invito",
        "/lista-attesa",
        "/api/",
      ],
    },
    sitemap: `${getServerEnv().APP_URL}/sitemap.xml`,
  };
}
