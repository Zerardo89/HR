import { and, eq, gt, isNull } from "drizzle-orm";
import { auditLog, emailActionTokens } from "@/lib/db/schema";
import { logger } from "@/lib/logger";
import { hashToken, isTokenShape, newToken } from "@/lib/tokens";
import { loadCompanyEntitlements } from "@/modules/billing";
import { activeEntitlement } from "@/modules/billing/domain";
import { recordActivity } from "@/modules/identity/jobs";
import { SEARCH_RADII_KM, toSearchParams } from "@/modules/matching/domain";
import { findOffersForProfile } from "@/modules/matching/jobs";
import { notificationEmail } from "@/modules/privacy/jobs";
import { MONTHLY_ANSWERS, shouldPauseMonthlyChecks } from "@/modules/profiles/domain";
import {
  applyMonthlyAnswer,
  dueMonthlyChecks,
  optOutMonthlyChecks,
  pauseMonthlyChecks,
  recordMonthlyCheckSent,
  type DueMonthlyCheck,
} from "@/modules/profiles/jobs";
import {
  MONTHLY_OFFERS,
  MONTHLY_TOKEN_DAYS,
  MONTHLY_WINDOW_DAYS,
  monthlyChoice,
  renderMonthlyCheck,
  renderMonthlyPaused,
  type MonthlyAction,
} from "../domain";
import type { OutcomeDeps } from "./outcomes";

/*
 * Mail mensile per gli "aperti" (WP-021, job `monthly.check` ogni giorno alle 9 ora italiana).
 * - Offerte: mansioni del profilo (o simili) nel raggio; nelle regioni "disposto a trasferirmi" solo quelle di
 *   aziende con il Piano Nazionale (01-PRODOTTO §5.3, ADR-0009).
 * - Prima si spedisce, poi si sposta la data: se l'SMTP non risponde, la mail parte al giro dopo.
 * - Risposte e disiscrizione con il token della mail (nel DB solo l'hash), sempre dopo una conferma (R-MAIL-02),
 *   tranne il POST "un clic" del programma di posta (RFC 8058).
 */

const DAY_MS = 24 * 60 * 60_000;
const CANDIDATES = 200;

export type MonthlySummary = { sent: number; paused: number; failures: number };

function searchRadius(km: number): (typeof SEARCH_RADII_KM)[number] {
  return SEARCH_RADII_KM.find((r) => r >= km) ?? SEARCH_RADII_KM[SEARCH_RADII_KM.length - 1]!;
}

async function offersFor(
  deps: OutcomeDeps,
  profile: DueMonthlyCheck,
  now: Date,
  hasNational: (companyId: string) => Promise<boolean>,
) {
  const candidates = await findOffersForProfile(deps.db, {
    occupationIds: profile.occupations.map((o) => o.id),
    lat: profile.place.lat,
    lon: profile.place.lon,
    radiusKm: profile.radiusKm,
    relocationRegionCodes: profile.relocationRegionCodes,
    publishedSince: new Date(now.getTime() - MONTHLY_WINDOW_DAYS * DAY_MS),
    now,
    limit: CANDIDATES,
  });
  const offers = [];
  for (const c of candidates) {
    if (c.inRadius || (await hasNational(c.companyId))) offers.push(c);
  }
  return offers;
}

export async function sendMonthlyChecks(deps: OutcomeDeps): Promise<MonthlySummary> {
  const now = deps.now();
  const national = new Map<string, boolean>();
  const hasNational = async (companyId: string) => {
    if (!national.has(companyId)) {
      const plan = activeEntitlement(
        await loadCompanyEntitlements(deps.db, companyId),
        "national",
        now,
      );
      national.set(companyId, plan !== null);
    }
    return national.get(companyId)!;
  };

  const summary: MonthlySummary = { sent: 0, paused: 0, failures: 0 };
  for (const profile of await dueMonthlyChecks(deps.db, now)) {
    try {
      if (shouldPauseMonthlyChecks(profile.unansweredChecks)) {
        await pauseMonthlyChecks(deps.db, profile.userId, now);
        summary.paused += 1;
        const to = await notificationEmail(deps, profile.userId, "notification.monthly-check");
        if (to) await deps.mailer.send({ to, ...renderMonthlyPaused({ appUrl: deps.appUrl }) });
        continue;
      }
      const offers = await offersFor(deps, profile, now, hasNational);
      const to = await notificationEmail(deps, profile.userId, "notification.monthly-check");
      if (!to) continue;
      const token = await createMonthlyToken(deps, profile.userId, now);
      const link = (action: MonthlyAction) =>
        `${deps.appUrl}/mensile?token=${token}&scelta=${monthlyChoice(action)}`;
      const place = `${profile.place.name} (${profile.place.provinceAbbr})`;
      const seeAll = toSearchParams({
        q: profile.occupations[0]?.label,
        dove: place,
        radiusKm: searchRadius(profile.radiusKm),
        contractTypes: [],
        schedules: [],
        publishedWithinDays: 30,
        page: 1,
      });
      const email = renderMonthlyCheck({
        appUrl: deps.appUrl,
        place,
        offers: offers.slice(0, MONTHLY_OFFERS),
        total: offers.length,
        seeAllUrl: `${deps.appUrl}/offerte?${seeAll}`,
        links: Object.fromEntries(MONTHLY_ANSWERS.map((a) => [a, link(a)])) as Record<
          (typeof MONTHLY_ANSWERS)[number],
          string
        >,
        unsubscribeUrl: link("stop"),
      });
      await deps.mailer.send({
        to,
        ...email,
        headers: {
          "List-Unsubscribe": `<${deps.appUrl}/api/mensile/disiscrizione?token=${token}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
      await recordMonthlyCheckSent(deps.db, profile.userId, profile.nextCheckAt, now);
      summary.sent += 1;
    } catch (error) {
      summary.failures += 1;
      logger.warn({ err: (error as Error).name }, "mail mensile non spedita");
    }
  }
  return summary;
}

// ─── Token della mail: risposte e disiscrizione ─────────────────────────────────────────────────────

async function createMonthlyToken(deps: OutcomeDeps, userId: string, now: Date): Promise<string> {
  const token = newToken();
  await deps.db.insert(emailActionTokens).values({
    tokenHash: hashToken(token),
    userId,
    action: "monthly_check",
    expiresAt: new Date(now.getTime() + MONTHLY_TOKEN_DAYS * DAY_MS),
    createdAt: now,
  });
  return token;
}

type TokenDeps = Pick<OutcomeDeps, "db" | "now">;

async function findToken(deps: TokenDeps, token: unknown) {
  if (!isTokenShape(token)) return null;
  const [row] = await deps.db
    .select({ userId: emailActionTokens.userId, usedAt: emailActionTokens.usedAt })
    .from(emailActionTokens)
    .where(
      and(
        eq(emailActionTokens.tokenHash, hashToken(token)),
        eq(emailActionTokens.action, "monthly_check"),
        gt(emailActionTokens.expiresAt, deps.now()),
      ),
    )
    .limit(1);
  return row?.userId ? { userId: row.userId, used: row.usedAt !== null } : null;
}

export async function checkMonthlyToken(
  deps: TokenDeps,
  token: unknown,
): Promise<"valid" | "used" | "invalid"> {
  const row = await findToken(deps, token);
  if (!row) return "invalid";
  return row.used ? "used" : "valid";
}

export type MonthlyAnswerResult = { status: "done" | "used" | "invalid" | "no_profile" };

/**
 * Risposta confermata. Una risposta per mail (il token si consuma nella stessa transazione, così due clic
 * simultanei non la applicano due volte); "stop" (disiscrizione) funziona anche dopo aver risposto.
 */
export async function answerMonthlyCheck(
  deps: TokenDeps,
  token: unknown,
  action: MonthlyAction,
): Promise<MonthlyAnswerResult> {
  const row = await findToken(deps, token);
  if (!row || !isTokenShape(token)) return { status: "invalid" };
  const now = deps.now();
  if (action === "stop") {
    await optOutMonthlyChecks(deps.db, row.userId, now);
    await recordActivity(deps.db, row.userId, now);
    await deps.db.insert(auditLog).values({
      actorId: row.userId,
      action: "monthly.stop",
      targetTable: "worker_profiles",
      at: now,
    });
    return { status: "done" };
  }
  return deps.db.transaction(async (tx) => {
    const consumed = await tx
      .update(emailActionTokens)
      .set({ usedAt: now })
      .where(
        and(eq(emailActionTokens.tokenHash, hashToken(token)), isNull(emailActionTokens.usedAt)),
      )
      .returning({ userId: emailActionTokens.userId });
    if (consumed.length === 0) return { status: "used" as const };
    const result = await applyMonthlyAnswer(tx, row.userId, action, now);
    await recordActivity(tx, row.userId, now); // un clic dalla mail è attività (R-PRIV-03)
    await tx.insert(auditLog).values({
      actorId: row.userId,
      action: "monthly.answer",
      targetTable: "worker_profiles",
      purpose: action,
      at: now,
    });
    return result;
  });
}
