import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { KeyProvider } from "@/lib/crypto";
import { auditLog, companies, jobOffers, municipalities, reports, users } from "@/lib/db/schema";
import { logger } from "@/lib/logger";
import type { Mailer } from "@/lib/mail";
import { closeApplicationsForOffers } from "@/modules/applications/jobs";
import { companyMemberEmails, notificationEmail } from "@/modules/privacy/jobs";
import {
  decisionCode,
  renderDecisionForCompany,
  renderReportOutcome,
  renderReportReceived,
  statementOfReasons,
  type RenderedEmail,
  type ReportDecision,
  type ReportInput,
  type ReportReason,
  type ReportTarget,
} from "../domain";

/*
 * Segnalazioni (DSA art. 16) e decisioni motivate (art. 17) — WP-024a.
 * - Si segnala solo ciò che è pubblico; chi segnala resta anonimo per l'azienda.
 * - La decisione la prende una persona (moderatore o admin, controllati anche qui); tutte le segnalazioni aperte
 *   sul bersaglio si chiudono insieme, in una transazione, e finiscono nell'audit.
 * - Le email partono dopo il salvataggio: se l'SMTP non risponde la decisione resta valida.
 */

export type TrustDeps = {
  db: NodePgDatabase;
  keys: KeyProvider;
  mailer: Mailer;
  now: () => Date;
  appUrl: string;
};

async function deliver(deps: TrustDeps, kind: string, to: string | null, email: RenderedEmail) {
  if (!to) return;
  try {
    await deps.mailer.send({ to, ...email });
  } catch (error) {
    logger.warn({ err: (error as Error).name, kind }, "email della segnalazione non spedita");
  }
}

export type SubmitResult = { status: "received" | "not_found" };

/** Segnalazione da un'offerta pubblicata: l'annuncio o l'azienda che lo pubblica. */
export async function submitReport(
  deps: TrustDeps,
  reporterUserId: string | null,
  input: ReportInput,
): Promise<SubmitResult> {
  const now = deps.now();
  const [offer] = await deps.db
    .select({
      id: jobOffers.id,
      title: jobOffers.title,
      companyId: jobOffers.companyId,
      company: companies.displayName,
    })
    .from(jobOffers)
    .innerJoin(companies, eq(companies.id, jobOffers.companyId))
    .where(
      and(
        eq(jobOffers.id, input.offerId),
        eq(jobOffers.status, "published"),
        gt(jobOffers.validThrough, now),
        eq(companies.status, "verified"),
      ),
    )
    .limit(1);
  if (!offer) return { status: "not_found" };
  const targetId = input.targetType === "offer" ? offer.id : offer.companyId;

  if (reporterUserId) {
    // Una sola segnalazione aperta per utente e bersaglio: la seconda non aggiunge nulla (né un'altra email).
    const [already] = await deps.db
      .select({ id: reports.id })
      .from(reports)
      .where(
        and(
          eq(reports.reporterUserId, reporterUserId),
          eq(reports.targetType, input.targetType),
          eq(reports.targetId, targetId),
          eq(reports.status, "open"),
        ),
      )
      .limit(1);
    if (already) return { status: "received" };
  }

  await deps.db.insert(reports).values({
    targetType: input.targetType,
    targetId,
    reason: input.reason,
    details: input.details ?? null,
    reporterUserId,
    createdAt: now,
  });
  if (reporterUserId) {
    await deliver(
      deps,
      "receipt",
      await notificationEmail(deps, reporterUserId, "notification.report").catch(() => null),
      renderReportReceived({
        targetType: input.targetType,
        title: offer.title,
        company: offer.company,
        appUrl: deps.appUrl,
      }),
    );
  }
  return { status: "received" };
}

export type OpenReportGroup = {
  targetType: ReportTarget;
  targetId: string;
  firstAt: Date;
  reasons: { reason: ReportReason; count: number }[];
  details: string[];
  count: number;
  title: string;
  company: string;
  status: string;
  offer?: { description: string; municipality: string };
  companyInfo?: { legalName: string; vatNumber: string; publishedOffers: number };
};

/** Coda del moderatore: segnalazioni aperte raggruppate per bersaglio, da chi aspetta da più tempo. */
export async function listOpenReports(db: NodePgDatabase): Promise<OpenReportGroup[]> {
  const rows = await db
    .select({
      targetType: reports.targetType,
      targetId: reports.targetId,
      reason: reports.reason,
      details: reports.details,
      createdAt: reports.createdAt,
    })
    .from(reports)
    .where(eq(reports.status, "open"))
    .orderBy(asc(reports.createdAt))
    .limit(1000);

  const groups = new Map<string, OpenReportGroup>();
  for (const r of rows) {
    const key = `${r.targetType}:${r.targetId}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        targetType: r.targetType,
        targetId: r.targetId,
        firstAt: r.createdAt,
        reasons: [],
        details: [],
        count: 0,
        title: "",
        company: "",
        status: "",
      };
      groups.set(key, g);
    }
    g.count += 1;
    const reason = g.reasons.find((x) => x.reason === r.reason);
    if (reason) reason.count += 1;
    else g.reasons.push({ reason: r.reason, count: 1 });
    if (r.details) g.details.push(r.details);
  }

  const list = [...groups.values()];
  const offerIds = list.filter((g) => g.targetType === "offer").map((g) => g.targetId);
  const companyIds = list.filter((g) => g.targetType === "company").map((g) => g.targetId);
  const offers = offerIds.length
    ? await db
        .select({
          id: jobOffers.id,
          title: jobOffers.title,
          description: jobOffers.descriptionMd,
          status: jobOffers.status,
          company: companies.displayName,
          municipality: municipalities.name,
        })
        .from(jobOffers)
        .innerJoin(companies, eq(companies.id, jobOffers.companyId))
        .innerJoin(municipalities, eq(municipalities.istatCode, jobOffers.municipalityCode))
        .where(inArray(jobOffers.id, offerIds))
    : [];
  const companyRows = companyIds.length
    ? await db
        .select({
          id: companies.id,
          name: companies.displayName,
          legalName: companies.legalName,
          vatNumber: companies.vatNumber,
          status: companies.status,
          publishedOffers: sql<number>`(select count(*)::int from ${jobOffers}
            where ${jobOffers.companyId} = ${companies.id} and ${jobOffers.status} = 'published')`,
        })
        .from(companies)
        .where(inArray(companies.id, companyIds))
    : [];

  return list.flatMap((g): OpenReportGroup[] => {
    if (g.targetType === "offer") {
      const o = offers.find((x) => x.id === g.targetId);
      if (!o) return [];
      return [
        {
          ...g,
          title: o.title,
          company: o.company,
          status: o.status,
          offer: { description: o.description, municipality: o.municipality },
        },
      ];
    }
    const c = companyRows.find((x) => x.id === g.targetId);
    if (!c) return [];
    return [
      {
        ...g,
        title: c.name,
        company: c.name,
        status: c.status,
        companyInfo: {
          legalName: c.legalName,
          vatNumber: c.vatNumber,
          publishedOffers: c.publishedOffers,
        },
      },
    ];
  });
}

async function isModerator(db: NodePgDatabase, userId: string): Promise<boolean> {
  const [u] = await db
    .select({ role: users.role, status: users.status })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return !!u && u.status === "active" && (u.role === "moderator" || u.role === "admin");
}

export type DecideResult = {
  status: "removed" | "suspended" | "dismissed" | "not_found" | "not_allowed";
};

/** Decisione su tutte le segnalazioni aperte di un bersaglio (annuncio o azienda). */
export async function decideReports(
  deps: TrustDeps,
  moderatorId: string,
  decision: ReportDecision,
): Promise<DecideResult> {
  if (!(await isModerator(deps.db, moderatorId))) return { status: "not_allowed" };
  const now = deps.now();
  const code = decisionCode(decision);

  const outcome = await deps.db.transaction(async (tx) => {
    const open = await tx
      .select({ id: reports.id, reporterUserId: reports.reporterUserId })
      .from(reports)
      .where(
        and(
          eq(reports.targetType, decision.targetType),
          eq(reports.targetId, decision.targetId),
          eq(reports.status, "open"),
        ),
      )
      .for("update");
    if (open.length === 0) return null;

    let subject: { title: string; company: string; companyId: string } | undefined;
    if (decision.targetType === "offer") {
      [subject] = await tx
        .select({
          title: jobOffers.title,
          company: companies.displayName,
          companyId: jobOffers.companyId,
        })
        .from(jobOffers)
        .innerJoin(companies, eq(companies.id, jobOffers.companyId))
        .where(eq(jobOffers.id, decision.targetId))
        .limit(1);
    } else {
      [subject] = await tx
        .select({
          title: companies.displayName,
          company: companies.displayName,
          companyId: companies.id,
        })
        .from(companies)
        .where(eq(companies.id, decision.targetId))
        .limit(1);
    }
    if (!subject) return null;

    let statement: string | null = null;
    if (decision.decision === "act") {
      const removal = sql`${jobOffers.moderation} || ${JSON.stringify({
        removal: { at: now.toISOString(), by: moderatorId, decision: code },
      })}::jsonb`;
      let removedOfferIds: string[];
      if (decision.targetType === "offer") {
        removedOfferIds = (
          await tx
            .update(jobOffers)
            .set({ status: "removed", moderation: removal, updatedAt: now })
            .where(eq(jobOffers.id, decision.targetId))
            .returning({ id: jobOffers.id })
        ).map((r) => r.id);
      } else {
        await tx
          .update(companies)
          .set({ status: "suspended" })
          .where(eq(companies.id, decision.targetId));
        // Le offerte ancora in vista (o in arrivo) si tolgono: i candidati vengono avvisati.
        removedOfferIds = (
          await tx
            .update(jobOffers)
            .set({ status: "removed", moderation: removal, updatedAt: now })
            .where(
              and(
                eq(jobOffers.companyId, decision.targetId),
                inArray(jobOffers.status, ["published", "pending_review"]),
              ),
            )
            .returning({ id: jobOffers.id })
        ).map((r) => r.id);
      }
      await closeApplicationsForOffers(tx, removedOfferIds, now);
      statement = statementOfReasons({
        targetType: decision.targetType,
        title: subject.title,
        company: subject.company,
        ground: decision.ground,
        facts: decision.facts,
        decidedAt: now,
        appUrl: deps.appUrl,
      });
    }

    await tx
      .update(reports)
      .set({
        status: decision.decision === "act" ? "actioned" : "dismissed",
        decision: code,
        statementOfReasons: statement,
        decidedAt: now,
      })
      .where(
        inArray(
          reports.id,
          open.map((r) => r.id),
        ),
      );
    await tx.insert(auditLog).values({
      actorId: moderatorId,
      action: "report.decide",
      targetTable: decision.targetType === "offer" ? "job_offers" : "companies",
      targetId: decision.targetId,
      purpose: code,
      at: now,
    });
    const reporters = [
      ...new Set(open.map((r) => r.reporterUserId).filter((id): id is string => !!id)),
    ];
    return { subject, statement, reporters };
  });
  if (!outcome) return { status: "not_found" };

  const who = {
    targetType: decision.targetType,
    title: outcome.subject.title,
    company: outcome.subject.company,
    appUrl: deps.appUrl,
  };
  if (outcome.statement) {
    const email = renderDecisionForCompany({ ...who, statement: outcome.statement });
    const recipients = await companyMemberEmails(
      deps,
      outcome.subject.companyId,
      "notification.report-decision",
    ).catch(() => []);
    for (const to of recipients) await deliver(deps, "decision", to, email);
  }
  const outcomeEmail = renderReportOutcome(
    decision.decision === "act"
      ? { ...who, decision: "act", ground: decision.ground }
      : { ...who, decision: "dismiss" },
  );
  for (const reporterId of outcome.reporters) {
    const to = await notificationEmail(deps, reporterId, "notification.report").catch(() => null);
    await deliver(deps, "outcome", to, outcomeEmail);
  }

  if (decision.decision === "dismiss") return { status: "dismissed" };
  return { status: decision.targetType === "offer" ? "removed" : "suspended" };
}
