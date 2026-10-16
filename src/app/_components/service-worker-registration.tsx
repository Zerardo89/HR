"use client";

import { useEffect } from "react";

/**
 * Registra il service worker (WP-010): pagina "Sei offline" nell'app installata e nella TWA.
 * Solo in produzione: in sviluppo resterebbe attivo su localhost anche per altri progetti.
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    // Se non si registra (browser vecchio, modalità privata) il sito funziona lo stesso.
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => undefined);
  }, []);
  return null;
}
