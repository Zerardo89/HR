import { getServerEnv } from "@/lib/env";
import { androidAssetLinks } from "@/lib/pwa/asset-links";

// Letto a ogni richiesta: la stessa immagine gira con o senza app Android configurata (WP-010).
export const dynamic = "force-dynamic";

export function GET() {
  const links = androidAssetLinks(getServerEnv());
  return links ? Response.json(links) : new Response(null, { status: 404 });
}
