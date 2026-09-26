# 08 — Registro dei rischi

Scala: Probabilità (P) e Impatto (I) da 1 a 5. **Punteggio = P × I**. Rivedere ogni domenica (Gemini prepara, Claude valuta).

| ID | Rischio | P | I | Punt. | Mitigazione | Piano B / Segnale d'allarme | Responsabile |
|----|---------|---|---|-------|-------------|-----------------------------|--------------|
| R1 | **Google Play non concede la produzione in tempo** (test 12×14, revisione) | 4 | 3 | 12 | Account il 28/09, TWA in test chiuso entro 02/10, 20 tester (non 12), registro dei feedback per il questionario | Lancio web il 01/11 + "installa dal browser"; Play appena approvato | Tu |
| R2 | **Il parere legale considera intermediazione anche la Fase A** | 3 | 5 | 15 | Chiamate legali in settimana 1; architettura a fasi con flag (ADR-0011) | Lancio con profilo minimo (solo avvisi email) finché l'iscrizione art. 6 non è attiva; accelerare associazione e Albo | Tu + Claude |
| R3 | **Ritardi nella costituzione dell'associazione** (co-fondatori, statuto, Agenzia Entrate) | 3 | 4 | 12 | Statuto bozza il 29/09, co-fondatori individuati il 28/09 | Senza ente: niente incassi (periodo fondatori gratuito già previsto); valutare con il legale chi è titolare dei dati al lancio | Tu |
| R4 | **Tempo e stanchezza del fondatore** (un solo umano) | 4 | 4 | 16 | Perimetro tagliabile (roadmap §6), buffer nei fine settimana, un WP alla volta | Se a G3 (18/10) mancano >2 WP essenziali: tagli nell'ordine previsto | Tu + Claude |
| R5 | **Qualità del codice dei modelli locali** (bug, pacchetti inventati, codice insicuro) | 4 | 3 | 12 | WP piccoli, test scritti prima, revisione ChatGPT, validazione Claude, moduli critici scritti da Claude, verifica di ogni dipendenza | Spostare WP difficili su ChatGPT/Claude | Claude |
| R6 | **Piattaforma vuota** (poche offerte → pochi lavoratori → poche offerte) | 4 | 5 | 20 | Area pilota ristretta; 100 aziende target contattate di persona; 30-50 offerte reali prima del lancio; focus sulle assunzioni stagionali di novembre-dicembre | Se < 20 offerte al 28/10: restringere la comunicazione alla sola provincia pilota | Tu |
| R7 | **Offerte truffa o illegali** | 3 | 5 | 15 | Verifica P.IVA, moderazione prime 3 offerte, validatore, pulsante Segnala, niente contatti esterni come unico canale | Sospensione immediata azienda; comunicazione ai candidati coinvolti | Tu (moderatore) |
| R8 | **Violazione di dati (data breach)** | 2 | 5 | 10 | Cifratura applicativa, niente porte DB esposte, patch automatiche, backup cifrati, audit | Procedura 72 h, crypto-shredding, rotazione chiavi | Claude + Tu |
| R9 | **Email in spam** (OTP non arrivano = nessuno entra) | 3 | 4 | 12 | Dominio autenticato (SPF/DKIM/DMARC), Brevo, niente pixel, invii distribuiti, contenuti sobri | Seconda via di accesso: passkey; fornitore email di riserva configurato | Tu |
| R10 | **AdSense rifiutato o ricavi minimi** | 4 | 2 | 8 | Non è il pilastro; sponsor diretti senza tracciamento | Solo sponsor + In evidenza | Tu |
| R11 | **Crowdfunding sotto obiettivo** | 3 | 3 | 9 | 40 impegni prima del via, pre-vendite alle aziende, GivingTuesday | Campagna "tutto o niente" vs "prendi tutto": scegliere "prendi tutto" per non perdere quanto raccolto; bandi | Tu |
| R12 | **Perdita della KEK** (dati illeggibili per sempre) | 1 | 5 | 5 | Copia cifrata della KEK in busta sigillata dal custode; test di ripristino | — | Custode |
| R13 | **Servizio VIES non disponibile** durante la registrazione aziende | 3 | 2 | 6 | Coda di verifica asincrona, stato "in verifica" | Verifica manuale | Claude |
| R14 | **Vulnerabilità nelle librerie** (Next.js/React hanno avuto CVE critiche) | 3 | 4 | 12 | Renovate, avvisi GitHub, aggiornamento patch settimanale | Hotfix entro 24 h | Claude |
| R15 | **Nome del progetto già registrato** come marchio | 2 | 4 | 8 | Ricerca su UIBM, EUIPO (TMview) e domini **prima** della scheda Play | Cambiare nome prima del lancio (il pacchetto Android no!) | Tu |
| R16 | **Tester che abbandonano** il test chiuso prima dei 14 giorni | 3 | 3 | 9 | 20 tester invece di 12; promemoria ogni 4 giorni con novità da provare | Reclutare nuovi tester subito (ma il contatore potrebbe ripartire) | Tu |
| R17 | **Lavoratore "occupato" riconosciuto dal datore attuale** | 2 | 4 | 8 | Profili anonimi, blocco per P.IVA, provincia invece del comune per comuni piccoli | — | Claude |
| R18 | **Carico di moderazione** eccessivo per una persona | 3 | 3 | 9 | Validatore automatico, fiducia crescente (dopo 3 offerte ok, pubblicazione immediata), coda con priorità | Volontari dell'associazione come moderatori (senza accesso a dati personali) | Tu |
| R19 | **Cron e cambio dell'ora** (25/10) o fusi orari errati | 2 | 2 | 4 | Tutto in UTC nel DB, cron con fuso `Europe/Rome` esplicito, test | — | Claude |
| R20 | **Claim di marketing sulla privacy non veritieri** | 2 | 4 | 8 | Formula approvata in [04 §1](04-PRIVACY-SICUREZZA.md) | — | Claude |
| R21 | **Uso dei dati per "altri progetti"** in violazione della finalità | 2 | 4 | 8 | R-PRIV-10: consenso separato | — | Tu |
| R22 | **Costi fuori controllo** (email, VPS) al crescere | 2 | 2 | 4 | Allarmi di spesa, limiti di invio | Piano email superiore solo con ricavi | Tu |

## Top 5 da guardare ogni giorno fino al lancio
1. **R6** Piattaforma vuota → contatore offerte reali promesse/pubblicate
2. **R4** Tempo del fondatore → WP chiusi vs pianificati
3. **R2** Legale → data del parere
4. **R7** Truffe → coda di moderazione
5. **R1** Play → numero di tester iscritti e giorni trascorsi
