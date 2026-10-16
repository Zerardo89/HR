import { appIcon, type AppIconVariant } from "@/app/_components/app-icon";

// Icone del manifest (WP-010): indirizzi fissi con l'estensione, generate in fase di build.
const ICONS: Record<string, { size: number; variant: AppIconVariant }> = {
  "icon-192.png": { size: 192, variant: "any" },
  "icon-512.png": { size: 512, variant: "any" },
  "maskable-512.png": { size: 512, variant: "maskable" },
};

export const dynamic = "force-static";
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(ICONS).map((file) => ({ file }));
}

export async function GET(_request: Request, { params }: RouteContext<"/icons/[file]">) {
  const icon = ICONS[(await params).file];
  if (!icon) return new Response(null, { status: 404 });
  return appIcon(icon.size, icon.variant);
}
