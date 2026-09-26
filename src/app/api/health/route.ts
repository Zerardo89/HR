import { NextResponse } from "next/server";
import { pingDb } from "@/lib/db";

export const dynamic = "force-dynamic";

// Stato del servizio per Uptime Kuma: nessun dettaglio interno (versione sì, errori no).
export async function GET() {
  const dbOk = await pingDb();
  return NextResponse.json(
    {
      status: dbOk ? "ok" : "degraded",
      db: dbOk ? "ok" : "down",
      version: process.env.APP_VERSION ?? "dev",
    },
    { status: dbOk ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
