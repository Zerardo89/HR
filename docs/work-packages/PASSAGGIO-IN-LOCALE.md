# Passaggio in locale — da dove ripartire

> Aggiornato lunedì 28/09/2026 dalla sessione cloud di Claude. Serve quando il lavoro continua sul tuo computer:
> con Claude Code (app desktop, oppure `claude` / `claude remote-control` nel terminale dentro la cartella del
> progetto), che da lì chiama ChatGPT (Codex CLI), Gemini e Ollama.

## 1. Stato
- `main` contiene gli Sprint 1 e 2 e il WP-017 (PR #1, #3, #4) e le PR #5-#7 (candidature, worker, avvisi, email).
- **PR #8 da unire** (branch `claude/optimistic-franklin-w8ou54`, CI verde): WP-021 mail mensile, WP-022 offerte,
  WP-023 centro privacy e conservazione, WP-024 segnalazioni DSA e condizioni d'uso versionate, WP-027 sicurezza,
  ruoli del database, backup e ripristino. Dopo il merge si riparte da `main`.
- Dettagli: [SPRINT-1.md](SPRINT-1.md) … [SPRINT-4.md](SPRINT-4.md); runbook in [../runbook/](../runbook/).

## 2. Mettere in piedi il progetto sul tuo computer (Windows)
Cartella del progetto: **`C:\Users\Utente\Desktop\PROGETTO HR`**.

Serve una volta sola: **Git**, **Node.js 24 LTS** e **Docker Desktop** installati.
Prima **unisci la PR #8** su GitHub (così `main` ha tutto). Poi, in **PowerShell**:
```powershell
cd "$env:USERPROFILE\Desktop"
# Se la cartella NON esiste ancora:
git clone https://github.com/Zerardo89/HR.git "PROGETTO HR"   # repository privato: Git chiede di accedere a GitHub
cd "PROGETTO HR"
# Se la cartella esiste già (clonata in passato): al posto del clone, dentro la cartella
#   git fetch origin ; git checkout main ; git pull
git checkout main
corepack enable                       # attiva pnpm 10 (la versione giusta è in package.json)
pnpm install
docker compose -f docker-compose.dev.yml up -d   # Postgres/PostGIS + Mailpit (posta di prova: http://localhost:8025)
Copy-Item .env.example .env.local
pnpm keys:generate                    # chiavi in .\secrets (mai nel repository, mai in altre cartelle condivise)
pnpm db:migrate
pnpm taxonomy:import                  # 263 mansioni
pnpm dev                              # http://localhost:3000
```
Se non vuoi aspettare il merge: dopo il clone `git checkout claude/optimistic-franklin-w8ou54` al posto di `main`.

- Comuni ISTAT: `pnpm geo:build` e `pnpm geo:import` (istruzioni in `data/README.md`; dal cloud il sito ISTAT è
  bloccato, dal tuo computer no).
- Moderatore/admin: registrati dal sito, poi `pnpm users:role tua@email.it admin` (al primo accesso attivi la verifica
  in due passaggi). Il pannello è su `/moderazione`.
- Job pianificati in locale: `pnpm worker` (oppure `pnpm worker --once alerts.send` per un giro subito).
- Test: `pnpm check`; `pnpm test:integration` (con `DATABASE_URL` del DB di sviluppo); `pnpm exec playwright install
  chromium` una volta, poi `pnpm build` e `pnpm test:e2e`.
- In sviluppo si usa l'utente proprietario `hr`; i ruoli ristretti (`pnpm db:roles`) servono sul server e in CI.

**Per lavorare con Claude e il team di IA nella cartella** (una volta sola, poi Claude li chiama da solo):
```powershell
npm install -g @openai/codex          # ChatGPT: al primo avvio di `codex` scegli l'accesso con l'account ChatGPT
npm install -g @google/gemini-cli     # Gemini: al primo avvio di `gemini` accedi con l'account Google
```
Poi apri Claude Code nella cartella `PROGETTO HR` (app Claude Desktop, oppure `claude` nel terminale; con
`claude remote-control` la sessione compare anche nell'app Claude Code sul telefono). Se un comando d'installazione
è cambiato, vale quello del sito ufficiale dello strumento.

## 3. Prossimi work package (in ordine)

| WP | Cosa | Chi lo scrive | Perché |
|----|------|---------------|--------|
| 010 | PWA/TWA + deploy | Tu + Claude | Servono nome dell'app e server (ADR-0012) |
| 018 | CV in PDF generato dal profilo (senza foto) | Claude (legge i dati cifrati) | Il lavoratore lo scarica o lo allega |
| 024c | Revisione dei testi legali in bozza (condizioni d'uso versionate in `content/legal/`, contatti, informativa) e informativa privacy versionata come le condizioni | Gemini i testi, Claude il codice e la validazione | R-DSA-01/02, docs/04 §1 per i claim |

Per i WP di Ollama: prompt in [../prompts/ollama-work-package.md](../prompts/ollama-work-package.md); i test di
accettazione vanno scritti **prima** (da Claude) e non si modificano per farli passare.

## 4. In locale Claude lavora con Gemini e ChatGPT (docs/07-TEAM-AI.md)
Sul tuo computer Claude Code può chiamare gli altri membri del team dal terminale, senza che tu faccia da postino:

| Membro | Per cosa | Come lo chiama Claude (modalità non interattiva) | Dove finisce il risultato |
|--------|----------|--------------------------------------------------|---------------------------|
| **Gemini** (Gemini CLI) | testi UI, bozze legali (G-03), termini vietati per il validatore, contenuti SEO, controllo di coerenza dei `docs/` | `gemini -p "<prompt da docs/prompts/gemini-scrittura.md>"` | `messages/it.json`, `docs/`, `content/` — Claude rilegge prima del commit |
| **ChatGPT** (Codex CLI con l'account ChatGPT) | revisione e semplificazione del diff di ogni WP | `codex exec "<prompt da docs/prompts/chatgpt-revisione.md>"` | `reviews/WP-xxx-chatgpt.md`; Claude decide cosa applicare |
| **Ollama** (Codex CLI `--oss`) | implementazione dei WP con i test già scritti | `codex exec --oss "<prompt da docs/prompts/ollama-work-package.md>"` | branch del WP; Claude valida con la checklist di CLAUDE.md |

- Le opzioni dei comandi cambiano spesso: alla prima esecuzione Claude controlla `gemini --help` e `codex exec --help`.
- La prima volta Claude Code ti chiede il permesso di eseguire `gemini` e `codex`: puoi approvarli una volta per tutte.
- Regola R-AI-04: a Gemini, ChatGPT e Ollama vanno **solo** codice, documenti e dati sintetici. Mai dati personali
  reali, mai il contenuto di `./secrets` o di `.env.local`.

## 5. Da ricordare
- Il merge su `main` lo fai tu (clic su "Merge pull request"): Claude non può unire le PR da solo.
- Imposta `main` come branch predefinito del repository (Settings → General).
- Mai dati personali reali nel repository o nei prompt; mai file di `./secrets` fuori dal tuo computer.
