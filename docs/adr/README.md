# Architecture Decision Records (ADR)

Ogni decisione architetturale importante ha un file. Formato: **Contesto → Decisione → Alternative scartate → Conseguenze → Come si verifica**.
Stato possibile: `Proposta` · `Accettata` · `Sostituita da ADR-xxxx`. Solo l'architetto (Claude) cambia lo stato;
chiunque (anche ChatGPT o Gemini) può proporre un nuovo ADR in stato `Proposta`.

| ADR | Titolo | Stato |
|-----|--------|-------|
| [0001](ADR-0001-monolite-modulare-nextjs.md) | Monolite modulare Next.js + TypeScript in un solo pacchetto | Accettata |
| [0002](ADR-0002-pwa-twa-play-store.md) | Play Store tramite PWA + Trusted Web Activity | Accettata |
| [0003](ADR-0003-postgres-postgis-drizzle.md) | PostgreSQL + PostGIS + Drizzle; ricerca e code dentro Postgres | Accettata |
| [0004](ADR-0004-cifratura-applicativa.md) | Cifratura applicativa a busta (envelope) con `KeyProvider` sostituibile | Accettata |
| [0005](ADR-0005-matching-deterministico.md) | Matching deterministico e spiegabile, nessuna IA sulle persone | Accettata |
| [0006](ADR-0006-hosting-italia.md) | Hosting su VPS in Italia con Docker Compose e Caddy | Sostituita in parte da 0012 |
| [0007](ADR-0007-profili-anonimi-doppio-consenso.md) | Profili anonimi e doppio consenso per il contatto (Fase B) | Accettata |
| [0008](ADR-0008-auth-better-auth.md) | Autenticazione senza password con Better Auth | Sostituita in parte da 0013 |
| [0009](ADR-0009-zona-regione-50km.md) | Zona gratuita = regione ∪ 50 km dalle sedi verificate | Accettata |
| [0010](ADR-0010-pagamenti-solo-web.md) | Pagamenti solo sul web con Stripe, nessun acquisto in-app all'MVP | Accettata |
| [0011](ADR-0011-due-fasi-bacheca-intermediazione.md) | Lancio in due fasi: Bacheca → Intermediazione (feature flag) | Accettata |
| [0012](ADR-0012-hosting-costo-zero.md) | Hosting a costo (quasi) zero: Cloudflare Tunnel + macchina spostabile | Accettata (sostituisce in parte 0006) |
| [0013](ADR-0013-auth-in-casa.md) | Autenticazione scritta in casa: codice via email + sessioni nel database | Accettata (sostituisce in parte 0008) |
| [0014](ADR-0014-cancellazione-e-backup.md) | Cancellazione dell'account: crypto-shredding subito, backup entro la rotazione | Accettata (precisa 0004) |
