# ADR-0013 — Autenticazione scritta in casa: codice via email + sessioni nel database

**Stato:** Accettata · **Data:** 27/09/2026 · **Sostituisce in parte:** [ADR-0008](ADR-0008-auth-better-auth.md)
(resta valido tutto tranne la scelta della libreria: niente password, codice a 6 cifre via email, 2FA per aziende e admin,
niente login con Google all'MVP)

## Contesto
Prima di scrivere WP-008 l'architetto ha letto il codice di Better Auth 1.7.6 (ultima versione, 24/09/2026):
- la tabella utenti di Better Auth ha una colonna `email` **in chiaro**, obbligatoria e unica, e tutte le ricerche
  (`findUserByEmail`) filtrano su quel valore;
- il plugin del codice via email salva l'identificativo `"<tipo>-otp-<email>"` (esiste un'opzione per farne l'hash);
- per non salvare l'email in chiaro servirebbe un adattatore che riscrive valori e filtri **dentro** le chiamate interne
  della libreria: codice fragile, che può rompersi a ogni versione minore (la libreria esce spesso) e che andrebbe
  riverificato ogni volta. Proprio il punto più delicato del progetto (R-PRIV-02) dipenderebbe da dettagli interni altrui.

Quello che serve all'MVP è poco: codice a 6 cifre via email, sessioni, ruoli. Niente password, niente social login.

## Decisione
Modulo `identity` scritto e mantenuto dall'architetto (CLAUDE.md), sul modello della guida pubblica
"The Copenhagen Book" (dall'autore di Lucia, che ha smesso di mantenere la libreria e consiglia di scrivere le sessioni in casa):

1. **Un solo percorso "Accedi o registrati":** email → codice → se l'account esiste si entra; altrimenti si completa la
   registrazione (ruolo, "ho almeno 18 anni", presa visione dell'informativa). La risposta al primo passo è **sempre la stessa**
   (non rivela se un'email è registrata).
2. **Codice:** 6 cifre da generatore crittografico, valido **10 minuti**, **5 tentativi**, un solo codice attivo per email.
   Nel DB solo l'HMAC del codice legato alla sfida (chiave dell'indice cieco, scopo separato) e l'indice cieco dell'email.
3. **Limiti:** per email 3 codici ogni 15 minuti e 10 al giorno (contati nel DB); per IP in memoria (l'IP **non** si salva).
4. **Sessioni nel database:** token casuale di 256 bit nel cookie, nel DB solo il suo SHA-256. Cookie `HttpOnly`, `Secure`,
   `SameSite=Lax`, prefisso `__Host-` in HTTPS. Durata 30 giorni con rinnovo automatico (lavoratori e aziende), 7 giorni per
   moderatori e admin (docs/04 §6). Uscita = riga cancellata. Nessun IP o user agent salvato con la sessione.
5. **Email mai in chiaro:** `users.email_bidx` per trovare l'utente, `users.email_enc` cifrata con la DEK dell'utente (ADR-0004).
   Per inviare il codice si usa l'email appena digitata, quindi l'accesso **non** decifra nulla.
6. **Protezione CSRF:** le azioni passano da Server Actions (Next.js confronta `Origin` e `Host`) + cookie `SameSite=Lax`.
7. **Audit:** accessi di moderatori e admin registrati in `audit_log` con IP hashato (docs/04 §7).
8. **Più avanti, stesso modulo:** 2FA TOTP obbligatoria per aziende e admin (WP-011), passkey facoltative (dopo il lancio).

## Alternative scartate
- **Better Auth con adattatore personalizzato:** vedi Contesto (fragile proprio sul requisito più importante).
- **Better Auth con l'email in chiaro:** viola R-PRIV-02 e il vincolo del fondatore ("io non devo poter accedere ai dati").
- **Auth.js / NextAuth:** in manutenzione dal team di Better Auth, stesso problema della colonna `email`.
- **Servizi esterni (Clerk, Auth0):** dati degli utenti presso terzi extra-UE.

## Conseguenze
- ✅ Nessuna email in chiaro in nessuna tabella (lo verifica il test di WP-004 su tutto lo schema).
- ✅ Una dipendenza pesante in meno; il codice di accesso è piccolo, leggibile e coperto da test.
- ⚠️ Scrivere l'autenticazione in casa è un rischio: lo si contiene con un perimetro minimo, test di accettazione
  (scadenza, tentativi, limiti, cookie), revisione di sicurezza prima di ogni rilascio e seconda lettura di ChatGPT.
- ⚠️ 2FA e passkey non sono "gratis": vanno scritte (WP-011 per la 2FA).

## Verifica
Test di accettazione di WP-008: codice scaduto, 6° tentativo bloccato, limiti per email, risposta identica per email
registrate e non, cookie con i flag giusti, sessione scaduta rifiutata, nessuna email in chiaro nel DB, e2e registrazione + accesso
con il codice letto da Mailpit.
