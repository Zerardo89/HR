# 05 — Monetizzazione e sostenibilità

> Obiettivo dichiarato: **non fare profitto, ma coprire i costi** (6-7 mila € per partire) e, col tempo, finanziare
> i prossimi progetti. Il "no lucro" è anche un **requisito di legge** per il regime art. 6
> ([02-REGOLE-DEL-GIOCO.md §2.2](02-REGOLE-DEL-GIOCO.md)): tutte le entrate vanno all'associazione e restano nel progetto.

## 1. Verità scomode (per non illudersi)
1. **La pubblicità programmatica (AdSense) renderà poco nei primi mesi.** Con pochi utenti e con una parte
   importante degli italiani che rifiuta i cookie (a quel punto Google serve solo annunci "limitati"),
   si parla di decine di euro al mese, non di centinaia. Va attivata, ma **non** è il pilastro.
2. **Le entrate vere di un portale di lavoro arrivano dalle aziende** (Indeed vive di offerte sponsorizzate).
   Per noi: *In evidenza*, *Piano Nazionale*, *sponsor locali*.
3. **Il primo anno lo paga il crowdfunding** (e le pre-vendite alle aziende fondatrici). Le entrate ricorrenti
   coprono i costi nello scenario base intorno al **mese 6-9**.
4. **Senza associazione con P.IVA non si incassa nulla di commerciale** (niente fatture, niente Stripe, niente AdSense intestato correttamente). Per questo il lancio è "periodo fondatori" gratuito e i pagamenti si accendono dopo (ADR-0010).

## 1-bis. Piano "costi quasi zero" (in vigore dal 27/09/2026)
Il fondatore non può anticipare spese: si parte spendendo **il minimo indispensabile** e ogni costo ricorrente
si attiva solo quando c'è un'entrata che lo copre.

| Voce | Prima (piano originale) | Ora | Come |
|------|------------------------|-----|------|
| Server | VPS 15-25 €/mese | **0-3 €/mese** | Cloudflare Tunnel + PC di casa / Oracle Always Free (ADR-0012) |
| Dominio | — | **0 €** | `inspectio.cloud` già pagato, sottodominio per l'app |
| Email | 0-25 €/mese | **0 €** | Brevo gratuito (300 email/giorno) |
| Backup | 3-6 €/mese | **0 €** | Cloudflare R2 gratuito (10 GB), backup cifrati |
| Banner cookie certificato (CMP) | 100-250 €/anno | **0 €** | Niente pubblicità Google finché non c'è l'associazione; solo sponsor senza tracciamento (niente consenso cookie) |
| Commercialista (associazione) | 600-1.200 €/anno | **0 €** all'inizio | **CSV — Centri di Servizio per il Volontariato**: consulenza gratuita per costituire un ente del Terzo settore (statuto, fisco, RUNTS) |
| Parere legale | 500-1.500 € | **0 €** all'inizio | CSV + richiesta scritta (PEC) al Ministero del Lavoro sulla procedura art. 6 + Fase A "bacheca" prudente; professionista a pagamento solo dopo il crowdfunding |
| Google Play | 25 $ | **25 $** | Unico costo inevitabile se si vuole l'app sullo Store il 01/11 (in alternativa: solo web installabile, Play dopo il crowdfunding) |
| Associazione | 250-350 € | **0-250 €** | Il CSV indica la forma che costa meno (alcuni atti degli ETS hanno imposte ridotte o esenzioni) |
| Marketing | 500-1.500 € | **0 €** | Passaparola, gruppi Facebook locali, volantini stampati in proprio, associazioni del territorio |

**Spesa per arrivare al lancio: circa 25-50 €** (+ l'eventuale registrazione dell'associazione, che può aspettare il crowdfunding).
Le cifre delle sezioni 6-7 restano come obiettivo **dopo** il crowdfunding.

## 2. Le fonti di entrata

| # | Fonte | Chi paga | Impatto sui lavoratori | Redditività | Quando |
|---|-------|----------|------------------------|-------------|--------|
| 1 | **Offerte "In evidenza"** (max 2 in cima ai risultati, etichettate) | Aziende | Nullo: sono offerte di lavoro pertinenti | ★★★★ | v1.1 (a pagamento da febbraio 2027) |
| 2 | **Piano Nazionale** (offerte fuori zona, avvisi nazionali, in Fase B ricerca nazionale) | Aziende medio-grandi, APL | Nullo | ★★★★ | costruito all'MVP, a pagamento da 01/02/2027 |
| 3 | **Sponsor del territorio** (vendita diretta: "Lavoro in provincia di X, con il sostegno di…") | Banche locali, associazioni di categoria, enti di formazione | Minimo: un riquadro statico, **senza tracciamento** → niente consenso cookie, funziona su tutti gli utenti | ★★★ | appena c'è P.IVA |
| 4 | **Partner formazione** ("Per questo lavoro serve l'attestato HACCP / il patentino del muletto / la CQC: corsi vicino a te") | Enti di formazione accreditati | Positivo: informazione utile e contestuale | ★★★ | v1.2 |
| 5 | **Pubblicità programmatica** (AdSense) in pochi punti a basso impatto | Inserzionisti Google | Basso se ben posizionata (§3) | ★ (inizialmente) | quando AdSense approva (fine nov.) |
| 6 | **Sostenitori** (contributo volontario, come ringraziamento niente pubblicità) | Chiunque | Nessuno | ★★ | con P.IVA/conto |
| 7 | **Crowdfunding** | Comunità, aziende fondatrici | — | ★★★★ (una tantum) | dal 01/11 |
| 8 | **Donazioni, 5×1000, bandi** | Cittadini, fondazioni | — | ★★ → ★★★★ nel tempo | dopo iscrizione RUNTS (2027) |

**Non-entrata ma enorme valore:** **Google Ad Grants** — fino a **$10.000/mese** di annunci gratuiti sulla ricerca
Google per le organizzazioni non profit (in Italia: enti iscritti al RUNTS/ONLUS/APS; verifica tramite Goodstack).
È il miglior canale per farsi conoscere dai lavoratori a costo zero.

## 3. Pubblicità: dove sì, dove no (mappa dello schermo)

| Pagina | Cosa si mostra | Cosa **non** si mostra mai |
|--------|----------------|----------------------------|
| **Home** | 1 riquadro "Sponsor del territorio" sotto la ricerca | Banner sopra la barra di ricerca |
| **Risultati di ricerca** | Max **2 offerte In evidenza** in cima (etichetta "Sponsorizzata"); **1** annuncio nativo dopo il 6° risultato, poi al massimo 1 ogni 10 | Annunci tra la ricerca e i primi risultati organici |
| **Pagina offerta** | Sotto la descrizione e il pulsante "Candidati": modulo "Corsi utili per questo lavoro" (partner) + 1 banner a fine pagina | Qualsiasi cosa tra titolo e pulsante "Candidati" |
| **Flusso di candidatura** | — | **Nulla** (R-ADS-02) |
| **Area personale** (profilo, candidature, privacy) | — | **Nulla** |
| **Area azienda** | Solo promozioni interne (In evidenza, Nazionale) | Pubblicità di terzi |
| **Email** | — | **Nulla** (restano comunicazioni di servizio) |
| **App Android (TWA)** | Come il web; AdSense solo se la policy sui frame lo consente, altrimenti solo sponsor/partner interni | — |
| **Sostenitori** | Nessun banner, sponsor o partner; restano le offerte In evidenza (sono offerte di lavoro, etichettate) | — |

Regole tecniche: spazi riservati (niente "salti" della pagina → buon punteggio CLS), caricamento pigro,
niente interstitial, niente video con audio, niente pop-up; categorie vietate bloccate (R-ADS-03: **gioco d'azzardo vietato per legge**, trading, prestiti opachi, MLM, incontri).

**Perché questo schema rende di più:** gli spazi venduti direttamente (sponsor, formazione, In evidenza) non
dipendono dal consenso ai cookie e sono **pertinenti** → valgono molte volte un banner generico. AdSense
riempie solo gli spazi rimasti.

## 4. Listino proposto (IVA da definire col commercialista)

| Prodotto | Prezzo | Contenuto |
|----------|--------|-----------|
| **Sostenitore** | **€9,99/anno** (o €1,99/mese) | Niente pubblicità, badge "Sostenitore", nome nel muro dei sostenitori (facoltativo). **Nessun vantaggio nella ricerca** (R-LAV-01) |
| **In evidenza — 7 giorni** | €9 | Offerta in cima ai risultati pertinenti nella zona, etichettata |
| **In evidenza — 30 giorni** | €29 | Come sopra |
| **Offerta Nazionale singola** | €19 / 30 giorni | Un'offerta fuori zona + avvisi ai lavoratori disposti a trasferirsi |
| **Piano Nazionale** | **€39/mese** o **€349/anno** | Offerte fuori zona illimitate, avvisi nazionali; in Fase B: liste per mansione in tutta Italia + 100 richieste di contatto/mese |
| **Sponsor del territorio** | €50-150/mese per provincia | Riquadro statico in home e risultati della provincia |
| **Partner formazione** | €30-80/mese per mansione e provincia | Modulo "Corsi utili" |

Confronto: su Indeed le offerte sponsorizzate costano da ~$0,10 a oltre $5 **a clic** con minimi giornalieri;
i nostri prezzi fissi sono **prevedibili** e pensati per le PMI locali.

**Periodo fondatori:** tutte le aziende registrate entro il **31/12/2026** hanno il Piano Nazionale gratis fino
al **31/01/2027**. Poi il gratuito in zona resta per sempre (è la promessa del progetto).

## 5. Crowdfunding (obiettivo €7.000)

### 5.1 Piattaforma
| Piattaforma | Modello | Note |
|-------------|---------|------|
| **Produzioni dal Basso** | Donazione e ricompensa | La più nota in Italia per progetti sociali/civici; adatta anche prima dell'iscrizione RUNTS |
| **For Funding (Intesa Sanpaolo)** | Donazione, solo non profit | Nessun costo aggiuntivo per i donatori; richiede di essere un ente non profit e l'approvazione del progetto |
| Kickstarter / Ulule | Ricompensa | Meno adatte a un progetto sociale italiano |

**Consiglio:** Produzioni dal Basso per la campagna di lancio (novembre-dicembre); For Funding in un secondo
momento, a ente consolidato. Commissioni e condizioni **da verificare** al momento dell'apertura.

### 5.2 Ricompense (solo digitali: niente magliette da spedire)
| Livello | Contributo | Ricompensa |
|---------|-----------|------------|
| Grazie | €5 | Nome nel muro dei fondatori |
| Sostenitore fondatore | €15 | 2 anni senza pubblicità + badge |
| Amico del progetto | €35 | Senza pubblicità **per sempre** + badge + voto sulle prossime funzioni |
| **Azienda fondatrice** | **€99** | 6 mesi di Piano Nazionale (dopo il periodo fondatori) + logo nella pagina fondatori |
| **Partner locale** | **€249** | 12 mesi di Piano Nazionale + 3 offerte In evidenza al mese + logo |
| Mecenate del territorio | €500+ | Sponsor della propria provincia per 12 mesi |

> **Attenzione fiscale:** le ricompense con valore economico (piani, sponsorizzazioni) sono probabilmente
> **corrispettivi**, non donazioni (domanda D6). Le donazioni pure a un ETS iscritto al RUNTS danno invece
> benefici fiscali ai donatori.

### 5.3 Come si arriva a €7.000 (matematica realistica)
- 20 **aziende fondatrici** × ~€150 di media = **€3.000** ← il pezzo più importante: si vendono **di persona** durante l'onboarding delle aziende (settimane 2-5).
- 150 persone × ~€20 = **€3.000**
- 2-3 mecenati/sponsor locali = **€1.000+**
- Regola d'oro: il **30 % dell'obiettivo nelle prime 48 ore** (le campagne che partono bene vengono spinte dalle piattaforme). Quindi, prima del via, **40 impegni** raccolti da amici, familiari, colleghi e aziende contattate.

### 5.4 Calendario
| Quando | Cosa |
|--------|------|
| Dal 02/10 | Lista d'attesa sul sito (double opt-in, consenso a ricevere l'avviso di lancio e della campagna) |
| Settimana 3 | Gemini scrive pagina campagna, FAQ, aggiornamenti, post; ComfyUI prepara le immagini |
| Settimana 4 | Raccolta dei 40 impegni pre-lancio |
| **01/11** | Campagna online insieme al lancio (il prodotto funzionante è la prova migliore) |
| **01/12** | **GivingTuesday** (giornata mondiale del dono, celebrata anche in Italia): spinta a metà campagna |
| ~10/12 | Chiusura (40 giorni), ringraziamenti, rendiconto pubblico delle spese |

## 6. Budget del primo anno (stime da verificare con preventivi)

### 6.1 Costi una tantum
| Voce | Stima |
|------|-------|
| Costituzione associazione (registrazione atto e statuto, bolli) | €250-350 |
| Parere legale lavoro + privacy (D1-D6) | €500-1.500 |
| Revisione documenti privacy/T&C da professionista | €300-800 |
| Google Play (account sviluppatore) | ~€23 ($25) |
| Deposito marchio UIBM (1-3 classi: 35, 42, 9) | €150-250 |
| PEC dell'associazione | ~€10 |
| Marketing di lancio (volantini, piccoli eventi, sponsorizzate social) | €500-1.500 |
| **Totale una tantum** | **≈ €1.750-4.450** |

### 6.2 Costi ricorrenti (12 mesi)
| Voce | Mese | Anno |
|------|------|------|
| VPS Aruba Cloud (4 GB) | €15-25 | €180-300 |
| Backup offsite (object storage UE) | €3-6 | €40-70 |
| Email Brevo | €0-25 | €0-300 |
| Dominio | — | €15-30 |
| CMP certificata Google (es. iubenda o equivalente) | — | €100-250 |
| Commercialista associazione | — | €600-1.200 |
| Assicurazione RC/cyber (facoltativa) | — | €0-500 |
| Abbonamenti IA (se non già attivi) | €0-45 | €0-540 |
| Commissioni Stripe | ~2-3 % dei ricavi | variabile |
| **Totale ricorrente** | | **≈ €935-3.190** |

### 6.3 Totale anno 1
**≈ €2.700-7.650 + 15 % di riserva → €3.100-8.800.** L'obiettivo di €7.000 è **coerente**: copre lo scenario
medio con margine e il marketing.

## 7. Scenari di entrata al mese 12 (ipotesi, da validare)

| Voce | Prudente | Base | Ottimista |
|------|----------|------|-----------|
| Utenti attivi al mese | 3.000 | 15.000 | 50.000 |
| Pagine viste/mese | 45.000 | 225.000 | 750.000 |
| AdSense (RPM effettivo €1-2 dopo i rifiuti cookie) | €45 | €340 | €1.500 |
| Sponsor del territorio | €40 | €200 | €600 |
| In evidenza | €45 | €360 | €1.200 |
| Piano Nazionale / offerte nazionali | €58 | €390 | €1.170 |
| Sostenitori (€9,99/anno) | €25 | €167 | €666 |
| **Totale mensile** | **≈ €210** | **≈ €1.460** | **≈ €5.100** |

Costi ricorrenti a regime: ~€150-250/mese (esclusi commercialista e marketing). **Scenario base: pareggio
tra il mese 6 e il 9**; scenario prudente: servono donazioni/bandi anche nel 2027.

## 8. Oltre il primo anno
- **5×1000** (dopo l'iscrizione RUNTS; le somme arrivano con 1-2 anni di ritardo).
- **Bandi**: fondazioni di origine bancaria del territorio, Fondo per la Repubblica Digitale (competenze digitali), bandi regionali per l'inclusione lavorativa (FSE+). La metrica "km 0" (lavoro vicino a casa = meno pendolarismo) è un argomento forte.
- **Servizi per enti pubblici e associazioni** (bacheche locali "white label" per Comuni/Informagiovani) — da valutare con cautela per non snaturare il progetto.
- **Visibilità per i progetti futuri**: banner "della casa" e pagina "Altri progetti" **sì**; usare le email degli utenti per promuoverli **solo con consenso marketing separato** (R-PRIV-10).
