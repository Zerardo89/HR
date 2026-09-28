import { z } from "zod";

/** Centro privacy (WP-023): per cancellare l'account si scrive la parola, così non succede per sbaglio. */
export const DELETE_CONFIRM_WORD = "CANCELLA";

export const deleteAccountInput = z.object({
  confirm: z
    .string()
    .transform((v) => v.trim().toUpperCase())
    .refine((v) => v === DELETE_CONFIRM_WORD),
});
