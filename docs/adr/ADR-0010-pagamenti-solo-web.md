# ADR-0010 — Pagamenti solo sul web con Stripe, nessun acquisto in-app all'MVP

**Stato:** Accettata · **Data:** 26/09/2026

## Contesto
Piani a pagamento: Sostenitore (senza pubblicità), Nazionale e In evidenza (aziende). Vendere beni digitali
**dentro** un'app Play obbliga a usare Google Play Billing (commissioni e integrazione) salvo programmi
alternativi EEA con requisiti propri. Per fatturare serve l'associazione con P.IVA.

## Decisione
- **Stripe Checkout + Customer Portal + webhook** sul sito; il webhook crea/aggiorna gli `entitlements`.
- L'app Android **non** mostra acquisti né link all'acquisto (R-PLAY-05); riconosce solo i diritti acquistati sul web.
- **Prezzi annuali in evidenza**: sui micro-importi la commissione fissa pesa troppo (su €1,49 la quota fissa è ~15-20 %).
- Codice costruito all'MVP ma dietro `BILLING_ENABLED=false` finché l'associazione non ha P.IVA e conto; nel frattempo "periodo fondatori" gratuito.
- In valutazione (v1.2): **Satispay** per i micro-pagamenti dei sostenitori (molto diffuso in Italia) — verificare condizioni e commissioni attuali.

## Alternative scartate
- Google Play Billing all'MVP: integrazione TWA (Digital Goods API) + commissioni; rimandato.
- PayPal come unico metodo: UX e costi peggiori per abbonamenti.

## Conseguenze
- ✅ Nessuna dipendenza del lancio dai pagamenti.
- ⚠️ Fatturazione elettronica (SDI) per le aziende: serve un servizio collegato (es. il gestionale del commercialista o un servizio di fatturazione con API) → v1.2.

## Verifica
Test webhook con Stripe CLI; idempotenza (stesso evento due volte = un solo entitlement); disdetta dal portale.
