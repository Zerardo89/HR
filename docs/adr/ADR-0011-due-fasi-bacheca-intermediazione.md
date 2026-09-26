# ADR-0011 — Lancio in due fasi: Bacheca → Intermediazione (feature flag)

**Stato:** Accettata · **Data:** 26/09/2026

## Contesto
Raccogliere CV e far incontrare domanda e offerta è **intermediazione** (art. 2 D.Lgs. 276/2003). Senza
autorizzazione è reato anche senza lucro dal 02/03/2024 (DL 19/2024). Il regime semplificato art. 6 per i
siti internet senza scopo di lucro richiede un ente, l'iscrizione all'Albo informatico e l'interconnessione:
tempi probabilmente **oltre il 01/11**. Dettagli in [02-REGOLE-DEL-GIOCO.md §2](../02-REGOLE-DEL-GIOCO.md).

## Decisione
- **Fase A — Bacheca** (lancio): offerte non anonime pubblicate dai datori; candidature su iniziativa del lavoratore; profili **non consultabili** dalle aziende.
- **Fase B — Intermediazione**: liste per mansione (ADR-0007), richieste di contatto, ricerca candidati fuori zona a pagamento.
- Flag server `INTERMEDIATION_ENABLED` (default `false`); tutte le route/azioni della Fase B verificano il flag lato server e rispondono 404 se spento; test e2e dedicati.
- Il perimetro esatto della Fase A si **adegua al parere legale** (domanda D1) prima del lancio.

## Alternative scartate
- Lanciare tutto e "regolarizzare dopo": rischio penale.
- Rinviare il lancio finché non c'è l'iscrizione: si perde il picco di assunzioni di novembre-dicembre.

## Conseguenze
- ✅ Lancio legale il 01/11.
- ⚠️ La funzione "liste per mansione" (richiesta originale) arriva dopo il lancio; i lavoratori possono però **già iscriversi alle liste** (i dati restano privati finché la Fase B non è attiva, se il legale conferma).

## Verifica
Test e2e con flag spento: nessuna rotta della Fase B raggiungibile; con flag acceso: funzionamento completo in staging.
