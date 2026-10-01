# syntax=docker/dockerfile:1
# Immagini di produzione (WP-010c, ADR-0012). Si costruiscono sul server: funzionano su amd64 e arm64.
#   app   → il sito (output "standalone" di Next.js): niente sorgenti, utente non root
#   tools → worker pg-boss e comandi di gestione (migrazioni, ruoli, import, nomina admin), eseguiti con tsx
# Le password arrivano dai Docker secrets tramite docker/entrypoint.sh: mai nell'immagine, mai nelle variabili del file.

FROM node:24-bookworm-slim AS base
ENV NEXT_TELEMETRY_DISABLED=1 COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app
# Cartella del registro delle cancellazioni (ADR-0014): il volume la eredita con questo proprietario.
RUN mkdir -p /var/lib/hr && chown node:node /var/lib/hr

FROM base AS deps
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
ENV BUILD_STANDALONE=true
RUN pnpm build

FROM base AS app
ARG APP_VERSION=dev
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0 APP_VERSION=${APP_VERSION}
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/entrypoint.sh
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]

FROM deps AS tools
ENV NODE_ENV=production
COPY . .
COPY --chmod=755 docker/entrypoint.sh /usr/local/bin/entrypoint.sh
USER node
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node_modules/.bin/tsx", "--conditions=react-server", "src/worker/index.ts"]
