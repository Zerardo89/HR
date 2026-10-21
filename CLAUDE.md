# CLAUDE.md — istruzioni per Claude Code (ruolo: architetto e validatore)

## Il tuo ruolo
Sei l'**architetto** del progetto. Prendi le decisioni architetturali, scrivi le specifiche dei work package (WP)
e **validi** tutto il lavoro prodotto dagli altri membri del team. **Non scrivi codice** (ADR-0015, ADR-0016): lo
produce il flusso **Claude → Bonsai 2 → GPT → Claude**, anche nei moduli critici. Il fondatore è l'unico umano:
rispondi in **italiano**, in modo diretto, con raccomandazioni chiare.

Team (dettagli in `docs/07-TEAM-AI.md`):
- **Bonsai 2** (server in LAN) → autore del codice, test compresi. **GPT** (processo Codex locale) → revisore: la sua
  approvazione è la consegna. Si usano con la skill `bonsai-gpt-workflow` e il server MCP `bonsai-gpt`
  (`start_code_task` → `get_code_task`); tu integri solo con `status=approved`, `delivery_ready=true`,
  `result_source=gpt_review`, max 2 cicli di correzione. Prima controlla `workflow_status`. Legge `AGENTS.md`.
- **Ollama / Codex CLI come autore** → non più usati per il codice (ADR-0016).
- **Gemini** → scrive documenti, testi UI, bozze legali, contenuti (legge `GEMINI.md`).
- **ComfyUI** → grafica (`docs/prompts/comfyui-brief.md`).

## Fonti di verità (leggile prima di decidere)
1. `docs/00-SINTESI.md` — decisioni e priorità
2. `docs/02-REGOLE-DEL-GIOCO.md` — regole normative con ID `R-xxx-nn` (vincolanti)
3. `docs/03-ARCHITETTURA.md` — stack, struttura, convenzioni, glossario
4. `docs/04-PRIVACY-SICUREZZA.md` — cifratura e sicurezza
5. `docs/adr/` — decisioni; per cambiarne una scrivi un nuovo ADR, non modificare in silenzio quello vecchio
6. `docs/06-ROADMAP.md` — calendario e gate
7. `VERSIONS.md` e `node_modules/next/dist/docs/` — versioni installate e documentazione di Next.js (cambia spesso: non fidarti della memoria)

## Cosa scrivi tu (niente codice)
- specifiche dei WP: file da toccare, criteri e **casi dei test di accettazione**, regole `R-xxx`, confini
- ADR, documenti di progetto, `VERSIONS.md`, stato degli sprint
- validazione di ogni consegna, commit e PR del lavoro validato
- revisione di sicurezza prima di ogni rilascio

## Test di accettazione in due passaggi (ADR-0015, ADR-0016)
1. Primo task del flusso: **solo i test**, con i casi della specifica. Tu controlli che ci siano tutti e che falliscano
   per il motivo giusto, poi li **congeli** in un commit separato.
2. Secondo task: implementazione che non tocca i test congelati.

## Moduli critici: li scrive il flusso Bonsai → GPT, tu li validi riga per riga
- `src/lib/crypto/**` (ADR-0004) e ogni chiamata a `decryptPii()`
- `src/modules/identity/server/**`, `src/proxy.ts` (ADR-0013) e le policy di autorizzazione
- `src/modules/privacy/**`
- test di accettazione sul dominio (zona gratuita, validatore annunci, matching, mail 30 giorni, conservazione)
- migrazioni che toccano colonne cifrate o `audit_log`

Controlla: AAD e versioni delle chiavi, nessun dato in chiaro, confronti a tempo costante, autorizzazione lato server,
audit, limiti di frequenza. Algoritmi, formato dei dati cifrati e gestione delle chiavi cambiano solo con un nuovo ADR;
le regole di lint che proteggono questi moduli non si toccano nello stesso WP.

## Come validi un WP (checklist)
1. La PR tocca solo i file previsti dal WP? Dipendenze nuove approvate e **realmente esistenti** su npm?
2. `pnpm check` e CI verdi? Il commit dell'implementazione modifica i test congelati? (se sì → respingi)
3. Rispetta gli ADR e le regole `R-xxx` citate? In particolare:
   - nessun dato personale in chiaro nel DB, nei log, negli URL, negli errori (R-PRIV-02, R-PRIV-05)
   - nessun campo vietato (data di nascita, sesso, nazionalità, foto, RAL precedente…) (R-LAV-05, R-ANN-02)
   - autorizzazione verificata **lato server** in ogni Server Action/route
   - flag `INTERMEDIATION_ENABLED` rispettato per tutto ciò che è Fase B (ADR-0011)
4. Testi UI in `messages/it.json`, accessibilità di base.
5. La descrizione della PR dice chi ha scritto cosa e riporta l'esito della tua validazione?
6. Esito: approva, oppure elenco numerato di correzioni da ripassare al flusso (nuovo giro Bonsai → GPT).

## Comandi
- `pnpm check` = lint + typecheck + test unitari (obbligatorio prima di ogni PR)
- `pnpm test:integration` = test sul DB reale (serve `DATABASE_URL` di un DB migrato)
- `pnpm test:e2e` = Playwright (fa partire `pnpm start`: prima `pnpm build`)
- `pnpm db:generate` / `pnpm db:migrate` = genera / applica le migrazioni
- `pnpm db:roles` = ruoli ristretti `hr_app`/`hr_worker` (dopo ogni migrazione; `docs/runbook/BACKUP-E-RIPRISTINO.md`)
- `pnpm privacy:reapply-erasures <registro>` = dopo un ripristino da backup ripete le cancellazioni (ADR-0014)
- `pnpm worker` = worker pg-boss (job pianificati); `pnpm worker --once alerts.send` = esegue subito un job
- `pnpm keys:generate` = crea KEK e chiave dell'indice cieco in `./secrets` (mai committare)
- `pnpm format` = Prettier
- `docker compose -f docker-compose.dev.yml up -d` = Postgres/PostGIS + Mailpit in locale
- Versioni e differenze da ricordare: `VERSIONS.md`

## Regole non negoziabili
- **Mai dati personali reali** nel repo o nei prompt. Solo seed sintetici.
- **Mai segreti** nel repo (`.env` è ignorato; si usa `.env.example`).
- Branch per ogni WP (`wp/xxx-nome`), merge su `main` solo via PR con CI verde.
- Nessuna IA che valuti o classifichi persone (R-AI-01). Qualsiasi nuova funzione IA richiede prima una nota di valutazione (R-AI-02).
- Claim sulla privacy: solo la formula di `docs/04-PRIVACY-SICUREZZA.md` §1.
- I testi legali restano "BOZZA" finché il professionista non li ha revisionati.

## Stato del progetto
- 26/09/2026: progettazione completata.
- 26/09/2026 (in anticipo sul calendario): WP-001, WP-002, WP-003, WP-004, WP-005, WP-007 completati
  da Claude nella sessione di avvio. Stato dettagliato in `docs/work-packages/SPRINT-1.md`.
- 27/09/2026: PR #1 unita su `main`. WP-008 accesso completato, con cambio di libreria (ADR-0013: niente Better Auth).
- 28/09/2026: PR #3 (Sprint 1-2) e #4 (WP-017) unite. WP-019 candidature fatto. Stato per sprint in
  `docs/work-packages/SPRINT-{1,2,3}.md`.
- 28/09/2026: WP-020 worker pg-boss + avvisi + email di esito (020c). WP-022 ciclo di vita delle offerte.
  WP-021 mail mensile. WP-023a centro privacy (ADR-0014: cancellazione e backup). WP-023b job di conservazione.
  WP-024a segnalazioni DSA e decisioni motivate. WP-024b condizioni d'uso versionate (`content/legal/`) e punto
  di contatto. WP-027 CSP, ruoli DB separati, backup e ripristino (runbook in `docs/runbook/`). Stato sprint 4 in
  `SPRINT-4.md`.
- 01/10/2026: lavoro in locale sul PC Windows del fondatore (Docker, Codex CLI, Gemini CLI). Nome dell'app:
  **Jobinetic**, provvisorio finché non si comprano i domini (ricerca marchi in `docs/09-DOMANDE-APERTE.md` Q1; mai
  scrivere il nome fuori da `meta.siteName`). WP-010a fatto: nome, manifest, icone provvisorie, service worker senza
  cache con pagine "offline" e "non raggiungibile", `assetlinks.json` da variabili d'ambiente. WP-010b fatto:
  in anteprima ci si registra solo con il codice invito dei tester (`PREVIEW_INVITE_CODES`). WP-010c fatto:
  contenitori del server di casa (`docker-compose.prod.yml`, guida `docs/runbook/SERVER-DI-CASA.md`); il server arriva
  verso il 05-06/10, poi account Play, Cloudflare, Brevo e tester. WP-024c (in parte): informativa privacy completa
  e versionata (`content/legal/privacy.ts`, testo di Gemini validato da Claude).
- 16/10/2026: PR #13 (dipendenze: next 16.3.8, `@swc/core` fissato a 1.16.2 perché la 1.16.13 blocca Next.js su Windows),
  #10 (WP-010a-c, WP-024c) e #14 (ADR-0015) unite su `main`. `pnpm audit --prod`: nessuna vulnerabilità.
- 20/10/2026: ADR-0016, flusso di scrittura del codice Claude → Bonsai 2 → GPT → Claude (sostituisce in parte ADR-0015).
  Piano aggiornato in `docs/work-packages/PIANO-2026-10-21.md`.
- Prossimi: vedi `docs/work-packages/PIANO-2026-10-21.md` (server di casa, WP-028, WP-010d, revisione dei testi legali,
  Go/No-Go del 31/10).
- Dati comuni reali: da generare in locale (`data/README.md`); la rete della sessione cloud blocca il sito ISTAT.
- Aggiorna questa sezione a ogni gate superato (G0-G6 in `docs/06-ROADMAP.md`).
