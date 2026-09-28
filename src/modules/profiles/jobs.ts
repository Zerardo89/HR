import "server-only";

// Modulo `profiles` — API per i job del worker e per gli altri moduli che girano nel worker (WP-021):
// niente componenti né Next.js.
export {
  applyMonthlyAnswer,
  dueMonthlyChecks,
  optOutMonthlyChecks,
  pauseMonthlyChecks,
  recordMonthlyCheckSent,
  type DueMonthlyCheck,
} from "./server/monthly";
