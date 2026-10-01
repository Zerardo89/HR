# WP-024c — informativa privacy: bozza di Gemini (G-03) e validazione di Claude (01/10/2026)

> Gemini CLI in sola lettura, con un elenco di fatti verificati sul codice (scratch del compito, riassunto sotto).
> Il testo pubblicato è in `content/legal/privacy.ts` (versione `bozza-2026-10-01`); resta BOZZA fino al professionista.

## Correzioni dell'architetto al testo di Gemini

| # | Testo di Gemini | Problema | Correzione |
|---|-----------------|----------|------------|
| 1 | I dati di ricerca servono «per farti trovare dalle aziende» | **Falso**: le aziende non cercano tra i profili (Fase B spenta, ADR-0011) | Servono a mostrarti le offerte e gli avvisi; «le aziende non possono cercare tra i profili» |
| 2 | All'azienda arrivano «nome, telefono, messaggi» | **Incompleto**: vede anche l'email dell'account (`privacy/server/application-pii.ts`) | Profilo, email, telefono e messaggio |
| 3 | Se l'informativa cambia «te lo diremo al prossimo accesso» | **Promessa non mantenuta**: non c'è un avviso per l'informativa | «lo segnaliamo nel sito» (avviso da fare prima di cambiarla dopo il lancio) |
| 4 | 6 mesi di inattività: «ti invieremo prima un avviso» | **Inesatto**: l'avviso parte quando il profilo viene nascosto (docs/04 §8) | «ti avvisiamo via email» |
| 5 | Esempio «un utente ha cambiato la sua email»; fatturazione «nome, indirizzo, importo» | **Inventati** | Esempio reale (moderatore che toglie un'offerta); niente elenco |
| 6 | «sei disposto», «da solo», «sei stato tu», «ti sei rivolto» | Linguaggio non inclusivo (GEMINI.md) | Forme neutre |
| 7 | Elenchi numerati e annidati, corsivo, «Ultimo aggiornamento» | Non supportati dal Markdown ridotto | Elenchi semplici; la data la mostra la pagina |
| 8 | Ancore `quali-dati`, `protezione`, `decisioni` | Diverse dalla specifica | `dati`, `sicurezza`, `decisioni-automatizzate` |

Restano aperti per il professionista: DPO sì/no; accordi art. 28 con Cloudflare, Brevo, R2; art. 111-bis anche per i
testi liberi che potrebbero contenere dati particolari non richiesti (punti di Gemini, sotto).

---

## Testo originale di Gemini

Questa informativa ti spiega come raccogliamo, usiamo e proteggiamo i tuoi dati personali quando usi la nostra piattaforma. La trasparenza è fondamentale per noi: vogliamo che tu sappia esattamente cosa succede ai tuoi dati, chi può vederli e come puoi controllarli. Usiamo un linguaggio semplice perché crediamo che la privacy non debba essere un labirinto di termini legali, ma un diritto facile da capire per tutti.

## 1. Chi è il Titolare del trattamento {#titolare}

Il "Titolare" è chi decide come e perché vengono usati i tuoi dati. Per questo servizio, il Titolare è l'associazione senza scopo di lucro che gestisce la piattaforma. Al momento l'associazione è **IN COSTITUZIONE**: questo significa che stiamo completando le pratiche legali per la sua nascita ufficiale.

I dati completi (nome dell'associazione, sede, codice fiscale, PEC e nome del rappresentante legale) sono sempre disponibili nel piè di pagina di ogni pagina del sito e nella sezione [Chi siamo](/chi-siamo).

Se hai domande sulla tua privacy, vuoi esercitare un diritto o segnalare un problema, il tuo punto di riferimento è il nostro punto di contatto che trovi alla pagina [Contatti](/contatti). Al momento non è stato nominato un Responsabile della protezione dei dati (DPO) [DA VERIFICARE se serve].

## 2. Quali dati raccogliamo e come {#quali-dati}

Raccogliamo solo i dati strettamente necessari per farti trovare lavoro o per permettere alla tua azienda di trovare collaboratori. Ecco nel dettaglio cosa trattiamo:

**Se sei un semplice visitatore (senza account)**
Quando navighi sul sito senza registrarti, il server vede il tuo indirizzo IP (l'etichetta numerica del tuo dispositivo). Questo indirizzo viene usato solo "nella memoria del server" per pochi istanti, per assicurarci che non ci siano abusi o attacchi informatici (limiti di traffico). **L'indirizzo IP non viene salvato** in modo permanente nei nostri database. Per quanto riguarda i cookie, usiamo solo quelli tecnici necessari al funzionamento del sito; non usiamo strumenti di statistica o pubblicità che ti seguono mentre navighi. Maggiori dettagli sono nella pagina [Cookie](/cookie).

**Se ti iscrivi alla lista d'attesa**
Se decidi di lasciarci la tua email prima del lancio ufficiale, raccogliamo:
- la tua email (che viene salvata in modo cifrato);
- se sei un lavoratore o un'azienda;
- la tua provincia.
Chiediamo il tuo consenso per inviarti l'avviso di lancio del sito. Per sicurezza, usiamo la "doppia conferma": dopo aver inserito i dati riceverai una email con un link da cliccare per confermare che sei stato proprio tu a iscriverti.

**Se crei un account**
Per ogni account (lavoratore, azienda o amministratore) salviamo:
- l'indirizzo email (salvato in modo cifrato);
- il tuo ruolo (lavoratore o azienda);
- la tua dichiarazione di essere maggiorenne (non ti chiediamo la data di nascita, ma solo di confermare che hai più di 18 anni);
- la data di registrazione e quella dell'ultimo accesso;
- i consensi che hai dato e quale versione dei testi legali hai accettato.

**Se cerchi lavoro (Profilo lavoratore)**
Il tuo profilo è diviso in due parti per proteggerti meglio:
1. **Dati di ricerca (in chiaro ma anonimi):** sono i dati che servono al motore di ricerca per farti trovare dalle aziende, come le mansioni, il comune di domicilio (salvato come codice ISTAT), la distanza massima che sei disposto a percorrere, la tua esperienza, disponibilità, tipo di contratto che cerchi, patenti e lingue. Questi dati non dicono chi sei.
2. **Dati identificativi (CIFRATI):** il tuo nome, cognome, numero di telefono e i testi liberi dove racconti di te o delle tue esperienze passate sono salvati in modo cifrato. Solo l'azienda a cui decidi di candidarti potrà vederli.

**Cosa NON raccogliamo mai:** per scelta, non raccogliamo dati che potrebbero portare a discriminazioni o che non servono per il contatto iniziale. Non ti chiederemo mai: data di nascita, foto, sesso, nazionalità, codice fiscale (se cerchi lavoro) o quanto guadagnavi nei lavori precedenti. Oggi non raccogliamo nemmeno dati su categorie protette o sulla tua salute.

**Candidature e comunicazioni**
Quando ti candidi a un'offerta, salviamo a quale offerta ti sei rivolto, quando lo hai fatto e lo stato della candidatura. Se scrivi un messaggio facoltativo all'azienda, anche questo è cifrato. Salviamo anche i criteri delle tue ricerche salvate (per inviarti avvisi di nuove offerte) e la tua scelta sulla mail mensile che ti chiede: "stai ancora cercando?".

**Se rappresenti un'azienda**
Raccogliamo la ragione sociale, la partita IVA (che verifichiamo tramite il servizio VIES della Commissione europea) e i comuni dove avete le sedi. Se inviti dei colleghi a gestire l'account con te, la loro email viene salvata in modo cifrato. Per la tua sicurezza, la verifica in due passaggi usa un segreto tecnico, anch'esso cifrato.

**Segnalazioni e sicurezza**
Se segnali un'offerta o un'azienda (tramite la pagina [Segnalazioni](/segnalazioni)), raccogliamo il motivo e la tua descrizione. Non chiediamo email o telefoni nelle segnalazioni anonime. Se hai un account, l'esito ti verrà inviato via email.
Infine, teniamo un "registro di sicurezza" dove scriviamo chi ha fatto cosa e quando (ad esempio: "un utente ha cambiato la sua email"). Non scriviamo i contenuti personali in questo registro. Per gli accessi degli amministratori, l'indirizzo IP viene salvato in una forma che non permette di risalire direttamente alla persona (pseudonimizzazione).

## 3. Perché trattiamo i tuoi dati e su quale base {#finalita}

Il Regolamento Europeo (GDPR, art. 6) dice che per trattare i dati serve una "base giuridica". Ecco le nostre:

- **Per darti il servizio che hai chiesto (Esecuzione del contratto, art. 6.1.b):** usiamo i tuoi dati per creare l'account, permetterti di compilare il profilo, cercare offerte e inviare candidature. Per quanto riguarda l'invio del tuo curriculum o del tuo profilo per instaurare un rapporto di lavoro, la legge italiana (art. 111-bis del Codice privacy) chiarisce che il tuo consenso non è necessario perché il trattamento serve a gestire la tua richiesta di lavoro.
- **Per gli avvisi e la mail mensile (Servizio richiesto):** questi messaggi fanno parte del servizio che scegli esplicitamente durante la registrazione. Puoi disattivarli in ogni momento con un semplice clic dentro le impostazioni del tuo account o in fondo alle email. Non contengono pubblicità di altri prodotti.
- **Per la lista d'attesa (Consenso, art. 6.1.a):** usiamo la tua email solo se ci hai dato il permesso. Puoi cambiare idea e ritirare il consenso in qualsiasi momento.
- **Per la sicurezza e prevenzione abusi (Legittimo interesse, art. 6.1.f):** abbiamo interesse a evitare che il sito venga usato per truffe o attacchi informatici, a tutela di tutti gli utenti.
- **Per obblighi di legge (Art. 6.1.c):** dobbiamo gestire le segnalazioni e prendere decisioni motivate su eventuali contenuti vietati per rispettare il Regolamento UE 2022/2065 (Digital Services Act).

Non ti invieremo mai email promozionali senza un tuo consenso separato e facoltativo, e **non venderemo mai i tuoi dati a nessuno**.

## 4. Come proteggiamo i tuoi dati {#protezione}

La protezione dei tuoi dati è il cuore tecnico del nostro progetto. Applichiamo il principio della "Privacy by Design": abbiamo costruito il sito pensando prima di tutto a come NON vedere i tuoi dati se non è strettamente necessario.

**I tuoi dati personali sono cifrati nel database. Nemmeno chi gestisce la piattaforma li vede durante il lavoro quotidiano: l'app li decifra solo quando servono a te o all'azienda a cui hai scelto di candidarti, e ogni accesso viene registrato.**

Ecco altri dettagli tecnici sulla nostra sicurezza:
- I nostri server si trovano fisicamente in Italia.
- I dischi dei server sono cifrati: se qualcuno rubasse fisicamente il computer, i dati resterebbero illeggibili.
- I database non sono collegati direttamente a internet (nessuna porta aperta); solo l'applicazione può parlarci.
- I log di sistema (i diari tecnici del server) non contengono dati personali.

## 5. A chi comunichiamo i tuoi dati {#destinatari}

I tuoi dati non circolano liberamente, ma vengono comunicati solo a:

- **Le aziende a cui ti candidi:** quando clicchi su "Candidati", i tuoi dati identificativi (nome, telefono, messaggi) vengono mostrati a quell'azienda. Da quel momento, l'azienda diventa **Titolare autonomo** dei dati che riceve: le nostre [Condizioni d'uso](/condizioni) obbligano l'azienda a usare i tuoi dati solo per quella specifica selezione di personale.
- **Fornitori tecnici (Responsabili del trattamento, art. 28):** per far funzionare il sito usiamo alcuni servizi esterni selezionati:
  - **Cloudflare:** si occupa del collegamento sicuro (HTTPS) e protegge il sito dagli attacchi. Vede il traffico tecnico che passa verso il sito.
  - **Brevo:** è il servizio che invia materialmente le nostre email (conferme di registrazione, avvisi di offerte).
  - **Cloudflare R2:** lo usiamo per salvare le copie di sicurezza (backup). **Importante:** i dati vengono cifrati sul nostro server PRIMA di essere inviati per il backup, quindi il fornitore non può leggerli.
  - [DA VERIFICARE: accordi art. 28 firmati con ciascuno].
- **Verifica Aziende:** per le aziende, inviamo la partita IVA al servizio **VIES della Commissione europea** per assicurarci che sia reale e attiva.
- **Autorità:** comunicheremo i dati solo se un giudice o una legge ce lo impone chiaramente.

## 6. Trasferimenti di dati fuori dall'Unione Europea {#trasferimenti}

Il nostro database principale e i server che elaborano i dati si trovano in Italia. L'unico fornitore che ha sede fuori dall'UE è **Cloudflare, Inc. (Stati Uniti)**, che però aderisce all'accordo "EU-US Data Privacy Framework", garantendo uno standard di protezione approvato dall'Unione Europea. Non trasferiamo i tuoi dati a nessun altro fornitore fuori dall'UE.

## 7. Per quanto tempo conserviamo i tuoi dati {#conservazione}

Non conserviamo i dati per sempre, ma solo finché servono o finché la legge lo richiede:

- **Inattività di 6 mesi:** se non entri nel sito e non interagisci con il tuo profilo per 6 mesi, il tuo profilo verrà "nascosto" dalle ricerche e la mail mensile verrà sospesa. Ti invieremo prima un avviso.
- **Inattività di 24 mesi:** se non accedi per due anni consecutivi, il tuo account verrà cancellato. Ti invieremo un preavviso 30 giorni prima della scadenza: ti basterà entrare una volta nel sito per fermare la cancellazione.
- **Candidature:** le aziende possono vedere la tua candidatura fino a 6 mesi dopo la chiusura dell'offerta di lavoro. Dopo questo tempo, la candidatura sparisce dalla loro vista e il tuo messaggio personale viene cancellato definitivamente.
- **Registro di sicurezza:** le informazioni tecniche su "chi ha fatto cosa" restano per 12 mesi per permetterci di analizzare eventuali problemi passati.
- **Lista d'attesa:** chi si registra ufficialmente sul sito esce subito dalla lista d'attesa. In ogni caso, il 1° maggio 2027 (sei mesi dopo il lancio) cancelleremo l'intera lista d'attesa. Se ti iscrivi ma non confermi l'email, i tuoi dati spariscono dopo 7 giorni.
- **Dati di fatturazione:** se in futuro farai dei pagamenti, quei dati (nome, indirizzo, importo) devono essere conservati per 10 anni per obbligo di legge fiscale.

**Cosa succede quando cancelli l'account:** puoi farlo in ogni momento dalla pagina [Privacy e dati](/account/privacy). Quando lo fai, **distruggiamo la chiave con cui erano cifrati i tuoi dati: diventano subito illeggibili**. Nelle copie di sicurezza cifrate spariscono con la loro rotazione, al più entro 6 mesi.

## 8. Decisioni automatizzate e profilazione {#decisioni}

Molti siti usano algoritmi per dare un "voto" ai candidati o decidere chi scartare. **Noi non lo facciamo.**
Non prendiamo decisioni basate solo su trattamenti automatizzati (art. 22 GDPR). Non c'è nessun programma che valuta le persone o le classifica. Le offerte di lavoro che vedi sono ordinate secondo criteri trasparenti (come la data di pubblicazione o la distanza) che puoi consultare alla pagina [Come funziona](/come-funziona). La scelta di chi chiamare per un colloquio resta sempre una decisione umana dell'azienda.

## 9. I tuoi diritti (come riprendere il controllo) {#diritti}

Il GDPR ti dà poteri precisi sui tuoi dati (artt. 15-22). Puoi chiederci:
- **Accesso:** sapere quali dati abbiamo su di te;
- **Rettifica:** correggere dati sbagliati o incompleti;
- **Cancellazione:** chiedere di eliminare i tuoi dati;
- **Limitazione:** chiederci di "congelare" i dati senza cancellarli;
- **Portabilità:** ricevere i tuoi dati in un formato leggibile dal computer per portarli altrove;
- **Opposizione:** opporti al trattamento per motivi tuoi particolari;
- **Revoca:** se hai dato un consenso (come per la lista d'attesa), puoi toglierlo quando vuoi (questo non rende illegale quello che abbiamo fatto prima della revoca).

Puoi fare quasi tutto da solo, in autonomia, dalla tua area riservata nella sezione [Privacy e dati](/account/privacy). Da lì puoi scaricare tutti i tuoi dati in un file, modificarli, nascondere il profilo o cancellare l'account.

Per tutto il resto, o se incontri difficoltà, scrivi al nostro punto di contatto. Ti risponderemo entro un mese (art. 12.3 GDPR). Se ritieni che non stiamo rispettando i tuoi diritti, puoi fare un reclamo ufficiale al **Garante per la protezione dei dati personali** (trovi le istruzioni su www.garanteprivacy.it).

## 10. Cookie e tecnologie simili {#cookie}

Il nostro sito non usa cookie di profilazione (quelli che servono a farti vedere pubblicità mirata) né strumenti di tracciamento di terze parti. Usiamo solo cookie tecnici che servono, ad esempio, a ricordarci che hai fatto il login mentre passi da una pagina all'altra. Puoi leggere la lista completa nella pagina dedicata ai [Cookie](/cookie).

## 11. Minori {#minori}

Il nostro servizio è rivolto esclusivamente a persone maggiorenni (18 anni o più). Se dovessimo accorgerci di aver raccolto dati di un minorenne, provvederemo alla cancellazione immediata.

## 12. Versione in anteprima (fino al 27 ottobre 2026) {#anteprima}

Fino al 27 ottobre 2026 il sito è in una fase di "anteprima" tecnica. Durante questo periodo usiamo dati di prova e solo i tester autorizzati (con un codice invito) possono registrarsi. **Tutti gli account e i dati creati durante l'anteprima verranno cancellati il 27 ottobre 2026.** L'unica eccezione è la lista d'attesa, che rimarrà attiva per il lancio ufficiale.

## 13. Modifiche a questa informativa {#modifiche}

Il mondo cambia e anche le leggi o il nostro sito potrebbero cambiare. Ogni volta che aggiorneremo questa informativa, cambieremo la data della "versione" che vedi qui sotto. Tutte le versioni precedenti resteranno consultabili. Se le modifiche saranno molto importanti (ad esempio se cambierà il Titolare o il modo in cui usiamo i tuoi dati identificativi), te lo diremo chiaramente nel sito al tuo prossimo accesso.

*Ultimo aggiornamento: 1 ottobre 2026*

---

**Punti da verificare per Claude:**
- Verificare se la nomina del DPO è obbligatoria per un'associazione che tratta dati di lavoratori su larga scala (anche se cifrati).
- Confermare che gli accordi ex art. 28 GDPR con Cloudflare, Brevo e altri siano stati effettivamente formalizzati prima del lancio.
- Verificare se la base giuridica dell'art. 111-bis del Codice Privacy sia sufficiente per coprire anche i testi liberi (C2) che potrebbero contenere dati particolari non richiesti.
- Controllare la coerenza della data di cancellazione della lista d'attesa (1° maggio 2027) con il piano di lancio.
- Assicurarsi che la procedura di "crypto-shredding" sia stata testata con successo nelle procedure di backup/ripristino.
