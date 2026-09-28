import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { STATIC_SECURITY_HEADERS } from "./src/lib/security-headers";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Immagine Docker minimale (ADR-0006): il Dockerfile imposta BUILD_STANDALONE=true.
  output: process.env.BUILD_STANDALONE === "true" ? "standalone" : undefined,
  poweredByHeader: false,
  reactStrictMode: true,
  // pino e pg restano dipendenze server esterne al bundle.
  serverExternalPackages: ["pino", "pg"],
  // Header di sicurezza su tutte le risposte, API comprese (WP-027); la CSP con nonce la mette src/proxy.ts.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: STATIC_SECURITY_HEADERS.map(([key, value]) => ({ key, value })),
      },
    ];
  },
};

export default withNextIntl(nextConfig);
