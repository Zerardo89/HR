# 04 — Privacy by design e sicurezza ("io non devo poter leggere i dati")

> Regole normative in [02-REGOLE-DEL-GIOCO.md](02-REGOLE-DEL-GIOCO.md) (R-PRIV-*). Decisioni: ADR-0004, ADR-0006, ADR-0007.

## 1. Onestà prima di tutto: cosa si può e cosa non si può ottenere

Hai chiesto: *"io non devo poter avere accesso diretto al db, criptato, in modo che non devo poter avere
accesso ai dati personali delle persone"*. È l'obiettivo giusto, ma va detto chiaramente:

- Una **cifratura "a conoscenza zero"** totale (come WhatsApp) **non è compatibile** con un portale di lavoro:
  il server deve poter filtrare per mansione e distanza, e l'azienda deve poter **leggere** la candidatura.
- **Chi controlla il server e il codice può sempre, in teoria, modificare il codice per leggere i dati.**
  Nessuna architettura elimina questo rischio al 100% se sei l'unico operatore.

Quindi l'obiettivo diventa, in tre livelli:

| Livello | Obiettivo | Come |
|---------|-----------|------|
| **1. Impossibile per sbaglio** | Non vedi dati personali durante il lavoro normale (debug, moderazione, backup, statistiche) | Cifratura applicativa dei campi personali, pannello admin senza dati personali, log ripuliti, niente accesso diretto al DB |
| **2. Impossibile senza lasciare traccia** | Ogni decifratura è registrata; ogni modifica al codice passa da revisione | Log di audit non modificabile, deploy solo da CI, protezione del branch `main` |
| **3. Impossibile da solo** | Per leggere i dati servono **due persone** | Chiave principale custodita da un **custode delle chiavi** (co-fondatore dell'associazione), non da te — Fase 2 con OpenBao |

Questo è ciò che possiamo dichiarare pubblicamente **in modo veritiero** (attenzione: un claim esagerato
tipo "nessuno può leggere i tuoi dati" sarebbe una pratica commerciale scorretta).

Formula consigliata per il sito:
> *"I tuoi dati personali sono cifrati nel database. Nemmeno chi gestisce la piattaforma li vede durante il
> lavoro quotidiano: l'app li decifra solo quando servono a te o all'azienda a cui hai scelto di candidarti,
> e ogni accesso viene registrato."*

## 2. Classificazione dei dati

| Classe | Esempi | Dove/come | Chi lo vede |
|--------|--------|-----------|-------------|
| **C0 — Pubblico** | Offerte, nome azienda, comune dell'offerta, stipendio | In chiaro | Tutti |
| **C1 — Pseudonimo** | ID mansioni, competenze (ID ESCO), comune ISTAT di domicilio, raggio, fascia di esperienza, disponibilità, tipo contratto desiderato, patenti, lingue (livello), stato (cerco/aperto/nascosto) | **In chiaro** (serve per cercare), senza identificativi diretti | Motore di ricerca; aziende solo in Fase B e in forma anonima |
| **C2 — Identificativo** | Nome, cognome, email, telefono, testi liberi (presentazione, esperienze, formazione, nomi di ex datori) | **Cifrato a livello applicativo** (AES-256-GCM, chiave per utente) | Il lavoratore; l'azienda a cui si candida o di cui accetta il contatto |
| **C3 — Particolare** | Appartenenza a categorie protette L. 68/99 | Cifrato con **chiave dedicata separata**, solo con consenso esplicito | Solo aziende di offerte "L.68" a cui il lavoratore si candida |
| **C4 — Segreti** | Chiavi, password DB, token API | Solo in secret manager / Docker secrets, mai nel repo | Solo i processi applicativi |

**Nota:** i **nomi degli ex datori** nei testi del CV sono identificanti (insieme al comune): stanno in C2.

## 3. Cifratura applicativa (envelope encryption)

```
                     ┌────────────────────────────┐
                     │  KEK (Key Encryption Key)   │  ← MVP: file segreto montato solo nel container app
                     │  (mai nel DB, mai nel repo) │  ← Fase 2: OpenBao Transit gestito dal custode
                     └──────────────┬─────────────┘
                                    │ cifra/decifra
                                    ▼
      ┌──────────────── riga worker_profiles ─────────────────┐
      │ dek_wrapped  = Enc_KEK(DEK_utente)                     │
      │ pii_enc      = AES-256-GCM(DEK_utente, JSON dati C2)   │
      │ key_version  = 1                                       │
      └────────────────────────────────────────────────────────┘
```

- **DEK per utente** (32 byte casuali): cifra i dati C2 di quell'utente. È salvata nel DB **solo cifrata** con la KEK.
- **Crypto-shredding:** quando l'utente cancella l'account, si distrugge la DEK → i suoi dati diventano subito
  illeggibili nel sistema. Nei backup (che non possiamo modificare) resta la DEK cifrata fino alla loro rotazione:
  i dati spariscono anche lì **al più entro 6 mesi**; dopo un ripristino si ripetono le cancellazioni successive al
  backup (ADR-0014).
- **Email per il login:** serve cercarla → si salva un **indice cieco** `email_bidx = HMAC-SHA256(K_index, email_normalizzata)`
  (chiave diversa dalla KEK) + l'email cifrata. Il DB non contiene email in chiaro.
- **Rotazione chiavi:** campo `key_version`; job di ri-cifratura progressiva.
- **Libreria:** primitive standard di Node (`crypto`, AES-256-GCM con IV casuale da 12 byte) dietro un'interfaccia
  `KeyProvider` (`wrapKey`, `unwrapKey`, `hmac`) così si passa da "file" a "OpenBao/KMS" senza toccare il resto (ADR-0004).
- **Chi scrive questo modulo:** l'architetto (Claude), **non** il modello locale. Il codice crittografico non si delega.

## 4. Gestione delle chiavi — due fasi

| | **MVP (lancio)** | **Fase 2 (entro gennaio 2027)** |
|---|---|---|
| Dove sta la KEK | Docker secret sul VPS, leggibile solo dal container `app`/`worker` | **OpenBao** (fork open source di Vault) su una piccola VM separata; motore *Transit*: la KEK **non esce mai** da OpenBao |
| Chi la controlla | Tu (limite dichiarato) | Il **custode delle chiavi** (co-fondatore); chiavi di sblocco divise con Shamir 2-su-3 |
| Audit | Log applicativo di ogni decifratura | + audit log di OpenBao che il custode può verificare |
| Backup della KEK | Stampata/cifrata, in busta sigillata presso il custode | Quote Shamir a 3 persone |

**Perché non OpenBao subito:** aggiunge operatività (sblocco dopo riavvii, un'altra macchina) nel mese più
critico. L'interfaccia `KeyProvider` rende la migrazione un lavoro di 1-2 giorni.

## 4-bis. Se il server è un computer di casa (ADR-0012)
- **Disco cifrato** obbligatorio (BitLocker, FileVault o LUKS): se il computer viene rubato, i dati restano illeggibili.
- **Utente del sistema dedicato** solo al servizio, senza privilegi di amministratore; niente navigazione o giochi con quell'utente.
- **Nessuna porta aperta sul router**: tutto passa dal tunnel Cloudflare in uscita.
- Aggiornamenti automatici del sistema operativo e di Docker.
- Il custode delle chiavi resta: la KEK non va copiata su altri dispositivi personali.

## 5. "Niente accesso diretto al DB" — misure concrete

1. **Postgres non espone porte** verso l'esterno: rete Docker interna. **Attenzione:** Docker scavalca `ufw`;
   non usare mai `ports: "5432:5432"` nel compose di produzione.
2. **Credenziali DB** generate al provisioning, salvate come Docker secret; **non** annotate altrove.
3. **Niente pgAdmin/Adminer** in produzione.
4. **Migrazioni** eseguite solo dalla pipeline di deploy. **Ruoli separati** (WP-027): l'app web si collega come
   `hr_app` (niente DDL, log di audit solo in aggiunta), il worker come `hr_worker`; il proprietario solo in pipeline.
5. **Pannello admin senza dati personali:** moderazione offerte (dati pubblici), statistiche aggregate, segnalazioni DSA,
   stato dei job. Le richieste degli utenti sui propri dati si gestiscono **in self-service** (export, cancellazione).
   Le segnalazioni mostrano al moderatore solo motivo e descrizione (in cui email e numeri di telefono sono
   rifiutati), mai chi ha segnalato; l'azienda sospesa perde subito l'accesso ai dati dei candidati (WP-024a).
6. **Procedura "break-glass"** (emergenze): richiede il custode, viene registrata e comunicata.
7. **Protezione del codice:** branch `main` protetto, merge solo via PR con CI verde; deploy solo da CI; tag firmati.
   Quando c'è il secondo sviluppatore/custode: revisione obbligatoria di una seconda persona sui moduli `crypto`, `privacy`, `identity`.

## 6. Sicurezza applicativa (obiettivo: OWASP ASVS livello 2 sulle parti critiche)

| Area | Misura |
|------|--------|
| Autenticazione | Modulo in casa (ADR-0013): login senza password con codice a 6 cifre via email (10 minuti, 5 tentativi, limiti per email e IP) + **passkey** (dopo il lancio); 2FA obbligatoria per aziende e admin (WP-011) |
| Sessioni | Cookie `HttpOnly`, `Secure`, `SameSite=Lax`; rotazione; scadenza 30 giorni (lavoratori), 7 giorni (admin) |
| Autorizzazione | Controlli **server-side** in ogni azione; policy centralizzate per ruolo (`worker`, `company_member`, `company_owner`, `moderator`, `admin`) e per risorsa (una azienda vede solo le **proprie** candidature) |
| Input | Validazione Zod su ogni input; output escaping di React; niente HTML libero negli annunci (Markdown ristretto) |
| Header | CSP rigorosa (nonce), HSTS, `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` |
| Rate limiting | Caddy + limiter applicativo su login, candidature, segnalazioni, ricerca (anti-scraping) |
| Anti-scraping (Fase B) | Profili anonimi, paginazione limitata, quote giornaliere di visualizzazione per azienda, allarmi su pattern anomali |
| Upload file | **Nessun upload all'MVP** (CV generato dal profilo). In v1.1: solo PDF ≤ 3 MB, controllo magic bytes, scansione ClamAV, cifratura, download con `Content-Disposition: attachment` |
| Dipendenze | Renovate/Dependabot, `pnpm audit`, blocco versioni (lockfile), Trivy sulle immagini |
| Segreti | gitleaks in CI; `.env` mai committato; `.env.example` senza valori |
| Server | Solo chiavi SSH, root disabilitato, `unattended-upgrades`, firewall (22 limitato, 80/443), CrowdSec o fail2ban |
| Backup | `restic` cifrato, giornaliero, **offsite presso un altro fornitore UE**; retention 7 giornalieri / 4 settimanali / 6 mensili; **test di ripristino** mensile documentato. Dopo ogni ripristino si ripetono le cancellazioni dal registro (ADR-0014). Procedura e script: [runbook](runbook/BACKUP-E-RIPRISTINO.md) |
| Monitoraggio | Uptime Kuma (uptime + certificati), log JSON con redazione dei campi personali (pino `redact`), allarmi via email/Telegram al gestore |

## 7. Log di audit
Tabella `audit_log` **append-only** (trigger che impedisce UPDATE e DELETE; unica eccezione, la cancellazione delle
righe più vecchie di 12 mesi, per il job di conservazione — migrazione 0013; il ruolo DB dell'app web ha solo
INSERT/SELECT, il DELETE è del solo worker — ruoli separati in WP-027):
- chi (id utente o "system"), cosa (`pii.decrypt`, `application.view`, `offer.moderate`, `account.delete`, `admin.login`…),
  su cosa (id risorsa), quando, IP **hashato**.
- Visibile in forma aggregata nel pannello admin; il lavoratore può vedere **chi ha visualizzato la sua candidatura** (trasparenza: funzione molto apprezzata).

## 8. Conservazione e cancellazione (job automatici)
Implementa R-PRIV-03 con job `pg-boss` giornalieri (fuso orario `Europe/Rome`; attenzione al cambio d'ora del 25/10/2026):

| Job (worker) | Regola |
|-----|--------|
| `retention.accounts` (04:15) | Tre passi, in ordine (WP-023b): |
| — nascondi | Nessuna attività per 6 mesi (né accesso né interazione col profilo) → profilo nascosto, mail mensile spenta + email di avviso (una volta sola) |
| — preavviso | 23 mesi senza accesso → preavviso con la **data** di cancellazione (30 giorni dopo, mai prima dei 24 mesi). Se l'utente entra anche una volta, il preavviso decade |
| — cancella | Dal giorno annunciato (ora italiana) → cancellazione con crypto-shredding, come quella fatta dall'utente (ADR-0014; audit `account.delete` con attore `system:retention`). Personale (moderatori, amministratori) escluso |
| `retention.applications` (03:45) | Candidature: rimosse dalla vista azienda 6 mesi dopo la chiusura dell'offerta (controllo in lettura, `company_visible_until`); poi il messaggio cifrato si cancella (job, WP-022) |
| `retention.audit` (04:30) | Log di sicurezza oltre 12 mesi → eliminati (il trigger ammette solo questa cancellazione) |
| `retention.waitlist` (04:40) | Iscritti alla lista d'attesa: chi si è registrato esce subito; dal 01/05/2027 (6 mesi dal lancio) escono tutti |

Ogni job lavora a lotti (500 righe) ed è ripetibile: rifarlo non cambia nulla, ciò che resta si fa il giorno dopo.

## 9. Modello delle minacce (sintesi STRIDE)

| Minaccia | Esempio | Contromisura principale |
|----------|---------|------------------------|
| Falsa azienda che raccoglie CV (phishing, truffe) | "Azienda" chiede documenti o soldi | Verifica P.IVA, moderazione prime offerte, profili anonimi (Fase B), niente documenti in candidatura, pulsante Segnala |
| Scraping del database candidati | Bot che scarica profili | Fase B: anonimato + quote + rate limit; mai esporre contatti senza consenso |
| Furto del dump DB | Backup rubato | Dati C2/C3 cifrati, KEK non nel DB, backup cifrati |
| Account takeover | Password riutilizzate | Niente password (OTP/passkey), 2FA aziende |
| Insider (il gestore) | Curiosità, pressioni esterne | §1 livelli 1-3, audit, custode chiavi |
| Abuso email | Spam dalla nostra piattaforma | Limiti di invio per azienda, contenuti moderati, disiscrizione |
| Iniezione / XSS | Annuncio con script | Markdown ristretto, CSP, escaping |
| Scanner email che "clicca" azioni | Stato cambiato per errore | Pagine di conferma con POST (R-MAIL-02) |

## 10. DPIA e documenti privacy (bozze a cura di Gemini, validazione Claude + professionista)
- Registro dei trattamenti (art. 30)
- DPIA (metodologia CNIL PIA o modello del Garante)
- Informative: lavoratori, aziende, visitatori/cookie
- Procedura data breach (chi fa cosa nelle 72 ore, modello di notifica)
- Procedura richieste degli interessati
- Modello di informativa per le aziende titolari autonome
- Accordi art. 28 con i fornitori (hosting, email, backup)

## 11. Regole per il team di IA (R-AI-04, ripetuto perché fondamentale)
- **Mai** incollare in ChatGPT, Gemini o altri servizi esterni: dati reali di utenti, dump, log di produzione, segreti.
- Solo dati **sintetici** generati apposta (seed).
- Disattivare nelle impostazioni di ChatGPT e Gemini l'uso delle conversazioni per l'addestramento.
- Gli strumenti CLI (Codex, Gemini CLI, Claude Code) lavorano **solo sul repo di sviluppo**, mai con credenziali di produzione.
