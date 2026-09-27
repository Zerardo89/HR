import { and, asc, count, eq, gt, isNull, ne } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { fillTemplate, messages } from "@/i18n/messages";
import type { KeyProvider } from "@/lib/crypto";
import { auditLog, companies, companyInvites, companyMembers, users } from "@/lib/db/schema";
import { logger } from "@/lib/logger";
import type { Mailer } from "@/lib/mail";
import { hashToken, isTokenShape, newToken } from "@/lib/tokens";
import {
  INVITE_TTL_DAYS,
  inviteExpiresAt,
  inviteState,
  MAX_INVITES_PER_DAY,
  MAX_OPEN_INVITES,
  type InviteInput,
  type InviteState,
} from "../domain";
import { isCompanyOwner } from "./sites";

/*
 * Inviti ai colleghi (WP-011c). L'email dell'invitato serve solo a spedire l'invito: nel DB resta il suo indice
 * cieco, così l'invito si accetta solo con l'account di quell'indirizzo (un link inoltrato non basta).
 */

export type InviteDeps = {
  db: NodePgDatabase;
  keys: KeyProvider;
  mailer: Mailer;
  now: () => Date;
  appUrl: string;
};

export const INVITE_PATH = "/invito";

export function renderInviteEmail(
  companyName: string,
  token: string,
  appUrl: string,
): { subject: string; text: string } {
  const t = messages.emails.companyInvite;
  const values = {
    company: companyName,
    link: `${appUrl}${INVITE_PATH}/${token}`,
    days: String(INVITE_TTL_DAYS),
    siteName: messages.meta.siteName,
    appUrl,
  };
  return {
    subject: fillTemplate(t.subject, values),
    text: [t.intro, t.invite, t.link, t.account, t.ignore, t.signature]
      .map((line) => fillTemplate(line, values))
      .join("\n\n"),
  };
}

export type CreateInviteResult = {
  status:
    "sent" | "not_allowed" | "company_not_verified" | "already_member" | "too_many" | "send_failed";
};

export async function createInvite(
  deps: InviteDeps,
  userId: string,
  input: InviteInput,
): Promise<CreateInviteResult> {
  if (!(await isCompanyOwner(deps.db, userId, input.companyId))) return { status: "not_allowed" };
  const [company] = await deps.db
    .select({ name: companies.displayName, status: companies.status })
    .from(companies)
    .where(eq(companies.id, input.companyId))
    .limit(1);
  if (!company) return { status: "not_allowed" };
  // Le email d'invito portano il nome dell'azienda: solo aziende verificate (niente inviti "civetta").
  if (company.status !== "verified") return { status: "company_not_verified" };
  const now = deps.now();

  const [today] = await deps.db
    .select({ n: count() })
    .from(companyInvites)
    .where(
      and(
        eq(companyInvites.companyId, input.companyId),
        gt(companyInvites.createdAt, new Date(now.getTime() - 24 * 60 * 60_000)),
      ),
    );
  if ((today?.n ?? 0) >= MAX_INVITES_PER_DAY) return { status: "too_many" };
  const emailBidx = await deps.keys.blindIndex(input.email, "email");

  const [member] = await deps.db
    .select({ userId: companyMembers.userId })
    .from(companyMembers)
    .innerJoin(users, eq(users.id, companyMembers.userId))
    .where(and(eq(companyMembers.companyId, input.companyId), eq(users.emailBidx, emailBidx)))
    .limit(1);
  if (member) return { status: "already_member" };

  const open = await deps.db
    .select({ id: companyInvites.id })
    .from(companyInvites)
    .where(
      and(
        eq(companyInvites.companyId, input.companyId),
        isNull(companyInvites.acceptedAt),
        isNull(companyInvites.revokedAt),
        gt(companyInvites.expiresAt, now),
        ne(companyInvites.emailBidx, emailBidx),
      ),
    );
  if (open.length >= MAX_OPEN_INVITES) return { status: "too_many" };

  const token = newToken();
  const inviteId = await deps.db.transaction(async (tx) => {
    // Un nuovo invito alla stessa persona sostituisce quello ancora aperto (il vecchio link non vale più).
    await tx
      .update(companyInvites)
      .set({ revokedAt: now })
      .where(
        and(
          eq(companyInvites.companyId, input.companyId),
          eq(companyInvites.emailBidx, emailBidx),
          isNull(companyInvites.acceptedAt),
          isNull(companyInvites.revokedAt),
        ),
      );
    const [row] = await tx
      .insert(companyInvites)
      .values({
        companyId: input.companyId,
        emailBidx,
        tokenHash: hashToken(token),
        role: "recruiter",
        invitedBy: userId,
        createdAt: now,
        expiresAt: inviteExpiresAt(now),
      })
      .returning({ id: companyInvites.id });
    return row!.id;
  });

  try {
    await deps.mailer.send({
      to: input.email,
      ...renderInviteEmail(company.name, token, deps.appUrl),
    });
  } catch (error) {
    logger.warn({ err: (error as Error).name }, "invito non spedito");
    await deps.db
      .update(companyInvites)
      .set({ revokedAt: now })
      .where(eq(companyInvites.id, inviteId));
    return { status: "send_failed" };
  }
  return { status: "sent" };
}

export type InviteRow = { id: string; createdAt: Date; expiresAt: Date; state: InviteState };

/** Inviti non ancora accettati né revocati (solo date: l'email non si conserva). Solo per il titolare. */
export async function listOpenInvites(
  deps: Pick<InviteDeps, "db" | "now">,
  userId: string,
  companyId: string,
): Promise<InviteRow[] | null> {
  if (!(await isCompanyOwner(deps.db, userId, companyId))) return null;
  const rows = await deps.db
    .select({
      id: companyInvites.id,
      createdAt: companyInvites.createdAt,
      expiresAt: companyInvites.expiresAt,
      acceptedAt: companyInvites.acceptedAt,
      revokedAt: companyInvites.revokedAt,
    })
    .from(companyInvites)
    .where(
      and(
        eq(companyInvites.companyId, companyId),
        isNull(companyInvites.acceptedAt),
        isNull(companyInvites.revokedAt),
      ),
    )
    .orderBy(asc(companyInvites.createdAt));
  const now = deps.now();
  return rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    expiresAt: r.expiresAt,
    state: inviteState(r, now),
  }));
}

export async function revokeInvite(
  deps: Pick<InviteDeps, "db" | "now">,
  userId: string,
  inviteId: string,
): Promise<{ status: "revoked" | "not_found" | "not_allowed" }> {
  const [invite] = await deps.db
    .select({ companyId: companyInvites.companyId })
    .from(companyInvites)
    .where(eq(companyInvites.id, inviteId))
    .limit(1);
  if (!invite) return { status: "not_found" };
  if (!(await isCompanyOwner(deps.db, userId, invite.companyId))) return { status: "not_allowed" };
  const [done] = await deps.db
    .update(companyInvites)
    .set({ revokedAt: deps.now() })
    .where(
      and(
        eq(companyInvites.id, inviteId),
        isNull(companyInvites.acceptedAt),
        isNull(companyInvites.revokedAt),
      ),
    )
    .returning({ id: companyInvites.id });
  return { status: done ? "revoked" : "not_found" };
}

export type InviteView =
  { status: "open"; companyName: string } | { status: "expired" | "used" | "not_found" };

/** Per la pagina dell'invito: nome dell'azienda e stato (nessun dato dell'invitato). */
export async function getInvite(
  deps: Pick<InviteDeps, "db" | "now">,
  token: string,
): Promise<InviteView> {
  if (!isTokenShape(token)) return { status: "not_found" };
  const [row] = await deps.db
    .select({
      companyName: companies.displayName,
      expiresAt: companyInvites.expiresAt,
      acceptedAt: companyInvites.acceptedAt,
      revokedAt: companyInvites.revokedAt,
    })
    .from(companyInvites)
    .innerJoin(companies, eq(companies.id, companyInvites.companyId))
    .where(eq(companyInvites.tokenHash, hashToken(token)))
    .limit(1);
  if (!row) return { status: "not_found" };
  const state = inviteState(row, deps.now());
  if (state === "open") return { status: "open", companyName: row.companyName };
  return { status: state === "expired" ? "expired" : "used" };
}

export type AcceptInviteResult = {
  status:
    | "accepted"
    | "already_member"
    | "wrong_account"
    | "not_company_account"
    | "expired"
    | "used"
    | "not_found";
  companyId?: string;
};

/**
 * Accetta l'invito: solo un account azienda attivo con la stessa email dell'invito (indice cieco).
 * Il collega entra come `recruiter`: gestisce le offerte, non le sedi né gli inviti.
 */
export async function acceptInvite(
  deps: Pick<InviteDeps, "db" | "now">,
  userId: string,
  token: string,
): Promise<AcceptInviteResult> {
  if (!isTokenShape(token)) return { status: "not_found" };
  const now = deps.now();
  const [user] = await deps.db
    .select({ role: users.role, status: users.status, emailBidx: users.emailBidx })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user || user.status !== "active") return { status: "not_found" };

  const [invite] = await deps.db
    .select({
      id: companyInvites.id,
      companyId: companyInvites.companyId,
      emailBidx: companyInvites.emailBidx,
      role: companyInvites.role,
      expiresAt: companyInvites.expiresAt,
      acceptedAt: companyInvites.acceptedAt,
      revokedAt: companyInvites.revokedAt,
    })
    .from(companyInvites)
    .where(eq(companyInvites.tokenHash, hashToken(token)))
    .limit(1);
  if (!invite) return { status: "not_found" };
  const state = inviteState(invite, now);
  if (state === "expired") return { status: "expired" };
  if (state !== "open") return { status: "used" };
  if (user.role !== "company_member") return { status: "not_company_account" };
  if (user.emailBidx !== invite.emailBidx) return { status: "wrong_account" };

  return deps.db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(companyInvites)
      .set({ acceptedAt: now, acceptedBy: userId })
      .where(
        and(
          eq(companyInvites.id, invite.id),
          isNull(companyInvites.acceptedAt),
          isNull(companyInvites.revokedAt),
        ),
      )
      .returning({ id: companyInvites.id });
    if (!claimed) return { status: "used" } as const;
    const [joined] = await tx
      .insert(companyMembers)
      .values({ companyId: invite.companyId, userId, role: invite.role, createdAt: now })
      .onConflictDoNothing()
      .returning({ userId: companyMembers.userId });
    if (!joined) return { status: "already_member", companyId: invite.companyId } as const;
    await tx.insert(auditLog).values({
      actorId: userId,
      action: "company.member_join",
      targetTable: "companies",
      targetId: invite.companyId,
      purpose: invite.role,
      at: now,
    });
    return { status: "accepted", companyId: invite.companyId } as const;
  });
}
