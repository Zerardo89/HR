import { unsubscribeOneClick } from "@/modules/notifications";

/**
 * Disiscrizione "un clic" (RFC 8058, R-MAIL-01): il programma di posta invia
 * `POST ?token=…` con corpo `List-Unsubscribe=One-Click`, senza cookie né conferma.
 * Risposta sempre 200 senza dettagli: non dice se il token esisteva.
 */
export async function POST(request: Request): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token");
  await unsubscribeOneClick(token);
  return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
}
