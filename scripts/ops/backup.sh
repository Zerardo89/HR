#!/usr/bin/env bash
# Backup giornaliero (docs/04 §6, WP-027): dump del DB e registro delle cancellazioni in restic, cifrati e fuori
# sede. Conservazione 7 giornalieri / 4 settimanali / 6 mensili (ADR-0014: al più ~6 mesi).
# La KEK NON va in questo backup: la custodisce il custode delle chiavi, altrove (docs/04 §4).
#
# Variabili (dai segreti del server, mai nel repo):
#   DATABASE_URL        utente proprietario (serve leggere tutte le tabelle)
#   RESTIC_REPOSITORY   repository fuori sede (altro fornitore UE)
#   RESTIC_PASSWORD_FILE file con la password del repository
#   ERASURE_LEDGER_FILE registro delle cancellazioni (facoltativo ma previsto in produzione)
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL mancante}"
: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY mancante}"
: "${RESTIC_PASSWORD_FILE:?RESTIC_PASSWORD_FILE mancante}"

stamp="$(date -u +%Y-%m-%dT%H%M%SZ)"

# Formato "custom" di pg_dump: compresso, si ripristina con pg_restore (anche tabella per tabella).
pg_dump --format=custom --no-owner --no-privileges "$DATABASE_URL" \
  | restic backup --stdin --stdin-filename "hr-db-${stamp}.dump" --tag db --quiet

if [[ -n "${ERASURE_LEDGER_FILE:-}" && -f "$ERASURE_LEDGER_FILE" ]]; then
  restic backup "$ERASURE_LEDGER_FILE" --tag registro --quiet
fi

restic forget --keep-daily 7 --keep-weekly 4 --keep-monthly 6 --prune --quiet
echo "Backup ${stamp} completato."
