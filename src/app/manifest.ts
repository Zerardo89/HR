import type { MetadataRoute } from "next";
import { fillTemplate, messages } from "@/i18n/messages";
import { BRAND_COLORS } from "@/lib/brand";

/**
 * Manifest della PWA (WP-010, ADR-0002): rende il sito installabile e fa da base all'app Android (TWA, Bubblewrap).
 * `start_url` e `scope` non vanno più cambiati dopo il primo caricamento su Play.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: fillTemplate(messages.meta.title, { siteName: messages.meta.siteName }),
    short_name: messages.meta.siteName,
    description: messages.pwa.shortDescription,
    lang: "it",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: BRAND_COLORS.background,
    theme_color: BRAND_COLORS.primary,
    categories: ["business"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
