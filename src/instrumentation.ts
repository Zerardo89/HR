// Eseguito una volta all'avvio del server Node: se la configurazione non è valida, l'app non parte (WP-002).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getServerEnv } = await import("@/lib/env");
    getServerEnv();
  }
}
