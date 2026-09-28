import { randomUUID } from "node:crypto";
import { and, desc, eq, gt } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { fillTemplate, messages } from "@/i18n/messages";
import type { KeyProvider } from "@/lib/crypto";
import {
  applications,
  auditLog,
  companies,
  companyMembers,
  jobOffers,
  municipalities,
  occupations,
  profileLanguages,
  profileOccupations,
  provinces,
  users,
  workerProfiles,
} from "@/lib/db/schema";
import { logger } from "@/lib/logger";
import type { Mailer } from "@/lib/mail";
import {
  companyNotificationEmails,
  companyRecipient,
  readApplicantForCompany,
  sealApplicationMessage,
  type ApplicantView,
} from "@/modules/privacy";
import {
  canCompanySet,
  canWorkerWithdraw,
  visibleToCompany,
  type ApplicationStatus,
  type ApplyInput,
  type CompanyDecision,
} from "../domain";

/*
 * Candidature (WP-019, 03-ARCHITETTURA §6.1). I dati identificativi restano in `modules/privacy`: qui si vedono
 * solo stati, date e dati di ricerca (C1). L'azienda riceve un'email senza dati personali del candidato.
 */

export type ApplicationDeps = {
  db: NodePgDatabase;
  keys: KeyProvider;
  mailer: Mailer;
  now: () => Date;
  appUrl: string;
};

export type ApplyResult =
  | { status: "applied"; applicationId: string }
  | { status: "not_allowed" | "no_profile" | "offer_unavailable" | "already_applied" };

export async function apply(
  deps: ApplicationDeps,
  workerUserId: string,
  input: ApplyInput,
): Promise<ApplyResult> {
  const now = deps.now();
  const [worker] = await deps.db
    .select({ role: users.role, status: users.status, profile: workerProfiles.userId })
    .from(users)
    .leftJoin(workerProfiles, eq(workerProfiles.userId, users.id))
    .where(eq(users.id, workerUserId))
    .limit(1);
  if (!worker || worker.role !== "worker" || worker.status !== "active") {
    return { status: "not_allowed" };
  }
  if (!worker.profile) return { status: "no_profile" };

  const [offer] = await deps.db
    .select({ title: jobOffers.title })
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
  if (!offer) return { status: "offer_unavailable" };

  const [existing] = await deps.db
    .select({ id: applications.id, status: applications.status })
    .from(applications)
    .where(
      and(eq(applications.offerId, input.offerId), eq(applications.workerUserId, workerUserId)),
    )
    .limit(1);
  if (existing && existing.status !== "withdrawn") return { status: "already_applied" };

  // Una candidatura ritirata si può ripresentare: stessa riga, nuovo messaggio.
  const id = existing?.id ?? randomUUID();
  const messageEnc = input.message
    ? await sealApplicationMessage(deps, workerUserId, id, input.message)
    : null;
  const values = {
    status: "sent" as const,
    messageEnc,
    createdAt: now,
    viewedAt: null,
    closedAt: null,
    companyVisibleUntil: null,
  };
  // Due invii quasi simultanei: il secondo non scrive nulla (indice unico offerta+lavoratore, stato ritirato).
  const saved = await deps.db.transaction(async (tx) => {
    const written = existing
      ? await tx
          .update(applications)
          .set(values)
          .where(and(eq(applications.id, id), eq(applications.status, "withdrawn")))
          .returning({ id: applications.id })
      : await tx
          .insert(applications)
          .values({ id, offerId: input.offerId, workerUserId, ...values })
          .onConflictDoNothing()
          .returning({ id: applications.id });
    if (written.length === 0) return false;
    await tx.insert(auditLog).values({
      actorId: workerUserId,
      action: "application.create",
      targetTable: "applications",
      targetId: id,
      at: now,
    });
    return true;
  });
  if (!saved) return { status: "already_applied" };

  await notifyCompany(deps, id, input.offerId, offer.title);
  return { status: "applied", applicationId: id };
}

/** Email ai membri dell'azienda: nessun dato del candidato, solo il titolo dell'offerta e il link. */
async function notifyCompany(
  deps: ApplicationDeps,
  applicationId: string,
  offerId: string,
  title: string,
): Promise<void> {
  const t = messages.emails.newApplication;
  const values = {
    title,
    link: `${deps.appUrl}/azienda/candidature?offerta=${offerId}`,
    siteName: messages.meta.siteName,
    appUrl: deps.appUrl,
  };
  const subject = fillTemplate(t.subject, values);
  const text = [t.intro, t.body, t.privacy, t.signature]
    .map((line) => fillTemplate(line, values))
    .join("\n\n");
  try {
    for (const to of await companyNotificationEmails(deps, applicationId)) {
      await deps.mailer.send({ to, subject, text });
    }
  } catch (error) {
    // La candidatura è salvata: l'azienda la vede comunque nella sua area.
    logger.warn({ err: (error as Error).name }, "avviso di nuova candidatura non spedito");
  }
}

export type MyApplication = {
  id: string;
  offerId: string;
  offerTitle: string;
  companyName: string;
  municipality: string;
  status: ApplicationStatus;
  createdAt: Date;
  viewedAt: Date | null;
};

export async function listMyApplications(
  db: NodePgDatabase,
  workerUserId: string,
): Promise<MyApplication[]> {
  return db
    .select({
      id: applications.id,
      offerId: jobOffers.id,
      offerTitle: jobOffers.title,
      companyName: companies.displayName,
      municipality: municipalities.name,
      status: applications.status,
      createdAt: applications.createdAt,
      viewedAt: applications.viewedAt,
    })
    .from(applications)
    .innerJoin(jobOffers, eq(jobOffers.id, applications.offerId))
    .innerJoin(companies, eq(companies.id, jobOffers.companyId))
    .innerJoin(municipalities, eq(municipalities.istatCode, jobOffers.municipalityCode))
    .where(eq(applications.workerUserId, workerUserId))
    .orderBy(desc(applications.createdAt));
}

/** Candidatura del lavoratore a un'offerta (per la pagina dell'offerta), se c'è e non è ritirata. */
export async function findMyApplication(
  db: NodePgDatabase,
  workerUserId: string,
  offerId: string,
): Promise<{ id: string; status: ApplicationStatus; createdAt: Date } | null> {
  const [row] = await db
    .select({ id: applications.id, status: applications.status, createdAt: applications.createdAt })
    .from(applications)
    .where(and(eq(applications.offerId, offerId), eq(applications.workerUserId, workerUserId)))
    .limit(1);
  return row && row.status !== "withdrawn" ? row : null;
}

export async function withdraw(
  deps: Pick<ApplicationDeps, "db" | "now">,
  workerUserId: string,
  applicationId: string,
): Promise<{ status: "withdrawn" | "not_found" | "not_allowed" }> {
  const [row] = await deps.db
    .select({ status: applications.status })
    .from(applications)
    .where(and(eq(applications.id, applicationId), eq(applications.workerUserId, workerUserId)))
    .limit(1);
  if (!row) return { status: "not_found" };
  if (!canWorkerWithdraw(row.status)) return { status: "not_allowed" };
  const updated = await deps.db
    .update(applications)
    .set({ status: "withdrawn", closedAt: deps.now() })
    .where(and(eq(applications.id, applicationId), eq(applications.status, row.status)))
    .returning({ id: applications.id });
  return { status: updated.length > 0 ? "withdrawn" : "not_allowed" };
}

// ─── Azienda ─────────────────────────────────────────────────────────────────────────────────────────

export type InboxRow = {
  id: string;
  status: ApplicationStatus;
  createdAt: Date;
  viewedAt: Date | null;
  experienceBand: string | null;
  /** Solo la provincia nell'elenco: il comune si vede aprendo la candidatura. */
  provinceAbbr: string | null;
};

/** Candidature di un'offerta, per i membri dell'azienda (`null` se l'utente non ne fa parte). */
export async function listApplicationsForOffer(
  deps: Pick<ApplicationDeps, "db" | "now">,
  userId: string,
  offerId: string,
): Promise<{ offerTitle: string; rows: InboxRow[] } | null> {
  const [offer] = await deps.db
    .select({ title: jobOffers.title })
    .from(jobOffers)
    .innerJoin(
      companyMembers,
      and(eq(companyMembers.companyId, jobOffers.companyId), eq(companyMembers.userId, userId)),
    )
    .where(eq(jobOffers.id, offerId))
    .limit(1);
  if (!offer) return null;
  const rows = await deps.db
    .select({
      id: applications.id,
      status: applications.status,
      createdAt: applications.createdAt,
      viewedAt: applications.viewedAt,
      companyVisibleUntil: applications.companyVisibleUntil,
      experienceBand: workerProfiles.experienceBand,
      provinceAbbr: provinces.abbreviation,
    })
    .from(applications)
    .leftJoin(workerProfiles, eq(workerProfiles.userId, applications.workerUserId))
    .leftJoin(municipalities, eq(municipalities.istatCode, workerProfiles.municipalityCode))
    .leftJoin(provinces, eq(provinces.code, municipalities.provinceCode))
    .where(eq(applications.offerId, offerId))
    .orderBy(desc(applications.createdAt));
  const now = deps.now();
  return {
    offerTitle: offer.title,
    rows: rows
      .filter((r) => visibleToCompany(r, now))
      .map((r) => ({
        id: r.id,
        status: r.status,
        createdAt: r.createdAt,
        viewedAt: r.viewedAt,
        experienceBand: r.experienceBand,
        provinceAbbr: r.provinceAbbr,
      })),
  };
}

export type OpenedApplication = {
  id: string;
  offerId: string;
  offerTitle: string;
  status: ApplicationStatus;
  createdAt: Date;
  profile: {
    place: string | null;
    experienceBand: string | null;
    occupations: string[];
    languages: { code: string; level: string }[];
    drivingLicenses: string[];
    availableFrom: string | null;
  };
  applicant: ApplicantView;
};

/**
 * L'azienda apre la candidatura: `modules/privacy` verifica che sia la destinataria e registra la lettura;
 * la candidatura passa a "vista" (il lavoratore lo vede nelle sue candidature).
 */
export async function openApplication(
  deps: ApplicationDeps,
  userId: string,
  applicationId: string,
): Promise<OpenedApplication | null> {
  const applicant = await readApplicantForCompany(deps, userId, applicationId);
  if (!applicant) return null;
  const now = deps.now();
  await deps.db
    .update(applications)
    .set({ status: "viewed", viewedAt: now })
    .where(and(eq(applications.id, applicationId), eq(applications.status, "sent")));

  const [app] = await deps.db
    .select({
      id: applications.id,
      offerId: jobOffers.id,
      offerTitle: jobOffers.title,
      status: applications.status,
      createdAt: applications.createdAt,
      workerUserId: applications.workerUserId,
      municipality: municipalities.name,
      province: provinces.abbreviation,
      experienceBand: workerProfiles.experienceBand,
      drivingLicenses: workerProfiles.drivingLicenses,
      availableFrom: workerProfiles.availableFrom,
    })
    .from(applications)
    .innerJoin(jobOffers, eq(jobOffers.id, applications.offerId))
    .leftJoin(workerProfiles, eq(workerProfiles.userId, applications.workerUserId))
    .leftJoin(municipalities, eq(municipalities.istatCode, workerProfiles.municipalityCode))
    .leftJoin(provinces, eq(provinces.code, municipalities.provinceCode))
    .where(eq(applications.id, applicationId))
    .limit(1);
  if (!app) return null;
  const [occ, langs] = await Promise.all([
    deps.db
      .select({ label: occupations.labelIt })
      .from(profileOccupations)
      .innerJoin(occupations, eq(occupations.id, profileOccupations.occupationId))
      .where(eq(profileOccupations.userId, app.workerUserId)),
    deps.db
      .select({ code: profileLanguages.languageCode, level: profileLanguages.level })
      .from(profileLanguages)
      .where(eq(profileLanguages.userId, app.workerUserId)),
  ]);
  return {
    id: app.id,
    offerId: app.offerId,
    offerTitle: app.offerTitle,
    status: app.status,
    createdAt: app.createdAt,
    profile: {
      place: app.municipality ? `${app.municipality} (${app.province})` : null,
      experienceBand: app.experienceBand,
      occupations: occ.map((o) => o.label),
      languages: langs,
      drivingLicenses: app.drivingLicenses ?? [],
      availableFrom: app.availableFrom,
    },
    applicant,
  };
}

export async function decideApplication(
  deps: Pick<ApplicationDeps, "db" | "now">,
  userId: string,
  applicationId: string,
  status: CompanyDecision,
): Promise<{ status: "updated" | "not_found" | "not_allowed" }> {
  const app = await companyRecipient(deps, userId, applicationId);
  if (!app) return { status: "not_found" };
  if (!canCompanySet(app.status, status)) return { status: "not_allowed" };
  const now = deps.now();
  // Solo se lo stato non è cambiato nel frattempo (ad esempio ritirata dal lavoratore).
  const updated = await deps.db
    .update(applications)
    .set({
      status,
      closedAt: status === "rejected" || status === "hired" ? now : null,
    })
    .where(and(eq(applications.id, applicationId), eq(applications.status, app.status)))
    .returning({ id: applications.id });
  return { status: updated.length > 0 ? "updated" : "not_allowed" };
}
