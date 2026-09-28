import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  decryptPii,
  dekContextFor,
  encryptJson,
  type AuditSink,
  type PiiLocation,
} from "@/lib/crypto";
import {
  applications,
  companies,
  companyMembers,
  jobOffers,
  users,
  workerProfiles,
} from "@/lib/db/schema";
import { visibleToCompany } from "@/modules/applications/domain";
import { workerPiiSchema, type WorkerPii } from "@/modules/profiles/domain";
import { dbAuditSink } from "./audit";
import type { PrivacyDeps } from "./worker-pii";

/*
 * Dati personali nelle candidature (WP-019, 03-ARCHITETTURA §6.1). L'azienda è il destinatario scelto dal
 * lavoratore: può leggere profilo, email e messaggio SOLO di chi si è candidato a una SUA offerta, finché la
 * candidatura è visibile (R-PRIV-03). Ogni lettura è registrata prima di avvenire (scopo `application.company-view`).
 */

const COMPANY_VIEW = "application.company-view";
const NOTIFY = "notification.new-application";

const messageLocation = (applicationId: string): PiiLocation => ({
  table: "applications",
  column: "message_enc",
  rowId: applicationId,
});

async function workerKey(deps: Pick<PrivacyDeps, "db">, workerUserId: string) {
  const [user] = await deps.db
    .select({ dekWrapped: users.dekWrapped })
    .from(users)
    .where(eq(users.id, workerUserId))
    .limit(1);
  return user?.dekWrapped ?? null;
}

/** Cifra il messaggio della candidatura con la chiave del lavoratore, legato alla riga della candidatura. */
export async function sealApplicationMessage(
  deps: Pick<PrivacyDeps, "db" | "keys">,
  workerUserId: string,
  applicationId: string,
  message: string,
): Promise<string> {
  const dekWrapped = await workerKey(deps, workerUserId);
  if (!dekWrapped) throw new Error("chiave dell'utente non disponibile");
  const dek = await deps.keys.unwrapKey(dekWrapped, dekContextFor("users", workerUserId));
  try {
    return encryptJson(dek, message, messageLocation(applicationId));
  } finally {
    dek.fill(0);
  }
}

/**
 * Autorizzazione dell'azienda: l'attore è un membro attivo (con ruolo azienda) dell'azienda che ha pubblicato
 * l'offerta, l'azienda è verificata (una sospesa non legge più nulla, WP-024a) e la candidatura è ancora
 * visibile. Restituisce i dati della candidatura, altrimenti `null`.
 */
export async function companyRecipient(
  deps: Pick<PrivacyDeps, "db" | "now">,
  actorId: string,
  applicationId: string,
) {
  const [row] = await deps.db
    .select({
      workerUserId: applications.workerUserId,
      status: applications.status,
      companyVisibleUntil: applications.companyVisibleUntil,
      messageEnc: applications.messageEnc,
      companyId: jobOffers.companyId,
    })
    .from(applications)
    .innerJoin(jobOffers, eq(jobOffers.id, applications.offerId))
    .innerJoin(
      companyMembers,
      and(eq(companyMembers.companyId, jobOffers.companyId), eq(companyMembers.userId, actorId)),
    )
    .innerJoin(users, eq(users.id, companyMembers.userId))
    .innerJoin(companies, eq(companies.id, jobOffers.companyId))
    .where(
      and(
        eq(applications.id, applicationId),
        eq(users.status, "active"),
        eq(users.role, "company_member"),
        eq(companies.status, "verified"),
      ),
    )
    .limit(1);
  if (!row || !visibleToCompany(row, deps.now())) return null;
  return row;
}

export type ApplicantView = { pii: WorkerPii | null; email: string | null; message: string | null };

/** Dati del candidato per l'azienda destinataria (`null` = non autorizzato o non più visibile). */
export async function readApplicantForCompany(
  deps: PrivacyDeps,
  actorId: string,
  applicationId: string,
): Promise<ApplicantView | null> {
  const app = await companyRecipient(deps, actorId, applicationId);
  if (!app) return null;
  const [worker] = await deps.db
    .select({
      dekWrapped: users.dekWrapped,
      emailEnc: users.emailEnc,
      piiEnc: workerProfiles.piiEnc,
    })
    .from(users)
    .leftJoin(workerProfiles, eq(workerProfiles.userId, users.id))
    .where(eq(users.id, app.workerUserId))
    .limit(1);
  // Chiave distrutta (account cancellato): non resta nulla da leggere.
  if (!worker?.dekWrapped) return { pii: null, email: null, message: null };

  const audit = dbAuditSink(deps.db, deps.now);
  const common = {
    provider: deps.keys,
    audit,
    actorId,
    purpose: COMPANY_VIEW,
    dekWrapped: worker.dekWrapped,
    dekContext: dekContextFor("users", app.workerUserId),
  };
  const pii = worker.piiEnc
    ? await decryptPii({
        ...common,
        token: worker.piiEnc,
        location: { table: "worker_profiles", column: "pii_enc", rowId: app.workerUserId },
        schema: workerPiiSchema,
      })
    : null;
  const email = await decryptPii({
    ...common,
    token: worker.emailEnc,
    location: { table: "users", column: "email_enc", rowId: app.workerUserId },
    schema: z.string(),
  });
  const message = app.messageEnc
    ? await decryptPii({
        ...common,
        token: app.messageEnc,
        location: messageLocation(applicationId),
        schema: z.string(),
      })
    : null;
  return { pii, email, message };
}

/**
 * Indirizzi dei membri attivi dell'azienda che ha ricevuto la candidatura, per avvisarli (email senza dati
 * personali del candidato). Lettura registrata come `system:notify`.
 */
export async function companyNotificationEmails(
  deps: PrivacyDeps,
  applicationId: string,
  audit: AuditSink = dbAuditSink(deps.db, deps.now),
): Promise<string[]> {
  const members = await deps.db
    .select({
      userId: users.id,
      dekWrapped: users.dekWrapped,
      emailEnc: users.emailEnc,
    })
    .from(applications)
    .innerJoin(jobOffers, eq(jobOffers.id, applications.offerId))
    .innerJoin(companyMembers, eq(companyMembers.companyId, jobOffers.companyId))
    .innerJoin(users, eq(users.id, companyMembers.userId))
    .innerJoin(companies, eq(companies.id, jobOffers.companyId))
    .where(
      and(
        eq(applications.id, applicationId),
        eq(users.status, "active"),
        eq(users.role, "company_member"),
        eq(companies.status, "verified"),
      ),
    );
  const emails: string[] = [];
  for (const m of members) {
    if (!m.dekWrapped) continue;
    emails.push(
      await decryptPii({
        provider: deps.keys,
        audit,
        actorId: "system:notify",
        purpose: NOTIFY,
        dekWrapped: m.dekWrapped,
        dekContext: dekContextFor("users", m.userId),
        token: m.emailEnc,
        location: { table: "users", column: "email_enc", rowId: m.userId },
        schema: z.string(),
      }),
    );
  }
  return emails;
}
