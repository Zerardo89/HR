# Runbook — backup, ruoli del database, ripristino

> WP-027 · docs/04 §5-§6 · ADR-0014. Lo esegue chi gestisce il server (oggi il fondatore; con la Fase 2 anche il
> custode delle chiavi). Nessun passo richiede di leggere dati personali: gli script stampano solo conteggi.

## 1. Ruoli del database (a ogni deploy, dopo le migrazioni)

| Ruolo | Chi lo usa | Cosa può fare |
|-------|------------|---------------|
| proprietario (es. `hr`) | solo la pipeline di deploy | migrazioni (`pnpm db:migrate`), ruoli, backup |
| `hr_app` | l'app web | leggere e scrivere i dati; sul log di audit **solo aggiungere e leggere**; niente DDL |
| `hr_worker` | il worker (job pianificati) | come `hr_app` + cancellare il log di audit oltre i 12 mesi (il trigger ammette solo quelle righe) + schema `pgboss` |

```sh
pnpm db:migrate
DB_APP_PASSWORD=… DB_WORKER_PASSWORD=… pnpm db:roles   # idempotente; password dai segreti del server
```

Poi l'app web ha `DATABASE_URL=postgres://hr_app:…` e il worker `DATABASE_URL=postgres://hr_worker:…`.
Il primo avvio del worker deve avvenire **dopo** `db:roles` (così lo schema `pgboss` è di `hr_worker`).
La CI fa girare tutti gli e2e con questi ruoli (`E2E_APP_DATABASE_URL`, `E2E_WORKER_DATABASE_URL`).

## 2. Backup (ogni notte)

`scripts/ops/backup.sh`: dump del DB (`pg_dump` formato custom) e registro delle cancellazioni in **restic**, cifrati,
su un altro fornitore UE. Conservazione 7 giornalieri, 4 settimanali, 6 mensili (ADR-0014: al più ~6 mesi).

- Orario: **01:30 ora italiana**. Mai tra le 2 e le 3 (il cambio dell'ora salta o ripete quell'ora); i job del worker
  partono dalle 03:30.
- **La KEK non è nel backup.** Senza KEK il backup è illeggibile: è voluto. La KEK la custodisce il custode delle
  chiavi (docs/04 §4); perderla = perdere i dati personali, quindi la sua copia di riserva segue la procedura del §4.
- Il registro delle cancellazioni è piccolo: salvarlo anche **ogni ora** (`restic backup "$ERASURE_LEDGER_FILE"
  --tag registro`), così dopo un disastro manca al più un'ora di cancellazioni (vedi §5).

## 3. Registro delle cancellazioni (ADR-0014)

Ogni cancellazione di account scrive una riga JSON con il **solo id** nel file `ERASURE_LEDGER_FILE` (volume del
server, permessi 600) e l'evento `account.erased` nel log dell'app. Servono a ripetere le cancellazioni dopo un
ripristino. Il file va conservato **almeno 7 mesi** (più dei backup) e non contiene dati personali.
Se la scrittura del registro fallisce, la cancellazione vale lo stesso e il log registra `erasure-ledger.failed`
(livello error): va sistemato subito, perché quell'id resta solo nel log.

## 4. Prova di ripristino (ogni mese, documentata)

```sh
restic restore latest --tag db --target /tmp/prova          # oppure: restic dump latest hr-db-….dump > prova.dump
ADMIN_URL=postgres://proprietario@localhost/postgres \
  scripts/ops/restore-test.sh /tmp/prova/hr-db-….dump "$ERASURE_LEDGER_FILE"
```

Lo script crea un DB di prova, ripristina, stampa i conteggi delle tabelle principali e l'ultima migrazione, ripete
le cancellazioni successive al backup e cancella il DB di prova. Annotare data, backup usato ed esito in fondo a
questo file. Provato il 28/09/2026 su un DB di test: ripristino completo, 1 cancellazione ripetuta, 1 già presente.

## 5. Ripristino vero (disastro o errore grave)

1. Fermare app e worker (niente scritture durante il ripristino).
2. Creare il DB, estensioni `postgis`, `pg_trgm`, `unaccent`; `pg_restore --no-owner --no-privileges` del backup scelto.
3. `pnpm db:migrate` (se il backup è precedente alle ultime migrazioni), poi `pnpm db:roles`.
4. **Ripetere le cancellazioni** con il registro più recente disponibile (e, se c'è, il log dell'app):
   `DATABASE_URL=… pnpm privacy:reapply-erasures "$ERASURE_LEDGER_FILE" [log…]`. Obbligatorio (ADR-0014).
5. Rimettere la KEK (dal custode) e avviare app e worker; controllare `/api/health`.
6. Annotare l'accaduto e, se sono andati persi dati dopo l'ultimo backup, valutare la comunicazione agli utenti.

**Limite noto:** se si perde il server, le cancellazioni avvenute dopo l'ultimo salvataggio del registro (al più
un'ora, §2) non si ripetono. Per ridurlo a zero il registro andrebbe replicato fuori dal server a ogni scrittura:
da valutare con la Fase 2 (docs/04 §4).

## Registro delle prove di ripristino

| Data | Backup usato | Esito | Chi |
|------|--------------|-------|-----|
| 28/09/2026 | dump del DB di test e2e | riuscito (script `restore-test.sh`) | Claude, in sviluppo |
