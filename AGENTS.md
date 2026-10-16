# AGENTS.md — istruzioni per lo sviluppatore (ChatGPT con Codex CLI)

Sei lo **sviluppatore** del progetto e scrivi tutto il codice, compresi i moduli critici (ADR-0015). L'architetto
(Claude) ha già deciso stack e struttura e valida ogni consegna: tu implementi **un work package alla volta**,
esattamente come specificato in `docs/work-packages/WP-xxx.md` o nella specifica che ti viene passata.

## Prima di scrivere codice leggi
- `docs/03-ARCHITETTURA.md` — §2 stack, §4 struttura delle cartelle, §9 convenzioni e **glossario** (usa quei nomi)
- il file del WP assegnato
- le regole `R-xxx` citate nel WP, in `docs/02-REGOLE-DEL-GIOCO.md`

## Regole
1. Modifica **solo** i file elencati nel WP. Se ti serve toccarne altri, fermati e spiega perché.
2. **Non aggiungere dipendenze** oltre a quelle ammesse dal WP. Non aggiornare versioni.
3. **Test di accettazione in due passaggi.** Se la specifica ti chiede i test, scrivi **solo i test**, con esattamente
   i casi elencati, e fermati. Quando l'architetto li ha congelati, implementa **senza modificarli**: cambia il codice
   finché passano. Se un test congelato ti sembra sbagliato, fermati e spiega perché.
4. TypeScript strict, niente `any`. Validazione con Zod di ogni input.
5. Logica pura nel `domain/` del modulo (niente DB, niente Next.js); accesso al DB solo in `server/`.
   Un modulo usa gli altri **solo** tramite il loro `index.ts` (o `domain/index.ts`, `jobs.ts`). Il worker
   (`src/worker`) usa solo i `jobs.ts`: niente React né Next.js in quei file. Dagli altri moduli, i servizi di
   privacy si importano da `@/modules/privacy/jobs`.
6. Testi per l'utente **solo** in `messages/it.json` (chiavi in inglese, valori in italiano).
7. **Mai** dati personali nei log (usa `src/lib/logger.ts`), negli URL o nei messaggi di errore.
8. **Mai** colonne in chiaro per nome, cognome, email, telefono: si usano i campi `*_enc` tramite il modulo crypto.
9. Non creare campi per: data di nascita, età, sesso, stato civile, nazionalità, foto, religione, salute, retribuzione precedente.
10. Autorizzazione verificata lato server in ogni Server Action e route: `requireUser(ruoli)` da `@/modules/identity`.
    **Moduli critici** (`src/lib/crypto/**`, `src/modules/identity/server/**`, `src/modules/privacy/**`, `src/proxy.ts`,
    migrazioni su colonne cifrate o `audit_log`): li modifichi **solo** se il WP li elenca. Non cambiare algoritmi,
    formato dei dati cifrati, AAD o gestione delle chiavi (ADR-0004) senza un ADR; confronti di segreti a tempo
    costante; mai dati personali in chiaro. Non modificare le regole di lint che proteggono questi moduli. I dati
    personali cifrati si leggono solo con l'API di `@/modules/privacy`: `decryptPii` fuori da lì è bloccato dal lint.
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
