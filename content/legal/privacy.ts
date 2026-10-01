/**
 * Informativa sulla privacy (art. 13 GDPR), con TUTTE le versioni pubblicate (WP-024c), come le condizioni d'uso:
 * - Una versione pubblicata non si modifica mai: chi l'ha letta deve poterla rileggere uguale. Per cambiare il testo
 *   si aggiunge una versione nuova e si aggiorna `LEGAL_VERSIONS.privacyNotice` (identity/domain/policy.ts): alla
 *   registrazione si salva la presa visione di quella versione (tabella `consents`).
 * - Formato: Markdown ridotto (`src/lib/markdown-lite.ts`), come `condizioni.ts`.
 * - Testi scritti da Gemini e validati da Claude (fatti verificati sul codice); restano "BOZZA" finché un
 *   professionista non li ha revisionati (CLAUDE.md).
 */
import type { LegalVersion } from "./condizioni";

export const PRIVACY_VERSIONS: Record<string, LegalVersion> = {
  // Il testo provvisorio mostrato dal 27/09/2026 (prima in messages/it.json), identico.
  "bozza-2026-09-27": {
    publishedOn: "2026-09-27",
    text: `I tuoi dati personali sono cifrati nel database. Nemmeno chi gestisce la piattaforma li vede durante il lavoro quotidiano: l'app li decifra solo quando servono a te o all'azienda a cui hai scelto di candidarti, e ogni accesso viene registrato.

L'informativa completa (chi tratta i dati, per quali scopi, per quanto tempo e quali sono i tuoi diritti) sarà pubblicata qui prima del lancio del 1° novembre 2026.`,
  },

  // Informativa completa: bozza di Gemini (G-03) validata da Claude sui fatti del codice.
  "bozza-2026-10-01": {
    publishedOn: "2026-10-01",
    text: `Questa informativa spiega quali dati personali raccogliamo, perché, per quanto tempo, a chi li comunichiamo e come puoi controllarli (art. 13 del Regolamento UE 2016/679, «GDPR»). Usiamo parole semplici: la privacy è un tuo diritto e deve essere facile da capire.

## 1. Chi è il titolare del trattamento {#titolare}

Il titolare è chi decide come e perché si usano i dati. Per questo servizio è l'associazione senza scopo di lucro che lo gestisce, oggi **in costituzione**. I suoi dati (nome, sede, codice fiscale, PEC, legale rappresentante, email) sono nel piè di pagina di ogni pagina e in [Chi siamo](/chi-siamo).

Per domande sulla privacy, per esercitare un diritto o per segnalare un problema scrivi al [punto di contatto](/contatti). Non abbiamo nominato un responsabile della protezione dei dati (DPO) [DA VERIFICARE se serve].

## 2. Quali dati raccogliamo {#dati}

Raccogliamo solo i dati che servono a trovare lavoro vicino a casa o a trovare personale.

**Se visiti il sito senza account.** Il server vede l'indirizzo IP del tuo dispositivo e lo usa solo nella sua memoria, per i limiti contro abusi e attacchi: **non lo salviamo**. Usiamo solo cookie tecnici e nessuno strumento di statistica o di pubblicità (vedi [Cookie](/cookie)).

**Se ti iscrivi alla lista d'attesa.** La tua email (salvata cifrata), se sei una persona che cerca lavoro o un'azienda, la tua provincia e il consenso a ricevere l'avviso del lancio. L'iscrizione vale solo dopo che confermi con il link che ti mandiamo via email (doppia conferma).

**Se crei un account.** Per ogni account salviamo:

- l'email, cifrata;
- il ruolo (persona che cerca lavoro o azienda);
- la sola dichiarazione di essere maggiorenne: non ti chiediamo la data di nascita;
- la data di registrazione e dell'ultimo accesso;
- i consensi che hai dato, con la versione dei testi che hai letto o accettato.

**Se cerchi lavoro.** Il profilo ha due parti:

- **dati per la ricerca**, senza nome: mansioni, comune di domicilio (come codice ISTAT), distanza massima, esperienza, disponibilità, tipo di contratto, patenti, lingue e stato del profilo («cerco», «aperto», «nascosto»). Servono a mostrarti le offerte adatte e a mandarti gli avvisi. Da soli non dicono chi sei, e le aziende non possono cercare tra i profili;
- **dati che dicono chi sei, cifrati**: nome, cognome, telefono e i testi liberi in cui racconti di te e delle tue esperienze.

**Cosa non raccogliamo mai.** Data di nascita, foto, sesso, nazionalità, codice fiscale di chi cerca lavoro, stipendio dei lavori precedenti: non te li chiediamo, perché non servono e potrebbero portare a discriminazioni. Oggi non raccogliamo neanche dati su categorie protette o sulla salute.

**Candidature, avvisi e mail mensile.** Quando ti candidi salviamo a quale offerta, quando e a che punto è la candidatura; il messaggio facoltativo per l'azienda è cifrato. Salviamo anche le ricerche per cui hai chiesto gli avvisi e le tue risposte alla mail mensile «stai ancora cercando?».

**Se rappresenti un'azienda.** Ragione sociale, partita IVA (controllata con il servizio VIES della Commissione europea) e comuni delle sedi. Se inviti dei colleghi, la loro email è cifrata. Per la verifica in due passaggi salviamo un codice segreto, cifrato.

**Segnalazioni.** Chi segnala un'offerta o un'azienda dalla pagina [Segnalazioni](/segnalazioni), anche senza account, ci dà il motivo e una descrizione facoltativa, in cui non vanno scritti email o numeri di telefono. Se segnali con il tuo account, l'esito arriva alla sua email.

**Registro di sicurezza.** Annotiamo chi ha fatto cosa e quando (per esempio «un moderatore ha tolto un'offerta»), senza contenuti personali. Per gli accessi degli amministratori salviamo l'indirizzo IP in forma pseudonimizzata, cioè non leggibile direttamente.

## 3. Perché usiamo i dati e su quale base {#finalita}

Il GDPR (art. 6) chiede una base giuridica per ogni uso dei dati. Le nostre:

- **Darti il servizio che chiedi** (esecuzione del contratto, art. 6.1.b): account, profilo, ricerca delle offerte e candidature. Per i dati che invii per trovare un lavoro il consenso non serve (art. 111-bis del Codice privacy, D.Lgs. 196/2003).
- **Avvisi e mail mensile**: fanno parte del servizio e li attivi tu con una scelta esplicita. Si spengono con un clic dal link nelle email o dal tuo account. Non contengono pubblicità.
- **Lista d'attesa** (consenso, art. 6.1.a): puoi ritirarlo quando vuoi.
- **Sicurezza e prevenzione di abusi e truffe** (legittimo interesse, art. 6.1.f): proteggere chi usa il sito.
- **Segnalazioni e decisioni motivate sui contenuti** (obbligo di legge, art. 6.1.c): lo chiede il Regolamento UE 2022/2065 sui servizi digitali.

Non ti mandiamo email promozionali senza un consenso separato e facoltativo, e **non vendiamo i tuoi dati a nessuno**.

## 4. Come proteggiamo i dati {#sicurezza}

I tuoi dati personali sono cifrati nel database. Nemmeno chi gestisce la piattaforma li vede durante il lavoro quotidiano: l'app li decifra solo quando servono a te o all'azienda a cui hai scelto di candidarti, e ogni accesso viene registrato.

Inoltre:

- il server si trova in Italia e il suo disco è cifrato: se qualcuno lo rubasse, i dati resterebbero illeggibili;
- il server non ha porte aperte verso internet e il database non è raggiungibile da fuori: ci parla solo l'applicazione;
- i log tecnici del server non contengono dati personali.

## 5. A chi comunichiamo i dati {#destinatari}

- **L'azienda a cui ti candidi.** Quando invii una candidatura, quell'azienda vede il tuo profilo, la tua email, il tuo telefono e il messaggio. Da quel momento è **titolare autonomo** dei dati che riceve: le [condizioni d'uso](/condizioni) la obbligano a usarli solo per quella selezione.
- **Fornitori che lavorano per noi** (responsabili del trattamento, art. 28 GDPR) [DA VERIFICARE: accordi firmati con ciascuno]:
- **Cloudflare**: collegamento sicuro (HTTPS) e protezione del sito dagli attacchi; vede il traffico che passa verso il sito.
- **Brevo**: invio delle email (codici di accesso, avvisi, mail mensile).
- **Cloudflare R2**: conserva le copie di sicurezza (backup), cifrate sul nostro server **prima** di partire: il fornitore non può leggerle.
- **Commissione europea (servizio VIES)**: riceve solo la partita IVA delle aziende, per controllarla.
- **Autorità**: solo quando la legge lo impone.

## 6. Trasferimenti fuori dall'Unione europea {#trasferimenti}

Il database resta in Italia. L'unico fornitore con sede fuori dall'Unione europea è **Cloudflare, Inc.** (Stati Uniti), che aderisce all'EU-US Data Privacy Framework, riconosciuto dalla Commissione europea come garanzia adeguata. Non ci sono altri trasferimenti.

## 7. Per quanto tempo conserviamo i dati {#conservazione}

- **6 mesi senza attività** (né accessi né azioni sul profilo): il profilo viene nascosto, la mail mensile si ferma e ti avvisiamo via email.
- **24 mesi senza accessi**: l'account viene cancellato. Ti avvisiamo 30 giorni prima con la data esatta; basta entrare una volta per fermare la cancellazione.
- **Candidature**: l'azienda le vede fino a 6 mesi dopo la chiusura dell'offerta; poi spariscono dalla sua vista e il messaggio si cancella.
- **Registro di sicurezza**: 12 mesi.
- **Lista d'attesa**: chi si registra al sito esce subito; tutti escono dal 1° maggio 2027, sei mesi dopo il lancio. Le iscrizioni non confermate si cancellano dopo 7 giorni.
- **Dati di fatturazione**, quando ci saranno pagamenti: 10 anni, per obbligo di legge.

**Se cancelli l'account.** Puoi farlo in ogni momento da [Privacy e dati](/account/privacy). Distruggiamo la chiave con cui erano cifrati i tuoi dati: diventano subito illeggibili. Nelle copie di sicurezza cifrate spariscono con la loro rotazione, al più entro 6 mesi.

## 8. Decisioni automatizzate {#decisioni-automatizzate}

Non prendiamo decisioni basate solo su un trattamento automatizzato (art. 22 GDPR). Nessun programma dà voti alle persone o le mette in classifica. Le offerte sono ordinate con criteri dichiarati, per esempio la mansione e la distanza: li trovi in [Come funziona](/come-funziona). Chi chiamare per un colloquio lo decide l'azienda, non il sito.

## 9. I tuoi diritti {#diritti}

Il GDPR (artt. 15-22) ti dà il diritto di:

- **accesso**: sapere quali dati abbiamo su di te;
- **rettifica**: correggere dati sbagliati o incompleti;
- **cancellazione**: far eliminare i tuoi dati;
- **limitazione**: far «congelare» i dati senza cancellarli;
- **portabilità**: ricevere i tuoi dati in un file per portarli altrove;
- **opposizione**: opporti a un uso dei dati per motivi legati alla tua situazione;
- **revoca del consenso**, quando l'hai dato (per esempio per la lista d'attesa): vale da quel momento in poi.

Molte cose le fai in autonomia da [Privacy e dati](/account/privacy): scarichi i tuoi dati in un file, li modifichi, nascondi il profilo o cancelli l'account. Per il resto scrivi al [punto di contatto](/contatti): rispondiamo entro un mese (art. 12.3 GDPR). Se pensi che non rispettiamo i tuoi diritti puoi fare reclamo al Garante per la protezione dei dati personali: www.garanteprivacy.it.

## 10. Cookie {#cookie}

Usiamo solo cookie tecnici, per esempio quello che ti tiene dentro al tuo account mentre passi da una pagina all'altra. Nessun cookie di profilazione o di pubblicità e nessuno strumento di tracciamento di altre aziende. L'elenco completo è in [Cookie](/cookie).

## 11. Minori {#minori}

Il servizio è solo per persone maggiorenni. Se scopriamo dati di una persona minorenne, li cancelliamo.

## 12. Anteprima fino al 27 ottobre 2026 {#anteprima}

Fino al 27 ottobre 2026 il sito è in anteprima, con dati di prova: si registrano solo i tester con un codice invito. **Il 27 ottobre 2026 cancelliamo tutti gli account e i dati dell'anteprima.** La lista d'attesa invece resta.

## 13. Modifiche a questa informativa {#modifiche}

Ogni versione ha una data e resta consultabile in questa pagina, insieme a tutte le precedenti. Se cambiamo qualcosa di importante, per esempio il titolare o il modo in cui usiamo i dati che dicono chi sei, lo segnaliamo nel sito.`,
  },
};
