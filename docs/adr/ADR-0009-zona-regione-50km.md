# ADR-0009 — Zona gratuita = regione ∪ 50 km dalle sedi verificate

**Stato:** Accettata · **Data:** 26/09/2026

## Contesto
Requisito: gratis per le aziende nella propria regione o entro 50 km; a pagamento fuori. "Regione da cui ci si connette" via IP è inaffidabile (reti mobili, VPN) e ingiusto.

## Decisione
- Riferimento = **sedi verificate** dell'azienda (legale da VIES + operative approvate), localizzate al comune ISTAT.
- `FreeZone(company) = ⋃ sedi s ( comuni della regione di s ∪ comuni con centroide entro 50 km dal centroide di s )`.
- Distanza **in linea d'aria** tra centroidi (semplice, verificabile, stabile). Si comunica così: "entro 50 km in linea d'aria".
- I lavoratori **non** sono mai limitati: vedono e si candidano a tutto.
- La disponibilità a trasferirsi dichiarata dal lavoratore estende la visibilità gratuita verso quella regione.
- Logica in `modules/matching/domain/freeZone.ts` (pura) + query PostGIS.

## Alternative scartate
- IP del visitatore: vedi contesto.
- Distanza stradale: richiede servizi esterni a pagamento e varia nel tempo.
- Solo provincia: troppo restrittivo per le aree di confine.

## Conseguenze
- ✅ Regola chiara, spiegabile, non aggirabile senza sedi false (che richiedono approvazione).
- ⚠️ Serve un buon dataset dei centroidi dei comuni e il suo aggiornamento annuale.

## Verifica
Test con casi: stesso comune; stessa regione a 200 km; regione diversa a 30 km; regione diversa a 50,1 km; più sedi; sede non approvata ignorata.
