# Passaggio in locale — da dove ripartire

> Aggiornato domenica 27/09/2026 dalla sessione cloud di Claude. Serve quando il lavoro continua sul tuo computer:
> con Claude Code (app desktop, oppure `claude` / `claude remote-control` nel terminale dentro la cartella del
> progetto) o con i modelli locali (Ollama via Codex CLI, `AGENTS.md`).

## 1. Stato
- `main` contiene gli **Sprint 1 e 2 completi** (PR #1 e #3): accesso con codice e 2FA, lista d'attesa, aziende con
  sedi e colleghi, validatore e form delle offerte, moderazione, pagina pubblica, ricerca, zona gratuita e periodo
  fondatori.
- Sprint 3 in corso: **WP-017 profilo del lavoratore** sul branch `claude/optimistic-franklin-w8ou54` (PR aperta da
  unire). Poi si riparte da `main`.
- Dettagli: [SPRINT-1.md](SPRINT-1.md), [SPRINT-2.md](SPRINT-2.md), [SPRINT-3.md](SPRINT-3.md). Decisioni nuove:
  [ADR-0013](../adr/ADR-0013-auth-in-casa.md).

## 2. Mettere in piedi il progetto sul tuo computer (Windows)
Cartella del progetto: **`C:\Users\Utente\Desktop\PROGETTO HR`**.

Serve una volta sola: **Git**, **Node.js 24 LTS** e **Docker Desktop** installati. Poi, in **PowerShell**:
```powershell
cd "$env:USERPROFILE\Desktop"
git clone https://github.com/Zerardo89/HR.git "PROGETTO HR"   # se il repository è privato, Git chiede di accedere a GitHub
cd "PROGETTO HR"
git checkout main
corepack enable                       # attiva pnpm (la versione giusta è in package.json)
pnpm install
docker compose -f docker-compose.dev.yml up -d   # Postgres/PostGIS + Mailpit (posta di prova: http://localhost:8025)
Copy-Item .env.example .env.local
pnpm keys:generate                    # chiavi in .\secrets (mai nel repository, mai in altre cartelle condivise)
pnpm db:migrate
pnpm taxonomy:import                  # 263 mansioni
pnpm dev                              # http://localhost:3000
```
Comuni ISTAT: `pnpm geo:build` e `pnpm geo:import` (istruzioni in `data/README.md`).
Per diventare moderatore/admin: registrati dal sito, poi `pnpm users:role tua@email.it admin` (al primo accesso
attivi la verifica in due passaggi). Il pannello è su `/moderazione`.
Per lavorare con Claude in quella cartella: app **Claude Desktop**, oppure `claude` (o `claude remote-control`) nel
terminale aperto in `PROGETTO HR`.
Controlli prima di ogni PR: `pnpm check`, poi `pnpm test:integration` (con `DATABASE_URL` del DB di sviluppo), poi
`pnpm build` e `pnpm test:e2e`.

## 3. Prossimi work package (in ordine)

| WP | Cosa | Chi lo scrive | Perché |
|----|------|---------------|--------|
| 010 | PWA/TWA + deploy | Tu + Claude | Servono nome dell'app e server (ADR-0012) |
| 018 | CV in PDF generato dal profilo (senza foto) | Claude (legge i dati cifrati) | Il lavoratore lo scarica o lo allega |

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
