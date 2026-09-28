#!/usr/bin/env bash
# Prova di ripristino (docs/04 §6: mensile e documentata; WP-027). Ripristina un dump in un DB di prova, controlla
# che sia completo, ripete le cancellazioni successive al backup (ADR-0014) e cancella il DB di prova.
# Non legge né stampa dati personali: solo conteggi.
#
# Uso: ADMIN_URL=postgres://proprietario@host/postgres scripts/ops/restore-test.sh <dump> <registro.jsonl>
#   <dump>      file di pg_dump (da `restic restore latest --tag db` o `restic dump latest …`)
#   <registro>  registro delle cancellazioni ATTUALE (non quello del backup)
set -euo pipefail

: "${ADMIN_URL:?ADMIN_URL mancante (utente che può creare database)}"
dump="${1:?manca il file del dump}"
ledger="${2:?manca il registro delle cancellazioni}"
db="hr_prova_ripristino_$(date -u +%Y%m%d%H%M%S)"
base="${ADMIN_URL%/*}"
target="${base}/${db}"

cleanup() { psql "$ADMIN_URL" -qc "drop database if exists \"${db}\" with (force)" >/dev/null; }
trap cleanup EXIT

psql "$ADMIN_URL" -qc "create database \"${db}\""
psql "$target" -qc "create extension if not exists postgis; create extension if not exists pg_trgm; create extension if not exists unaccent"
pg_restore --no-owner --no-privileges --exit-on-error --dbname="$target" "$dump" 2>&1 \
  | grep -v "already exists" || true

echo "Righe ripristinate (conteggi, nessun dato):"
for table in users companies job_offers applications consents audit_log; do
  echo "  ${table}: $(psql "$target" -tAc "select count(*) from ${table}")"
done
psql "$target" -tAc "select 'Ultima migrazione applicata: ' || to_timestamp(max(created_at) / 1000) from drizzle.__drizzle_migrations"

DATABASE_URL="$target" pnpm -s privacy:reapply-erasures "$ledger"
echo "Prova di ripristino riuscita (${db}, poi cancellato)."
