# 06 — Roadmap dettagliata: dal 26/09/2026 al lancio del 01/11/2026 e oltre

## 0. Come leggere questa roadmap
- **Cinque tracce parallele**: 🅰 Codice · 🅱 Legale/ente · 🅲 Store e infrastruttura · 🅳 Mercato (aziende, comunità, crowdfunding) · 🅴 Contenuti (Gemini) e grafica (ComfyUI).
- **Chi:** **Tu** (fondatore) · **Claude** (architetto, validatore) · **Ollama** (codice, via Codex CLI `--oss`) · **ChatGPT** (revisione e correzione) · **Gemini** (scrittura) · **ComfyUI** (grafica).
- **WP-xxx** = work package (specifica per i modelli). Elenco completo in §4; i primi in dettaglio in [work-packages/SPRINT-1.md](work-packages/SPRINT-1.md).
- **Gate (G)** = punto di controllo: se non è superato, si applica il piano B indicato.
- **Ipotesi di carico:** ~6-8 ore/giorno del fondatore, anche parte dei fine settimana. Se hai meno tempo, si taglia il perimetro (§6), **non** la qualità della privacy e della sicurezza.

## 1. Il percorso critico (cosa decide la data di lancio)

```
Lun 28/09  Account Google Play personale + verifica identità (possono servire giorni)
   │
Ven 02/10  App TWA caricata + test chiuso con ≥12 tester (meglio 20) che restano iscritti   ◄── G1 (HARD)
   │        14 giorni consecutivi
Ven 16/10  Fine dei 14 giorni → sab 17/10 richiesta accesso alla produzione                  ◄── G4
   │        revisione Google (fino a ~7 giorni, non garantita)
~24/10     Accesso concesso → invio della versione di produzione (revisione di alcuni giorni)
   │
Dom 01/11  LANCIO — web sicuro; Play Store se Google ha approvato in tempo
```

In parallelo, il secondo percorso critico è **legale**: parere del professionista (entro **09/10**) → perimetro
della Fase A confermato → documenti legali pronti (entro **25/10**).

**Piano B se Play non approva in tempo:** il 01/11 si lancia il **web** (installabile come app dal browser
Android: "Aggiungi a schermata Home"), e si comunica "App Play Store in arrivo". Nessuna modifica al codice.

## 2. Settimana 0 — Preparazione (sab 26 – lun 28 settembre)

### Sabato 26/09 ✅
- **Claude:** ricerca normativa e di mercato, architettura, ADR, roadmap, work package dello sprint 1 (questo repository).

### Domenica 27/09 — Tu
- [ ] Leggi [00-SINTESI.md](00-SINTESI.md) e rispondi a [09-DOMANDE-APERTE.md](09-DOMANDE-APERTE.md) (almeno Q1-Q6: nome, dominio, area pilota, co-fondatori, hardware, tempo disponibile).
- [ ] Scegli il **nome del pacchetto Android** (immutabile, R-PLAY-06).

### Lunedì 28/09 — Giorno zero (burocrazia e strumenti) — gate **G0**
🅲 **Store e infrastruttura (Tu)**
- [ ] Crea l'account **Google Play Console personale** ($25), completa la verifica d'identità.
- [ ] Ordina il **VPS Aruba Cloud** (Ubuntu LTS, ≥4 GB RAM); crea i record DNS: `beta.` e `lavoro.` (o root) → IP del VPS.
- [ ] Crea account **Brevo**, autentica il dominio (SPF, DKIM, DMARC `p=none`) dal pannello DNS Aruba.
- [ ] GitHub: proteggi `main` (PR obbligatorie, CI verde richiesta).
- [ ] Crea un **Google Group** "tester" e invia l'invito a **20 persone** con Android + account Gmail (famiglia, amici, colleghi). Spiega che devono **installare l'app e restare iscritte 14 giorni**, aprendola qualche volta.

🅱 **Legale (Tu)**
- [ ] Contatta **2 professionisti** (consulente del lavoro o avvocato giuslavorista con competenze privacy) e fissa una chiamata **entro venerdì 02/10**; invia loro le domande D1-D6 di [02-REGOLE-DEL-GIOCO.md §12](02-REGOLE-DEL-GIOCO.md).
- [ ] Individua **almeno 2 co-fondatori** per l'associazione; uno sarà il **custode delle chiavi**.
- [ ] Contatta un **commercialista** esperto di Terzo settore.

🅰 **Postazione di sviluppo (Tu, guida in [07-TEAM-AI.md](07-TEAM-AI.md))**
- [ ] Installa: Docker, Node.js 24 LTS, pnpm, Git, JDK 17 + Android SDK command-line tools (per Bubblewrap).
- [ ] **Ollama** + modelli (in base alla GPU: `gpt-oss:20b` e/o `qwen3-coder:30b`), contesto ≥ 32k.
- [ ] **Codex CLI** configurato in modalità `--oss` su Ollama; **Gemini CLI**; accesso a ChatGPT.
- [ ] **ComfyUI** con un modello a licenza commerciale (FLUX.1 **schnell** Apache-2.0 o SDXL).
- [ ] In ChatGPT e Gemini: **disattiva l'uso delle conversazioni per l'addestramento**; crea un Progetto/Gem con le istruzioni di [prompts/](prompts/).

## 3. Calendario giorno per giorno

### Settimana 1 — Fondamenta e avvio del test Play (mar 29/09 – dom 04/10)

| Giorno | 🅰 Codice | 🅱 Legale/ente | 🅲 Store/infra | 🅳 Mercato | 🅴 Contenuti/grafica |
|--------|-----------|---------------|----------------|------------|---------------------|
| **Mar 29/09** | **WP-001** scaffold (Ollama → ChatGPT → Claude). **WP-002** Docker dev, env, logger, flag | Bozza statuto ETS (Gemini) | Hardening VPS (utente non root, SSH a chiavi, firewall, aggiornamenti automatici) | Elenco di 100 aziende target nell'area pilota (Gemini aiuta con le categorie; i dati li raccogli tu da fonti pubbliche) | Gemini: `messages/it.json` iniziale, glossario. ComfyUI: 20 concept di logo/icona |
| **Mer 30/09** | **WP-003** CI. **WP-004** schema DB v1 (Claude scrive lo scheletro) | Chiamata col primo professionista | Docker + Caddy sul VPS, dominio dell'app in HTTPS in **modalità anteprima** (vedi WP-010) | Script di contatto per aziende (Gemini) | Scegli il logo; ComfyUI: icona adattiva Android 512×512, feature graphic 1024×500 |
| **Gio 01/10** | **WP-005** comuni ISTAT + geo + `FreeZone` (test scritti da Claude). **WP-007** crypto (**Claude**) | — | — | Primi 10 contatti telefonici/di persona alle aziende (solo sondaggio: "pubblichereste qui?") | Gemini: bozza informativa privacy, T&C, cookie policy (marcate BOZZA) |
| **Ven 02/10** | **WP-009** landing + lista d'attesa (double opt-in) + pagine legali in bozza. **WP-010** PWA + `assetlinks.json` + TWA Bubblewrap | Seconda chiamata legale se serve | **Upload TWA su Play → test interno → test chiuso; invito ai tester** — **G1** | Apertura lista d'attesa: messaggio a contatti e gruppi locali | Gemini: scheda Play Store (titolo, descrizioni), risposte Data safety in bozza |
| **Sab 03/10** | **WP-006** tassonomia mansioni + autocompletamento | Riunione co-fondatori: statuto, cariche, quota associativa | Verifica: ≥12 tester **iscritti e con app installata** | — | Gemini: 300 mansioni con sinonimi colloquiali (dati per WP-006) |
| **Dom 04/10** | **WP-008** autenticazione Better Auth (Claude + Ollama) | — | Buffer | — | ComfyUI: illustrazioni onboarding (3) e stati vuoti (4) |

**G1 — ven 02/10 (al più tardi sab 03/10):** ≥12 tester iscritti al test chiuso.
*Piano B:* se l'account Play non è verificato in tempo, si recupera spostando i 14 giorni: ogni giorno perso qui è un giorno perso sul Play Store (il web non cambia).

### Settimana 2 — Aziende e offerte (lun 05/10 – dom 11/10)

| Giorno | 🅰 Codice | 🅱 Legale/ente | 🅲 Store/infra | 🅳 Mercato | 🅴 Contenuti/grafica |
|--------|-----------|---------------|----------------|------------|---------------------|
| **Lun 05/10** | **WP-011** onboarding azienda + VIES + sedi + membri + 2FA | Statuto definitivo al commercialista | — | 10 visite/telefonate aziende | Gemini: "Regolamento annunci" e "Come riconoscere le truffe" |
| **Mar 06/10** | **WP-012** validatore annunci a norma (**test di Claude**, codice di Ollama) | — | Backup restic su staging | — | Gemini: lista termini vietati/sospetti con motivazioni (input WP-012) |
| **Mer 07/10** | **WP-013** form offerta + anteprima + moderazione + pannello moderatore | **Atto costitutivo firmato + registrazione all'Agenzia Entrate** (obiettivo) | — | 10 contatti | Gemini: testi di aiuto nel form offerta (spiegazione D.Lgs. 96/2026 in parole semplici) |
| **Gio 08/10** | **WP-014** pagina offerta SSR + JSON-LD JobPosting + sitemap + pagine "Lavoro [mansione] a [provincia]" | Richiesta codice fiscale (e P.IVA se attività commerciale), PEC, conto corrente | — | — | Gemini: modelli testo per le pagine SEO (200 combinazioni prioritarie) |
| **Ven 09/10** | **WP-015** ricerca (full-text + refusi + raggio) + "perché la vedi" | **G2**: parere legale ricevuto → perimetro Fase A confermato | — | — | ComfyUI: icone per 20 macro-categorie di mansioni (stile coerente) |
| **Sab 10/10** | **WP-016** zona gratuita + entitlement + periodo fondatori | — | — | Evento/mercato locale? Volantini con QR alla lista d'attesa | Gemini: pagina "Chi siamo" e "Come funziona il matching" |
| **Dom 11/10** | Buffer / debito tecnico | — | — | — | Gemini: rapporto settimanale di avanzamento |

**Traguardo M2 (dom 11/10):** *un'azienda verificata pubblica un'offerta a norma e un visitatore la trova cercando "cameriere" vicino a casa.*
**G2 — ven 09/10:** parere legale. *Piano B:* senza parere, il lancio del 01/11 avviene in modalità **ridotta**: solo offerte + candidature, profilo minimo, nessuna "lista" (vedi ADR-0011).

### Settimana 3 — Lavoratori e candidature (lun 12/10 – dom 18/10)

| Giorno | 🅰 Codice | 🅱 Legale/ente | 🅲 Store/infra | 🅳 Mercato | 🅴 Contenuti/grafica |
|--------|-----------|---------------|----------------|------------|---------------------|
| **Lun 12/10** | **WP-017** onboarding lavoratore + profilo guidato + cifratura PII + stati | Avvio pratica **Albo informatico art. 6** (se l'associazione ha il CF) | — | Obiettivo: 20 aziende "sì, pubblico al lancio" | Gemini: testi dell'onboarding (italiano semplice, frasi brevi) |
| **Mar 13/10** | **WP-018** CV PDF generato (senza foto) | Richiesta **D-U-N-S** per l'associazione (serve per l'account Play organizzazione in futuro) | — | — | Gemini: template email (benvenuto, OTP, candidatura, avvisi, mensile) |
| **Mer 14/10** | **WP-019** candidatura + "le mie candidature" + casella azienda + notifiche | — | — | — | — |
| **Gio 15/10** | **WP-020** avvisi (ricerche salvate) + worker pg-boss | — | — | Pre-vendita "Azienda fondatrice" alle aziende più convinte | Gemini: pagina crowdfunding + FAQ + ricompense |
| **Ven 16/10** | **WP-021** mail 30 giorni + token + pagine di conferma + disiscrizione RFC 8058 | — | **Fine 14 giorni test chiuso** | — | ComfyUI: immagini per la campagna |
| **Sab 17/10** | **WP-022** scadenza/chiusura offerte → notifica ai candidati | — | **G4: richiesta accesso produzione Play** (questionario: come hai reclutato i tester, cosa hai cambiato grazie ai loro feedback — tieni un registro dei feedback da subito!) | — | Gemini: note di rilascio per i tester |
| **Dom 18/10** | **G3: feature freeze** Fase A. Bug bash con i tester | — | — | — | Gemini: rapporto settimanale |

**Traguardo M3 (dom 18/10):** *tutto il percorso lavoratore funziona in staging: registrazione → profilo → ricerca → candidatura → risposta dell'azienda → avviso → mail mensile.*

### Settimana 4 — Privacy, fiducia, soldi, qualità (lun 19/10 – dom 25/10)

| Giorno | 🅰 Codice | 🅱 Legale/ente | 🅲 Store/infra | 🅳 Mercato | 🅴 Contenuti/grafica |
|--------|-----------|---------------|----------------|------------|---------------------|
| **Lun 19/10** | **WP-023** centro privacy (export, cancellazione con crypto-shredding, consensi) + job di conservazione | Documenti legali alla revisione del professionista | Produzione: compose separato, DB separato, segreti | — | Gemini: DPIA e registro dei trattamenti (bozze) |
| **Mar 20/10** | **WP-024** segnalazioni DSA + decisioni motivate + T&C versionati | — | **Richiesta AdSense** (serve sito con contenuti e policy) | 40 impegni pre-campagna | Gemini: procedura data breach, modello informativa per aziende |
| **Mer 21/10** | **WP-025** slot pubblicitari + sponsor diretti + CMP + AdSense dietro flag | — | Uptime Kuma, Umami | — | — |
| **Gio 22/10** | **WP-026** Stripe dietro flag (Sostenitore, Nazionale, In evidenza) | — | — | — | Gemini: help center (20 FAQ lavoratori, 20 aziende) |
| **Ven 23/10** | **WP-027** hardening: CSP, header, rate limit, audit append-only, backup + **prova di ripristino** | — | Runbook deploy/rollback/ripristino | — | Gemini: comunicato stampa e kit stampa |
| **Sab 24/10** | **WP-028** e2e dei 5 percorsi critici + accessibilità (axe) + test di carico leggero | — | (atteso) accesso produzione Play | — | ComfyUI: screenshot incorniciati per il Play Store |
| **Dom 25/10** | **G5: Release Candidate**, code freeze. **Revisione di sicurezza** (Claude + ChatGPT) | Checklist G-LEGALE ([02 §10](02-REGOLE-DEL-GIOCO.md)) | ⚠️ **Cambio dell'ora** (ora solare): verificare i cron | — | — |

### Settimana 5 — Lancio (lun 26/10 – dom 01/11)

| Giorno | Attività |
|--------|----------|
| **Lun 26/10** | Correzione dei bug bloccanti della RC. Invio versione di **produzione su Play** (se accesso concesso). |
| **Mar 27/10** | **Fine dell'anteprima:** azzeramento del DB **tranne la lista d'attesa**, `PREVIEW_MODE=false`, indicizzazione ancora bloccata. Inserimento delle **aziende reali** (onboarding assistito, 30-50 offerte nell'area pilota). |
| **Mer 28/10** | **Deploy della RC in produzione**, smoke test, monitoraggio. Il sito è online ma non annunciato ("lancio silenzioso"); si sblocca l'indicizzazione (robots + sitemap). |
| **Gio 29/10** | Correzioni. Pagina crowdfunding pronta (in revisione alla piattaforma). |
| **Ven 30/10** | Preparazione post social, gruppi Facebook "offerte di lavoro [città]", stampa locale, associazioni partner. |
| **Sab 31/10** | **G6: Go / No-Go** con la checklist §5. |
| **Dom 01/11** | 🚀 **LANCIO PUBBLICO**: web + Play Store (se approvato) + campagna crowdfunding + comunicazione. È festivo (Ognissanti) e domenica: ottimo per i lavoratori, per le aziende la spinta vera è **lunedì 02/11**. |

## 4. Elenco completo dei work package

| WP | Titolo | Esecutore | Validazione | Sprint |
|----|--------|-----------|-------------|--------|
| 001 | Scaffold Next.js/TS/Tailwind/shadcn/ESLint/Vitest/Playwright + `VERSIONS.md` | Ollama | ChatGPT → Claude | 1 |
| 002 | Docker Compose dev (PostGIS, Mailpit), env con Zod, logger pino con redazione, flag | Ollama | ChatGPT → Claude | 1 |
| 003 | CI GitHub Actions (check, build, gitleaks, audit, Semgrep) | Ollama | Claude | 1 |
| 004 | Schema DB v1 + migrazioni Drizzle | Claude (scheletro) + Ollama | Claude | 1 |
| 005 | Import comuni ISTAT + centroidi + modulo geo + `FreeZone` (dominio) | Ollama (test di Claude) | Claude | 1 |
| 006 | Tassonomia mansioni ESCO + sinonimi + autocompletamento | Ollama + Gemini (dati) | Claude | 1 |
| 007 | Modulo crypto (KeyProvider, envelope, indice cieco, audit) | **Claude** | ChatGPT (seconda lettura) | 1 |
| 008 | Autenticazione Better Auth (OTP, sessioni, ruoli, adattatore email cifrata) | Claude + Ollama | Claude | 1 |
| 009 | Layout, design di base, landing, lista d'attesa double opt-in, pagine legali | Ollama + Gemini + ComfyUI | Claude | 1 |
| 010 | PWA + assetlinks + TWA Bubblewrap + deploy staging | Tu + Claude | Claude | 1 |
| 011 | Onboarding azienda + VIES + sedi + membri + 2FA | Ollama | ChatGPT → Claude | 2 |
| 012 | Validatore annunci a norma (R-ANN, R-LAV-10/11) | Ollama (test di Claude) | Claude | 2 |
| 013 | Form offerta + moderazione + pannello moderatore | Ollama | ChatGPT → Claude | 2 |
| 014 | Pagina offerta SSR + JSON-LD + sitemap + pagine SEO | Ollama | Claude | 2 |
| 015 | Ricerca + risultati + "perché la vedi" + slot segnaposto | Ollama (test di Claude) | Claude | 2 |
| 016 | Zona gratuita + entitlement + periodo fondatori | Ollama (test di Claude) | Claude | 2 |
| 017 | Onboarding lavoratore + profilo + cifratura + stati + trasferimento | Ollama + Claude (parte PII) | Claude | 3 |
| 018 | CV PDF generato | Ollama | ChatGPT | 3 |
| 019 | Candidature (lavoratore + azienda) + notifiche | Ollama | ChatGPT → Claude | 3 |
| 020 | Avvisi + worker pg-boss + template email | Ollama | ChatGPT → Claude | 3 |
| 021 | Mail 30 giorni + token + conferme + RFC 8058 | Ollama (test di Claude) | Claude | 3 |
| 022 | Scadenza/chiusura offerte + notifica candidati | Ollama | ChatGPT | 3 |
| 023 | Centro privacy + conservazione | Claude + Ollama | Claude | 4 |
| 024 | DSA: segnalazioni, decisioni, T&C versionati | Ollama | Claude | 4 |
| 025 | Pubblicità: slot, sponsor, CMP, AdSense (flag) | Ollama | Claude | 4 |
| 026 | Stripe (flag) + webhook + portale | Ollama | Claude | 4 |
| 027 | Hardening sicurezza + backup + monitoraggio | Claude + Ollama | ChatGPT → Claude | 4 |
| 028 | E2E, accessibilità, carico | Ollama + ChatGPT | Claude | 4 |
| 029 | Fase B: liste anonime + richieste di contatto (flag) | Ollama | Claude | v1.1 |
| 030 | Runbook, produzione, go-live | Tu + Claude | Claude | 5 |

## 5. Checklist Go/No-Go (sabato 31/10)
**Bloccanti (tutti devono essere ✅):**
- [ ] Parere legale ricevuto e perimetro rispettato; `INTERMEDIATION_ENABLED` coerente con il parere
- [ ] Pagine: Chi siamo (legale rappresentante), privacy, cookie, T&C, regolamento annunci — revisionate
- [ ] Cancellazione account funzionante (app e web); export dati funzionante
- [ ] Nessun dato personale in chiaro nel DB (test automatico) e nei log (verifica manuale su 1 giorno di log di staging)
- [ ] Backup giornaliero attivo + **ripristino provato** negli ultimi 7 giorni
- [ ] E2E dei 5 percorsi critici verdi su produzione (con account di test)
- [ ] Email: SPF/DKIM/DMARC ok, OTP consegnati su Gmail/Outlook/Libero/Virgilio in < 1 minuto
- [ ] ≥ 30 offerte reali pubblicate e moderate
- [ ] Monitoraggio e allarmi attivi

**Non bloccanti (si lancia comunque):** Play Store approvato · AdSense approvato · pagamenti attivi · Fase B.

## 6. Se il tempo non basta: cosa si taglia (in quest'ordine)
1. WP-029 Fase B (era già post-lancio)
2. WP-026 Stripe (pagamenti tanto spenti fino a P.IVA)
3. WP-025 AdSense (si lancia solo con slot sponsor interni)
4. WP-018 CV PDF (il profilo online basta)
5. Pagine SEO mansione×provincia (resta la sitemap delle offerte)
6. WP-020 avvisi giornalieri (resta la mail mensile)

**Mai tagliare:** cifratura (WP-007), validatore annunci (WP-012), centro privacy/cancellazione (WP-023), backup (WP-027), moderazione (WP-013).

## 7. Dopo il lancio

### Hypercare (02/11 – 15/11)
- Ogni mattina: errori, email non consegnate, segnalazioni, moderazione < 24 h.
- Onboarding assistito delle aziende (lunedì 02/11 è il primo giorno lavorativo).
- Crowdfunding: aggiornamenti ogni 3-4 giorni.
- Raccolta feedback strutturata (modulo in-app) → backlog.

### v1.1 — entro domenica 29/11/2026
- Notifiche push web (anche nella TWA)
- Messaggi in-app lavoratore↔azienda (niente numeri di telefono esposti)
- Caricamento CV PDF con scansione ClamAV
- AdSense attivo (se approvato) con CMP
- **Fase B** se l'iscrizione art. 6 è arrivata (WP-029)
- Pagamenti attivi se l'associazione ha P.IVA e conto (altrimenti v1.2)
- Campagna **GivingTuesday 01/12**

### v1.2 — dicembre 2026 / gennaio 2027
- Stipendi medi per mansione e provincia (pagine SEO)
- Vetrina azienda, badge "risponde di solito entro X giorni", "chi ha visto la mia candidatura"
- **Indexing API** Google + feed XML per aggregatori (Jobrapido, Jooble, Talent.com, Adzuna, Careerjet)
- Fatturazione elettronica per i piani aziende
- Categoria protetta L.68 (con DPIA aggiornata)
- **Chiavi in OpenBao** gestite dal custode (Fase 2 di [04 §4](04-PRIVACY-SICUREZZA.md))
- Mappatura mansioni ESCO ↔ ISTAT CP2021

### Gennaio – marzo 2027
- Iscrizione al **RUNTS** → Google for Nonprofits + **Ad Grants**, donazioni con benefici fiscali, iscrizione al **5×1000**
- **01/02/2027**: fine del periodo fondatori, piani a pagamento attivi
- Account Play **organizzazione** (D-U-N-S) e trasferimento dell'app
- Multilingua: inglese, rumeno, arabo, ucraino, albanese
- Primi bandi (fondazioni di origine bancaria, Repubblica Digitale)

### Aprile – dicembre 2027
- Famiglie come datori di lavoro (lavoro domestico) con verifica SPID/CIE
- Assistente IA per scrivere annunci (solo per le aziende, nessuna valutazione di persone — R-AI-02)
- Controllo dei minimi tabellari dei CCNL
- Integrazione SIISL per le aziende che vogliono incentivi
- Minori 16-17 anni con tutele
- App iOS (valutare PWA installabile vs App Store)
- **Entro il 02/12/2027**: revisione di conformità AI Act (anche se non usiamo IA ad alto rischio, documentarlo)
