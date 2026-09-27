# ADR-0008 — Autenticazione senza password con Better Auth

**Stato:** Sostituita in parte da [ADR-0013](ADR-0013-auth-in-casa.md) (la libreria; il resto resta valido) · **Data:** 26/09/2026

## Contesto
Utenti poco tecnologici, spesso solo da smartphone; password dimenticate = abbandono. Aziende = bersaglio per furti di account.

## Decisione
- **Better Auth** (Auth.js è passato sotto la gestione del team Better Auth a settembre 2025, che raccomanda Better Auth per i nuovi progetti).
- Lavoratori: **codice OTP a 6 cifre via email** (preferito al magic link: funziona anche se il link si apre in un altro browser/app) + **passkey** facoltativa.
- Aziende e admin: OTP + **2FA TOTP obbligatoria** (o passkey).
- Login con Google: **non** all'MVP (meno dati condivisi con terzi, meno configurazione).
- L'email si cerca tramite indice cieco (ADR-0004): adattatore Better Auth personalizzato per non salvare email in chiaro.

## Alternative scartate
- Password: più supporto, più rischi.
- SPID/CIE: ottimo per verificare l'identità (utile nel 2027 per le famiglie datrici), ma integrazione lunga (accreditamento come fornitore di servizi).
- Servizi esterni (Auth0, Clerk): dati degli utenti presso terzi extra-UE.

## Conseguenze
- ⚠️ L'adattatore con email cifrata è il punto delicato: lo scrive/valida l'architetto.
- ⚠️ La consegna delle email OTP è critica → Brevo con dominio autenticato, monitoraggio dei rimbalzi.

## Verifica
E2E: registrazione, login OTP, scadenza codice (10 min), limite tentativi (5), 2FA azienda.
