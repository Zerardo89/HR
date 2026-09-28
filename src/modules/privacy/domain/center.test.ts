import { describe, expect, it } from "vitest";
import { DELETE_CONFIRM_WORD, deleteAccountInput } from "./center";

// Test di accettazione WP-023: la cancellazione non parte per sbaglio. NON modificarli.

describe("conferma della cancellazione", () => {
  it("serve la parola esatta (maiuscole e spazi non contano)", () => {
    expect(DELETE_CONFIRM_WORD).toBe("CANCELLA");
    expect(deleteAccountInput.safeParse({ confirm: "CANCELLA" }).success).toBe(true);
    expect(deleteAccountInput.safeParse({ confirm: "  cancella " }).success).toBe(true);
    for (const confirm of ["", "cancel", "CANCELLAMI", "sì"]) {
      expect(deleteAccountInput.safeParse({ confirm }).success).toBe(false);
    }
  });
});
