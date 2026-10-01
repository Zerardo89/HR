#!/usr/bin/env bash
# Backup orario del solo registro delle cancellazioni (ADR-0014, runbook BACKUP-E-RIPRISTINO.md §2): dopo un
# disastro manca al più un'ora di cancellazioni da ripetere. Il backup notturno completo è backup.sh.
#
# Variabili: RESTIC_REPOSITORY, RESTIC_PASSWORD_FILE, ERASURE_LEDGER_FILE (vedi backup.sh).
set -euo pipefail

: "${RESTIC_REPOSITORY:?RESTIC_REPOSITORY mancante}"
: "${RESTIC_PASSWORD_FILE:?RESTIC_PASSWORD_FILE mancante}"

# Finché nessuno ha cancellato l'account il registro non esiste: niente da salvare.
if [[ -z "${ERASURE_LEDGER_FILE:-}" || ! -f "$ERASURE_LEDGER_FILE" ]]; then
  exit 0
fi
restic backup "$ERASURE_LEDGER_FILE" --tag registro --quiet
