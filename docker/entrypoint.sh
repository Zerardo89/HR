#!/bin/sh
# Prepara le variabili che contengono password leggendo i Docker secrets (WP-010c): le password non stanno mai nel
# file .env.production, nel file compose o nell'immagine. Poi avvia il comando del servizio.
#
# DB_ROLE sceglie con chi collegarsi al database (docs/runbook/BACKUP-E-RIPRISTINO.md §1):
#   owner  → hr         (solo migrazioni, ruoli, backup)
#   app    → hr_app     (il sito)
#   worker → hr_worker  (i job pianificati)
set -eu

secret() {
  tr -d '\r\n' < "/run/secrets/$1"
}

case "${DB_ROLE:-}" in
  owner) db_user=hr ;;
  app) db_user=hr_app ;;
  worker) db_user=hr_worker ;;
  "") db_user= ;;
  *)
    echo "DB_ROLE sconosciuto: usa owner, app o worker." >&2
    exit 1
    ;;
esac

# Le password sono generate in esadecimale (scripts/generate-server-secrets.ts): si possono mettere nell'URL così.
if [ -n "$db_user" ]; then
  DATABASE_URL="postgres://${db_user}:$(secret "db_${DB_ROLE}_password")@${DB_HOST:-db}:${DB_PORT:-5432}/${DB_NAME:-hr}"
  export DATABASE_URL
fi

# Solo per `pnpm db:roles` (servizio migrate): le password dei due ruoli ristretti.
if [ "${DB_ROLE:-}" = owner ] && [ -f /run/secrets/db_app_password ]; then
  DB_APP_PASSWORD="$(secret db_app_password)"
  DB_WORKER_PASSWORD="$(secret db_worker_password)"
  export DB_APP_PASSWORD DB_WORKER_PASSWORD
fi

# Posta (Brevo) e backup fuori sede (Cloudflare R2): solo se il segreto è stato montato.
if [ -f /run/secrets/smtp_password ]; then
  SMTP_PASS="$(secret smtp_password)"
  export SMTP_PASS
fi
if [ -f /run/secrets/r2_access_key_id ]; then
  AWS_ACCESS_KEY_ID="$(secret r2_access_key_id)"
  AWS_SECRET_ACCESS_KEY="$(secret r2_secret_access_key)"
  export AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY
fi

exec "$@"
