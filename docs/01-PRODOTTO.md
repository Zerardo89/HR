# 01 — Prodotto: visione, funzionalità, perimetro dell'MVP

## 1. Visione in una frase
**Il lavoro vicino a casa, gratis per chi lo cerca, onesto per chi assume.**
Una piattaforma senza scopo di lucro che fa incontrare lavoratori e aziende **del territorio**, dove i dati
delle persone sono protetti per costruzione e le offerte sono **a norma** (stipendio visibile, niente
discriminazioni, niente truffe).

## 2. Principi di prodotto (in ordine di priorità, per decidere nei conflitti)
1. **Il lavoratore prima di tutto.** Gratis sempre, nessun vantaggio a pagamento nella ricerca, controllo totale sui propri dati.
2. **Fiducia > crescita.** Meglio 100 offerte vere che 10.000 dubbie. Moderazione, aziende verificate.
3. **A norma per costruzione.** Le regole di [02-REGOLE-DEL-GIOCO.md](02-REGOLE-DEL-GIOCO.md) sono vincoli del form, non avvisi.
4. **Semplice per chi ha poco tempo e un telefono vecchio.** Italiano semplice, 3 minuti per il profilo, pagine leggere.
5. **Locale.** Il valore gratuito è nel raggio di casa; il nazionale è un servizio extra per le aziende.
6. **Spiegabile.** Ogni risultato dice perché lo vedi. Niente IA che giudica le persone.

## 3. Chi lo usa (personas)
| Persona | Situazione | Cosa le serve | Cosa la fa scappare |
|---------|-----------|---------------|---------------------|
| **Marco, 34, magazziniere**, cerca attivamente | Contratto scaduto, ha solo lo smartphone | Offerte entro 20 km, stipendio chiaro, candidatura in 1 tocco | Moduli lunghi, CV da caricare, annunci truffa, nessuna risposta |
| **Aisha, 27, OSS**, occupata ma aperta | Lavora in RSA, cerca orari migliori | Restare "in lista" senza esporsi; ricevere ogni tanto le offerte giuste | Il capo che scopre il profilo, spam |
| **Giulia, 52, cuoca**, rientro al lavoro | Dopo anni di pausa, poco pratica di app | Guida passo-passo, nessuna domanda sull'età | Richieste di foto/età, linguaggio tecnico |
| **Luca, titolare di un ristorante** (8 dipendenti) | Serve un aiuto cuoco per la stagione | Pubblicare in 5 minuti, gratis, candidati della zona | Costi, burocrazia, candidati a 300 km |
| **Sara, HR di una logistica** (120 dipendenti) | Apre un magazzino in un'altra regione | Raggiungere candidati fuori regione | Nessuna — è disposta a pagare se funziona |
| **Agenzia per il lavoro** | Pubblica per clienti | Visibilità, rispetto delle regole | — (deve indicare l'autorizzazione, R-LAV-03) |

## 4. Benchmark: cosa prendiamo da Indeed (e cosa no)
| Indeed | Da noi | Note |
|--------|--------|------|
| Ricerca "Cosa + Dove" | ✅ Identica: mansione/parole chiave + comune + raggio | La semplicità è il punto di forza di Indeed |
| Candidatura semplice con profilo | ✅ "Candidati con il tuo profilo" in 1 tocco | Niente upload all'MVP |
| Avvisi via email | ✅ Avvisi giornalieri/settimanali + mail mensile per gli "aperti" | |
| Offerte sponsorizzate (pay-per-click) | ✅ "In evidenza" a prezzo fisso (più semplice e prevedibile del CPC) | Indeed ha abbandonato il pay-per-application nel 2023 dopo proteste per addebiti imprevisti: prezzo fisso = fiducia |
| Pagine azienda | 🔜 v1.2 (anche come prodotto a pagamento "vetrina") | |
| Stipendi medi per ruolo | 🔜 v1.2 "Quanto si guadagna come… a Bergamo": dati aggregati dalle nostre offerte (obbligatorie grazie al D.Lgs. 96/2026) | Ottimo per SEO |
| Badge "risponde di solito entro X giorni" | 🔜 v1.2 | Contro il "ghosting", il dolore n.1 di chi cerca lavoro |
| CV database per aziende (Smart Sourcing) | ✅ ma **anonimo e con doppio consenso** (Fase B) | Più privacy di Indeed |
| Agenti IA che classificano candidati (Talent Scout, 2025) | ❌ | AI Act alto rischio; noi puntiamo sulla spiegabilità |
| Recensioni aziende | ❌ per ora | Rischio legale e di moderazione |
| Foto profilo | ❌ | Anti-discriminazione |
| Google for Jobs | ✅ dati strutturati + Indexing API | Traffico gratuito |

**Contesto di mercato:** InfoJobs è confluito in Subito.it (fine 2025); Indeed e LinkedIn dominano ma
**non** sono locali, non sono no-profit e non garantiscono stipendio e anonimato. Il nostro spazio: **locale + etico + gratuito per le PMI del territorio**.

## 5. La regola "regione o 50 km" (ADR-0009)

### 5.1 Definizioni
- **Sede verificata**: la sede legale (da VIES/visura) o una sede operativa approvata dal moderatore. Localizzata al **comune** (codice ISTAT).
- **Zona gratuita dell'azienda** = per ogni sede verificata: **tutti i comuni della sua regione** ∪ **tutti i comuni entro 50 km** (distanza in linea d'aria tra i centroidi dei comuni). Un'azienda di Piacenza (Emilia-Romagna) copre gratis tutta l'Emilia-Romagna **e** Lodi, Cremona, Pavia entro 50 km.
- **Fuori zona** = tutto il resto → **Piano Nazionale** (a pagamento).

### 5.2 Perché non "la regione da cui ci si connette"
L'IP **non** indica dove si trova una persona: le reti mobili italiane escono spesso da Milano o Roma,
e basta una VPN per cambiare regione. Usare l'IP renderebbe la regola **ingiusta** (un'azienda di Lecce
risulterebbe a Milano) e **aggirabile**. Usiamo la **sede verificata**; l'IP resta solo un segnale antifrode.

### 5.3 Cosa è gratis e cosa a pagamento
| Azione azienda | Nella zona gratuita | Fuori zona |
|----------------|---------------------|------------|
| Pubblicare un'offerta con luogo di lavoro nella zona | **Gratis, illimitato** | Offerta con luogo di lavoro fuori zona → **Nazionale** |
| Chi può vedere e candidarsi all'offerta | **Tutti i lavoratori d'Italia** (il lavoratore non va mai limitato) | Tutti |
| Chi riceve l'offerta negli **avvisi** e nella **mail mensile** | I lavoratori il cui raggio include l'offerta | Con Nazionale: anche i lavoratori "disposti a trasferirsi" in quella regione |
| (Fase B) Consultare le liste per mansione | Candidati domiciliati nella zona **+** candidati che hanno indicato "disponibile a trasferirmi in [questa regione]" | Con Nazionale: tutta Italia |
| (Fase B) Richieste di contatto | 20/mese gratis | Con Nazionale: 100/mese |

> **Sfumatura a favore dei lavoratori:** se un lavoratore dichiara "disponibile a trasferirmi in Lombardia",
> le aziende lombarde lo vedono **gratis** anche se abita a Palermo: è una sua scelta, non la paghiamo noi a lui
> né la facciamo pagare all'azienda.

### 5.4 Anti-abuso
- Sedi operative aggiuntive: approvazione manuale (prova: visura, contratto, foto insegna…).
- Limite di 5 sedi per il piano gratuito.
- Offerte con luogo di lavoro incoerente (es. "Milano" ma sede e contatti in Puglia) → moderazione.

## 6. Stati del lavoratore e mail ogni 30 giorni

### 6.1 Stati
| Stato | Etichetta UI | Visibile alle aziende (Fase B) | Avvisi | Mail 30 giorni |
|-------|-------------|--------------------------------|--------|----------------|
| `seeking` | 🟢 **Cerco lavoro** | Sì (anonimo) | Sì (frequenza scelta) | No (riceve già gli avvisi) |
| `open` | 🟡 **Occupato, ma aperto a proposte** | Sì (anonimo, con etichetta "occupato") | No | **Sì** |
| `hidden` | ⚪ **Non visibile** | No | No | No |

Il lavoratore sceglie le **mansioni** (fino a 5) in cui comparire nelle liste: ecco le "liste della propria mansione".

### 6.2 La mail mensile (per chi è `open`)
- **Quando:** ogni 30 giorni dalla data di iscrizione (gli invii si distribuiscono nel mese → reputazione del dominio migliore e carico basso), alle 9:00 ora italiana.
- **Oggetto esempio:** *"Marco, stai cercando lavoro? 12 offerte da cuoco vicino a Bergamo"*
- **Contenuto:** le **10 offerte più pertinenti** (mansione + raggio + pubblicate negli ultimi 30 giorni) e il totale con link "vedi tutte". *Allegare "tutte" le offerte non è praticabile (potrebbero essere centinaia) e peggiora la consegna delle email.*
- **Quattro pulsanti:**
  1. **"Sì, sto cercando"** → stato `seeking`, attiva gli avvisi
  2. **"No, resto occupato ma visibile"** → conferma `open`
  3. **"Nascondimi per ora"** → `hidden`
  4. **"Cancella il mio profilo"** → flusso di cancellazione
  Ogni pulsante apre una **pagina di conferma** (non esegue l'azione al clic: R-MAIL-02), con token firmato valido 30 giorni.
- **Senza risposta:** dopo **6 mail consecutive** senza alcuna interazione → profilo nascosto e invii sospesi, con un'ultima mail "Ti abbiamo messo in pausa, riattiva quando vuoi". Tutela la privacy (minimizzazione) e la reputazione email.
- **Niente pubblicità** nella mail (resta una comunicazione di servizio, R-PRIV-* / art. 130).
- **Disiscrizione con un clic** (RFC 8058) nell'intestazione.

## 7. Funzionalità per rilascio

Legenda: **M** = MVP 01/11/2026 · **1.1** = fine novembre · **1.2** = dicembre/gennaio · **2027** = dopo

### 7.1 Lavoratore
| Funzione | Rilascio | Note |
|----------|----------|------|
| Registrazione con email + codice OTP (niente password), passkey opzionale | M | 18+ autodichiarato |
| Profilo guidato in 3 minuti: mansioni (autocompletamento con sinonimi), comune + raggio, esperienze, formazione, lingue, patenti, disponibilità, contratti desiderati | M | Nessuna foto, nessuna data di nascita |
| Stato cerco/aperto/nascosto | M | |
| "Disponibile a trasferirmi in…" (regioni) | M | |
| CV in PDF generato dal profilo (senza foto) | M | |
| Ricerca offerte + filtri (mansione, raggio, contratto, orario, stipendio minimo, pubblicate da) | M | |
| Pagina offerta con "perché la vedi" | M | |
| Candidatura con 1 tocco + messaggio facoltativo | M | |
| "Le mie candidature" con stato (inviata, vista, in valutazione, chiusa) | M | Lo stato "vista" riduce l'ansia da ghosting |
| Avvisi email (giornaliero/settimanale) | M | |
| Mail ogni 30 giorni per gli "aperti" | M | |
| Centro privacy: esporta, nascondi, cancella, consensi | M | |
| Segnala offerta | M | |
| Notifiche push web (anche nell'app Android) | 1.1 | |
| Messaggi in-app con l'azienda (senza esporre telefono/email) | 1.1 | |
| Caricamento CV PDF (con scansione antivirus) | 1.1 | |
| Richieste di contatto dalle aziende (accetta/rifiuta) | 1.1 (se Fase B attiva) | |
| "Chi ha visto la mia candidatura" | 1.2 | |
| Categoria protetta L.68 (opt-in) | 1.2 | Serve la DPIA completa |
| Multilingua (EN, RO, AR, UK, SQ…) | 2027 | Lavoratori stranieri |
| Minori 16-17 anni con tutele | 2027 | |

### 7.2 Azienda
| Funzione | Rilascio | Note |
|----------|----------|------|
| Registrazione con P.IVA → verifica VIES, dati precompilati | M | |
| Sedi (legale + operative con approvazione) | M | |
| Più utenti per azienda (titolare, selezionatore) + 2FA | M | |
| Crea offerta con **validatore a norma** (stipendio, contratto, linguaggio, scadenza) e anteprima | M | Cuore del prodotto |
| Moderazione prime 3 offerte | M | |
| Casella candidature: elenco, dettaglio, cambio stato, esporta PDF | M | |
| Chiudi/rinnova offerta; notifica automatica "posizione chiusa" ai candidati | M | Anti-ghosting |
| Tipo account "Agenzia per il lavoro" con n. autorizzazione | M | |
| Offerta "In evidenza" | 1.1 (a pagamento quando attivo il billing) | |
| Piano Nazionale (offerte fuori zona + avvisi nazionali) | M costruito, **attivo a pagamento dal 01/02/2027** | "Periodo fondatori" gratuito |
| Liste per mansione (profili anonimi) + richieste di contatto | 1.1 **solo se Fase B autorizzata** | |
| Vetrina azienda | 1.2 | |
| Badge tempo di risposta | 1.2 | |
| Assistente per scrivere l'annuncio (IA generativa, non valuta persone) | 2027 | R-AI-02 |
| Pubblicazione anche su SIISL | 2027 | Per chi vuole incentivi |
| Famiglie come datori (lavoro domestico) con SPID/CIE | 2027 | |

### 7.3 Piattaforma e amministrazione
| Funzione | Rilascio |
|----------|----------|
| Pannello moderazione (offerte, aziende, segnalazioni DSA con motivazione) — **senza dati personali** | M |
| Statistiche aggregate (Umami + contatori interni) | M |
| SEO: pagine offerta SSR, JSON-LD JobPosting, sitemap, pagine "Lavoro [mansione] a [provincia]" | M |
| Indexing API Google + feed XML per aggregatori (Jobrapido, Jooble, Talent.com, Adzuna, Careerjet) | 1.2 |
| Pubblicità: slot interni + AdSense con CMP (quando approvato) | 1.1 |
| Pagamenti Stripe (Sostenitore, Nazionale, In evidenza) | costruiti in M, **attivi quando l'associazione ha P.IVA** |
| Lista d'attesa pre-lancio (double opt-in) | Settimana 1 |

## 8. Il matching (ADR-0005)
Due passaggi, **entrambi deterministici e spiegabili**:
1. **Filtri rigidi** (solo ciò che l'utente ha scelto): mansione (o gruppo di mansioni affini), distanza ≤ raggio, stato dell'offerta, tipo contratto se selezionato, stipendio minimo se indicato.
2. **Ordinamento** con punteggio a pesi pubblici:

| Fattore | Peso | Spiegazione mostrata |
|---------|------|----------------------|
| Mansione uguale (1) / affine stesso gruppo ISCO (0,5) | 40 | "Stessa mansione" / "Mansione simile" |
| Vicinanza: 1 − distanza/raggio | 25 | "A 12 km da te" |
| Competenze in comune (quota delle competenze richieste che hai) | 20 | "Hai 3 competenze su 4" |
| Freschezza (decadimento in 30 giorni) | 10 | "Pubblicata 2 giorni fa" |
| Contratto/orario come preferisci | 5 | "Part-time, come preferisci" |

Le offerte sponsorizzate sono **separate** (max 2 in alto, etichettate), **non** alterano il punteggio.
Nessun uso di età, sesso, origine (i dati non esistono). La formula è pubblicata nella pagina "Come funziona".

## 9. Metriche (KPI)
- **Stella polare:** *candidature che ricevono una risposta dall'azienda entro 7 giorni* (misura valore reale per entrambi i lati).
- Lancio (entro 31/12/2026, area pilota): 50 aziende verificate · 150 offerte attive · 1.000 lavoratori registrati · 30 % dei lavoratori "aperti" che rispondono alla mail mensile.
- Qualità: < 1 % offerte rimosse per truffa; tempo di moderazione < 24 h.
- Sostenibilità: costi mensili coperti da ricavi entro il mese 9 (scenario base, vedi [05-MONETIZZAZIONE.md](05-MONETIZZAZIONE.md)).
- Tecniche: pagina offerta < 1,5 s LCP su 4G; disponibilità ≥ 99,5 %.

## 10. Idee di miglioramento proposte dall'architetto (oltre la richiesta iniziale)
1. **Selezione alla cieca:** profili anonimi finché il lavoratore non accetta il contatto (privacy + meno discriminazioni).
2. **Stipendio sempre visibile** (obbligo di legge trasformato in vantaggio) → pagine "quanto si guadagna" per la SEO.
3. **"Disponibile a trasferirmi"**: allarga le opportunità del lavoratore senza costi.
4. **Anti-ghosting:** chiusura automatica con notifica ai candidati, stato "vista", badge tempo di risposta.
5. **Periodo fondatori:** tutto gratis per le aziende fino al 31/01/2027 → toglie i pagamenti dal percorso critico del lancio e crea fedeltà.
6. **Tempismo del lancio:** novembre è il picco di assunzioni per logistica (Black Friday/Natale), commercio natalizio, stagione sciistica e raccolta delle olive: campagna mirata su queste mansioni.
7. **Sponsor locali senza tracciamento** (banche di credito cooperativo, associazioni di categoria): più redditizi e senza banner cookie.
8. **Metrica "km 0":** "X persone hanno trovato lavoro a meno di 20 km da casa" → racconto di sostenibilità utile per bandi e stampa.
9. **Partnership di territorio:** Informagiovani, CPI, patronati, Caritas, parrocchie, scuole professionali/ITS, associazioni di categoria.
10. **Google Ad Grants** (fino a $10.000/mese di annunci gratuiti) appena l'associazione è nel RUNTS.
