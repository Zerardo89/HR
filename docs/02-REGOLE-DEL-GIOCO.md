# 02 — Regole del gioco (quadro normativo)

> **Stato:** v1 — 26/09/2026 — redatto dall'architetto (Claude) dopo ricerca online.
> **Attenzione:** questo documento **non è un parere legale**. Serve a (1) progettare il prodotto già
> conforme, (2) preparare le domande giuste per il professionista (vedi §12). Ogni regola ha un ID
> (`R-xxx-nn`) che va citato nei work package, nei test e nelle review.

---

## 0. Le 5 cose che cambiano il progetto (leggere per prime)

| # | Scoperta | Impatto sul progetto |
|---|----------|----------------------|
| 1 | **Far incontrare domanda e offerta = "intermediazione"** (art. 2, D.Lgs. 276/2003), che include *raccolta dei curricula* e *costituzione della banca dati*. Serve autorizzazione ministeriale **oppure** il **regime particolare** dell'art. 6: *gestori di siti internet senza finalità di lucro che pubblicano sul sito i dati del legale rappresentante*, con iscrizione all'Albo informatico e interconnessione col sistema ministeriale (DM 20/09/2011). | Serve un **ente senza scopo di lucro** (associazione) come titolare della piattaforma. Il "no lucro" che volevi per scelta è anche **un requisito di legge** per stare nel regime semplificato. |
| 2 | Dal **2 marzo 2024** (DL 19/2024, conv. L. 56/2024) l'intermediazione **non autorizzata è di nuovo reato anche senza scopo di lucro** (arresto fino a 45 giorni o ammenda). | Non si "prova e poi si vede". Il prodotto nasce in **due fasi**: *Fase A – Bacheca* (sicura da subito) e *Fase B – Intermediazione* (si accende solo dopo il via libera legale). Vedi §2.3. |
| 3 | **D.Lgs. 96/2026** (trasparenza retributiva, in vigore dal **7 giugno 2026**): retribuzione iniziale o fascia da comunicare **nell'annuncio o prima del colloquio**; **vietato chiedere la retribuzione pregressa**. | Campo stipendio **obbligatorio** nel form offerta; **nessun campo** "RAL attuale" nel profilo. Vantaggio competitivo: siamo "a norma per costruzione". |
| 4 | **AI Act**: i sistemi di IA per selezionare/filtrare/valutare candidati o per annunci mirati sono **ad alto rischio** (Allegato III, punto 4). Obblighi rinviati al **2 dicembre 2027** dal Digital Omnibus (in vigore dal 27/07/2026), ma arriveranno. | **Matching deterministico e spiegabile, niente IA che classifica le persone.** È anche un argomento di fiducia ("nessun algoritmo decide chi vede il tuo CV"). |
| 5 | **Lavoratori: gratis per legge** (art. 11 D.Lgs. 276/2003 — divieto di percepire compensi, anche indiretti, dal lavoratore). | Coincide con la tua visione. Ma l'abbonamento "senza pubblicità" pagato dai lavoratori va **inquadrato con cura** (§5.2). |

---

## 1. Mappa delle fonti

| Area | Norma principale | Cosa ci riguarda |
|------|------------------|------------------|
| Mercato del lavoro | D.Lgs. 276/2003 (Legge Biagi) artt. 2, 4, 6, 9, 10, 11, 18 | Intermediazione, annunci, divieti, sanzioni |
| Regime siti internet | DM Lavoro 20/09/2011 | Iscrizione Albo informatico + interconnessione |
| Sanzioni | DL 19/2024 art. 29 (conv. L. 56/2024) | Ri-penalizzazione art. 18 |
| Retribuzione | D.Lgs. 96/2026 (recepisce Dir. UE 2023/970) | Stipendio negli annunci, no storico retributivo |
| Parità / discriminazioni | D.Lgs. 198/2006 (Codice pari opportunità) art. 27; D.Lgs. 215/2003; D.Lgs. 216/2003 | Annunci neutri, no requisiti di età, sesso, origine |
| Disabilità | L. 68/1999 | Offerte "categorie protette", dati sanitari |
| Minori | L. 977/1967; obbligo d'istruzione (16 anni) | Età minima utenti |
| Privacy | GDPR (Reg. UE 2016/679); D.Lgs. 196/2003 mod. D.Lgs. 101/2018 (art. 111-bis CV, art. 2-quinquies minori, art. 122 cookie, art. 130 marketing) | Tutto il trattamento |
| Privacy — prassi | Codice di condotta APL (Assolavoro) approvato dal Garante 11/01/2024, in vigore 07/03/2024 | Benchmark su conservazione, minimizzazione, referenze |
| Cookie | Linee guida Garante 10/06/2021; Provv. 29/04/2025 (consultazione "Pay or OK") | Banner, pubblicità, abbonamento no-ads |
| IA | Reg. UE 2024/1689 (AI Act) + Digital Omnibus 2026; L. 132/2025 art. 11 | Niente IA di selezione |
| Piattaforme | Reg. UE 2022/2065 (DSA), art. 11-18 (+ art. 19 esenzione micro/piccole) | Segnalazioni, motivazioni, T&C |
| Consumatori | D.Lgs. 206/2005 (Codice del Consumo); D.Lgs. 70/2003 (e-commerce) | Abbonamenti, info obbligatorie sul sito |
| Pubblicità vietata | DL 87/2018 art. 9 ("Decreto Dignità") | Divieto pubblicità gioco d'azzardo |
| Terzo settore | D.Lgs. 117/2017 (CTS); D.Lgs. 186/2025 (fiscale dal 01/01/2026) | Forma giuridica, donazioni, 5×1000 |
| Offerte pubbliche per incentivi | DL 159/2025 art. 14 (conv. L. 198/2025) — SIISL | Aziende che vogliono incentivi devono pubblicare anche su SIISL |
| Store | Google Play Developer Policy | Test chiuso 12×14, cancellazione account, Data safety, target API 36 |
| Email | Requisiti bulk sender Gmail/Yahoo (2024-2025) | SPF/DKIM/DMARC, disiscrizione 1-click |

---

## 2. Intermediazione: il nodo centrale

### 2.1 Cosa dice la legge (sintesi)
- **Art. 2 D.Lgs. 276/2003** — l'intermediazione comprende tra l'altro: *raccolta dei curricula*, *preselezione e costituzione di relativa banca dati*, *promozione e gestione dell'incontro tra domanda e offerta*.
- **Art. 4-5** — autorizzazione ordinaria (requisiti societari e patrimoniali da agenzia vera: **irraggiungibili** per un hobby).
- **Art. 6** — **regime particolare di autorizzazione**; tra i soggetti ammessi: *gestori di siti internet, a condizione che svolgano l'attività senza finalità di lucro e che rendano pubblici sul sito i dati identificativi del legale rappresentante*. Il **DM 20/09/2011** subordina l'esercizio a **interconnessione** col portale ministeriale (all'epoca ClicLavoro; oggi l'ecosistema è confluito nei sistemi del Ministero/SIISL — *da verificare la procedura attuale*) e **iscrizione all'Albo informatico**.
- **Art. 9** — vietati annunci di ricerca e selezione **in forma anonima**; i datori di lavoro possono pubblicare direttamente solo in forma **non anonima**; le agenzie devono indicare gli **estremi dell'autorizzazione**.
- **Art. 10** — divieto di indagini e preselezioni basate su convinzioni, affiliazione sindacale/politica, religione, sesso, orientamento sessuale, stato matrimoniale/famiglia/gravidanza, **età**, handicap, origine etnica, colore, ascendenza, origine nazionale, gruppo linguistico, stato di salute, controversie con ex datori — salvo requisiti essenziali e determinanti. **Vietato trattare dati non strettamente attinenti alle attitudini professionali.**
- **Art. 11** — vietato esigere o percepire compensi, **direttamente o indirettamente**, dal lavoratore.
- **Art. 18** + **DL 19/2024** — intermediazione non autorizzata: **contravvenzione penale** anche senza scopo di lucro (arresto fino a 45 giorni o ammenda €300-1.500; importi più alti se con lucro). *Testo vigente da confermare col legale.*

### 2.2 Cosa significa "senza finalità di lucro" per noi
- Non vuol dire "zero entrate": vuol dire **nessuna distribuzione di utili**, entrate reinvestite nei costi e nella missione.
- La forma coerente è un **ente del Terzo settore** (associazione) con statuto che vieta la distribuzione di utili (art. 8 CTS). Una ditta individuale o una Srl ordinaria **non** sono compatibili col regime art. 6.
- Pubblicità, piani a pagamento per aziende e donazioni sono **compatibili in linea di principio** se servono a coprire i costi; il legale deve confermarlo (domanda D2 in §12).

### 2.3 Strategia a due fasi (decisione architetturale — vedi ADR-0011)

| | **Fase A — Bacheca** (dal lancio) | **Fase B — Intermediazione** (dopo via libera) |
|---|---|---|
| Aziende | Pubblicano **le proprie** offerte, in forma **non anonima** (art. 9 consente al datore di pubblicare direttamente) | + consultano le **liste per mansione** (profili anonimi) e inviano **richieste di contatto** |
| Lavoratori | Cercano, si candidano **di propria iniziativa**, ricevono avvisi e la mail mensile | + possono essere **trovati** dalle aziende (solo se lo scelgono) |
| Profili | Il profilo serve **solo al lavoratore** per candidarsi più in fretta e ricevere offerte; **non è consultabile dalle aziende** | Profilo consultabile in forma **anonima** (ADR-0007) |
| Monetizzazione | Pubblicità, sostenitori, offerte "in evidenza", visibilità nazionale delle offerte | + ricerca candidati fuori zona a pagamento |
| Requisito | Parere legale che confermi che la Fase A non è intermediazione (o che lo è ma serve comunque l'art. 6 → allora si parte già in art. 6) | Associazione costituita + iscrizione Albo (art. 6) + interconnessione |

Tecnicamente: **feature flag `INTERMEDIATION_ENABLED`** (default `false`). Tutto il codice della Fase B si costruisce, si testa, ma resta spento.

> **Sfumatura importante:** anche la sola "costituzione di banca dati" di CV è citata nella definizione di
> intermediazione. In Fase A i profili esistono per servire il lavoratore (come un account "salva i miei
> dati e avvisami"), **non** vengono esposti a nessuna azienda. È la zona grigia da far validare per prima
> (domanda D1). Se il legale dice che anche questo è intermediazione, **il lancio del 01/11 si fa comunque**
> ma con profili ridotti a "avvisi via email" finché l'iscrizione art. 6 non è attiva.

### 2.4 Regole di prodotto derivate

| ID | Regola | Come si implementa | Test |
|----|--------|--------------------|------|
| **R-LAV-01** | Gratis per i lavoratori: nessuna funzione di ricerca lavoro a pagamento per il lavoratore | Nessun entitlement a pagamento lato lavoratore tranne "Sostenitore" (solo rimozione pubblicità, zero vantaggi nel matching) | Test che verifica che nessuna query di ricerca/ranking legga entitlement del lavoratore |
| **R-LAV-02** | Annunci **non anonimi** | `company.display_name` obbligatorio e sempre visibile sull'offerta; niente "importante azienda cerca" | Validatore rifiuta offerte senza azienda verificata |
| **R-LAV-03** | Le **agenzie per il lavoro** che pubblicano devono indicare gli estremi dell'autorizzazione | Tipo account "APL" con campo n. autorizzazione obbligatorio, verificato a mano contro l'Albo | Moderazione manuale prima offerta |
| **R-LAV-04** | Dati del **legale rappresentante** pubblicati sul sito (art. 6) | Pagina `/chi-siamo` + footer con ente, CF/P.IVA, legale rappresentante, PEC | Check in CI che la pagina esista |
| **R-LAV-05** | Nessun dato non attinente alle attitudini professionali | Schema profilo **senza**: data di nascita, sesso, stato civile, figli, nazionalità, foto, religione, salute (eccetto R-LAV-08) | Test di schema: lista campi vietati |
| **R-LAV-06** | Nessun filtro/ordinamento su caratteristiche protette | Il motore di matching non ha accesso a tali campi (non esistono) | Test su funzione di ranking |
| **R-LAV-07** | Funzione "Fase B" spenta finché non c'è autorizzazione | Flag `INTERMEDIATION_ENABLED` letto lato server; route azienda "liste" rispondono 404 se off | Test e2e con flag off |
| **R-LAV-08** | Categorie protette L. 68/99 | Dato "iscritto L.68" = dato sanitario (art. 9 GDPR): **facoltativo**, **consenso esplicito separato**, cifrato con chiave dedicata, condiviso **solo** candidandosi a offerte marcate L.68 | Test cifratura + test visibilità |
| **R-LAV-09** | Età minima | MVP: **18+** con autodichiarazione (non si chiede la data di nascita). Estensione a 16-17 anni solo con tutele L. 977/1967 (lavori vietati, orari) — roadmap 2027 | Checkbox obbligatoria in registrazione |
| **R-LAV-10** | Tirocini extracurricolari | Tipo contratto "tirocinio" richiede indennità ≥ minimo della **regione** della sede (tabella da mantenere) e dichiarazione che non sostituisce lavoro subordinato | Validatore su offerta |
| **R-LAV-11** | Niente oneri economici chiesti ai candidati negli annunci | Validatore blocca parole chiave ("quota di iscrizione", "investimento iniziale", "kit a pagamento", "corso obbligatorio a pagamento") → moderazione | Test su validatore |
| **R-LAV-12** | Avviso SIISL | Nel form offerta: nota informativa "Se vuoi accedere agli incentivi all'assunzione, l'offerta va pubblicata anche su SIISL (DL 159/2025)" | — |

---

## 3. Annunci di lavoro a norma

### 3.1 Trasparenza retributiva — D.Lgs. 96/2026
- Vale **per ogni datore di lavoro, senza soglie dimensionali**, per lavoro subordinato (tempo determinato/indeterminato, anche part-time, dirigenti). **Escluso il lavoro domestico.**
- Retribuzione iniziale **o fascia**: nell'annuncio **o** prima del colloquio. Noi scegliamo la via più semplice e più utile al lavoratore: **sempre nell'annuncio**.
- **Divieto** di chiedere la retribuzione percepita nei rapporti precedenti.
- Sanzioni amministrative + possibile esclusione da benefici pubblici per le aziende inadempienti.

| ID | Regola | Implementazione |
|----|--------|-----------------|
| **R-ANN-01** | Stipendio obbligatorio per lavoro subordinato | `salary_min` obbligatorio, `salary_max` opzionale (≥ min), `salary_period` (ora/mese/anno), `salary_basis` (lordo/netto — **default lordo**, con etichetta chiara). Per "lavoro domestico" facoltativo |
| **R-ANN-02** | Nessuna domanda sullo storico retributivo | Nessun campo; le **domande di screening** personalizzate dell'azienda passano un filtro che blocca "RAL attuale", "ultimo stipendio", "quanto guadagni" |
| **R-ANN-03** | Titolo neutro o rivolto a entrambi i sessi (D.Lgs. 198/2006 art. 27) | Suggerimento automatico "(m/f)" o forma neutra; blocco di formulazioni tipo "cercasi ragazza", "solo uomini" salvo requisito essenziale motivato (moderazione manuale) |
| **R-ANN-04** | Niente requisiti di età, aspetto, origine | Lista termini bloccanti/sospetti: "max X anni", "età", "giovane", "bella presenza", "italiano madrelingua" (ammesso solo "ottima conoscenza dell'italiano"), "solo italiani", "no stranieri", "automunita" → ok solo se motivato. Parole **sospette** → moderazione, parole **vietate** → blocco |
| **R-ANN-05** | Tipologia contrattuale sempre indicata | Enum: indeterminato, determinato, apprendistato, somministrazione, tirocinio, stagionale, collaborazione, lavoro autonomo/P.IVA, lavoro occasionale |
| **R-ANN-06** | CCNL applicato (raccomandato) | Campo testo con suggerimenti dai CCNL più diffusi; in roadmap 2027 controllo minimi tabellari |
| **R-ANN-07** | Scadenza obbligatoria | `valid_through` ≤ 60 giorni, rinnovabile; alla scadenza l'offerta sparisce e i candidati ricevono "posizione chiusa" (anche requisito Google for Jobs) |
| **R-ANN-08** | Offerte truffa/irregolari | Regole anti-frode (§3.2) + pulsante "Segnala" (R-DSA-03) |

### 3.2 Anti-truffa (fiducia = tutto il valore del prodotto)
- Azienda **verificata** (P.IVA valida su VIES + corrispondenza ragione sociale) prima di pubblicare.
- Le **prime 3 offerte** di ogni azienda nuova passano in **moderazione manuale** (la fa il fondatore: vede solo offerte, **nessun dato personale**).
- Blocco link esterni per candidarsi via WhatsApp/Telegram come unico canale; blocco richieste di denaro, dati bancari, documenti d'identità in fase di candidatura.
- Pagina pubblica "Come riconoscere un'offerta truffa" (ispirata alla guida di ClicLavoro).

---

## 4. Privacy (GDPR + Codice privacy)

Dettagli tecnici in [04-PRIVACY-SICUREZZA.md](04-PRIVACY-SICUREZZA.md). Qui le **regole**.

### 4.1 Ruoli
- **Titolare** della piattaforma: l'**associazione** (non tu come persona, una volta costituita). Fino ad allora il titolare sei tu: motivo in più per costituire l'ente **prima** di raccogliere dati reali.
- **Aziende**: quando ricevono una candidatura diventano **titolari autonomi** dei dati del candidato che hanno ricevuto. Forniamo loro un **modello di informativa** e le obblighiamo nei T&C a rispettarla.
- **Fornitori** (hosting, email): **responsabili del trattamento** con contratto art. 28 (DPA). Preferenza UE/Italia.

### 4.2 Basi giuridiche
| Trattamento | Base | Nota |
|-------------|------|------|
| Account e profilo lavoratore | Contratto (art. 6.1.b) | Art. 111-bis Codice privacy: per i CV inviati per instaurare un rapporto di lavoro **il consenso non è dovuto**; l'informativa si dà al primo contatto utile |
| Candidatura inviata all'azienda | Contratto / misure precontrattuali su richiesta dell'interessato | È il lavoratore che sceglie a chi inviare |
| Mail mensile "stai cercando?" + avvisi offerte | Contratto (servizio richiesto) + opt-in esplicito in registrazione | **Nessuna pubblicità** dentro, altrimenti diventa marketing (art. 130) |
| Dato L. 68/99 | **Consenso esplicito** (art. 9.2.a) | Separato, revocabile, facoltativo |
| Sicurezza, antifrode, log | Legittimo interesse (art. 6.1.f) | Log senza contenuti personali |
| Cookie pubblicitari / profilazione | Consenso (art. 122 Codice privacy) | Tramite CMP certificata Google (TCF v2.2) |
| Promozione di **altri progetti** tuoi | **Consenso marketing separato**, facoltativo, non pre-spuntato | Vedi R-PRIV-10 |

### 4.3 Regole
| ID | Regola |
|----|--------|
| **R-PRIV-01** | **Minimizzazione:** comune (codice ISTAT) invece dell'indirizzo; nessuna data di nascita; nessuna foto; nessun codice fiscale del lavoratore. |
| **R-PRIV-02** | **Cifratura applicativa** dei dati identificativi (nome, email, telefono, testi liberi del CV) — ADR-0004. |
| **R-PRIV-03** | **Conservazione** (ispirata al Codice di condotta APL che fissa max 48 mesi e alle indicazioni del Garante 6-12 mesi per CV conservati dalle aziende): <br>• account inattivo 6 mesi (nessun accesso/clic) → profilo **nascosto** + avviso; <br>• inattivo **24 mesi** → **cancellazione** con preavviso di 30 giorni; <br>• candidature: visibili all'azienda fino a **6 mesi** dopo la chiusura dell'offerta, poi rimosse dalla vista azienda; <br>• log di sicurezza: 12 mesi; <br>• dati di fatturazione: 10 anni (obbligo civilistico/fiscale). |
| **R-PRIV-04** | **Diritti self-service:** esporta i miei dati (JSON + PDF), modifica, nascondi, **cancella account** (in-app e via web — anche requisito Google Play). Risposta a richieste manuali entro 30 giorni. |
| **R-PRIV-05** | **Nessun dato personale nei log**, negli errori, negli strumenti di analisi, nei prompt verso IA esterne. |
| **R-PRIV-06** | **Nessuna decisione basata unicamente su trattamento automatizzato** (art. 22): il matching ordina e filtra per criteri dichiarati dall'utente, ogni risultato mostra "perché lo vedi". |
| **R-PRIV-07** | **Data breach:** procedura di notifica al Garante entro 72 ore (art. 33) e comunicazione agli interessati se rischio elevato. |
| **R-PRIV-08** | **Trasferimenti extra-UE** evitati per i dati personali; se inevitabili (es. Google per la pubblicità) solo con consenso e con garanzie (EU-US Data Privacy Framework). |
| **R-PRIV-09** | **DPIA** (valutazione d'impatto) redatta prima del lancio: trattamento di dati di persone in cerca di lavoro (potenzialmente vulnerabili) su larga scala, con dato sanitario opzionale → la DPIA è prudente anche se non fosse strettamente obbligatoria. |
| **R-PRIV-10** | **Visibilità sì, dati no:** la piattaforma può dare visibilità ai tuoi progetti futuri (banner della casa, pagina "altri progetti"), ma **gli indirizzi email degli utenti non si usano** per promuoverli senza consenso marketing specifico (principio di limitazione della finalità, art. 5.1.b). |
| **R-PRIV-11** | **Nessun pixel di tracciamento nelle email**, nessun "read receipt". Misuriamo solo i clic sui pulsanti d'azione. |
| **R-PRIV-12** | **Referenze** di ex datori: mai raccolte o comunicate senza autorizzazione esplicita del candidato (principio del Codice di condotta APL). |

### 4.4 Cookie e tracciamento (Linee guida Garante 10/06/2021)
| ID | Regola |
|----|--------|
| **R-COOK-01** | Banner con **"Accetta" e "Rifiuta" di pari evidenza**; la **X** chiude = rifiuto; lo scroll **non** è consenso; niente cookie wall. |
| **R-COOK-02** | Non si ripropone il banner prima di **6 mesi** dopo un rifiuto (salvo cambi sostanziali). |
| **R-COOK-03** | Analytics **cookieless e self-hosted** (Umami) con IP anonimizzato → assimilabile a strumento tecnico, niente consenso. |
| **R-COOK-04** | Pubblicità Google solo tramite **CMP certificata Google con IAB TCF v2.2** (obbligatoria in UE dal 16/01/2024); senza consenso Google serve solo annunci "limitati". |
| **R-COOK-05** | **Niente "Pay or OK"**: l'abbonamento senza pubblicità **non** è l'alternativa al consenso. Il Garante (provv. 29/04/2025, consultazione pubblica) ha espresso seri dubbi su questo modello. Chi rifiuta i cookie usa il sito gratis con annunci non profilati/contestuali. |

---

## 5. Pubblicità, abbonamenti, consumatori

### 5.1 Pubblicità
| ID | Regola |
|----|--------|
| **R-ADS-01** | Ogni contenuto pagato è **etichettato** ("Sponsorizzato" / "Pubblicità") — pratiche commerciali (Codice del Consumo) e buona prassi DSA art. 26. |
| **R-ADS-02** | **Mai** pubblicità in: flusso di candidatura, editor del profilo, pagine privacy/account, email di servizio. **Mai** interstitial a tutto schermo, video con audio automatico, pop-up. |
| **R-ADS-03** | Categorie **bloccate**: gioco d'azzardo (vietato in Italia dal DL 87/2018), trading/cripto, prestiti non trasparenti, "guadagna da casa", MLM, incontri, contenuti per adulti. Si configurano i blocchi nella console AdSense. |
| **R-ADS-04** | Le "offerte sponsorizzate" rispettano **le stesse regole** di tutte le offerte (R-ANN) e sono **al massimo 2 per pagina** di risultati. |
| **R-ADS-05** | Sponsorizzazioni locali vendute direttamente = **contestuali e senza tracciamento** (nessun cookie di terze parti) → funzionano anche per chi rifiuta i cookie. |

### 5.2 Abbonamento "Sostenitore" (senza pubblicità) — attenzione all'art. 11
- L'art. 11 vieta compensi **anche indiretti** dal lavoratore **per l'intermediazione**. Togliere la pubblicità non migliora la ricerca di lavoro, ma un'interpretazione rigida potrebbe contestarlo.
- **Soluzione progettuale:** lo chiamiamo **"Sostenitore"**: è un **contributo volontario** all'associazione con, come ringraziamento, la rimozione della pubblicità. **Nessun vantaggio** su visibilità, ranking, candidature, avvisi (R-LAV-01). Domanda D3 al legale.

| ID | Regola |
|----|--------|
| **R-CONS-01** | Informazioni precontrattuali chiare (prezzo, durata, rinnovo, disdetta) prima del pagamento. |
| **R-CONS-02** | **Recesso 14 giorni** per i consumatori; se si attiva subito il servizio digitale serve richiesta espressa + presa d'atto della perdita del recesso. |
| **R-CONS-03** | **Disdetta facile** quanto l'attivazione (un clic nell'area account). |
| **R-CONS-04** | Il sito riporta denominazione, sede, CF/P.IVA, PEC, contatti (D.Lgs. 70/2003 art. 7; P.IVA in homepage). |
| **R-CONS-05** | Piani aziende = B2B: T&C dedicati, fattura elettronica (SDI) obbligatoria. |

---

## 6. Digital Services Act (DSA)
Siamo un **servizio di hosting** che diffonde al pubblico contenuti degli utenti (offerte) → **piattaforma online**. Come **micro/piccola impresa** (< 50 persone e < €10 mln) siamo **esentati** dalla maggior parte degli obblighi specifici delle piattaforme (art. 19), ma **non** da quelli di base.

| ID | Regola |
|----|--------|
| **R-DSA-01** | **Punto di contatto** unico per autorità e utenti (art. 11-12): email dedicata + pagina. |
| **R-DSA-02** | **T&C** chiari su cosa si può pubblicare e come moderiamo (art. 14) → "Regolamento annunci". |
| **R-DSA-03** | **Segnalazione** (notice & action, art. 16): pulsante "Segnala" su ogni offerta e profilo azienda, anche senza account. |
| **R-DSA-04** | **Motivazione** (art. 17) a chi subisce rimozione/sospensione: cosa, perché, come fare reclamo. |
| **R-DSA-05** | Obbligo di informare le autorità in caso di sospetto di reati gravi (art. 18) → procedura interna. |
| **R-DSA-06** | Buona prassi (anche se esenti): trasparenza su come funzionano ordinamento e raccomandazioni (pagina "Come funziona il matching"). |

---

## 7. Intelligenza artificiale
| ID | Regola |
|----|--------|
| **R-AI-01** | **Nessun sistema di IA** che valuti, filtri, classifichi candidati o decida a chi mostrare le offerte. Il matching è a regole esplicite (ADR-0005). Una regola deterministica scritta a mano non è un "sistema di IA" ai sensi dell'AI Act. |
| **R-AI-02** | Qualsiasi futura funzione IA (es. "aiutami a scrivere l'annuncio") richiede **prima** una nota di valutazione: rientra nell'Allegato III? Serve trasparenza art. 50? |
| **R-AI-03** | L. 132/2025 art. 11: gli obblighi informativi ricadono sui **datori di lavoro** che usano IA. Noi non ne usiamo per la selezione → lo diciamo alle aziende (punto di forza). |
| **R-AI-04** | Le IA del team di sviluppo (Ollama, ChatGPT, Gemini, ComfyUI) **non ricevono mai dati personali reali**: solo codice e dati sintetici. |

---

## 8. Google Play e canali digitali
| ID | Regola | Fonte |
|----|--------|-------|
| **R-PLAY-01** | Account sviluppatore **personale** creato dopo il 13/11/2023 → **test chiuso con almeno 12 tester per 14 giorni consecutivi** prima di chiedere l'accesso alla produzione (per ogni nuova app). Gli account **organizzazione** ne sono esenti ma richiedono D-U-N-S. | Play Console Help |
| **R-PLAY-02** | Dal 31/08/2026 le nuove app devono avere **target API 36** (Android 16). | Play Console Help |
| **R-PLAY-03** | Se l'app permette di creare un account: **cancellazione dell'account in-app e tramite link web**, dichiarata nella sezione Data safety. | Play Console Help |
| **R-PLAY-04** | Dichiarare "contiene annunci", questionario contenuti (IARC), pubblico **18+**, informativa privacy raggiungibile. | Play policy |
| **R-PLAY-05** | Nessun acquisto di beni digitali **dentro l'app** Android all'MVP (si evitano Play Billing e le relative commissioni); gli acquisti si fanno sul sito e l'app riconosce il diritto acquisito. Niente pulsanti/inviti all'acquisto esterno nell'app senza aderire ai programmi EEA di Google. | Play Payments policy |
| **R-PLAY-06** | Il **nome del pacchetto** Android (es. `it.tuodominio.lavoro`) è **permanente**: deciderlo prima del primo upload. | — |
| **R-MAIL-01** | Email: SPF + DKIM + DMARC (almeno `p=none`), **disiscrizione con un clic RFC 8058** (header `List-Unsubscribe-Post`), tasso di spam < 0,3 %. | Requisiti Gmail/Yahoo |
| **R-MAIL-02** | I pulsanti d'azione nelle email **non** eseguono l'azione con un GET: aprono una pagina di conferma (gli scanner antivirus delle caselle aziendali "cliccano" i link in automatico). | Prassi tecnica |
| **R-SEO-01** | Dati strutturati **JobPosting** (Google for Jobs) validi; offerte scadute rimosse (410/`URL_DELETED` via Indexing API, che Google supporta ufficialmente per le pagine JobPosting). | Google Search Central |

---

## 9. Forma giuridica e fisco (sintesi — decide il commercialista)

| Opzione | Pro | Contro | Compatibile art. 6? |
|---------|-----|--------|---------------------|
| **A. Associazione ETS** (non riconosciuta, poi iscritta RUNTS) — **consigliata** | Coerente col "no lucro"; costi bassi (registrazione statuto ~€200 + bolli); dal 2026 regime fiscale del CTS operativo (D.Lgs. 186/2025, forfettario fino a €85.000); con iscrizione RUNTS: **donazioni detraibili/deducibili** per chi dona, **5×1000**, **Google for Nonprofits / Ad Grants** (fino a $10.000/mese di annunci Google gratuiti), bandi di fondazioni | Servono almeno 3 persone (7 per APS); RUNTS ~60 giorni; contabilità da tenere; PEC obbligatoria | **Sì** |
| B. Ditta individuale forfettaria | Semplice, controllo totale | Se inquadrata come commercio: contributi INPS minimi **~€4.600/anno** (2026) anche a ricavi zero (riducibili del 35%) → si mangiano il budget; **scopo di lucro** | **No** |
| C. Srl / startup innovativa / impresa sociale | Scalabile, investitori | Costi di costituzione e gestione alti; Srl ordinaria ha scopo di lucro | Solo impresa sociale, complessa |

**Nota tempi:** l'associazione si costituisce in 1-2 settimane (statuto, atto, registrazione all'Agenzia Entrate, codice fiscale e — se c'è attività commerciale come la pubblicità — partita IVA). La PEC si può attivare subito (Aruba la vende).

---

## 10. Checklist di conformità pre-lancio (gate G-LEGALE)

- [ ] Parere scritto del professionista su D1-D6 (§12)
- [ ] Associazione costituita, CF (e P.IVA se attività commerciale), PEC, conto corrente
- [ ] Pagina "Chi siamo" con legale rappresentante (R-LAV-04) e dati obbligatori (R-CONS-04)
- [ ] Informative privacy: lavoratori, aziende, visitatori; cookie policy; T&C lavoratori; T&C aziende; Regolamento annunci; Policy anti-truffa; "Come funziona il matching"
- [ ] Registro dei trattamenti (art. 30) + DPIA + procedura data breach
- [ ] DPA firmati con hosting ed email provider
- [ ] Modello di informativa per le aziende (titolari autonomi)
- [ ] CMP certificata configurata (solo se la pubblicità Google è attiva)
- [ ] Validatore annunci attivo con tutte le regole R-ANN
- [ ] Flag `INTERMEDIATION_ENABLED=false` verificato in produzione (finché non c'è l'iscrizione)
- [ ] Cancellazione account funzionante (in-app + web)
- [ ] Record DNS email (SPF/DKIM/DMARC) e disiscrizione 1-click

---

## 11. Cosa **non** facciamo (e perché)
- **Scraping di Indeed/altri portali** per riempire il sito: violazione dei termini d'uso e del diritto *sui generis* sulle banche dati (L. 633/1941 art. 102-bis). Si parte da offerte vere raccolte sul territorio.
- **Foto nel profilo**: invita alla discriminazione (art. 10). Il nostro CV generato non ha foto: lo presentiamo come "selezione alla cieca".
- **Annunci di famiglie** (colf, badanti) all'MVP: i privati non hanno P.IVA da verificare; si aggiungono nel 2027 con verifica SPID/CIE.
- **IA che valuta i candidati** (R-AI-01).
- **Recensioni delle aziende** all'MVP: rischio diffamazione e carico di moderazione DSA; si valuta nel 2027.

---

## 12. Domande per il professionista (consulente del lavoro / avvocato giuslavorista + privacy)

- **D1** — La "Fase A" (bacheca: il datore pubblica la propria offerta non anonima, il lavoratore si candida di sua iniziativa, i profili non sono consultabili dalle aziende) è intermediazione ai sensi dell'art. 2? Il salvataggio del profilo per ricandidarsi e ricevere avvisi è "costituzione di banca dati"?
- **D2** — Per il regime art. 6 (siti internet senza lucro): pubblicità, piani a pagamento per le aziende (ricerca fuori regione) e contributi dei sostenitori sono compatibili con il requisito "senza finalità di lucro" se l'ente è un'associazione ETS che reinveste tutto?
- **D3** — L'abbonamento "Sostenitore" (rimozione pubblicità, nessun vantaggio nella ricerca) pagato da un lavoratore viola l'art. 11?
- **D4** — Procedura attuale per l'iscrizione all'Albo informatico dei soggetti art. 6 e per l'interconnessione (ex ClicLavoro, oggi Ministero/SIISL): tempi e requisiti tecnici.
- **D5** — Ruoli privacy: l'azienda che riceve la candidatura è titolare autonomo? Quando offriremo strumenti di gestione candidature (inbox), serve un DPA con le aziende (responsabile del trattamento)?
- **D6** — Forma giuridica: associazione ETS "generica" o APS? Trattamento fiscale di pubblicità, piani aziende, ricompense del crowdfunding (sono corrispettivi o donazioni?).

---

## Fonti consultate (settembre 2026)
- D.Lgs. 276/2003 — testo: [lavoro.gov.it](https://www.lavoro.gov.it/archivio-doc-pregressi/Strumenti_normativa/2003/20030910_DLGS_276.pdf), [parlamento.it](https://www.parlamento.it/parlam/leggi/deleghe/03276dl.htm); art. 10: [notiziedellascuola.it](https://www.notiziedellascuola.it/legislazione-e-dottrina/indice-cronologico/2003/settembre/DLGS_20030910_276/tit2-cap2-art10)
- Regime art. 6 e piattaforme: [Bollettino ADAPT — caso JustKnock](http://www.bollettinoadapt.it/piattaforme-digitali-e-legittimita-nellattivita-di-intermediazione-tra-domanda-ed-offerta-di-lavoro-il-caso-justknock/)
- DM 20/09/2011 interconnessione e albo: [lavoro.gov.it (PDF)](https://www.lavoro.gov.it/documenti-e-norme/normative/Documents/2011/20110920_DM.pdf), [FLC CGIL](https://www.flcgil.it/leggi-normative/documenti/decreti-ministeriali/decreto-ministeriale-20-settembre-2011-modalita-di-interconnessione-a-cliclavoro.flc?__no_mobile=1)
- Albo Agenzie per il lavoro: [Ministero del Lavoro](https://www.lavoro.gov.it/strumenti-e-servizi/pagine/albo-nazionale-delle-agenzie-il-lavoro)
- Annunci anonimi (art. 9): [PMI.it](https://www.pmi.it/economia/lavoro/305333/annunci-di-lavoro-anonimi-quando-e-illegale.html), [La Legge per Tutti](https://www.laleggepertutti.it/286493_pubblicazione-annunci-di-lavoro-regole)
- Sanzioni art. 18 e DL 19/2024: [Giustizia Insieme](https://www.giustiziainsieme.it/it/diritto-penale/3123-idecreto-pnrr-n-19-2024-art-18-chiara-giuntelli), [LavoriPubblici — nota INL](https://www.lavoripubblici.it/news/somministrazione-appalto-distacco-illeciti-inl-nuove-sanzioni-penali-33644)
- D.Lgs. 96/2026 trasparenza retributiva: [Altalex](https://www.altalex.com/documents/2026/06/05/trasparenza-retributiva-d-lgs-96-2026-attua-direttiva-ue-2023-970), [Job4Good](https://www.job4good.it/retribuzione-annunci-lavoro-2026/), [PMI.it](https://www.pmi.it/impresa/normativa/487243/trasparenza-retributiva-regole-imprese.html), [Studio Bartali — annunci a norma](https://www.studiobartalicdl.it/annunci-di-lavoro-e-trasparenza-retributiva-come-pubblicare-unofferta-a-norma/)
- AI Act e Digital Omnibus: [Gibson Dunn](https://www.gibsondunn.com/eu-ai-act-omnibus-agreement-postponed-high-risk-deadlines-and-other-key-changes/), [Jones Walker](https://www.joneswalker.com/en/insights/blogs/ai-law-blog/yes-august-2-still-matters-the-eu-approved-a-high-risk-ai-delay-but-most-trans.html?id=102nbon)
- L. 132/2025 art. 11: [Rödl](https://www.roedl.it/it/temi/legal-newsletter/11-2025/nuovi-obblighi-carico-datore-lavoro-luce-legge-132-2025-materia-intelligenza-artificiale), [gdpr.it](https://www.gdpr.it/entrata-in-vigore-la-legge-132-2025-sullintelligenza-artificiale-nuovi-obblighi-per-i-datori-di-lavoro/)
- Codice di condotta APL: [Garante — newsletter 14/02/2024](https://www.garanteprivacy.it/home/docweb/-/docweb-display/docweb/9983384), [Cyber Security 360](https://www.cybersecurity360.it/news/agenzie-per-il-lavoro-il-garante-approva-il-codice-di-condotta-piu-tutele-a-favore-dei-candidati/), [Assolavoro](https://assolavoro.eu/garante-privacy-pubblicato-in-g-u-il-codice-di-condotta-delle-agenzie-per-il-lavoro/)
- "Pay or OK": [Garante — provv. 29/04/2025](https://www.garanteprivacy.it/web/guest/home/docweb/-/docweb-display/docweb/10126652)
- DSA art. 19: [CMS DigitalLaws](https://www.cms-digitallaws.com/en/dsa/article-19/)
- SIISL e DL 159/2025: [Consulenti del Lavoro](https://www.consulentidellavoro.it/home/storico-articoli/19435-siisl-avvio-graduale-per-l-obbligo-di-pubblicazione-offerte-di-lavoro), [IPSOA](https://www.ipsoa.it/documents/quotidiano/2025/11/07/assunzioni-agevolate-funziona-obbligo-pubblicazione-siisl-2026)
- Terzo settore fiscale 2026: [Altalex — D.Lgs. 186/2025](https://www.altalex.com/documents/2025/12/29/terzo-settore-novita-d-lgs-186-2025), [Quotidianopiù](https://www.quotidianopiu.it/dettaglio/13908748/enti-del-terzo-settore-regimi-forfetari-dal-1-gennaio-2026)
- INPS commercianti 2026: [burocalcolo.it](https://www.burocalcolo.it/guide/inps-commercianti-2026)
- Google Play: [test per account personali](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en), [target API](https://support.google.com/googleplay/android-developer/answer/11926878?hl=en), [cancellazione account](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en), [programma offerte esterne EEA](https://support.google.com/googleplay/android-developer/answer/14372887?hl=en-GB)
- AdSense e CMP: [requisiti consenso EEA](https://support.google.com/adsense/answer/13554116?hl=en), [policy app/frame web](https://support.google.com/adsense/answer/3394713)
- Email bulk sender: [Gmail FAQ](https://support.google.com/a/answer/14229414?hl=en)
- Google for Jobs e Indexing API: [JobPosting](https://developers.google.com/search/docs/appearance/structured-data/job-posting)
- Google Ad Grants: [Google per il non profit](https://www.google.com/intl/it/nonprofits/offerings/google-ad-grants/)
