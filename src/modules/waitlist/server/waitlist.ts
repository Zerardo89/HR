import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull, lt } from "drizzle-orm";
import { dekContextFor, encryptJson, newDataKey, normalizeEmail } from "@/lib/crypto";
import { consents, emailActionTokens, waitlist } from "@/lib/db/schema";
import { hashToken, newToken } from "@/lib/tokens";
import { LEGAL_VERSIONS } from "@/modules/identity/domain";
import {
  canResendConfirmation,
  CONFIRM_TOKEN_TTL_MS,
  UNCONFIRMED_RETENTION_MS,
  WAITLIST_CONSENT_VERSION,
  type WaitlistInput,
} from "../domain";
import { renderConfirmEmail } from "./confirm-email";
import type { WaitlistDeps } from "./deps";

/*
 * Lista d'attesa con doppia conferma (WP-009). Nel DB: indice cieco dell'email + email cifrata con una DEK
 * per riga (ADR-0004), hash del token di conferma. La risposta è la stessa per indirizzi nuovi, già iscritti
 * o già confermati: da fuori non si capisce chi è iscritto.
 */

export type JoinResult = { status: "sent" | "send_failed" };

export async function joinWaitlist(deps: WaitlistDeps, input: WaitlistInput): Promise<JoinResult> {
  const now = deps.now();
  await deleteUnconfirmedWaitlist(deps); // pulizia a ogni iscrizione, oltre al job giornaliero (WP-020)
  const emailBidx = await deps.keys.blindIndex(input.email, "email");

  const [existing] = await deps.db
    .select({ id: waitlist.id, confirmedAt: waitlist.confirmedAt })
    .from(waitlist)
    .where(eq(waitlist.emailBidx, emailBidx))
    .limit(1);

  let waitlistId: string;
  if (existing) {
    if (existing.confirmedAt) return { status: "sent" }; // già confermato: niente altre email
    const [last] = await deps.db
      .select({ createdAt: emailActionTokens.createdAt })
      .from(emailActionTokens)
      .where(eq(emailActionTokens.waitlistId, existing.id))
      .orderBy(desc(emailActionTokens.createdAt))
      .limit(1);
    if (!canResendConfirmation(last?.createdAt ?? null, now)) return { status: "sent" };
    waitlistId = existing.id;
  } else {
    waitlistId = randomUUID();
    const { dek, dekWrapped, keyVersion } = await newDataKey(
      deps.keys,
      dekContextFor("waitlist", waitlistId),
    );
    let emailEnc: string;
    try {
      emailEnc = encryptJson(dek, normalizeEmail(input.email), {
        table: "waitlist",
        column: "email_enc",
        rowId: waitlistId,
      });
    } finally {
      dek.fill(0);
    }
    const [created] = await deps.db
      .insert(waitlist)
      .values({
        id: waitlistId,
        emailBidx,
        emailEnc,
        dekWrapped,
        keyVersion,
        kind: input.kind,
        provinceCode: input.province ?? null,
        createdAt: now,
      })
      .onConflictDoNothing({ target: waitlist.emailBidx })
      .returning({ id: waitlist.id });
    if (!created) return { status: "sent" }; // iscrizione parallela con la stessa email
  }

  const token = newToken();
  await deps.db.insert(emailActionTokens).values({
    tokenHash: hashToken(token),
    waitlistId,
    action: "waitlist_confirm",
    expiresAt: new Date(now.getTime() + CONFIRM_TOKEN_TTL_MS),
    createdAt: now,
  });
  try {
    await deps.mailer.send({ to: input.email, ...renderConfirmEmail(token, deps.appUrl) });
  } catch {
    return { status: "send_failed" };
  }
  return { status: "sent" };
}

export type ConfirmResult = { status: "confirmed" | "already_confirmed" | "invalid" };

/** Consuma il token (una volta sola) e registra il consenso con la sua versione. */
export async function confirmWaitlist(deps: WaitlistDeps, token: string): Promise<ConfirmResult> {
  const now = deps.now();
  const tokenHash = hashToken(token);
  const [row] = await deps.db
    .select({
      waitlistId: emailActionTokens.waitlistId,
      usedAt: emailActionTokens.usedAt,
      expiresAt: emailActionTokens.expiresAt,
    })
    .from(emailActionTokens)
    .where(
      and(
        eq(emailActionTokens.tokenHash, tokenHash),
        eq(emailActionTokens.action, "waitlist_confirm"),
      ),
    )
    .limit(1);
  if (!row?.waitlistId) return { status: "invalid" };
  if (row.usedAt) return { status: "already_confirmed" };
  if (row.expiresAt.getTime() <= now.getTime()) return { status: "invalid" };
  const waitlistId = row.waitlistId;

  return deps.db.transaction(async (tx) => {
    const [used] = await tx
      .update(emailActionTokens)
      .set({ usedAt: now })
      .where(and(eq(emailActionTokens.tokenHash, tokenHash), isNull(emailActionTokens.usedAt)))
      .returning({ tokenHash: emailActionTokens.tokenHash });
    if (!used) return { status: "already_confirmed" } as const;

    const [confirmed] = await tx
      .update(waitlist)
      .set({ confirmedAt: now })
      .where(and(eq(waitlist.id, waitlistId), isNull(waitlist.confirmedAt)))
      .returning({ id: waitlist.id });
    if (!confirmed) return { status: "already_confirmed" } as const;

    await tx.insert(consents).values([
      { waitlistId, type: "waitlist_launch", version: WAITLIST_CONSENT_VERSION, grantedAt: now },
      { waitlistId, type: "privacy_notice", version: LEGAL_VERSIONS.privacyNotice, grantedAt: now },
    ]);
    return { status: "confirmed" } as const;
  });
}

/**
 * Conservazione (docs/04 §8): iscrizioni non confermate dopo 7 giorni → cancellate (token e consensi se ne
 * vanno con la riga); token di conferma scaduti → cancellati.
 */
export async function deleteUnconfirmedWaitlist(
  deps: Pick<WaitlistDeps, "db" | "now">,
): Promise<number> {
  const now = deps.now();
  const removed = await deps.db
    .delete(waitlist)
    .where(
      and(
        isNull(waitlist.confirmedAt),
        lt(waitlist.createdAt, new Date(now.getTime() - UNCONFIRMED_RETENTION_MS)),
      ),
    )
    .returning({ id: waitlist.id });
  await deps.db
    .delete(emailActionTokens)
    .where(
      and(eq(emailActionTokens.action, "waitlist_confirm"), lt(emailActionTokens.expiresAt, now)),
    );
  return removed.length;
}
