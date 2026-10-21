# ADR-0016 — Flusso di scrittura del codice: Bonsai 2 scrive, GPT rivede, Claude integra

**Stato:** Accettata · **Data:** 20/10/2026 · **Sostituisce in parte:** [ADR-0015](ADR-0015-chatgpt-sviluppatore.md) (solo *chi* scrive il
codice e *come* lo si ottiene: restano validi i test in due passaggi e la validazione rafforzata dei moduli critici)

## Contesto
Il 16/10/2026 il codice passava a ChatGPT via Codex CLI (ADR-0015). Le istruzioni globali del fondatore sul PC di sviluppo
definiscono ora un flusso unico per scrivere codice, in LAN: **Claude → Bonsai 2 → GPT → (correzioni) → Claude**, esposto dal
server MCP `bonsai-gpt` e dalla skill `bonsai-gpt-workflow`. Il modello Bonsai 2 gira sul server in LAN
(`http://192.168.5.100:8081/v1`); la revisione la fa un processo Codex locale con un modello GPT (servizio OpenAI).

## Decisione
1. **Autore del codice: Bonsai 2.** **Autorità della consegna: la revisione GPT.** Claude non scrive codice: prepara il
   contesto (la specifica del WP), riceve il risultato approvato e lo integra nel repository.
2. **Avvio e attesa:** `start_code_task`, poi `get_code_task` fino a stato finale. Durante `drafting_bonsai`,
   `reviewing_gpt` e gli altri stati intermedi si attende: niente bozze prese dai file locali, niente richieste dirette a
   Bonsai per aggirare la revisione.
3. **Quando Claude può integrare:** solo con `status=approved`, `delivery_ready=true` e `result_source=gpt_review`. Con errori,
   revisioni bloccate o rilievi aperti si segnala l'esito all'utente e **non si applica la bozza**. Massimo **due cicli** di
   correzione (Bonsai → GPT); oltre, si ripensa la specifica o si divide il WP.
4. **Integrazione:** Claude applica soltanto le modifiche consegnate, poi esegue `pnpm check` (e integrazione/e2e quando il WP li
   tocca). Non modifica il contenuto per "migliorarlo": se serve una correzione, torna al flusso come nuovo giro.
5. **Test in due passaggi (invariato da ADR-0015):** primo task del flusso = **solo i test**, con i casi elencati nella specifica;
   Claude controlla che coprano tutti i casi e che falliscano per il motivo giusto, poi li congela in un commit separato.
   Secondo task = implementazione, a cui i test congelati vengono dati come vincolo; se l'implementazione li cambia, il WP è respinto.
6. **Moduli critici (invariato):** `src/lib/crypto/**`, `src/modules/identity/server/**`, `src/modules/privacy/**`, `src/proxy.ts`,
   migrazioni su colonne cifrate o `audit_log`. Claude legge il diff **riga per riga** (AAD e versioni delle chiavi, nessun dato
   in chiaro, confronti a tempo costante, autorizzazione lato server, audit, limiti). Algoritmi, formato dei dati cifrati e chiavi
   cambiano solo con un nuovo ADR.
7. **Ambito di Codex CLI:** non è più il canale per scrivere WP. Resta il processo revisore del flusso e, per lavori di sola
   configurazione già specificati e piccoli (come l'override di `@swc/core` del 16/10), un'eccezione da dichiarare nella PR.
8. **Dati e segreti:** la bozza passa da Bonsai (LAN) e il diff dal revisore (OpenAI). Restano vietati dati reali, segreti e
   contenuto di `secrets/` nei prompt e nelle specifiche (docs/07 §5). Se `workflow_status` dice che il collegamento è disattivato,
   non si inviano richieste ai modelli.

## Alternative scartate
- **Mantenere ChatGPT/Codex come unico autore (ADR-0015):** in contrasto con il flusso scelto dal fondatore per il PC di sviluppo.
- **Claude che applica correzioni "a mano" dopo la revisione:** annulla il controllo incrociato autore ≠ revisore ≠ integratore.

## Conseguenze
- ✅ Tre ruoli distinti sul codice: autore (Bonsai), revisore con autorità di consegna (GPT), integratore e validatore (Claude).
- ✅ Il server in LAN toglie il codice grezzo dal cloud fino alla revisione.
- ⚠️ Dipende dal server in LAN (`192.168.5.100`) acceso e raggiungibile: se è giù, i WP di codice si fermano.
- ⚠️ Il limite di due cicli può bloccare WP grossi: le specifiche vanno tenute piccole (≤ ~300 righe, 1-5 file).
- ⚠️ "Integrare" è un atto sul repository: lo si fa sul branch del WP, mai direttamente su `main`.

## Verifica
Ogni PR dice: WP, task del flusso (id dei task `start_code_task`), stato finale `approved` con `delivery_ready=true`,
quanti cicli di correzione, e l'esito della validazione di Claude. Il commit dei test congelati precede quello
dell'implementazione e non viene modificato da esso.
