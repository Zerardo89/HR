# HR — piattaforma di lavoro locale, gratuita ed etica

> **Nome in codice:** HR (il nome definitivo è da scegliere — vedi [docs/09-DOMANDE-APERTE.md](docs/09-DOMANDE-APERTE.md), Q1).
> **Stato:** progettazione completata il 26/09/2026 · sviluppo dal **29/09/2026** · lancio previsto **01/11/2026** (web + Android).

Una piattaforma **senza scopo di lucro** che fa incontrare chi cerca lavoro e chi assume, **vicino a casa**:

- **Gratis per i lavoratori**, sempre.
- **Gratis per le aziende** nella propria regione o entro **50 km** dalle proprie sedi; a pagamento solo la ricerca di personale **fuori zona**.
- **Offerte a norma**: stipendio sempre visibile, linguaggio non discriminatorio, aziende verificate, moderazione anti-truffa.
- **Privacy by design**: dati personali cifrati, profili anonimi finché il lavoratore non accetta il contatto, dati in Italia.
- **Matching spiegabile**: regole chiare, nessuna intelligenza artificiale che giudica le persone.
- Anche chi **ha già un lavoro** può restare nelle liste della propria mansione ("occupato, ma aperto") e riceve ogni 30 giorni una mail con le offerte più adatte.
- Solo **Italia**, per ora.

## Da dove iniziare
1. **[docs/00-SINTESI.md](docs/00-SINTESI.md)** — decisioni, sfumature, cosa fare subito.
2. **[docs/06-ROADMAP.md](docs/06-ROADMAP.md)** — il calendario giorno per giorno.
3. **[docs/work-packages/SPRINT-1.md](docs/work-packages/SPRINT-1.md)** — i primi lavori da martedì.

## Documentazione
| Documento | Contenuto |
|-----------|-----------|
| [01 Prodotto](docs/01-PRODOTTO.md) | Visione, personas, benchmark Indeed, funzioni per rilascio, matching, KPI |
| [02 Regole del gioco](docs/02-REGOLE-DEL-GIOCO.md) | Normativa (lavoro, privacy, cookie, DSA, AI Act, consumo, Play Store) con regole numerate |
| [03 Architettura](docs/03-ARCHITETTURA.md) | Stack, struttura del codice, modello dati, ambienti, CI/CD |
| [04 Privacy e sicurezza](docs/04-PRIVACY-SICUREZZA.md) | Cifratura, chiavi, accessi, conservazione, minacce |
| [05 Monetizzazione](docs/05-MONETIZZAZIONE.md) | Pubblicità a basso impatto, piani, crowdfunding, budget |
| [06 Roadmap](docs/06-ROADMAP.md) | Piano fino al lancio e oltre |
| [07 Team IA](docs/07-TEAM-AI.md) | Claude (architetto), Ollama (codice), ChatGPT (revisione), Gemini (scrittura), ComfyUI (grafica) |
| [08 Rischi](docs/08-RISCHI.md) | Registro dei rischi |
| [09 Domande aperte](docs/09-DOMANDE-APERTE.md) | Decisioni che servono dal fondatore |
| [ADR](docs/adr/README.md) | Decisioni architetturali |

## Stack (sintesi)
Next.js 16 · React 19 · TypeScript · Tailwind v4 + shadcn/ui · PostgreSQL 17 + PostGIS · Drizzle ORM · pg-boss ·
accesso con codice via email scritto in casa (ADR-0013) · Brevo (email) · Stripe (web) · PWA + Trusted Web Activity (Android) ·
Cloudflare Tunnel + Docker Compose (ADR-0012).

## Il team
| Chi | Ruolo | Istruzioni |
|-----|-------|------------|
| Fondatore | Product owner | [docs/00-SINTESI.md](docs/00-SINTESI.md) |
| Claude Code | Architetto e validatore | [CLAUDE.md](CLAUDE.md) |
| Ollama via Codex CLI | Sviluppo | [AGENTS.md](AGENTS.md) |
| ChatGPT | Revisione e semplificazione | [docs/prompts/chatgpt-revisione.md](docs/prompts/chatgpt-revisione.md) |
| Gemini | Scrittura | [GEMINI.md](GEMINI.md) |
| ComfyUI | Grafica | [docs/prompts/comfyui-brief.md](docs/prompts/comfyui-brief.md) |

## Regola d'oro
**Nessun dato personale reale** in questo repository, nei prompt o nelle conversazioni con le IA. Solo dati sintetici.
