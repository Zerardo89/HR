# ADR-0001 — Monolite modulare Next.js + TypeScript in un solo pacchetto

**Stato:** Accettata · **Data:** 26/09/2026

## Contesto
33 giorni, uno sviluppatore umano, codice generato in buona parte da modelli locali con contesto limitato
(32k-128k token). Serve SSR per la SEO delle offerte e un solo codice per web e Android.

## Decisione
- **Next.js 16 (App Router) + TypeScript strict**, UI e backend nello stesso progetto (Server Components, Server Actions, route handler per webhook).
- **Un solo `package.json`**, moduli in `src/modules/<modulo>/{domain,server,ui,index.ts}`, confini imposti da `eslint-plugin-boundaries`.
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
