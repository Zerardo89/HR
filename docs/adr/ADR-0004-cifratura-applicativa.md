# ADR-0004 — Cifratura applicativa a busta con `KeyProvider` sostituibile

**Stato:** Accettata · **Data:** 26/09/2026

## Contesto
Requisito del fondatore: non poter accedere ai dati personali. La cifratura del disco o `pgcrypto` non bastano
(chi ha accesso al DB o alle query vede i dati in chiaro). Vedi [04-PRIVACY-SICUREZZA.md](../04-PRIVACY-SICUREZZA.md).

## Decisione
- Dati C2/C3 cifrati **nell'applicazione** con **AES-256-GCM** (IV casuale 12 byte, tag 16 byte, AAD = `tabella:id:versione`).
- **DEK per utente**, salvata cifrata con la **KEK**; la KEK non è mai nel DB né nel repo.
- **Indice cieco** HMAC-SHA256 (chiave separata) per cercare l'email in login.
- Interfaccia:
  ```ts
  interface KeyProvider {
    wrapKey(dek: Uint8Array, context: string): Promise<string>;   // ritorna "v1:<base64>"
    unwrapKey(wrapped: string, context: string): Promise<Uint8Array>;
    blindIndex(value: string, purpose: 'email' | 'phone'): Promise<string>;
  }
  ```
  Implementazioni: `FileKeyProvider` (MVP, KEK da Docker secret) → `OpenBaoTransitKeyProvider` (Fase 2).
- **Crypto-shredding** alla cancellazione (si elimina la DEK).
- Ogni `decryptPii()` scrive in `audit_log`.
- Modulo scritto dall'**architetto**, non delegato ai modelli locali.

## Alternative scartate
- `pgcrypto`: la chiave transita nelle query e nei log del DB.
- Cifratura solo del disco/volume: protegge dal furto fisico, non dall'accesso al DB.
- Cifratura lato client (zero-knowledge): incompatibile con ricerca e lettura da parte delle aziende.
- Librerie esterne di cifratura dei campi ORM: dipendenza poco mantenuta su un punto critico.

## Conseguenze
- ✅ Dump DB e backup non rivelano dati identificativi.
- ✅ Diritto all'oblio anche nei backup.
- ⚠️ Non si può fare ricerca full-text sui campi cifrati (per questo i dati per la ricerca stanno in C1, non identificanti).
- ⚠️ Perdere la KEK = perdere i dati: backup della KEK dal custode (busta sigillata / Shamir).

## Verifica
Test: round-trip; tag manomesso → errore; AAD diverso → errore; DEK distrutta → illeggibile; nessun campo C2 in chiaro nel DB (test che scansiona le colonne).
