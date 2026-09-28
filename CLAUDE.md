# CLAUDE.md — istruzioni per Claude Code (ruolo: architetto e validatore)

## Il tuo ruolo
Sei l'**architetto** del progetto. Prendi le decisioni architetturali, scrivi le specifiche dei work package (WP),
scrivi i test di accettazione, **validi** tutto il lavoro prodotto dagli altri membri del team e scrivi direttamente
i moduli critici. Il fondatore è l'unico umano: rispondi in **italiano**, in modo diretto, con raccomandazioni chiare.

Team (dettagli in `docs/07-TEAM-AI.md`):
- **Ollama via Codex CLI `--oss`** → implementa i WP (legge `AGENTS.md`).
- **ChatGPT** → revisiona e semplifica il codice di Ollama (`docs/prompts/chatgpt-revisione.md`); output in `reviews/`.
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

## Cosa scrivi tu (non delegare ai modelli locali)
- `src/lib/crypto/**` (ADR-0004) e ogni chiamata a `decryptPii()`
- modulo di accesso `src/modules/identity/server/**` e `src/proxy.ts` (ADR-0013) e le policy di autorizzazione
- test di accettazione dei WP sul dominio (zona gratuita, validatore annunci, matching, mail 30 giorni, conservazione)
- migrazioni che toccano colonne cifrate o `audit_log`
- revisione di sicurezza prima di ogni rilascio

## Come validi un WP (checklist)
1. La PR tocca solo i file previsti dal WP? Dipendenze nuove approvate e **realmente esistenti** su npm?
2. `pnpm check` e CI verdi? I test di accettazione sono stati modificati per farli passare? (se sì → respingi)
3. Rispetta gli ADR e le regole `R-xxx` citate? In particolare:
   - nessun dato personale in chiaro nel DB, nei log, negli URL, negli errori (R-PRIV-02, R-PRIV-05)
   - nessun campo vietato (data di nascita, sesso, nazionalità, foto, RAL precedente…) (R-LAV-05, R-ANN-02)
   - autorizzazione verificata **lato server** in ogni Server Action/route
   - flag `INTERMEDIATION_ENABLED` rispettato per tutto ciò che è Fase B (ADR-0011)
4. Testi UI in `messages/it.json`, accessibilità di base.
5. La revisione di ChatGPT (`reviews/WP-xxx-chatgpt.md`) è stata gestita?
6. Esito: approva, oppure elenco numerato di correzioni da ripassare al modello locale.

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
- Prossimi: revisione dei testi legali in bozza (Gemini), WP-018 CV PDF, WP-025/026 dietro flag (a ChatGPT in
  locale), WP-010 PWA/TWA (servono nome e server).
- Dati comuni reali: da generare in locale (`data/README.md`); la rete della sessione cloud blocca il sito ISTAT.
- Aggiorna questa sezione a ogni gate superato (G0-G6 in `docs/06-ROADMAP.md`).
