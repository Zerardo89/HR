# ADR-0001 — Monolite modulare Next.js + TypeScript in un solo pacchetto

**Stato:** Accettata · **Data:** 26/09/2026

## Contesto
33 giorni, uno sviluppatore umano, codice generato in buona parte da modelli locali con contesto limitato
(32k-128k token). Serve SSR per la SEO delle offerte e un solo codice per web e Android.

## Decisione
- **Next.js 16 (App Router) + TypeScript strict**, UI e backend nello stesso progetto (Server Components, Server Actions, route handler per webhook).
- **Un solo `package.json`**, moduli in `src/modules/<modulo>/{domain,server,ui,index.ts}`, confini imposti da ESLint (strumento aggiornato: vedi "Aggiornamento 26/09/2026").
- Un secondo entrypoint (`src/worker/`) nello stesso pacchetto per i job in background.

## Alternative scartate
- **Backend separato (NestJS/Fastify) + frontend**: doppio deploy, doppi tipi, più contesto per i modelli.
- **Monorepo con workspace (Turborepo)**: i modelli locali sbagliano spesso percorsi e import tra pacchetti.
- **Flutter/React Native**: due codici o SEO debole.
- **SvelteKit/Remix**: validi, ma meno esempi nei dati di addestramento → più errori dei modelli locali.

## Conseguenze
- ✅ Un solo deploy, un solo linguaggio, tipi condivisi.
- ✅ Il dominio puro (`domain/`) è testabile senza framework: è lì che si concentrano i test.
- ⚠️ Next.js cambia spesso: versioni bloccate in `VERSIONS.md` e "differenze da ricordare" in ogni prompt.
- ⚠️ Da tenere aggiornato per le patch di sicurezza di React/Next (Server Components hanno avuto CVE gravi nel 2025).

## Verifica
`pnpm check` verde; regola ESLint che fallisce se un modulo importa l'interno di un altro.

## Aggiornamento 26/09/2026 (WP-001)
- I confini tra moduli sono imposti con `import/no-restricted-paths` (già incluso in `eslint-config-next`) e
  `no-restricted-imports` per la purezza del `domain/`, **invece di** `eslint-plugin-boundaries`: la v7 di quel plugin
  ha cambiato completamente la configurazione (poco adatta ai modelli locali) e aggiungeva una dipendenza.
  Le zone sono generate automaticamente leggendo `src/modules/*` in `eslint.config.mjs`. Verificato con violazioni di prova.
- API pubbliche di un modulo: `index.ts` (lato server) e `domain/index.ts` (pura, usabile dal dominio di altri moduli).
- TypeScript resta alla 5.9: typescript-eslint non supporta ancora TS ≥ 6.1.

## Aggiornamento 28/09/2026 (WP-020)
- Terza API pubblica di un modulo: **`jobs.ts`**, per il worker pg-boss. Il worker gira fuori dal rendering di
  Next.js (`tsx --conditions=react-server`): gli `index.ts` esportano anche componenti e Server Actions, che lì non si
  caricano (verificato: `next/navigation` fallisce). `jobs.ts` esporta solo funzioni server, senza React né Next.
- Regole di lint: il worker (`src/worker`) importa solo `@/modules/<nome>/jobs` o `@/modules/<nome>/domain`; un
  modulo può importare da un altro anche il suo `jobs.ts` (serve al codice che gira nel worker, per esempio gli
  avvisi usano la ricerca di `matching/jobs`); `src/app` resta su `index.ts` e `domain/index.ts`.

