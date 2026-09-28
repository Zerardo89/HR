/**
 * Condizioni d'uso, con TUTTE le versioni pubblicate (WP-024b, R-DSA-02, DSA art. 14).
 * - Una versione pubblicata non si modifica mai: chi l'ha accettata deve poterla rileggere uguale. Per cambiare
 *   il testo si aggiunge una versione nuova e si aggiorna `LEGAL_VERSIONS.terms` (identity/domain/policy.ts):
 *   chi ha accettato la precedente lo vede all'accesso e accetta di nuovo.
 * - Formato: Markdown ridotto (`src/lib/markdown-lite.ts`): `#`, `##` con ancora `{#id}`, paragrafi, `- `, link
 *   interni `[testo](/percorso)`.
 * - Restano "BOZZA" finché un professionista non li ha revisionati (CLAUDE.md).
 */

export type LegalVersion = { publishedOn: string; text: string };

export const TERMS_VERSIONS: Record<string, LegalVersion> = {
  "bozza-2026-09-27": {
    publishedOn: "2026-09-27",
    text: `Il servizio è gratuito per chi cerca lavoro, sempre. Per le aziende è gratuito nella loro regione o entro 50 km dalle loro sedi.

Le condizioni d'uso complete saranno pubblicate qui prima del lancio.`,
  },

  "bozza-2026-09-28": {
    publishedOn: "2026-09-28",
    text: `## 1. Chi siamo e cosa facciamo {#chi-siamo}

Il servizio è gestito da un'associazione senza scopo di lucro: i suoi dati sono nel piè di pagina e nella pagina [Chi siamo](/chi-siamo). Mettiamo in contatto chi cerca lavoro e chi offre lavoro vicino a casa: le aziende pubblicano offerte, chi cerca lavoro le trova e si candida.

Non siamo parte del rapporto di lavoro: l'assunzione, il contratto e lo stipendio riguardano solo l'azienda e la persona assunta. Non garantiamo che una candidatura porti a un colloquio o a un'assunzione.

## 2. Chi può usare il servizio {#chi-puo}

- Persone maggiorenni.
- Aziende con partita IVA italiana verificata e agenzie per il lavoro autorizzate dal Ministero del Lavoro.
- Un account per persona. Tieni al sicuro l'accesso: per chi usa l'area aziende la verifica in due passaggi è obbligatoria.

## 3. Quanto costa {#costi}

- Per chi cerca lavoro il servizio è **gratuito, sempre**: la legge vieta di chiedere compensi ai lavoratori (D.Lgs. 276/2003, art. 11).
- Per le aziende la pubblicazione è gratuita nella propria regione o entro 50 km dalle proprie sedi. I servizi a pagamento (ad esempio le offerte fuori zona con il Piano Nazionale) sono gratuiti fino al 31 gennaio 2027; dopo, prezzo e condizioni si vedono prima di qualsiasi pagamento.
- Le offerte «In evidenza» sono a pagamento e portano sempre un'etichetta che lo dice.

## 4. Regolamento degli annunci {#regolamento-annunci}

Ogni offerta deve indicare:

- lo **stipendio** (lordo o netto, all'ora, al mese o all'anno) per il lavoro dipendente;
- il **tipo di contratto** e il **comune** in cui si lavora;
- una descrizione vera e completa del lavoro;
- una **scadenza**, al massimo 60 giorni: si rinnova solo negli ultimi 7 giorni.

Non sono ammessi:

- requisiti di età, sesso, aspetto, origine, nazionalità, stato civile, religione, salute o simili, salvo i rari casi in cui sono un requisito essenziale del lavoro e sono spiegati (D.Lgs. 198/2006, D.Lgs. 215/2003, D.Lgs. 216/2003, D.Lgs. 276/2003 art. 10); il titolo deve essere rivolto a tutti, ad esempio con «(m/f)»;
- domande sullo stipendio dei lavori precedenti;
- **richieste di denaro** ai candidati, in qualsiasi forma (corsi, kit, iscrizioni, «investimenti»), e richieste di dati bancari o documenti d'identità per candidarsi;
- lavoro irregolare o senza contratto;
- offerte false o ingannevoli, truffe, vendite piramidali, pubblicità di prodotti o servizi;
- contatti esterni (ad esempio WhatsApp o Telegram) come unico modo per candidarsi.

## 5. Come controlliamo gli annunci {#moderazione}

- **Controllo automatico mentre scrivi.** Un programma a regole scritte da noi (non usiamo intelligenza artificiale) segnala i campi mancanti e le parole vietate o sospette, e spiega cosa correggere. Le parole vietate bloccano la pubblicazione; quelle sospette mandano l'offerta al controllo di una persona.
- **Controllo di una persona.** Le prime 3 offerte di ogni azienda nuova, e quelle con parole sospette, sono lette da un moderatore prima di essere pubblicate. Se un'offerta non va, l'azienda riceve il motivo.
- **Segnalazioni.** Chiunque, anche senza account, può segnalare un'offerta o un'azienda con il link «Segnala» in fondo a ogni offerta ([come funziona](/segnalazioni)). Ogni segnalazione è esaminata da una persona; chi segnala con il proprio account riceve l'esito.
- **Decisioni.** Possiamo togliere un'offerta o sospendere l'account di un'azienda. Ogni decisione è presa da una persona e spiegata per iscritto all'azienda: cosa abbiamo deciso, per quali fatti, in base a quale regola, e come contestarla.
- **Riesame.** Chi non è d'accordo con una decisione può chiederne il riesame entro 6 mesi dal [punto di contatto](/contatti). Resta il diritto di rivolgersi al giudice.
- **Ordine dei risultati.** Nessun sistema valuta o classifica le persone. Le offerte sono ordinate con criteri dichiarati: [come ordiniamo le offerte](/come-funziona).

## 6. Cosa ti chiediamo {#obblighi}

- Inserisci informazioni vere e aggiornate.
- Le aziende usano i dati dei candidati solo per la selezione per cui si sono candidati e rispettano le leggi sul lavoro: dell'offerta risponde l'azienda che la pubblica.
- Non copiare in massa i contenuti del sito e non usarlo per inviare pubblicità.

## 7. I dati personali {#dati}

Come trattiamo i dati personali lo spiega l'[informativa sulla privacy](/privacy). Puoi scaricare i tuoi dati o cancellare l'account in ogni momento da «Privacy e dati» nel tuo account.

## 8. Sospensione e chiusura dell'account {#sospensione}

Se le regole non sono rispettate possiamo togliere contenuti o sospendere un account, sempre con una decisione motivata (punto 5). Puoi chiudere il tuo account quando vuoi, da «Privacy e dati»; cosa succede ai dati, anche nelle copie di sicurezza, lo spiega l'[informativa sulla privacy](/privacy).

## 9. Modifiche a queste condizioni {#modifiche}

Ogni versione ha una data e resta consultabile in questa pagina. Se le cambiamo in modo importante te lo diciamo al primo accesso e ti chiediamo di accettarle di nuovo.

## 10. Contatti e legge applicabile {#contatti}

Per qualsiasi domanda scrivi al [punto di contatto](/contatti). Queste condizioni sono regolate dalla legge italiana; per chi usa il servizio come consumatore è competente il giudice del luogo in cui abita.`,
  },
};
