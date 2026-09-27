import { randomInt } from "node:crypto";
import { formatOtp } from "../domain";

export { hashToken, newToken, safeEqual } from "@/lib/tokens";

export function newOtpCode(): string {
  return formatOtp(randomInt(0, 1_000_000));
}
