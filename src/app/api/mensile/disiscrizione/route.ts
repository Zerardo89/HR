import { stopMonthlyOneClick } from "@/modules/notifications";

/**
 * Disiscrizione "un clic" dalla mail mensile (RFC 8058, R-MAIL-01): `POST ?token=…` dal programma di posta.
 * Risposta sempre 200 senza dettagli: non dice se il token esisteva.
 */
export async function POST(request: Request): Promise<Response> {
  await stopMonthlyOneClick(new URL(request.url).searchParams.get("token"));
  return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
}
