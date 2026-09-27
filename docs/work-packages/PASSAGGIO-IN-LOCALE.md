# Passaggio in locale — da dove ripartire

> Aggiornato domenica 27/09/2026 dalla sessione cloud di Claude. Serve quando il lavoro continua sul tuo computer:
> con Claude Code (app desktop, oppure `claude` / `claude remote-control` nel terminale dentro la cartella del
> progetto) o con i modelli locali (Ollama via Codex CLI, `AGENTS.md`).

## 1. Stato
- `main` contiene lo Sprint 1 fino a WP-007 (PR #1).
- **PR #3** (branch `claude/optimistic-franklin-w8ou54`) è verde e aspetta il merge: WP-006 resto, WP-008 accesso,
  WP-009 landing e lista d'attesa, WP-011a registrazione aziende, WP-012 validatore annunci. **Uniscila prima di
  iniziare altro lavoro**, poi riparti da `main`.
- Dettagli: [SPRINT-1.md](SPRINT-1.md), [SPRINT-2.md](SPRINT-2.md). Decisioni nuove: [ADR-0013](../adr/ADR-0013-auth-in-casa.md).

## 2. Mettere in piedi il progetto sul tuo computer
```bash
git clone https://github.com/Zerardo89/HR.git && cd HR     # oppure: git pull
git checkout main && git pull                               # dopo il merge della PR #3
pnpm install
docker compose -f docker-compose.dev.yml up -d              # Postgres/PostGIS + Mailpit (posta di prova: http://localhost:8025)
cp .env.example .env.local
pnpm keys:generate                                          # chiavi in ./secrets (mai nel repository)
pnpm db:migrate
pnpm taxonomy:import                                        # 263 mansioni
pnpm geo:build && pnpm geo:import                           # comuni ISTAT: istruzioni in data/README.md
pnpm dev                                                    # http://localhost:3000
```
Controlli prima di ogni PR: `pnpm check`, poi `DATABASE_URL=… pnpm test:integration`, poi `pnpm build && pnpm test:e2e`.

## 3. Prossimi work package (in ordine)

| WP | Cosa | Chi lo scrive | Perché |
|----|------|---------------|--------|
| 011b | **2FA TOTP** obbligatoria per aziende, moderatori e admin (segreto cifrato con la DEK dell'utente, codici di recupero, passo in più dopo il codice email) | **Claude** | Tocca `src/modules/identity/server/**` (ADR-0013, CLAUDE.md) |
| 011c | Sedi operative (comune + approvazione del moderatore) e inviti ai colleghi (email con token, ruolo `recruiter`) | Ollama, test di Claude | Moduli `companies`, niente crittografia |
| 013 | Form offerta con anteprima del validatore (WP-012) e selettore delle mansioni (WP-006); stati bozza → in moderazione → pubblicata; pannello moderatore (anche verifica manuale aziende "in verifica") | Ollama (UI) + Claude (autorizzazioni, test) | Il validatore e la ricerca mansioni sono già pronti e testati |
| 014 | Pagina offerta SSR + JSON-LD JobPosting + sitemap | Ollama | |
| 015 | Ricerca offerte (full-text `italian_unaccent` + trigrammi, ADR-0003) + "perché la vedi" | Ollama, test di Claude | |
| 010 | PWA/TWA + deploy | Tu + Claude | Servono nome dell'app e server (ADR-0012) |

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
