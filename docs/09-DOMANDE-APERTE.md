# 09 — Domande aperte (servono le tue risposte)

Rispondi direttamente in questo file (sotto ogni domanda) e fai commit, oppure rispondi a Claude in chat.
Dove c'è una **proposta**, se non rispondi entro lunedì 28/09 si procede con quella.

## Bloccanti per la settimana 1

**Q1 — Nome del progetto e dominio.** ✅ Dominio: **inspectio.cloud** (Aruba). L'app userà un sottodominio con il nome scelto,
es. `dintorni.inspectio.cloud` (vedi ADR-0012). **Resta da scegliere il nome.**

Rosa di 10 nomi (27/09/2026, verifica rapida sul web: nessun portale di lavoro con lo stesso nome trovato per i 🟢;
prima della scelta finale servono ricerca marchi su UIBM/TMview e disponibilità del dominio su Aruba):

| # | Nome | Slogan | Perché | Rischio |
|---|------|--------|--------|---------|
| 1 | **Prossimo** | "Il tuo prossimo lavoro è vicino" | Doppio senso: *prossimo* = il prossimo lavoro **e** il vicino ("ama il prossimo"). Ottimo come marchio ombrello per i progetti futuri | 🟡 parola comune; esiste il consorzio "Farsi Prossimo" (cooperative sociali) |
| 2 | **Raggio** | "Il lavoro nel tuo raggio" | Richiama la regola dei 50 km e un "raggio di sole" | 🟢 |
| 3 | **Dintorni** | "Il lavoro nei dintorni" | Morbido, locale, adatto anche ad altri servizi di zona | 🟢 |
| 4 | **Accanto** | "Il lavoro accanto a te" | Caldo, umano | 🟢 |
| 5 | **Intorno** | "Lavoro intorno a te" | Simile a Dintorni, più corto | 🟢 |
| 6 | **Vicinato** | "Il lavoro del tuo vicinato" | Comunità, quartiere | 🟢 |
| 7 | **Dietro l'Angolo** | "Il lavoro è dietro l'angolo" | Modo di dire italiano: "vicinissimo" e anche "la svolta è vicina" | 🟢 un po' lungo |
| 8 | **Sottocasa** | "Il lavoro sottocasa" | Colloquiale e memorabile | 🟡 esistono app di coupon/negozi con nome simile |
| 9 | **KmZero** | "Lavoro a km zero" | Concetto chiaro e di moda | 🟡 descrittivo (marchio debole), km0.com usato per prodotti tipici |
| 10 | **Bottega** | "Impara, lavora, cresci" | "Andare a bottega" = imparare un mestiere da chi lo sa fare | 🟡 parola comunissima, poco distintiva |

Scartati: *Mestieri* (rete nazionale di agenzie per il lavoro già esistente), *InZona* (app di commercio locale),
*Cerchia* (banca dati aziende), *Campanile* (catena alberghiera + sa di "campanilismo"), *Compaesani* (suona escludente),
*Lavoro per Te* (agenzia regionale Emilia-Romagna).
**Consiglio dell'architetto:** 1) Prossimo, 2) Raggio, 3) Dintorni.
> Risposta (01/10/2026): **Tasky**. Indirizzo proposto (ADR-0012 §5): `tasky.inspectio.cloud`, poi
> `tasky-beta.inspectio.cloud` per lo staging. Prima del caricamento su Play: ricerca marchi su UIBM/TMview.

**Q2 — Nome del pacchetto Android** (immutabile). È la "targa" tecnica dell'app su Google Play (es. `it.prossimo.lavoro`):
gli utenti la vedono solo nell'indirizzo della pagina Play Store, ma **non si può più cambiare** dopo il primo caricamento.
*Decisione:* la sceglie l'architetto dal dominio, appena sono decisi nome e dominio. Non serve una risposta.
> Decisione (01/10/2026): **`cloud.inspectio.tasky`** (ADR-0012 §8). Diventa definitivo al primo caricamento su Play
> (WP-010d); fino ad allora si cambia solo in `ANDROID_PACKAGE_NAME`.

**Q3 — Area pilota.** In quale provincia/regione vivi e dove hai più contatti? L'app funziona in tutta Italia, ma la comunicazione e l'onboarding delle aziende partono da **una** provincia.
> Risposta:

**Q4 — Co-fondatori dell'associazione.** Hai almeno 2 persone di fiducia? Chi può fare da **custode delle chiavi**?
> Risposta:

**Q5 — Hardware.** Che GPU/RAM hai per Ollama e ComfyUI? (Determina i modelli: [07-TEAM-AI.md §2.1](07-TEAM-AI.md))
> Risposta:

**Q6 — Tempo disponibile.** Quante ore al giorno puoi dedicare da martedì 29/09 al 01/11? Lavori anche nel fine settimana?
> Risposta:

**Q7 — Sistema operativo** del PC di sviluppo (Windows con WSL2, macOS, Linux)?
> Risposta:

## Da decidere entro la settimana 2

**Q8 — Forma giuridica.** Confermi l'**associazione ETS** (vedi [02 §9](02-REGOLE-DEL-GIOCO.md))? *Proposta:* sì.
> Risposta:

**Q9 — Prezzi.** Confermi il listino di [05 §4](05-MONETIZZAZIONE.md)? (Sostenitore €9,99/anno; Nazionale €39/mese; In evidenza €9/7 giorni)
> Risposta:

**Q10 — Periodo fondatori** gratuito fino al 31/01/2027? *Proposta:* sì (toglie i pagamenti dal percorso critico).
> Risposta:

**Q11 — Hosting.** ✅ Deciso il 27/09/2026: niente VPS a pagamento per ora → Cloudflare Tunnel + PC di casa, poi Oracle Always Free
o un vecchio portatile/mini PC; VPS solo con le prime entrate ([ADR-0012](adr/ADR-0012-hosting-costo-zero.md)).

**Q12 — Stile visivo.** Colori o riferimenti che ti piacciono? *Proposta:* caldo e affidabile (es. verde salvia + arancio tenue), niente blu "corporate".
> Risposta:

**Q13 — Tipi di lavoro esclusi all'MVP.** Confermi: niente famiglie come datori (colf/badanti), niente minori, niente upload di CV? *Proposta:* sì, arrivano nel 2027 / v1.1.
> Risposta:

**Q14 — Agenzie per il lavoro** ammesse a pubblicare dal lancio (con n. di autorizzazione)? *Proposta:* sì, ma senza accesso alla Fase B nei primi mesi.
> Risposta:

## Da decidere entro il lancio

**Q15 — Piattaforma crowdfunding:** Produzioni dal Basso? *Proposta:* sì per la campagna di lancio.
> Risposta:

**Q16 — Chi modera** oltre a te? Volontari dell'associazione?
> Risposta:

**Q17 — Contatti con enti locali** (Comune, Informagiovani, CPI, associazioni di categoria, parrocchie, scuole)? Qualcuno che conosci?
> Risposta:
