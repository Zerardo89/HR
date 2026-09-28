import { getCurrentUser } from "@/modules/identity";
import { getMyDataExport } from "@/modules/privacy";

/**
 * "Scarica i miei dati" (WP-023, R-PRIV-04, art. 15 e 20 GDPR): JSON con tutti i dati della persona che ha fatto
 * l'accesso (con il secondo passaggio se attivo). Mai in cache; nessun dato nell'indirizzo.
 */
export async function GET(): Promise<Response> {
  const user = await getCurrentUser();
  if (!user || (user.mfa.enabled && !user.mfa.verified)) {
    return new Response(null, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const data = await getMyDataExport(user.id);
  if (!data) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="i-miei-dati.json"',
      "Cache-Control": "no-store",
    },
  });
}
