import { chmodSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { CryptoError, decrypt, encrypt, generateDek } from "./aead";
import { computeBlindIndex, computeMac, normalizeEmail, normalizePhone } from "./blind-index";
import { FileKeyProvider, parseKeyFile } from "./key-provider";
import {
  decryptPii,
  dekContextFor,
  encryptJson,
  newDataKey,
  type AuditSink,
  type PiiLocation,
} from "./pii";

// Test di accettazione WP-007 (ADR-0004). NON modificarli per far passare il codice.

const b64 = (buf: Buffer) => buf.toString("base64");
const provider = () => new FileKeyProvider(new Map([[1, randomBytes(32)]]), randomBytes(32));
const loc: PiiLocation = {
  table: "worker_profiles",
  column: "pii_enc",
  rowId: "11111111-1111-1111-1111-111111111111",
};
const piiSchema = z.object({ firstName: z.string(), phone: z.string() });
const sample = { firstName: "Nome Finto", phone: "+390000000000" };

function recordingAudit(): AuditSink & { events: unknown[] } {
  const events: unknown[] = [];
  return { events, record: async (e) => void events.push(e) };
}

describe("AES-256-GCM", () => {
  it("round-trip: decifra ciò che ha cifrato", () => {
    const key = generateDek();
    const token = encrypt(key, Buffer.from("ciao"), "ctx");
    expect(decrypt(key, token, "ctx").toString()).toBe("ciao");
  });

  it("lo stesso input produce testi cifrati diversi (IV casuale)", () => {
    const key = generateDek();
    const a = encrypt(key, Buffer.from("uguale"), "ctx");
    const b = encrypt(key, Buffer.from("uguale"), "ctx");
    expect(a).not.toBe(b);
    expect(a.split(".")[1]).not.toBe(b.split(".")[1]);
  });

  it("tag manomesso → errore", () => {
    const key = generateDek();
    const [v, iv, tag, ct] = encrypt(key, Buffer.from("dato"), "ctx").split(".") as [
      string,
      string,
      string,
      string,
    ];
    const badTag = Buffer.from(tag, "base64url");
    badTag[0] = badTag[0]! ^ 0xff;
    expect(() => decrypt(key, [v, iv, badTag.toString("base64url"), ct].join("."), "ctx")).toThrow(
      CryptoError,
    );
  });

  it("testo cifrato manomesso → errore", () => {
    const key = generateDek();
    const [v, iv, tag, ct] = encrypt(key, Buffer.from("dato lungo"), "ctx").split(".") as [
      string,
      string,
      string,
      string,
    ];
    const badCt = Buffer.from(ct, "base64url");
    badCt[0] = badCt[0]! ^ 0x01;
    expect(() => decrypt(key, [v, iv, tag, badCt.toString("base64url")].join("."), "ctx")).toThrow(
      CryptoError,
    );
  });

  it("AAD diverso → errore (non si sposta un valore cifrato su un'altra riga)", () => {
    const key = generateDek();
    const token = encrypt(key, Buffer.from("dato"), "worker_profiles.pii_enc:riga-A");
    expect(() => decrypt(key, token, "worker_profiles.pii_enc:riga-B")).toThrow(CryptoError);
  });

  it("chiave sbagliata → errore", () => {
    const token = encrypt(generateDek(), Buffer.from("dato"), "ctx");
    expect(() => decrypt(generateDek(), token, "ctx")).toThrow(CryptoError);
  });

  it("rifiuta chiavi di lunghezza sbagliata e formati sconosciuti", () => {
    expect(() => encrypt(randomBytes(16), Buffer.from("x"), "ctx")).toThrow(CryptoError);
    expect(() => decrypt(generateDek(), "v2.a.b.c", "ctx")).toThrow(CryptoError);
    expect(() => decrypt(generateDek(), "non-un-token", "ctx")).toThrow(CryptoError);
  });

  it("i messaggi d'errore non contengono dati", () => {
    const token = encrypt(generateDek(), Buffer.from("segreto-nel-testo"), "ctx");
    try {
      decrypt(generateDek(), token, "ctx");
    } catch (e) {
      expect((e as Error).message).not.toContain("segreto-nel-testo");
    }
  });
});

describe("indice cieco", () => {
  const key = randomBytes(32);

  it("è deterministico e insensibile a maiuscole e spazi dell'email", () => {
    expect(computeBlindIndex(key, "  Mario.Rossi@Example.TEST ", "email")).toBe(
      computeBlindIndex(key, "mario.rossi@example.test", "email"),
    );
  });

  it("scopi diversi → indici diversi per lo stesso valore", () => {
    expect(computeBlindIndex(key, "3330000000", "email")).not.toBe(
      computeBlindIndex(key, "3330000000", "phone"),
    );
  });

  it("chiavi diverse → indici diversi", () => {
    expect(computeBlindIndex(key, "a@b.test", "email")).not.toBe(
      computeBlindIndex(randomBytes(32), "a@b.test", "email"),
    );
  });

  it("normalizza email e telefoni italiani", () => {
    expect(normalizeEmail(" A@B.Test ")).toBe("a@b.test");
    expect(normalizePhone("333 000 0000")).toBe("+393330000000");
    expect(normalizePhone("+39 333-000-0000")).toBe("+393330000000");
    expect(normalizePhone("0041 79 000 00 00")).toBe("+41790000000");
  });
});

describe("MAC con chiave (codici di accesso, IP) — WP-008", () => {
  const key = randomBytes(32);

  it("è deterministico, dipende dallo scopo e dalla chiave", () => {
    expect(computeMac(key, "123456", "otp")).toBe(computeMac(key, "123456", "otp"));
    expect(computeMac(key, "123456", "otp")).not.toBe(computeMac(key, "123456", "ip"));
    expect(computeMac(randomBytes(32), "123456", "otp")).not.toBe(computeMac(key, "123456", "otp"));
  });

  it("non coincide mai con l'indice cieco dello stesso valore", () => {
    expect(computeMac(key, "email:a@b.it", "otp")).not.toBe(
      computeBlindIndex(key, "a@b.it", "email"),
    );
  });

  it("il KeyProvider lo espone senza rivelare la chiave", async () => {
    const p = provider();
    expect(await p.mac("1.2.3.4", "ip")).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });
});

describe("KeyProvider su file", () => {
  it("wrap/unwrap della DEK con contesto; contesto diverso → errore", async () => {
    const p = provider();
    const dek = generateDek();
    const wrapped = await p.wrapKey(dek, "worker_profiles:1");
    expect(wrapped.startsWith("1:")).toBe(true);
    expect((await p.unwrapKey(wrapped, "worker_profiles:1")).equals(dek)).toBe(true);
    await expect(p.unwrapKey(wrapped, "worker_profiles:2")).rejects.toThrow(CryptoError);
  });

  it("rotazione: cifra con la versione più alta, decifra anche le vecchie", async () => {
    const k1 = randomBytes(32);
    const k2 = randomBytes(32);
    const idx = randomBytes(32);
    const old = new FileKeyProvider(new Map([[1, k1]]), idx);
    const wrappedOld = await old.wrapKey(generateDek(), "ctx");
    const rotated = new FileKeyProvider(
      new Map([
        [1, k1],
        [2, k2],
      ]),
      idx,
    );
    expect(rotated.currentKeyVersion).toBe(2);
    expect((await rotated.wrapKey(generateDek(), "ctx")).startsWith("2:")).toBe(true);
    await expect(rotated.unwrapKey(wrappedOld, "ctx")).resolves.toHaveLength(32);
  });

  it("versione di KEK sconosciuta → errore", async () => {
    await expect(provider().unwrapKey("9:v1.a.b.c", "ctx")).rejects.toThrow(CryptoError);
    await expect(provider().unwrapKey("senza-versione", "ctx")).rejects.toThrow(CryptoError);
  });

  it("rifiuta KEK uguale alla chiave dell'indice cieco", () => {
    const same = randomBytes(32);
    expect(() => new FileKeyProvider(new Map([[1, same]]), Buffer.from(same))).toThrow(CryptoError);
  });

  it("formato file: singola chiave, versioni multiple, commenti; rifiuta lunghezze sbagliate e duplicati", () => {
    const a = randomBytes(32);
    const b = randomBytes(32);
    expect(
      parseKeyFile(`# commento\n${b64(a)}\n`)
        .get(1)!
        .equals(a),
    ).toBe(true);
    const multi = parseKeyFile(`1:${b64(a)}\n2:${b64(b)}\n`);
    expect([...multi.keys()]).toEqual([1, 2]);
    expect(() => parseKeyFile(b64(randomBytes(16)))).toThrow(CryptoError);
    expect(() => parseKeyFile(`1:${b64(a)}\n1:${b64(b)}`)).toThrow(CryptoError);
    expect(() => parseKeyFile("# solo commenti\n")).toThrow(CryptoError);
  });

  it("carica le chiavi da file e avvisa se i permessi sono troppo larghi", async () => {
    const dir = mkdtempSync(join(tmpdir(), "hr-keys-"));
    const kekPath = join(dir, "kek.b64");
    const idxPath = join(dir, "idx.b64");
    writeFileSync(kekPath, b64(randomBytes(32)), { mode: 0o600 });
    writeFileSync(idxPath, b64(randomBytes(32)), { mode: 0o600 });
    chmodSync(kekPath, 0o644);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const p = FileKeyProvider.fromFiles(kekPath, idxPath);
    expect(p.currentKeyVersion).toBe(1);
    if (process.platform !== "win32")
      expect(warn).toHaveBeenCalledWith(expect.stringContaining("chmod 600"));
  });
});

describe("dati personali (PII)", () => {
  it("il testo cifrato non contiene il testo in chiaro", async () => {
    const p = provider();
    const { dek } = await newDataKey(p, dekContextFor(loc.table, loc.rowId));
    const token = encryptJson(dek, sample, loc);
    expect(token).not.toContain("Nome Finto");
    expect(Buffer.from(token.split(".")[3]!, "base64url").toString("utf8")).not.toContain("Nome");
  });

  it("decryptPii registra l'audit PRIMA di restituire i dati", async () => {
    const p = provider();
    const audit = recordingAudit();
    const ctx = dekContextFor(loc.table, loc.rowId);
    const { dek, dekWrapped } = await newDataKey(p, ctx);
    const token = encryptJson(dek, sample, loc);
    const out = await decryptPii({
      provider: p,
      audit,
      actorId: "u_worker",
      purpose: "worker.self-view",
      dekWrapped,
      dekContext: ctx,
      token,
      location: loc,
      schema: piiSchema,
    });
    expect(out).toEqual(sample);
    expect(audit.events).toEqual([
      {
        action: "pii.decrypt",
        actorId: "u_worker",
        targetTable: loc.table,
        targetId: loc.rowId,
        purpose: "worker.self-view",
      },
    ]);
  });

  it("se l'audit fallisce, i dati NON vengono restituiti (fail closed)", async () => {
    const p = provider();
    const ctx = dekContextFor(loc.table, loc.rowId);
    const { dek, dekWrapped } = await newDataKey(p, ctx);
    const token = encryptJson(dek, sample, loc);
    const brokenAudit: AuditSink = {
      record: async () => {
        throw new Error("DB giù");
      },
    };
    await expect(
      decryptPii({
        provider: p,
        audit: brokenAudit,
        actorId: "u",
        purpose: "x",
        dekWrapped,
        dekContext: ctx,
        token,
        location: loc,
        schema: piiSchema,
      }),
    ).rejects.toThrow("DB giù");
  });

  it("crypto-shredding: senza la DEK originale i dati sono illeggibili", async () => {
    const p = provider();
    const ctx = dekContextFor(loc.table, loc.rowId);
    const { dek } = await newDataKey(p, ctx);
    const token = encryptJson(dek, sample, loc);
    const { dekWrapped: otherDek } = await newDataKey(p, ctx); // la DEK originale è stata distrutta
    await expect(
      decryptPii({
        provider: p,
        audit: recordingAudit(),
        actorId: "u",
        purpose: "x",
        dekWrapped: otherDek,
        dekContext: ctx,
        token,
        location: loc,
        schema: piiSchema,
      }),
    ).rejects.toThrow(CryptoError);
  });

  it("valida la forma dei dati decifrati con lo schema", async () => {
    const p = provider();
    const ctx = dekContextFor(loc.table, loc.rowId);
    const { dek, dekWrapped } = await newDataKey(p, ctx);
    const token = encryptJson(dek, { altro: 1 }, loc);
    await expect(
      decryptPii({
        provider: p,
        audit: recordingAudit(),
        actorId: "u",
        purpose: "x",
        dekWrapped,
        dekContext: ctx,
        token,
        location: loc,
        schema: piiSchema,
      }),
    ).rejects.toThrow();
  });
});
