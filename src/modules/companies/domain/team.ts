import { z } from "zod";
import { emailInput } from "@/modules/identity/domain";

/**
 * Sedi operative e inviti ai colleghi (WP-011c). Le sedi contano per la zona gratuita (ADR-0009) solo dopo
 * l'approvazione di un moderatore: per questo chi le aggiunge non può approvarle da sé.
 */

export const MAX_SITES_PER_COMPANY = 20;
export const INVITE_TTL_DAYS = 7;
export const MAX_OPEN_INVITES = 10;
/** Inviti spediti per azienda in 24 ore (anche se poi revocati): le email partono a nome nostro. */
export const MAX_INVITES_PER_DAY = 20;

/** Motivi di rifiuto di una sede, mostrati all'azienda (DSA art. 17). */
export const SITE_REJECTION_REASONS = [
  "not_found", // l'attività non risulta in quel comune
  "duplicate", // sede già presente
  "unclear", // indicazioni insufficienti
  "other",
] as const;
export type SiteRejectionReason = (typeof SITE_REJECTION_REASONS)[number];

export type SiteState = "approved" | "pending" | "rejected";

export function siteState(site: { approvedAt: Date | null; rejectedAt: Date | null }): SiteState {
  if (site.approvedAt) return "approved";
  if (site.rejectedAt) return "rejected";
  return "pending";
}

export type InviteState = "open" | "expired" | "accepted" | "revoked";

export function inviteState(
  invite: { expiresAt: Date; acceptedAt: Date | null; revokedAt: Date | null },
  now: Date,
): InviteState {
  if (invite.acceptedAt) return "accepted";
  if (invite.revokedAt) return "revoked";
  return invite.expiresAt.getTime() <= now.getTime() ? "expired" : "open";
}

export function inviteExpiresAt(now: Date): Date {
  return new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 60 * 60_000);
}

const uuid = z.uuid();

export const siteInput = z.object({
  companyId: uuid,
  label: z.string().trim().min(2).max(80),
  place: z.string().trim().min(2).max(80),
});
export type SiteInput = z.infer<typeof siteInput>;

export const inviteInput = z.object({ companyId: uuid, email: emailInput });
export type InviteInput = z.infer<typeof inviteInput>;

export const siteDecisionInput = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("approve"), siteId: uuid }),
  z.object({ decision: z.literal("reject"), siteId: uuid, reason: z.enum(SITE_REJECTION_REASONS) }),
]);
export type SiteDecision = z.infer<typeof siteDecisionInput>;
