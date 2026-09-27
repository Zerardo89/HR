import { describe, expect, it } from "vitest";
import { parseServerEnv } from "./env";

const valid = {
  NODE_ENV: "test",
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgres://hr:hr@localhost:5432/hr",
  KEK_FILE: "./secrets/dev-kek.b64",
  BLIND_INDEX_KEY_FILE: "./secrets/dev-blind-index.b64",
  SMTP_HOST: "localhost",
  SMTP_PORT: "1025",
  MAIL_FROM: "HR <noreply@example.test>",
};

describe("parseServerEnv", () => {
  it("accetta una configurazione valida e applica i default", () => {
    const env = parseServerEnv(valid);
    expect(env.SMTP_PORT).toBe(1025);
    expect(env.LOG_LEVEL).toBe("info");
    expect(env.APP_VERSION).toBe("dev");
  });

  it("rifiuta un DATABASE_URL che non è postgres", () => {
    expect(() => parseServerEnv({ ...valid, DATABASE_URL: "mysql://x@y/z" })).toThrow(
      /DATABASE_URL/,
    );
  });

  it("segnala le variabili mancanti senza stampare i valori delle altre", () => {
    const missing: Record<string, string | undefined> = { ...valid, KEK_FILE: undefined };
    try {
      parseServerEnv({ ...missing, SMTP_PASS: "segreto-da-non-stampare" });
      expect.unreachable();
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toMatch(/KEK_FILE/);
      expect(msg).not.toMatch(/segreto-da-non-stampare/);
    }
  });
});
