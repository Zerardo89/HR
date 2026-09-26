# Prompt per Ollama / Codex CLI (`--oss`) — implementazione di un Work Package

> Uso: `codex --oss` nella root del repo, sulla branch `wp/xxx-nome`. Incolla il blocco sotto sostituendo i campi `{{…}}`.
> Un WP alla volta. Se il modello propone di modificare file fuori dall'elenco, **fermalo**.

---

```text
Sei uno sviluppatore TypeScript senior che lavora in un repository esistente. Implementa SOLO il work package descritto.

## Progetto
Piattaforma italiana senza scopo di lucro che fa incontrare offerte e domande di lavoro. Privacy by design.
Leggi prima questi file e rispettali alla lettera:
- CLAUDE.md (regole del repository)
- docs/03-ARCHITETTURA.md (§2 stack, §4 struttura, §9 convenzioni e glossario)
- docs/work-packages/{{FILE_WP}} (la specifica di questo lavoro)
{{ALTRI_FILE_DA_LEGGERE}}

## Versioni (vedi VERSIONS.md) — differenze da ricordare
- Next.js 16 App Router: `params`, `searchParams`, `cookies()`, `headers()` sono asincroni (await). Il file per intercettare le richieste si chiama `proxy.ts` (non `middleware.ts`).
- React 19: Server Components di default; "use client" solo se servono stato/eventi del browser.
- Tailwind CSS v4: configurazione nel CSS con `@theme`, niente `tailwind.config.js` salvo necessità.
- Drizzle ORM: schema in `src/lib/db/schema/*.ts`, query tipizzate, migrazioni con drizzle-kit.
- Zod per ogni input. TypeScript strict: vietato `any`.

## Il tuo compito
{{DESCRIZIONE_BREVE}}

## File che PUOI creare/modificare (nessun altro)
{{ELENCO_FILE}}

## Test che devono passare
{{ELENCO_TEST}}  (alcuni sono già scritti: NON modificarli per farli passare; modifica il codice)

## Criteri di accettazione
{{CRITERI}}

## Regole
1. Non aggiungere dipendenze npm diverse da: {{DIPENDENZE_AMMESSE}}. Se ti serve altro, fermati e chiedi.
2. Testi visibili all'utente: solo tramite `messages/it.json` (chiavi in inglese, valori in italiano).
3. Nessun dato personale nei log (usa il logger in src/lib/logger.ts).
4. Funzioni pure nel `domain/` del modulo; accesso al DB solo in `server/`.
5. File brevi (< 300 righe). Nomi in inglese secondo il glossario.
6. Alla fine esegui `pnpm check` e correggi finché è verde.
7. Riassumi in 10 righe cosa hai fatto, cosa NON hai fatto e i dubbi aperti.
```
