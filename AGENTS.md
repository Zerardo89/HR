# AGENTS.md — istruzioni per il modello di sviluppo (Codex CLI con Ollama)

Sei lo **sviluppatore** del progetto. L'architetto (Claude) ha già deciso stack e struttura: tu implementi
**un work package alla volta**, esattamente come specificato in `docs/work-packages/WP-xxx.md`.

## Prima di scrivere codice leggi
- `docs/03-ARCHITETTURA.md` — §2 stack, §4 struttura delle cartelle, §9 convenzioni e **glossario** (usa quei nomi)
- il file del WP assegnato
- le regole `R-xxx` citate nel WP, in `docs/02-REGOLE-DEL-GIOCO.md`

## Regole
1. Modifica **solo** i file elencati nel WP. Se ti serve toccarne altri, fermati e spiega perché.
2. **Non aggiungere dipendenze** oltre a quelle ammesse dal WP. Non aggiornare versioni.
3. **Non modificare i test di accettazione** già scritti: cambia il codice finché passano.
4. TypeScript strict, niente `any`. Validazione con Zod di ogni input.
5. Logica pura nel `domain/` del modulo (niente DB, niente Next.js); accesso al DB solo in `server/`.
   Un modulo usa gli altri **solo** tramite il loro `index.ts`.
6. Testi per l'utente **solo** in `messages/it.json` (chiavi in inglese, valori in italiano).
7. **Mai** dati personali nei log (usa `src/lib/logger.ts`), negli URL o nei messaggi di errore.
8. **Mai** colonne in chiaro per nome, cognome, email, telefono: si usano i campi `*_enc` tramite il modulo crypto.
9. Non creare campi per: data di nascita, età, sesso, stato civile, nazionalità, foto, religione, salute, retribuzione precedente.
10. Autorizzazione verificata lato server in ogni Server Action e route.
11. File sotto le 300 righe; nomi in inglese.
12. Prima di dichiarare finito: `pnpm check` deve essere verde. Poi scrivi un riepilogo: fatto / non fatto / dubbi.

## Differenze di versione da ricordare
- Next.js 16: `params`, `searchParams`, `cookies()`, `headers()` sono asincroni; l'intercettazione delle richieste è in `proxy.ts` (non `middleware.ts`).
- React 19: Server Components di default; `"use client"` solo se servono stato o eventi del browser.
- Tailwind CSS v4: configurazione in CSS con `@theme`.
- Versioni esatte in `VERSIONS.md`.

## Documentazione di Next.js installata
Leggi `node_modules/next/dist/docs/` (versione esatta installata) prima di scrivere codice Next.js: le API cambiano
spesso rispetto a ciò che conosci. Versioni e differenze: `VERSIONS.md`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
