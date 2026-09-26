# 00 — Sintesi per il fondatore (leggi questo per primo)

> Redatto dall'architetto (Claude) il 26/09/2026 dopo la ricerca normativa e di mercato.
> Tempo di lettura: 10 minuti. Da qui si arriva a tutti gli altri documenti.

## Il progetto in 5 righe
Una piattaforma **senza scopo di lucro** per trovare lavoro **vicino a casa**: gratis per i lavoratori (sempre),
gratis per le aziende nella propria regione o entro 50 km, a pagamento solo per cercare personale fuori zona.
Offerte **a norma** (stipendio visibile, niente discriminazioni, niente truffe), dati personali **cifrati**,
matching **spiegabile e senza IA che giudica le persone**. Web + Android, solo Italia.
Lancio: **domenica 1 novembre 2026**. Codice da **martedì 29 settembre**.

## Le 10 decisioni principali
| # | Decisione | Perché | Dove |
|---|-----------|--------|------|
| 1 | **Ente = associazione ETS senza scopo di lucro** | Il regime semplificato per i siti di intermediazione (art. 6 Legge Biagi) lo **richiede**; apre donazioni detraibili, 5×1000, Google Ad Grants | [02 §2, §9](02-REGOLE-DEL-GIOCO.md) |
| 2 | **Lancio in due fasi**: *Bacheca* il 01/11, *Intermediazione* (liste per mansione consultabili dalle aziende) dopo il via libera legale | L'intermediazione non autorizzata è reato anche senza lucro dal 2024 | [ADR-0011](adr/ADR-0011-due-fasi-bacheca-intermediazione.md) |
| 3 | **Un solo codice**: Next.js (web) + app Android come **Trusted Web Activity** | Unica via realistica in 33 giorni; aggiornamenti senza revisione Google | [ADR-0001](adr/ADR-0001-monolite-modulare-nextjs.md), [ADR-0002](adr/ADR-0002-pwa-twa-play-store.md) |
| 4 | **PostgreSQL + PostGIS** per tutto (dati, ricerca, distanze, code) | Meno servizi da gestire | [ADR-0003](adr/ADR-0003-postgres-postgis-drizzle.md) |
| 5 | **Cifratura applicativa** dei dati personali, chiave fuori dal DB, custode delle chiavi | Il tuo requisito "io non devo poter vedere i dati" (con i limiti spiegati onestamente) | [04](04-PRIVACY-SICUREZZA.md), [ADR-0004](adr/ADR-0004-cifratura-applicativa.md) |
| 6 | **Matching a regole esplicite**, nessuna IA sulle persone | AI Act (alto rischio dal 12/2027), GDPR art. 22, fiducia | [ADR-0005](adr/ADR-0005-matching-deterministico.md) |
| 7 | **Zona gratuita = regione ∪ 50 km dalle sedi verificate**, non dall'IP | L'IP è inaffidabile (reti mobili, VPN) e ingiusto | [ADR-0009](adr/ADR-0009-zona-regione-50km.md) |
| 8 | **Profili anonimi + doppio consenso** per i contatti delle aziende | Tutela gli "occupati ma aperti", ostacola truffatori e scraper | [ADR-0007](adr/ADR-0007-profili-anonimi-doppio-consenso.md) |
| 9 | **Pagamenti solo sul web** (Stripe), accesi quando l'associazione ha P.IVA; al lancio **periodo fondatori gratuito** fino al 31/01/2027 | Toglie i pagamenti dal percorso critico e crea fedeltà | [ADR-0010](adr/ADR-0010-pagamenti-solo-web.md), [05](05-MONETIZZAZIONE.md) |
| 10 | **Hosting in Italia** (VPS Aruba Cloud, Docker, Caddy) su un **sottodominio** del tuo dominio | "Dati in Italia", costi bassi; una porta non standard sarebbe bloccata da molte reti e pessima per la SEO | [ADR-0006](adr/ADR-0006-hosting-italia.md) |

## Le sfumature che non ti aspettavi
1. **Il "no lucro" è un obbligo di legge**, non solo una scelta: tutto (pubblicità comprese) deve passare dall'associazione e restare nel progetto.
2. **Dal 7 giugno 2026 lo stipendio va indicato** (D.Lgs. 96/2026) ed è **vietato chiedere quanto guadagnavi prima**: nel nostro form lo stipendio è obbligatorio e il campo "RAL attuale" non esiste. Diventa un vantaggio: siamo "a norma per costruzione".
3. **Google Play blocca i nuovi account personali**: servono **12 tester per 14 giorni** prima di pubblicare. Per stare nel 01/11 l'app deve essere in test **entro venerdì 2 ottobre**. È il percorso critico. Il web invece è garantito.
4. **Togliere la pubblicità a pagamento ai lavoratori** potrebbe urtare il divieto di chiedere compensi ai lavoratori (art. 11): lo chiamiamo **"Sostenitore"** (contributo volontario, nessun vantaggio nella ricerca) e lo facciamo validare.
5. **"Pay or OK" no**: il Garante ha forti dubbi sul modello "paga o accetta i cookie". Chi rifiuta i cookie usa il sito gratis con pubblicità non profilata.
6. **La pubblicità Google renderà poco all'inizio**; rendono di più le **offerte in evidenza** e gli **sponsor locali senza tracciamento** (funzionano anche su chi rifiuta i cookie).
7. **La mail mensile non può "allegare tutte le offerte"**: mettiamo le 10 più pertinenti + link a tutte; i pulsanti aprono una pagina di conferma (gli antivirus delle caselle aziendali "cliccano" i link da soli!).
8. **Le "liste per mansione" arrivano con la Fase B**: i lavoratori possono iscriversi da subito, ma le aziende le consultano solo dopo il via libera legale.
9. **Novembre è il momento giusto**: picco di assunzioni per logistica, commercio natalizio, stagione sciistica, raccolta delle olive.
10. **"Aggregherà persone per altri progetti": la visibilità sì, i dati no.** Per usare le email degli utenti per altri progetti serve un consenso marketing separato.
11. **Niente foto e niente data di nascita** nei profili: è un obbligo (art. 10 Legge Biagi, minimizzazione GDPR) che trasformiamo in "selezione alla cieca".
12. **Il 25 ottobre cambia l'ora**: i job pianificati devono usare il fuso `Europe/Rome` esplicito.

## Cosa devi fare tu, subito
**Domenica 27/09**
- [ ] Rispondi alle domande Q1-Q7 in [09-DOMANDE-APERTE.md](09-DOMANDE-APERTE.md) (nome, dominio, area pilota, co-fondatori, hardware, tempo, sistema operativo).

**Lunedì 28/09 — giorno zero** (dettagli in [06-ROADMAP.md §2](06-ROADMAP.md))
- [ ] Account **Google Play Console** personale ($25) + verifica identità.
- [ ] **VPS** Aruba Cloud + DNS del sottodominio.
- [ ] Account **Brevo** + record SPF/DKIM/DMARC.
- [ ] **20 tester** Android con Gmail in un Google Group.
- [ ] Chiamate con **consulente del lavoro/avvocato** (domande D1-D6) e **commercialista**.
- [ ] **2 co-fondatori** per l'associazione (uno fa il custode delle chiavi).
- [ ] Postazione: Docker, Node 24, pnpm, Ollama + modelli, Codex CLI, Gemini CLI, ComfyUI.

**Martedì 29/09** — si parte con **WP-001** ([work-packages/SPRINT-1.md](work-packages/SPRINT-1.md)).

## I numeri
- **Budget anno 1:** ≈ €3.100-8.800 → obiettivo crowdfunding **€7.000** coerente ([05 §6](05-MONETIZZAZIONE.md)).
- **Pareggio dei costi ricorrenti:** mese 6-9 nello scenario base.
- **Obiettivi al 31/12/2026** (area pilota): 50 aziende verificate, 150 offerte attive, 1.000 lavoratori.

## Mappa dei documenti
| File | Contenuto |
|------|-----------|
| [01-PRODOTTO.md](01-PRODOTTO.md) | Visione, personas, benchmark Indeed, regola 50 km, stati del lavoratore, mail mensile, funzioni per rilascio, matching, KPI |
| [02-REGOLE-DEL-GIOCO.md](02-REGOLE-DEL-GIOCO.md) | Normativa con regole numerate (R-xxx) da rispettare nel codice, checklist legale, domande al professionista, fonti |
| [03-ARCHITETTURA.md](03-ARCHITETTURA.md) | Stack, diagrammi, struttura del codice, modello dati, flussi, ambienti, CI/CD, convenzioni |
| [04-PRIVACY-SICUREZZA.md](04-PRIVACY-SICUREZZA.md) | Cifratura, gestione chiavi, "niente accesso al DB", sicurezza, conservazione, minacce |
| [05-MONETIZZAZIONE.md](05-MONETIZZAZIONE.md) | Fonti di entrata, mappa della pubblicità, listino, crowdfunding, budget, scenari |
| [06-ROADMAP.md](06-ROADMAP.md) | Calendario giorno per giorno fino al 01/11 e piano post-lancio |
| [07-TEAM-AI.md](07-TEAM-AI.md) | Ruoli e flusso di lavoro di Claude, Ollama, ChatGPT, Gemini, ComfyUI |
| [08-RISCHI.md](08-RISCHI.md) | Registro dei rischi |
| [09-DOMANDE-APERTE.md](09-DOMANDE-APERTE.md) | Le decisioni che servono da te |
| [adr/](adr/) | Decisioni architetturali motivate |
| [prompts/](prompts/) | Prompt pronti per Ollama, ChatGPT, Gemini, ComfyUI |
| [work-packages/](work-packages/) | Specifiche dei lavori da far eseguire ai modelli |

> **Disclaimer:** i documenti normativi sono una mappa per progettare, non un parere legale. Le decisioni
> marcate "da verificare" vanno confermate dal professionista prima del lancio.
