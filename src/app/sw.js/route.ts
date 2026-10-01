import { fillTemplate, messages } from "@/i18n/messages";
import { BRAND_COLORS } from "@/lib/brand";
import { serviceWorkerSource } from "@/lib/pwa/service-worker";

// Service worker (WP-010): generato in fase di build dai testi di messages/it.json.
export const dynamic = "force-static";

export function GET() {
  const t = messages.pwa;
  const siteName = messages.meta.siteName;
  const source = serviceWorkerSource({
    siteName,
    offline: { title: t.offlineTitle, text: t.offlineText, retry: t.retry },
    unavailable: {
      title: t.unavailableTitle,
      text: fillTemplate(t.unavailableText, { siteName }),
      retry: t.retry,
    },
    colors: BRAND_COLORS,
  });
  return new Response(source, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // Il browser controlla sempre se c'è una versione nuova (anche `updateViaCache: "none"` alla registrazione).
      "Cache-Control": "no-cache",
    },
  });
}
