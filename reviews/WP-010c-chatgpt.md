# WP-010c — revisione di ChatGPT (Codex CLI, 01/10/2026)

> Prompt: `docs/prompts/chatgpt-revisione.md` sul commit del WP-010c (contenitori e guida del server di casa).
> Risposta originale sotto; la gestione dell'architetto è in fondo.

## 1. Bloccanti

1. [docker-compose.prod.yml:121](../docker-compose.prod.yml:121) · **Il backup può non avviarsi su Linux.** `backup` esegue `/entrypoint.sh` montato dal repository, dove il file ha permessi Git `100644`. Il `chmod 755` nel Dockerfile vale solo per le copie nelle immagini `app` e `tools`. È grave perché backup e `restic init` possono fallire sul server Ubuntu, anche se provati con Docker Desktop. **Patch minima:** `entrypoint: ["sh", "/entrypoint.sh"]`. Aggiungere alla CI un `docker compose ... --profile ops run --rm backup true` per coprire questo avvio.

2. [SERVER-DI-CASA.md:123](../docs/runbook/SERVER-DI-CASA.md:123) · **Il registro delle cancellazioni viene salvato solo ogni notte.** Il [runbook di ripristino](../docs/runbook/BACKUP-E-RIPRISTINO.md:31) prevede anche una copia oraria. Se il server si perde dopo una cancellazione, ripristinare il DB senza la riga corrispondente del registro può far ricomparire l’account cancellato: contrasta con ADR-0014. **Patch minima:** aggiungere un secondo cron orario che esegua nel servizio `backup` `restic backup "$ERASURE_LEDGER_FILE" --tag registro --quiet`, saltando il comando finché il file non esiste; provare poi il ripristino da una copia del DB precedente a una cancellazione.

## 2. Importanti

1. [SERVER-DI-CASA.md:34](../docs/runbook/SERVER-DI-CASA.md:34) · **L’utente aggiunto al gruppo `docker` ottiene di fatto privilegi amministrativi.** La guida non realizza l’utente di servizio dedicato e senza privilegi richiesto da ADR-0012 e `docs/04` §4-bis. **Patch proposta:** tenere separati l’account amministratore che impartisce i comandi Docker e l’account dedicato proprietario di `/srv/hr`; eliminare `usermod -aG docker "$USER"` e adeguare i comandi della guida a questa separazione.

2. [SERVER-DI-CASA.md:132](../docs/runbook/SERVER-DI-CASA.md:132) · **La procedura di aggiornamento non aggiorna esplicitamente le immagini esterne.** `git pull` e `up --build` non costituiscono una procedura per aggiornare `cloudflared`; questo usa anche `--no-autoupdate`. **Patch minima:** aggiungere `docker compose -f docker-compose.prod.yml pull cloudflared` prima di `up`, e indicare una verifica periodica degli aggiornamenti di Docker e delle immagini, come richiede ADR-0012.

3. [SERVER-DI-CASA.md:150](../docs/runbook/SERVER-DI-CASA.md:150) · **Il percorso “cambiare macchina” non è eseguibile alla lettera.** Ripetere i passi 1–3 con le vecchie chiavi fa fallire `generate-keys.ts`, che correttamente rifiuta di sovrascriverle; il runbook richiamato usa inoltre comandi host `restic` e `pnpm`, non installati dalla guida del server. **Patch proposta:** distinguere esplicitamente *prima installazione* e *ripristino*, saltare entrambi i generatori quando si copiano i segreti esistenti e dare i comandi di ripristino tramite i contenitori già previsti.

4. [SERVER-DI-CASA.md:110](../docs/runbook/SERVER-DI-CASA.md:110) · **L’email reale dell’amministratore finisce nella cronologia della shell** quando si sostituisce il segnaposto nel comando. È un dato personale persistente sul server, anche se lo script non lo stampa. **Patch minima per la guida:** acquisirla con `read -r -s` prima del comando e cancellare subito la variabile. Per eliminarla anche dagli argomenti del contenitore serve farla leggere da stdin a `scripts/users-role.ts`, file fuori dal WP: va assegnato dall’architetto.

5. [generate-server-secrets.ts:28](../scripts/generate-server-secrets.ts:28) · **“Non sovrascrivere” non è garantito se due esecuzioni partono insieme:** tra `existsSync` e `writeFileSync` un’altra esecuzione può creare il file. **Patch minima:** creare con `flag: "wx"` e trattare `EEXIST` come “già presente”.

## 3. Semplificazioni

- [docker-compose.prod.yml:43](../docker-compose.prod.yml:43) · Il comando ripete i percorsi di due script già dichiarati in `package.json`. **Patch minima:** sostituire la riga con `pnpm db:migrate && pnpm db:roles`; riduce duplicazione mantenendo lo stesso ordine.

## 4. Conformità

- **Criteri di accettazione:** ✅ immagini `app`/`tools`, PostGIS multiarchitettura, reti senza porte pubblicate, ruoli DB, sito in sola lettura e worker: coperti dal diff e dalle prove manuali riferite. ✅ variabili vuote: test aggiunto. ❌ backup affidabile su Linux e salvataggio orario del registro. ⏳ tunnel pubblico e ripristino R2 sul server reale: previsti dall’ADR, non ancora verificati.
- **Test:** la CI include `pnpm check` nei suoi passi, ma il nuovo job Docker non avvia `backup`. In questa revisione di sola lettura non ho rieseguito `pnpm check`; `git diff HEAD^ HEAD --check` non ha segnalato errori.
- **Dipendenze aggiunte:** nessun pacchetto npm aggiunto; nessuna nuova dipendenza npm da verificare per esistenza o manutenzione. Le immagini sono specificate nel WP.
- **Dati personali in log/errori/URL:** **no** nel nuovo codice esaminato; **sì nella cronologia shell** se si segue il comando per nominare l’amministratore con l’email reale.
- **Stringhe UI fuori da `messages/it.json`:** **no**, per il codice UI modificato da questo commit.

## 5. Verdetto

**DA CORREGGERE.** Passare al modello locale, nell’ordine:

1. Rendere eseguibile l’entrypoint del servizio `backup` su Linux e aggiungere la prova CI.
2. Salvare ogni ora il registro delle cancellazioni e verificare un ripristino con cancellazione successiva al dump.
3. Correggere la guida su account di servizio, aggiornamenti e ripristino su nuova macchina.
4. Evitare l’email nella cronologia shell; chiedere a Claude di estendere il perimetro del WP se vuole eliminarla anche dagli argomenti del contenitore.
5. Rendere atomica la creazione dei segreti.


---

## Gestione dell'architetto (Claude)

| # | Punto | Esito |
|---|-------|-------|
| B1 | `backup` esegue `/entrypoint.sh` montato senza permesso di esecuzione | ✅ Applicato: `entrypoint: ["sh", "/entrypoint.sh"]` e bit eseguibile in Git; la CI avvia `tools` e `backup`. |
| B2 | Registro delle cancellazioni salvato solo di notte | ✅ Applicato: `scripts/ops/backup-registro.sh` e cron orario nella guida. **Provato**: backup notturno e orario, DB cancellato, ripristino con i comandi della guida (263 mansioni tornate, sito sano), registro ripristinato e cancellazioni ripetute. |
| I1 | Utente nel gruppo `docker` = amministratore | ✅ Applicato: niente gruppo `docker`, comandi con `sudo` e cron dell'amministratore; server dedicato solo al sito. Un utente di servizio separato non toglierebbe il rischio (chi comanda Docker comanda il server). |
| I2 | Aggiornamento di cloudflared e delle immagini di base | ✅ Applicato: `pull cloudflared` e `build --pull`, anche una volta al mese. |
| I3 | "Cambiare macchina" non eseguibile alla lettera | ✅ Riscritto: niente generatori, comandi di ripristino nei contenitori; provato come sopra. |
| I4 | Email dell'admin nella cronologia della shell | ✅ Applicato fino in fondo: `users-role.ts` accetta `-` e chiede l'email dopo l'avvio (estensione del perimetro decisa dall'architetto). |
| I5 | Creazione dei segreti non atomica | ✅ Applicato: `flag: "wx"`. |
| S1 | `pnpm db:migrate && pnpm db:roles` nel compose | ❌ Non applicato: nell'immagine `tools` l'utente `node` non ha pnpm (corepack lo scaricherebbe all'avvio, senza rete garantita); si usa `tsx` direttamente. |

Verdetto finale: **approvato** dopo le correzioni.
