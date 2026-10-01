import { z } from "zod";
import { SELF_SIGNUP_ROLES } from "./policy";

/** Email digitata dall'utente: spazi tolti, minuscole, massimo 254 caratteri (RFC 5321). */
export const emailInput = z.string().trim().toLowerCase().max(254).pipe(z.email());

/** Checkbox HTML: il valore arriva come "on" solo se spuntata. */
const checked = z.literal("on");

export const signupInput = z.object({
  email: emailInput,
  role: z.enum(SELF_SIGNUP_ROLES),
  adult: checked, // R-LAV-09: solo la dichiarazione, mai la data di nascita
  legal: checked, // presa visione dell'informativa + accettazione delle condizioni d'uso
  // Solo in anteprima (WP-010b). Spazi e trattini contano: un codice di 64 caratteri scritto a gruppi ci sta.
  inviteCode: z.string().max(128).optional(),
});

export type SignupInput = z.infer<typeof signupInput>;
