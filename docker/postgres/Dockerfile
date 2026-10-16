# Postgres 17 + PostGIS 3 per il server (WP-010c). Multi-architettura: l'immagine `postgis/postgis` esiste solo
# per amd64 (ADR-0012), quindi si parte dall'immagine ufficiale `postgres` (amd64 e arm64) e si aggiunge PostGIS dal
# repository ufficiale di PostgreSQL, già configurato nell'immagine. restic serve al backup (scripts/ops/backup.sh).
FROM postgres:17-bookworm
RUN apt-get update \
  && apt-get install -y --no-install-recommends postgresql-17-postgis-3 restic ca-certificates \
  && rm -rf /var/lib/apt/lists/*
