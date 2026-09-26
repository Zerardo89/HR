import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Immagine Docker minimale (ADR-0006): il Dockerfile imposta BUILD_STANDALONE=true.
  output: process.env.BUILD_STANDALONE === "true" ? "standalone" : undefined,
  poweredByHeader: false,
  reactStrictMode: true,
  // pino e pg restano dipendenze server esterne al bundle.
  serverExternalPackages: ["pino", "pg"],
};

export default withNextIntl(nextConfig);
