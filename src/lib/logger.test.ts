import { Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { createLogger } from "./logger";

function capture() {
  const lines: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      lines.push(chunk.toString());
      cb();
    },
  });
  return { lines, logger: createLogger(stream, "info") };
}

describe("logger (R-PRIV-05)", () => {
  it("redige email, telefono e nomi a ogni livello di annidamento", () => {
    const { lines, logger } = capture();
    logger.info(
      {
        email: "mario.rossi@example.test",
        user: { phone: "+39 333 0000000", firstName: "Mario" },
        req: { headers: { authorization: "Bearer abc.def" } },
      },
      "login",
    );
    const out = lines.join("");
    expect(out).not.toContain("mario.rossi@example.test");
    expect(out).not.toContain("333 0000000");
    expect(out).not.toContain("Mario");
    expect(out).not.toContain("abc.def");
    expect(out).toContain("[REDATTO]");
    expect(out).toContain('"msg":"login"');
  });

  it("redige il `detail` degli errori Postgres (contiene i valori duplicati)", () => {
    const { lines, logger } = capture();
    logger.error({ err: { detail: "Key (email_bidx)=(x@y.test) already exists." } }, "db");
    expect(lines.join("")).not.toContain("x@y.test");
  });

  it("lascia passare ID e azioni", () => {
    const { lines, logger } = capture();
    logger.info({ userId: "u_123", action: "application.create" }, "ok");
    const out = lines.join("");
    expect(out).toContain("u_123");
    expect(out).toContain("application.create");
  });
});
