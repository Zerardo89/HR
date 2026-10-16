# ADR-0015 — Il codice lo scrive ChatGPT, anche nei moduli critici; l'architetto specifica e valida

**Stato:** Accettata · **Data:** 16/10/2026 · **Sostituisce in parte:** [ADR-0013](ADR-0013-auth-in-casa.md) (solo la frase
"modulo `identity` scritto e mantenuto dall'architetto") e la tabella dei ruoli di [docs/07-TEAM-AI.md §1](../07-TEAM-AI.md)

## Contesto
Fino al 01/10/2026 quasi tutti i WP li ha scritti l'architetto (Claude): Ollama non è installato sul PC di sviluppo
nuovo e la qualità dei modelli locali non bastava per i moduli critici (rischio R5). ChatGPT faceva la seconda lettura.
Il 16/10/2026 il fondatore ha deciso: **il codice lo scrive ChatGPT, non Claude**, compresi crittografia, accesso,
privacy, proxy, test di accettazione e migrazioni su colonne cifrate.

## Decisione
1. **ChatGPT è l'unico sviluppatore**: codice applicativo, configurazione, script, migrazioni e test. Lavora con Codex CLI
   collegato all'account ChatGPT (modello cloud) sul branch del WP e segue `AGENTS.md`.
2. **Claude non scrive codice.** Scrive le specifiche dei WP (file da toccare, criteri e casi dei test di accettazione,
   regole `R-xxx`), gli ADR e i documenti di progetto (`VERSIONS.md` compreso), valida ogni consegna, fa la revisione di
   sicurezza prima dei rilasci, fa commit e PR del lavoro validato.
3. **Test di accettazione in due passaggi**, perché chi scrive il codice non scriva test su misura del codice:
   a. ChatGPT scrive **solo i test**, con i casi elencati nella specifica. Claude controlla che ci siano tutti e che
      falliscano per il motivo giusto, poi li **congela** in un commit separato.
   b. ChatGPT implementa senza toccare i test congelati. Se il commit dell'implementazione li modifica, il WP è respinto.
4. **Moduli critici: validazione rafforzata.** Per `src/lib/crypto/**`, `src/modules/identity/server/**`,
   `src/modules/privacy/**`, `src/proxy.ts` e le migrazioni che toccano colonne cifrate o `audit_log`, Claude legge il diff
   riga per riga: AAD e versioni delle chiavi, nessun dato in chiaro (DB, log, URL, errori), confronti a tempo costante,
   autorizzazione lato server, audit, limiti di frequenza. Algoritmi, formato dei dati cifrati e gestione delle chiavi
   (ADR-0004) cambiano solo con un nuovo ADR. Le regole di lint che proteggono questi moduli (`decryptPii` solo da
   `privacy` e `lib/crypto`, confini tra moduli) non si toccano nello stesso WP che le userebbe.
5. **Ollama non è più usato per il codice.** ChatGPT non revisiona il proprio codice: l'esito della validazione di Claude
   va nella descrizione della PR, con chi ha scritto cosa.

## Alternative scartate
- **Moduli critici all'architetto, il resto a ChatGPT** (come in CLAUDE.md fino al 15/10): scartata dal fondatore. Il
  controllo incrociato resta, con i ruoli invertiti: prima Claude scriveva e ChatGPT rileggeva, ora il contrario.
- **Ollama come sviluppatore** (piano iniziale): non installato e insufficiente sui moduli critici.

## Conseguenze
- ✅ Chi scrive e chi valida sono sempre due modelli diversi, anche sulla crittografia.
- ✅ I test congelati prima dell'implementazione restano il contratto del WP.
- ⚠️ Più tempo di validazione sui moduli critici: va previsto nella stima dei WP.
- ⚠️ Il codice passa da un servizio cloud di OpenAI: restano vietati dati reali e segreti nel repository e nei prompt
  (docs/07 §5), addestramento sulle conversazioni disattivato.
- ⚠️ Una specifica vaga produce codice sbagliato: le specifiche elencano file, casi di test e confini in modo esplicito.

## Verifica
Ogni PR indica chi ha scritto cosa e l'esito della validazione. Il commit dei test congelati precede quello
dell'implementazione e `git diff <commit-dei-test> -- <file di test>` sull'implementazione è vuoto. CI verde.
