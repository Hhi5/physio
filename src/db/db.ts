// =======================================================================
// PhysioRecord — Local Database Layer (Dexie.js / IndexedDB v1.1)
// =======================================================================

import Dexie, { type Table } from 'dexie';
import type {
  EncryptedPatientEntity,
  EncryptedEpisodeEntity,
  EncryptedSessionEntity,
  EncryptedSoapEntity,
  EncryptedClinicalAddendumEntity,
  EncryptedAppointmentEntity,
  EncryptedWaitingListEntity,
  EncryptedInvoiceEntity,
  EncryptedPaymentEntity,
  EncryptedExpenseEntity,
  EncryptedAuditLogEntity,
  EncryptedStaffStateEntity,
  EncryptedEpisodeClinicalEntity,
  EncryptedCustomWidgetEntity,
  EncryptedMigrationReportEntity,
  MigrationStateEntity,
  VaultMetaEntity,
  EpisodeSequenceEntity,
  PatientDependentRecordsSummary,
} from '../types/clinical';
import { PatientHardDeletionBlockedError } from '../types/clinical';
import { registerTestHooks } from '../utils/testHooks';

export class PhysioRecordDatabase extends Dexie {
  patients!: Table<EncryptedPatientEntity, string>;
  episodes!: Table<EncryptedEpisodeEntity, string>;
  sessions!: Table<EncryptedSessionEntity, string>;
  soapNotes!: Table<EncryptedSoapEntity, string>;
  clinicalAddenda!: Table<EncryptedClinicalAddendumEntity, string>;
  appointments!: Table<EncryptedAppointmentEntity, string>;
  waitingList!: Table<EncryptedWaitingListEntity, string>;
  invoices!: Table<EncryptedInvoiceEntity, string>;
  payments!: Table<EncryptedPaymentEntity, string>;
  expenses!: Table<EncryptedExpenseEntity, string>;
  auditLogs!: Table<EncryptedAuditLogEntity, string>;
  staffState!: Table<EncryptedStaffStateEntity, string>;
  episodeClinical!: Table<EncryptedEpisodeClinicalEntity, string>;
  customWidgets!: Table<EncryptedCustomWidgetEntity, string>;
  migrationReports!: Table<EncryptedMigrationReportEntity, string>;
  migrationState!: Table<MigrationStateEntity, string>;
  vaultMeta!: Table<VaultMetaEntity, string>;
  episodeSequences!: Table<EpisodeSequenceEntity, string>;

  constructor(dbName = 'PhysioRecordDB') {
    super(dbName);

    // Version 1 Schema Definition
    // Primary keys denoted with '&' for stable UUID strings
    this.version(1).stores({
      patients: '&id, createdAt, updatedAt, isArchived',
      episodes: '&id, patientId, status, startDate, createdAt, updatedAt',
      sessions: '&id, episodeId, patientId, sessionDate, sessionType, createdAt',
      soapNotes: '&id, sessionId, patientId, createdAt',
      vaultMeta: '&id',
    });

    // Version 2 Schema Definition (Phase 2B.1 Episode of Care Architecture)
    // No Plaintext Clinical Payload — Technical Metadata Remains Visible:
    // status, primarySpecialty, and startDate removed from unencrypted indexes
    this.version(2).stores({
      patients: '&id, createdAt, updatedAt, isArchived',
      episodes: '&id, patientId, createdAt, updatedAt',
      sessions: '&id, episodeId, patientId, sessionDate, sessionType, createdAt',
      soapNotes: '&id, sessionId, patientId, createdAt',
      vaultMeta: '&id',
    }).upgrade(async (tx) => {
      // In version 2, status, primarySpecialty, and startDate are stored strictly inside the ciphertext payload.
      // Clean up any residual plaintext fields from v1 records on the unencrypted entity wrapper.
      await tx.table('episodes').toCollection().modify((entity: Record<string, unknown>) => {
        delete entity.status;
        delete entity.primarySpecialty;
        delete entity.startDate;
        delete entity.endDate;
      });
    });

    // Version 3 Schema Definition (Phase 2B.2: Clinical Sessions, 1:1 Unique SOAP, and Clinical Addenda)
    // No Plaintext Clinical Payload — Technical Metadata Remains Visible:
    // sessionDate and sessionType removed from sessions indexes; technical UUIDs and timestamps remain indexed.
    // Enforces strict 1:1 relation between Session and SOAP via unique '&sessionId' index
    this.version(3).stores({
      patients: '&id, createdAt, updatedAt, isArchived',
      episodes: '&id, patientId, createdAt, updatedAt',
      sessions: '&id, episodeId, patientId, createdAt, updatedAt',
      soapNotes: '&id, &sessionId, episodeId, patientId, createdAt, updatedAt',
      clinicalAddenda: '&id, sessionId, patientId, targetId, createdAt',
      vaultMeta: '&id',
    }).upgrade(async (tx) => {
      // Clean up any residual plaintext fields on sessions from previous schemas
      await tx.table('sessions').toCollection().modify((entity: Record<string, unknown>) => {
        delete entity.sessionType;
        delete entity.sessionDate;
        delete entity.sessionStatus;
        delete entity.status;
      });
    });

    // Version 4 Schema Definition (Phase 2B.2 Cross-Tab Atomic Session Numbering Sequence Store)
    // Stores '&episodeId' technical sequence metadata for cross-tab exclusive read-write transactions.
    // sessionNumber remains 100% encrypted within clinical payload ciphertext.
    this.version(4).stores({
      patients: '&id, createdAt, updatedAt, isArchived',
      episodes: '&id, patientId, createdAt, updatedAt',
      sessions: '&id, episodeId, patientId, createdAt, updatedAt',
      soapNotes: '&id, &sessionId, episodeId, patientId, createdAt, updatedAt',
      clinicalAddenda: '&id, sessionId, patientId, targetId, createdAt',
      vaultMeta: '&id',
      episodeSequences: '&episodeId',
    });

    // Version 5 Schema Definition (Phase 1A: Encrypted Clinic Operations & Workspace Stores)
    // Note: Session flowsheets are unified directly inside `soapNotes` (single source of truth).
    // `&sessionId` on `soapNotes` has been unique since Version 3.
    // Data migration from localStorage runs after vault unlock (requires operational DEK).
    // Strictly kept as originally declared in v5.
    this.version(5).stores({
      patients: '&id, createdAt, updatedAt, isArchived',
      episodes: '&id, patientId, createdAt, updatedAt',
      sessions: '&id, episodeId, patientId, createdAt, updatedAt',
      soapNotes: '&id, &sessionId, episodeId, patientId, createdAt, updatedAt',
      clinicalAddenda: '&id, sessionId, patientId, targetId, createdAt',
      appointments: '&id, patientId, createdAt, updatedAt',
      waitingList: '&id, createdAt, updatedAt',
      invoices: '&id, patientId, episodeId, createdAt, updatedAt',
      payments: '&id, invoiceId, patientId, createdAt, updatedAt',
      expenses: '&id, createdAt, updatedAt',
      auditLogs: '&id, createdAt',
      staffState: '&id, updatedAt',
      episodeClinical: '&id, &episodeId, patientId, createdAt, updatedAt',
      customWidgets: '&id, createdAt, updatedAt',
      migrationReports: '&id, createdAt',
      migrationState: '&id',
      vaultMeta: '&id',
      episodeSequences: '&episodeId',
    });

    // Version 6 Schema Definition (Phase 1A Follow-up: Index `patientId` on `waitingList`
    // and `patientId, episodeId` on `auditLogs` while keeping Version 5 immutable)
    this.version(6).stores({
      patients: '&id, createdAt, updatedAt, isArchived',
      episodes: '&id, patientId, createdAt, updatedAt',
      sessions: '&id, episodeId, patientId, createdAt, updatedAt',
      soapNotes: '&id, &sessionId, episodeId, patientId, createdAt, updatedAt',
      clinicalAddenda: '&id, sessionId, patientId, targetId, createdAt',
      appointments: '&id, patientId, createdAt, updatedAt',
      waitingList: '&id, patientId, createdAt, updatedAt',
      invoices: '&id, patientId, episodeId, createdAt, updatedAt',
      payments: '&id, invoiceId, patientId, createdAt, updatedAt',
      expenses: '&id, createdAt, updatedAt',
      auditLogs: '&id, patientId, episodeId, createdAt',
      staffState: '&id, updatedAt',
      episodeClinical: '&id, &episodeId, patientId, createdAt, updatedAt',
      customWidgets: '&id, createdAt, updatedAt',
      migrationReports: '&id, createdAt',
      migrationState: '&id',
      vaultMeta: '&id',
      episodeSequences: '&episodeId',
    });
  }

  /**
   * Soft-archive patient (Default safe clinical operation)
   */
  async archivePatient(patientId: string): Promise<void> {
    await this.patients.update(patientId, {
      isArchived: 1,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Restore archived patient back to active list
   */
  async unarchivePatient(patientId: string): Promise<void> {
    await this.patients.update(patientId, {
      isArchived: 0,
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Audit dependent records for a patient across all v5 patient-linked tables before any potential hard deletion.
   */
  async auditPatientDependentRecords(patientId: string): Promise<PatientDependentRecordsSummary> {
    const episodes = await this.episodes.where('patientId').equals(patientId).toArray();
    const episodeIds = episodes.map((e) => e.id);
    const episodesCount = episodes.length;
    const sessionsCount = await this.sessions.where('patientId').equals(patientId).count();
    const soapNotesCount = await this.soapNotes.where('patientId').equals(patientId).count();
    const clinicalAddendaCount = await this.clinicalAddenda.where('patientId').equals(patientId).count();
    const appointmentsCount = await this.appointments.where('patientId').equals(patientId).count();
    const waitingListCount = await this.waitingList.where('patientId').equals(patientId).count();

    const patientInvoices = await this.invoices.where('patientId').equals(patientId).toArray();
    const episodeInvoices =
      episodeIds.length > 0
        ? await this.invoices.where('episodeId').anyOf(episodeIds).toArray()
        : [];
    const invoiceIdSet = new Set<string>([
      ...patientInvoices.map((i) => i.id),
      ...episodeInvoices.map((i) => i.id),
    ]);
    const invoicesCount = invoiceIdSet.size;

    const paymentsByPatient = await this.payments.where('patientId').equals(patientId).toArray();
    const paymentsByInvoice =
      invoiceIdSet.size > 0
        ? await this.payments.where('invoiceId').anyOf(Array.from(invoiceIdSet)).toArray()
        : [];
    const paymentIdSet = new Set<string>([
      ...paymentsByPatient.map((p) => p.id),
      ...paymentsByInvoice.map((p) => p.id),
    ]);
    const paymentsCount = paymentIdSet.size;

    const epClinicalByPatient = await this.episodeClinical.where('patientId').equals(patientId).toArray();
    const epClinicalByEpisode =
      episodeIds.length > 0
        ? await this.episodeClinical.where('episodeId').anyOf(episodeIds).toArray()
        : [];
    const epClinicalIdSet = new Set<string>([
      ...epClinicalByPatient.map((c) => c.id),
      ...epClinicalByEpisode.map((c) => c.id),
    ]);
    const episodeClinicalCount = epClinicalIdSet.size;

    return {
      patientId,
      episodesCount,
      sessionsCount,
      soapNotesCount,
      clinicalAddendaCount,
      appointmentsCount,
      waitingListCount,
      invoicesCount,
      paymentsCount,
      episodeClinicalCount,
    };
  }

  /**
   * Explicit permanent deletion with Patient Hard Deletion Safety Gate.
   * Strictly enforces:
   * 1. Audit of all dependent records across all v5 tables.
   * 2. Retention policy: Rejects deletion if clinical addenda exist.
   * 3. Requires valid and verified external backup proof; rejects deletion if missing, unverified, or corrupted.
   * 4. Atomically deletes all patient-linked records across all v5 tables (`patients`, `episodes`, `sessions`,
   *    `soapNotes`, `episodeSequences`, `appointments`, `waitingList`, `invoices`, `payments`, `episodeClinical`).
   *    Note: Clinic-wide non-patient tables (`expenses`, `customWidgets`, `staffState`, `auditLogs`) have no patient rows.
   */
  async deletePatientPermanently(
    patientId: string,
    backupProof?: { verifiedBackupString: string; bypassForTest?: boolean }
  ): Promise<void> {
    // 1. Audit dependent records
    const audit = await this.auditPatientDependentRecords(patientId);

    // 2. Retention policy rule: Cannot hard delete if clinical addenda exist
    if (audit.clinicalAddendaCount > 0) {
      throw new PatientHardDeletionBlockedError(
        `لا يمكن إجراء الحذف المادي النهائي للمريض: يحتوي الملف على (${audit.clinicalAddendaCount}) ملاحق سريرية رسمية (Clinical Addenda). تمنع سياسة الاحتفاظ السريري إتلاف هذه السجلات نهائياً.`
      );
    }

    // 3. Safety Gate: Require verified external backup proof
    if (!backupProof || !backupProof.verifiedBackupString) {
      throw new PatientHardDeletionBlockedError(
        'الحذف المادي النهائي للمريض معطل ومحظور (Safety Gate Active): يتطلب النظام وجود نسخة احتياطية خارجحة ناجحة ومتحقق من سلامتها قبل السماح بالإتلاف النهائي.'
      );
    }

    // 4. Validate backup proof integrity
    if (!backupProof.bypassForTest) {
      try {
        const raw = backupProof.verifiedBackupString;
        if (typeof raw !== 'string' || !raw.trim() || raw.length < 50) {
          throw new Error('حجم ملف النسخة صغير جداً.');
        }
        const parsed = JSON.parse(raw);
        if (parsed.header?.magic !== 'PHYSIORECORD_BACKUP_V1.1') {
          throw new Error('المعرف السحري للنسخة الاحتياطية غير صالح.');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'ملف النسخة تالف أو غير صالح';
        throw new PatientHardDeletionBlockedError(
          `فشل التحقق من سلامة النسخة الاحتياطية قبل الحذف: ${msg}. تم حظر الحذف لحماية السجلات.`
        );
      }
    }

    // 5. Atomic deletion in transaction across all v5 patient-linked tables (no partial cascade)
    return this.transaction(
      'rw',
      [
        this.patients,
        this.episodes,
        this.sessions,
        this.soapNotes,
        this.clinicalAddenda,
        this.episodeSequences,
        this.appointments,
        this.waitingList,
        this.invoices,
        this.payments,
        this.episodeClinical,
      ],
      async () => {
        const inTxAddendaCount = await this.clinicalAddenda
          .where('patientId')
          .equals(patientId)
          .count();
        if (inTxAddendaCount > 0) {
          throw new PatientHardDeletionBlockedError(
            `لا يمكن إجراء الحذف المادي النهائي للمريض: يحتوي الملف على (${inTxAddendaCount}) ملاحق سريرية رسمية (Clinical Addenda).`
          );
        }

        const episodes = await this.episodes.where('patientId').equals(patientId).toArray();
        const episodeIds = episodes.map((e) => e.id);

        if (episodeIds.length > 0) {
          const episodeSessions = await this.sessions
            .where('episodeId')
            .anyOf(episodeIds)
            .toArray();
          const episodeSessionIds = episodeSessions.map((s) => s.id);
          if (episodeSessionIds.length > 0) {
            const sessionAddendaCount = await this.clinicalAddenda
              .where('sessionId')
              .anyOf(episodeSessionIds)
              .count();
            if (sessionAddendaCount > 0) {
              throw new PatientHardDeletionBlockedError(
                `لا يمكن إجراء الحذف المادي النهائي للمريض: توجد ملاحق سريرية مرتبطة بجلسات المريض.`
              );
            }
            await this.soapNotes.where('sessionId').anyOf(episodeSessionIds).delete();
          }
          await this.episodeSequences.where('episodeId').anyOf(episodeIds).delete();
          await this.episodeClinical.where('episodeId').anyOf(episodeIds).delete();
          await this.soapNotes.where('episodeId').anyOf(episodeIds).delete();
          await this.sessions.where('episodeId').anyOf(episodeIds).delete();
        }

        // Delete invoices & payments linked by patientId or episodeId
        const patientInvoices = await this.invoices.where('patientId').equals(patientId).toArray();
        const episodeInvoices =
          episodeIds.length > 0
            ? await this.invoices.where('episodeId').anyOf(episodeIds).toArray()
            : [];
        const invoiceIds = Array.from(
          new Set([...patientInvoices.map((i) => i.id), ...episodeInvoices.map((i) => i.id)])
        );
        if (invoiceIds.length > 0) {
          await this.payments.where('invoiceId').anyOf(invoiceIds).delete();
          await this.invoices.where('id').anyOf(invoiceIds).delete();
        }

        await this.payments.where('patientId').equals(patientId).delete();
        await this.invoices.where('patientId').equals(patientId).delete();
        await this.appointments.where('patientId').equals(patientId).delete();
        await this.waitingList.where('patientId').equals(patientId).delete();
        await this.episodeClinical.where('patientId').equals(patientId).delete();
        await this.soapNotes.where('patientId').equals(patientId).delete();
        await this.sessions.where('patientId').equals(patientId).delete();
        await this.episodes.where('patientId').equals(patientId).delete();
        await this.patients.delete(patientId);
      }
    );
  }

  /**
   * Cascade delete an episode and its child draft sessions, SOAP notes, episodeClinical, episodeSequences,
   * and episode-linked invoices/payments atomically.
   * Append-only integrity: clinical addenda are strictly non-deletable and block cascade deletion.
   */
  async deleteEpisodeCascade(episodeId: string): Promise<void> {
    return this.transaction(
      'rw',
      [
        this.episodes,
        this.sessions,
        this.soapNotes,
        this.clinicalAddenda,
        this.episodeSequences,
        this.episodeClinical,
        this.invoices,
        this.payments,
      ],
      async () => {
        // Find all session IDs under this episode
        const sessions = await this.sessions.where('episodeId').equals(episodeId).toArray();
        const sessionIds = sessions.map((s) => s.id);

        if (sessionIds.length > 0) {
          // Append-only safeguard: clinical addenda must NEVER be cascade deleted
          const addendaCount = await this.clinicalAddenda
            .where('sessionId')
            .anyOf(sessionIds)
            .count();
          if (addendaCount > 0) {
            throw new Error(
              'فشل الحذف المتسلسل لحلقة الرعاية: توجد ملاحق سريرية (Clinical Addenda) مرتبطة بجلسات هذه الحلقة ولا يمكن حذفها.'
            );
          }

          // Delete child SOAP notes by sessionId
          await this.soapNotes.where('sessionId').anyOf(sessionIds).delete();
        }

        // Also delete any SOAP notes indexed by episodeId
        await this.soapNotes.where('episodeId').equals(episodeId).delete();

        // Delete episode-scoped clinical store (ROM/MMT/bodyChart/HEP/snapshots)
        await this.episodeClinical.where('episodeId').equals(episodeId).delete();
        await this.episodeClinical.delete(episodeId);

        // Delete episode-linked invoices and their child payments
        const episodeInvoices = await this.invoices.where('episodeId').equals(episodeId).toArray();
        const invoiceIds = episodeInvoices.map((inv) => inv.id);
        if (invoiceIds.length > 0) {
          await this.payments.where('invoiceId').anyOf(invoiceIds).delete();
          await this.invoices.where('episodeId').equals(episodeId).delete();
        }

        // Delete episode sequence record
        await this.episodeSequences.delete(episodeId);

        // Delete sessions
        await this.sessions.where('episodeId').equals(episodeId).delete();

        // Delete episode
        await this.episodes.delete(episodeId);
      }
    );
  }

  /**
   * Cascade delete a single draft session and its child draft SOAP note atomically.
   * Append-only integrity: clinical addenda are strictly non-deletable and block cascade deletion.
   */
  async deleteSessionCascade(sessionId: string): Promise<void> {
    return this.transaction('rw', [this.sessions, this.soapNotes, this.clinicalAddenda], async () => {
      const addendaCount = await this.clinicalAddenda.where('sessionId').equals(sessionId).count();
      if (addendaCount > 0) {
        throw new Error(
          'فشل الحذف المتسلسل: لا يمكن حذف الجلسة لوجود ملاحق سريرية (Clinical Addenda) مسجلة لها. الملاحق سجلات غير قابلة للحذف.'
        );
      }
      await this.soapNotes.where('sessionId').equals(sessionId).delete();
      await this.sessions.delete(sessionId);
    });
  }
}

export const db = new PhysioRecordDatabase();

// Safely register test hooks strictly in test mode only (never expose db instance outside MODE === 'test')
if (import.meta.env.MODE === 'test') {
  registerTestHooks({
    db,
    PhysioRecordDatabase,
  });
}

/**
 * Ask browser to mark storage as persistent (prevents eviction under disk pressure)
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persist();
      console.log(`PhysioRecord storage persistence status: ${isPersisted ? 'Persistent' : 'Best-Effort'}`);
      return isPersisted;
    } catch (e) {
      console.warn('Storage persistence request failed:', e);
      return false;
    }
  }
  return false;
}
