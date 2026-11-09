// =======================================================================
// PhysioRecord — Phase 1A-ii-a: Non-Destructive localStorage -> Encrypted Dexie Migration Engine
// - Uses `navigator.locks` (with in-process mutex fallback) for cross-tab mutual exclusion.
// - Tracks resumable per-key progress in `db.migrationState` (`id: 'localStorage_v5_migration'`).
// - Computes all WebCrypto operations BEFORE opening Dexie transactions.
// - Writes encrypted records to Dexie, then verifies every record by decrypt + canonical deep-equal.
// - Supports `dryRun: true` mode that only reports what would be migrated without writing.
// - Reports corrupt keys, pre-session pain conflicts, and orphan flowsheets in `db.migrationReports`.
// - Phase 1A-ii-a rule: NEVER deletes any `localStorage` key.
// =======================================================================

import { db as defaultDb, type PhysioRecordDatabase } from '../db/db';
import {
  encryptRecordWithMandatoryReservation,
  decryptRecordPayload,
  getDekGeneration,
  CURRENT_DEK_VERSION,
  CURRENT_RECORD_CRYPTO_VERSION,
} from '../crypto/vault';
import {
  UnboundVaultKeyError,
  CURRENT_SOAP_SCHEMA_VERSION,
  type EncryptedAppointmentEntity,
  type EncryptedWaitingListEntity,
  type EncryptedInvoiceEntity,
  type EncryptedPaymentEntity,
  type EncryptedExpenseEntity,
  type EncryptedAuditLogEntity,
  type EncryptedStaffStateEntity,
  type EncryptedEpisodeClinicalEntity,
  type EncryptedCustomWidgetEntity,
  type EncryptedSoapEntity,
  type EncryptedMigrationReportEntity,
  type MigrationReportPayload,
  type MigrationPainConflictRecord,
  type MigrationOrphanFlowsheetRecord,
  type MigrationCorruptKeyRecord,
  type SoapNoteData,
  type SoapFlowsheetData,
  type PatientClinicalData,
} from '../types/clinical';
import type {
  ClinicAppointment,
  WaitingListEntry,
  FinancialInvoiceIQD,
  PaymentTransactionIQD,
  ClinicExpenseIQD,
  AuditLogEntry,
  EpisodeScopedClinicalStore,
  SessionFlowsheetData,
} from '../types/clinicManagement';
import { canonicalizeForSeal } from './sessionService';
import { assertAppendOnlySnapshots } from './clinicOperationsService';

export const LOCALSTORAGE_MIGRATION_STATE_ID = 'localStorage_v5_migration';
export const LOCALSTORAGE_MIGRATION_LOCK_NAME = 'physiorecord_v5_localstorage_migration';

const NON_CLINICAL_SKIPPED_KEYS = new Set<string>([
  'physiorecord_language',
  'physiorecord_clinical_theme',
  'physiorecord_pre_restore_safety_backup',
]);

const KNOWN_KEY_NAMES = {
  ACTIVE_STAFF_ID: 'physiorecord_active_staff_v2',
  AUDIT_LOGS: 'physiorecord_audit_logs_v2',
  APPOINTMENTS: 'physiorecord_appointments_v2',
  WAITING_LIST: 'physiorecord_waiting_list_v2',
  INVOICES_IQD: 'physiorecord_invoices_iqd_v2',
  EXPENSES_IQD: 'physiorecord_expenses_iqd_v2',
  CUSTOM_WIDGETS: 'physiorecord_custom_widgets',
  EPISODE_STORE_PREFIX: 'physiorecord_episode_clinical_v2_',
  SESSION_FLOWSHEET_PREFIX: 'physiorecord_session_flowsheet_v2_',
  SESSION_FLOWSHEET_LATEST_PREFIX: 'physiorecord_session_flowsheet_v2_latest_ep_',
  SESSION_SOAP_LEGACY_PREFIX: 'physiorecord_session_soap_v2_',
  PATIENT_WIDGETS_LEGACY_PREFIX: 'physiorecord_patient_widgets_',
  ORGANUI_MEDS_PREFIX: 'physiorecord_organui_meds_',
};

export interface StorageLike {
  length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem?(key: string, value: string): void;
  removeItem?(key: string): void;
}

export interface LocalStorageMigrationOptions {
  dryRun?: boolean;
  storage?: StorageLike;
  /**
   * Optional test hook to simulate an interrupted migration after `interruptAfterKeys` keys have been committed.
   */
  interruptAfterKeys?: number;
  /**
   * Optional callback invoked before each key is committed in live mode.
   */
  onBeforeKeyCommit?: (key: string, committedSoFar: number) => Promise<void> | void;
}

export interface LocalStorageMigrationResult {
  status: 'completed' | 'partial_with_errors' | 'interrupted' | 'dry_run';
  alreadyCompleted?: boolean;
  report: MigrationReportPayload;
}

// In-process FIFO mutex used alongside navigator.locks so concurrent calls in Node/Vitest or same tab serialize cleanly
let inProcessLockPromise: Promise<unknown> = Promise.resolve();

async function withMigrationLock<T>(fn: () => Promise<T>): Promise<T> {
  const runInProcess = async (): Promise<T> => {
    const prev = inProcessLockPromise;
    let release!: () => void;
    inProcessLockPromise = new Promise<void>((resolve) => {
      release = resolve;
    });
    await prev.catch(() => undefined);
    try {
      return await fn();
    } finally {
      release();
    }
  };

  if (
    typeof navigator !== 'undefined' &&
    navigator.locks &&
    typeof navigator.locks.request === 'function'
  ) {
    return await navigator.locks.request(
      LOCALSTORAGE_MIGRATION_LOCK_NAME,
      { mode: 'exclusive' },
      async () => await runInProcess()
    );
  }

  return await runInProcess();
}

async function computeSha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function resolveDefaultStorage(explicitStorage?: StorageLike): StorageLike | null {
  if (explicitStorage) return explicitStorage;
  if (typeof globalThis !== 'undefined' && 'localStorage' in globalThis && globalThis.localStorage) {
    const ls = globalThis.localStorage as Partial<StorageLike> & Record<string, unknown>;
    if (typeof ls.getItem === 'function') {
      if (typeof ls.length === 'number' && typeof ls.key === 'function') {
        return ls as StorageLike;
      }
      // Fallback wrapper for simplified mock localStorage objects in unit tests
      const ownKeys = Object.keys(ls).filter(
        (k) => !['getItem', 'setItem', 'removeItem', 'clear', 'key', 'length'].includes(k)
      );
      return {
        get length() {
          return ownKeys.length;
        },
        key(index: number) {
          return ownKeys[index] ?? null;
        },
        getItem(k: string) {
          return ls.getItem!(k);
        },
      };
    }
  }
  return null;
}

function collectPhysioRecordKeys(storage: StorageLike): Array<{ key: string; rawValue: string }> {
  const keys = new Set<string>();
  if (typeof storage.length === 'number' && typeof storage.key === 'function') {
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k && k.startsWith('physiorecord_')) {
        keys.add(k);
      }
    }
  }
  // Also probe well-known static keys in case a test double only implements `getItem`
  for (const staticKey of [
    KNOWN_KEY_NAMES.ACTIVE_STAFF_ID,
    KNOWN_KEY_NAMES.AUDIT_LOGS,
    KNOWN_KEY_NAMES.APPOINTMENTS,
    KNOWN_KEY_NAMES.WAITING_LIST,
    KNOWN_KEY_NAMES.INVOICES_IQD,
    KNOWN_KEY_NAMES.EXPENSES_IQD,
    KNOWN_KEY_NAMES.CUSTOM_WIDGETS,
    ... NON_CLINICAL_SKIPPED_KEYS,
  ]) {
    const val = storage.getItem(staticKey);
    if (val !== null && val !== undefined) {
      keys.add(staticKey);
    }
  }

  const sortedKeys = Array.from(keys).sort();
  const entries: Array<{ key: string; rawValue: string }> = [];
  for (const k of sortedKeys) {
    const rawValue = storage.getItem(k);
    if (typeof rawValue === 'string') {
      entries.push({ key: k, rawValue });
    }
  }
  return entries;
}

/**
 * Scrubs embedded patient names from legacy audit log summaries while preserving
 * the clinical/financial event description and linking `patientId` / `episodeId`.
 */
export function sanitizeAuditLogEntryForMigration(
  entry: AuditLogEntry,
  knownPatientNames: string[],
  entityLookup: {
    invoiceToPatientEpisode: Map<string, { patientId: string; episodeId?: string }>;
    appointmentToPatientEpisode: Map<string, { patientId: string; episodeId?: string }>;
    sessionToPatientEpisode: Map<string, { patientId: string; episodeId: string }>;
    episodeToPatient: Map<string, string>;
  }
): AuditLogEntry {
  let patientId = entry.patientId;
  let episodeId = entry.episodeId;

  if (entry.entityType === 'patient' && entry.entityId) {
    patientId = patientId || entry.entityId;
  } else if (entry.entityType === 'episode' && entry.entityId) {
    episodeId = episodeId || entry.entityId;
    patientId = patientId || entityLookup.episodeToPatient.get(entry.entityId);
  } else if (entry.entityType === 'session' && entry.entityId) {
    const sessRef = entityLookup.sessionToPatientEpisode.get(entry.entityId);
    if (sessRef) {
      patientId = patientId || sessRef.patientId;
      episodeId = episodeId || sessRef.episodeId;
    }
  } else if (entry.entityType === 'invoice' && entry.entityId) {
    const invRef = entityLookup.invoiceToPatientEpisode.get(entry.entityId);
    if (invRef) {
      patientId = patientId || invRef.patientId;
      episodeId = episodeId || invRef.episodeId;
    }
  } else if (entry.entityType === 'appointment' && entry.entityId) {
    const apptRef = entityLookup.appointmentToPatientEpisode.get(entry.entityId);
    if (apptRef) {
      patientId = patientId || apptRef.patientId;
      episodeId = episodeId || apptRef.episodeId;
    }
  }

  let summaryAr = entry.summaryAr || '';
  let summaryEn = entry.summaryEn || '';

  // Scrub known patient names
  for (const name of knownPatientNames) {
    const trimmed = name.trim();
    if (trimmed.length >= 2) {
      summaryAr = summaryAr.split(trimmed).join('[مريض مرجعي]');
      summaryEn = summaryEn.split(trimmed).join('[Referenced Patient]');
    }
  }

  // Scrub common legacy phrasing patterns that embedded patient names
  summaryAr = summaryAr
    .replace(/للمريض\s+[^(\n]+?(?=\s+بصافي|\s*\(|$)/g, 'للمريض [مريض مرجعي]')
    .replace(/من المريض\s+[^(\n]+?(?=\s*\(|$)/g, 'من المريض [مريض مرجعي]')
    .replace(/ملف المريض:\s*.+$/g, `ملف المريض (#${(patientId || entry.entityId || '').slice(0, 8)})`);

  summaryEn = summaryEn
    .replace(/\bfor\s+[^(\n]+?(?=\s*\(|$)/gi, 'for [Referenced Patient]')
    .replace(/\bfrom\s+[^(\n]+?(?=\s*\(|$)/gi, 'from [Referenced Patient]')
    .replace(/patient record:\s*.+$/gi, `patient record (#${(patientId || entry.entityId || '').slice(0, 8)})`);

  return {
    ...entry,
    ...(patientId ? { patientId } : {}),
    ...(episodeId ? { episodeId } : {}),
    summaryAr,
    summaryEn,
  };
}

interface StagedVerificationRecord {
  tableName: string;
  id: string;
  parentIds: string[];
  entity: Record<string, unknown>;
  expectedPlaintext: unknown;
}

async function verifyWrittenRecordInDexie(
  database: PhysioRecordDatabase,
  dek: CryptoKey,
  item: StagedVerificationRecord
): Promise<void> {
  const table = database.table<Record<string, unknown>, string>(item.tableName);
  const stored = await table.get(item.id);
  if (!stored) {
    throw new Error(
      `فشل التحقق بعد الترحيل: السجل "${item.id}" غير موجود في جدول "${item.tableName}".`
    );
  }
  const decrypted = await decryptRecordPayload(
    dek,
    item.tableName,
    item.id,
    item.parentIds,
    stored.iv as Uint8Array,
    stored.ciphertext as Uint8Array,
    Number(stored.recordCryptoVersion) || CURRENT_RECORD_CRYPTO_VERSION,
    Number(stored.dekVersion) || CURRENT_DEK_VERSION
  );
  if (canonicalizeForSeal(decrypted) !== canonicalizeForSeal(item.expectedPlaintext)) {
    throw new Error(
      `فشل التحقق التشفيري العميق (decrypt + deep-equal) للسجل "${item.id}" في جدول "${item.tableName}".`
    );
  }
}

export class LocalStorageMigrationService {
  /**
   * Run Phase 1A-ii-a non-destructive migration from `localStorage` into encrypted Dexie tables.
   * - Acquires `navigator.locks` (`physiorecord_v5_localstorage_migration`) + in-process mutex.
   * - Tracks per-key completion hashes in `db.migrationState` (`localStorage_v5_migration`).
   * - Encrypts BEFORE opening Dexie transactions, commits, and verifies by decrypt + deep-equal.
   * - Never deletes any `localStorage` key in Phase 1A-ii-a.
   */
  static async runMigration(
    dek: CryptoKey,
    database: PhysioRecordDatabase = defaultDb,
    options: LocalStorageMigrationOptions = {}
  ): Promise<LocalStorageMigrationResult> {
    return await withMigrationLock(async () => {
      const expectedGen = getDekGeneration(dek);
      if (expectedGen === undefined) {
        throw new UnboundVaultKeyError(
          'تم رفض ترحيل البيانات: مفتاح التشفير التشغيلي (DEK) غير مرتبط بأي جيل خزينة معتمد.'
        );
      }

      const dryRun = Boolean(options.dryRun);
      const now = new Date().toISOString();
      const reportId = `migration_report_v5_gen_${expectedGen}`;

      const countsByTable: Record<string, number> = {
        staffState: 0,
        appointments: 0,
        waitingList: 0,
        invoices: 0,
        payments: 0,
        expenses: 0,
        auditLogs: 0,
        customWidgets: 0,
        episodeClinical: 0,
        soapNotes: 0,
      };
      const migratedKeys: string[] = [];
      const skippedAlreadyCompletedKeys: string[] = [];
      const skippedNonClinicalKeys: string[] = [];
      const painConflicts: MigrationPainConflictRecord[] = [];
      const orphanFlowsheets: MigrationOrphanFlowsheetRecord[] = [];
      const corruptKeys: MigrationCorruptKeyRecord[] = [];

      const storage = resolveDefaultStorage(options.storage);
      if (!storage) {
        const emptyReport: MigrationReportPayload = {
          id: reportId,
          createdAt: now,
          vaultGeneration: expectedGen,
          dryRun,
          migratedKeys,
          skippedAlreadyCompletedKeys,
          skippedNonClinicalKeys,
          countsByTable,
          painConflicts,
          orphanFlowsheets,
          corruptKeys,
        };
        return {
          status: dryRun ? 'dry_run' : 'completed',
          report: emptyReport,
        };
      }

      const allEntries = collectPhysioRecordKeys(storage);

      const existingState = await database.migrationState.get(LOCALSTORAGE_MIGRATION_STATE_ID);
      const completedKeyHashSet = new Set<string>(
        existingState && existingState.vaultGeneration === expectedGen
          ? existingState.completedKeyHashes || []
          : []
      );

      // Build reference lookup maps for audit log patient-name scrubbing and patientId/episodeId resolution
      const knownPatientNames: string[] = [];
      const invoiceToPatientEpisode = new Map<string, { patientId: string; episodeId?: string }>();
      const appointmentToPatientEpisode = new Map<string, { patientId: string; episodeId?: string }>();
      const sessionToPatientEpisode = new Map<string, { patientId: string; episodeId: string }>();
      const episodeToPatient = new Map<string, string>();

      const allPatientsInDb = await database.patients.toArray();
      for (const pEntity of allPatientsInDb) {
        try {
          const pData = await decryptRecordPayload<PatientClinicalData>(
            dek,
            'patients',
            pEntity.id,
            [],
            pEntity.iv,
            pEntity.ciphertext,
            pEntity.recordCryptoVersion || CURRENT_RECORD_CRYPTO_VERSION,
            pEntity.dekVersion || CURRENT_DEK_VERSION
          );
          if (pData.fullName) knownPatientNames.push(pData.fullName);
        } catch {
          // ignore
        }
      }

      const allEpisodesInDb = await database.episodes.toArray();
      for (const epEntity of allEpisodesInDb) {
        episodeToPatient.set(epEntity.id, epEntity.patientId);
      }

      const allSessionsInDb = await database.sessions.toArray();
      for (const sEntity of allSessionsInDb) {
        sessionToPatientEpisode.set(sEntity.id, {
          patientId: sEntity.patientId,
          episodeId: sEntity.episodeId,
        });
      }

      // Pre-scan invoices & appointments in localStorage to enrich knownPatientNames and entity lookup
      for (const entry of allEntries) {
        if (entry.key === KNOWN_KEY_NAMES.INVOICES_IQD) {
          try {
            const parsed = JSON.parse(entry.rawValue);
            if (Array.isArray(parsed)) {
              for (const inv of parsed as FinancialInvoiceIQD[]) {
                if (inv && typeof inv.id === 'string' && typeof inv.patientId === 'string') {
                  invoiceToPatientEpisode.set(inv.id, {
                    patientId: inv.patientId,
                    episodeId: inv.episodeId,
                  });
                }
                if (inv && typeof inv.patientName === 'string') {
                  knownPatientNames.push(inv.patientName);
                }
              }
            }
          } catch {
            // handled in main loop
          }
        } else if (entry.key === KNOWN_KEY_NAMES.APPOINTMENTS) {
          try {
            const parsed = JSON.parse(entry.rawValue);
            if (Array.isArray(parsed)) {
              for (const appt of parsed as ClinicAppointment[]) {
                if (appt && typeof appt.id === 'string' && typeof appt.patientId === 'string') {
                  appointmentToPatientEpisode.set(appt.id, {
                    patientId: appt.patientId,
                    episodeId: appt.episodeId,
                  });
                }
                if (appt && typeof appt.patientName === 'string') {
                  knownPatientNames.push(appt.patientName);
                }
              }
            }
          } catch {
            // handled in main loop
          }
        } else if (entry.key === KNOWN_KEY_NAMES.WAITING_LIST) {
          try {
            const parsed = JSON.parse(entry.rawValue);
            if (Array.isArray(parsed)) {
              for (const w of parsed as WaitingListEntry[]) {
                if (w && typeof w.patientName === 'string') {
                  knownPatientNames.push(w.patientName);
                }
              }
            }
          } catch {
            // handled in main loop
          }
        }
      }

      const meta = await database.vaultMeta.get('auth');
      const activeDekVersion = meta?.dekVersion || CURRENT_DEK_VERSION;

      if (!dryRun) {
        await database.migrationState.put({
          id: LOCALSTORAGE_MIGRATION_STATE_ID,
          status: 'in_progress',
          vaultGeneration: expectedGen,
          completedKeyHashes: Array.from(completedKeyHashSet),
          failedKeyCount: 0,
          repairedSoapNotesCount: existingState?.repairedSoapNotesCount || 0,
          conflictCount: 0,
          orphanFlowsheetCount: 0,
          updatedAt: now,
        });
      }

      let keysCommittedInThisRun = 0;
      let wasInterrupted = false;

      for (const { key, rawValue } of allEntries) {
        // 1. Check non-clinical / transient cache keys
        if (
          NON_CLINICAL_SKIPPED_KEYS.has(key) ||
          key.startsWith(KNOWN_KEY_NAMES.SESSION_FLOWSHEET_LATEST_PREFIX)
        ) {
          skippedNonClinicalKeys.push(key);
          continue;
        }

        const keyValueHash = await computeSha256Hex(`${key}:${rawValue}`);
        if (!dryRun && completedKeyHashSet.has(keyValueHash)) {
          skippedAlreadyCompletedKeys.push(key);
          continue;
        }

        if (
          !dryRun &&
          options.interruptAfterKeys !== undefined &&
          keysCommittedInThisRun >= options.interruptAfterKeys
        ) {
          wasInterrupted = true;
          break;
        }

        if (!dryRun && options.onBeforeKeyCommit) {
          await options.onBeforeKeyCommit(key, keysCommittedInThisRun);
        }

        // 2. Classify & stage records for this key
        const stagedForThisKey: StagedVerificationRecord[] = [];
        let keyPainConflicts: MigrationPainConflictRecord[] = [];
        let keyOrphanFlowsheets: MigrationOrphanFlowsheetRecord[] = [];
        let episodeClinicalToSaveViaGuard: EpisodeScopedClinicalStore | null = null;

        try {
          if (key === KNOWN_KEY_NAMES.ACTIVE_STAFF_ID) {
            const staffId = rawValue.trim();
            if (!staffId) {
              throw new Error('معرّف الموظف النشط فارغ.');
            }
            const payload = { activeStaffId: staffId, updatedAt: now };
            if (dryRun) {
              countsByTable.staffState += 1;
              migratedKeys.push(key);
              continue;
            }
            const { iv, ciphertext } = await encryptRecordWithMandatoryReservation(
              database,
              dek,
              'staffState',
              'active_staff',
              [],
              payload,
              CURRENT_RECORD_CRYPTO_VERSION,
              activeDekVersion,
              expectedGen
            );
            const entity: EncryptedStaffStateEntity = {
              id: 'active_staff',
              updatedAt: now,
              recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
              dekVersion: activeDekVersion,
              iv,
              ciphertext,
            };
            stagedForThisKey.push({
              tableName: 'staffState',
              id: 'active_staff',
              parentIds: [],
              entity: entity as unknown as Record<string, unknown>,
              expectedPlaintext: payload,
            });
          } else if (key === KNOWN_KEY_NAMES.APPOINTMENTS) {
            const parsed = JSON.parse(rawValue);
            if (!Array.isArray(parsed)) {
              throw new Error('بنية جدول المواعيد غير صالحة (ليست مصفوفة).');
            }
            for (const item of parsed as ClinicAppointment[]) {
              if (!item || typeof item.id !== 'string' || !item.id.trim()) {
                throw new Error('عنصر موعد يفتقر إلى معرّف صالح.');
              }
              if (typeof item.patientId !== 'string' || !item.patientId.trim()) {
                throw new Error(`الموعد "${item.id}" يفتقر إلى patientId صالح.`);
              }
              if (dryRun) {
                countsByTable.appointments += 1;
                continue;
              }
              const { iv, ciphertext } = await encryptRecordWithMandatoryReservation(
                database,
                dek,
                'appointments',
                item.id,
                [],
                item,
                CURRENT_RECORD_CRYPTO_VERSION,
                activeDekVersion,
                expectedGen
              );
              const entity: EncryptedAppointmentEntity = {
                id: item.id,
                patientId: item.patientId,
                createdAt: now,
                updatedAt: now,
                recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
                dekVersion: activeDekVersion,
                iv,
                ciphertext,
              };
              stagedForThisKey.push({
                tableName: 'appointments',
                id: item.id,
                parentIds: [],
                entity: entity as unknown as Record<string, unknown>,
                expectedPlaintext: item,
              });
            }
            if (dryRun) {
              migratedKeys.push(key);
              continue;
            }
          } else if (key === KNOWN_KEY_NAMES.WAITING_LIST) {
            const parsed = JSON.parse(rawValue);
            if (!Array.isArray(parsed)) {
              throw new Error('بنية قائمة الانتظار غير صالحة (ليست مصفوفة).');
            }
            for (const item of parsed as WaitingListEntry[]) {
              if (!item || typeof item.id !== 'string' || !item.id.trim()) {
                throw new Error('عنصر قائمة انتظار يفتقر إلى معرّف صالح.');
              }
              if (dryRun) {
                countsByTable.waitingList += 1;
                continue;
              }
              const { iv, ciphertext } = await encryptRecordWithMandatoryReservation(
                database,
                dek,
                'waitingList',
                item.id,
                [],
                item,
                CURRENT_RECORD_CRYPTO_VERSION,
                activeDekVersion,
                expectedGen
              );
              const entity: EncryptedWaitingListEntity = {
                id: item.id,
                ...(item.patientId ? { patientId: item.patientId } : {}),
                createdAt: item.addedAt || now,
                updatedAt: now,
                recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
                dekVersion: activeDekVersion,
                iv,
                ciphertext,
              };
              stagedForThisKey.push({
                tableName: 'waitingList',
                id: item.id,
                parentIds: [],
                entity: entity as unknown as Record<string, unknown>,
                expectedPlaintext: item,
              });
            }
            if (dryRun) {
              migratedKeys.push(key);
              continue;
            }
          } else if (key === KNOWN_KEY_NAMES.INVOICES_IQD) {
            const parsed = JSON.parse(rawValue);
            if (!Array.isArray(parsed)) {
              throw new Error('بنية الفواتير غير صالحة (ليست مصفوفة).');
            }
            for (const inv of parsed as FinancialInvoiceIQD[]) {
              if (!inv || typeof inv.id !== 'string' || !inv.id.trim()) {
                throw new Error('فاتورة تفتقر إلى معرّف صالح.');
              }
              if (typeof inv.patientId !== 'string' || !inv.patientId.trim()) {
                throw new Error(`الفاتورة "${inv.id}" تفتقر إلى patientId صالح.`);
              }
              const paymentsList: PaymentTransactionIQD[] = Array.isArray(inv.payments)
                ? inv.payments
                : [];
              if (dryRun) {
                countsByTable.invoices += 1;
                countsByTable.payments += paymentsList.length;
                continue;
              }
              const { iv: invIv, ciphertext: invCipher } =
                await encryptRecordWithMandatoryReservation(
                  database,
                  dek,
                  'invoices',
                  inv.id,
                  [],
                  inv,
                  CURRENT_RECORD_CRYPTO_VERSION,
                  activeDekVersion,
                  expectedGen
                );
              const invEntity: EncryptedInvoiceEntity = {
                id: inv.id,
                patientId: inv.patientId,
                ...(inv.episodeId ? { episodeId: inv.episodeId } : {}),
                createdAt: inv.date || now,
                updatedAt: now,
                recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
                dekVersion: activeDekVersion,
                iv: invIv,
                ciphertext: invCipher,
              };
              stagedForThisKey.push({
                tableName: 'invoices',
                id: inv.id,
                parentIds: [],
                entity: invEntity as unknown as Record<string, unknown>,
                expectedPlaintext: inv,
              });

              for (const pay of paymentsList) {
                if (!pay || typeof pay.id !== 'string' || !pay.id.trim()) {
                  throw new Error(`دفعة تابعة للفاتورة "${inv.id}" تفتقر إلى معرّف صالح.`);
                }
                const normalizedPay: PaymentTransactionIQD = {
                  ...pay,
                  invoiceId: inv.id,
                  patientId: pay.patientId || inv.patientId,
                };
                const { iv: payIv, ciphertext: payCipher } =
                  await encryptRecordWithMandatoryReservation(
                    database,
                    dek,
                    'payments',
                    normalizedPay.id,
                    [inv.id],
                    normalizedPay,
                    CURRENT_RECORD_CRYPTO_VERSION,
                    activeDekVersion,
                    expectedGen
                  );
                const payEntity: EncryptedPaymentEntity = {
                  id: normalizedPay.id,
                  invoiceId: inv.id,
                  patientId: normalizedPay.patientId,
                  createdAt: normalizedPay.date || now,
                  updatedAt: now,
                  recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
                  dekVersion: activeDekVersion,
                  iv: payIv,
                  ciphertext: payCipher,
                };
                stagedForThisKey.push({
                  tableName: 'payments',
                  id: normalizedPay.id,
                  parentIds: [inv.id],
                  entity: payEntity as unknown as Record<string, unknown>,
                  expectedPlaintext: normalizedPay,
                });
              }
            }
            if (dryRun) {
              migratedKeys.push(key);
              continue;
            }
          } else if (key === KNOWN_KEY_NAMES.EXPENSES_IQD) {
            const parsed = JSON.parse(rawValue);
            if (!Array.isArray(parsed)) {
              throw new Error('بنية المصاريف غير صالحة (ليست مصفوفة).');
            }
            for (const exp of parsed as ClinicExpenseIQD[]) {
              if (!exp || typeof exp.id !== 'string' || !exp.id.trim()) {
                throw new Error('سجل مصروف يفتقر إلى معرّف صالح.');
              }
              if (dryRun) {
                countsByTable.expenses += 1;
                continue;
              }
              const { iv, ciphertext } = await encryptRecordWithMandatoryReservation(
                database,
                dek,
                'expenses',
                exp.id,
                [],
                exp,
                CURRENT_RECORD_CRYPTO_VERSION,
                activeDekVersion,
                expectedGen
              );
              const entity: EncryptedExpenseEntity = {
                id: exp.id,
                createdAt: exp.date || now,
                updatedAt: now,
                recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
                dekVersion: activeDekVersion,
                iv,
                ciphertext,
              };
              stagedForThisKey.push({
                tableName: 'expenses',
                id: exp.id,
                parentIds: [],
                entity: entity as unknown as Record<string, unknown>,
                expectedPlaintext: exp,
              });
            }
            if (dryRun) {
              migratedKeys.push(key);
              continue;
            }
          } else if (key === KNOWN_KEY_NAMES.AUDIT_LOGS) {
            const parsed = JSON.parse(rawValue);
            if (!Array.isArray(parsed)) {
              throw new Error('بنية سجل التدقيق غير صالحة (ليست مصفوفة).');
            }
            for (const rawLog of parsed as AuditLogEntry[]) {
              if (!rawLog || typeof rawLog.id !== 'string' || !rawLog.id.trim()) {
                throw new Error('سجل تدقيق يفتقر إلى معرّف صالح.');
              }
              const sanitizedLog = sanitizeAuditLogEntryForMigration(
                rawLog,
                knownPatientNames,
                {
                  invoiceToPatientEpisode,
                  appointmentToPatientEpisode,
                  sessionToPatientEpisode,
                  episodeToPatient,
                }
              );
              if (dryRun) {
                countsByTable.auditLogs += 1;
                continue;
              }
              const { iv, ciphertext } = await encryptRecordWithMandatoryReservation(
                database,
                dek,
                'auditLogs',
                sanitizedLog.id,
                [],
                sanitizedLog,
                CURRENT_RECORD_CRYPTO_VERSION,
                activeDekVersion,
                expectedGen
              );
              const entity: EncryptedAuditLogEntity = {
                id: sanitizedLog.id,
                ...(sanitizedLog.patientId ? { patientId: sanitizedLog.patientId } : {}),
                ...(sanitizedLog.episodeId ? { episodeId: sanitizedLog.episodeId } : {}),
                createdAt: sanitizedLog.timestamp || now,
                recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
                dekVersion: activeDekVersion,
                iv,
                ciphertext,
              };
              stagedForThisKey.push({
                tableName: 'auditLogs',
                id: sanitizedLog.id,
                parentIds: [],
                entity: entity as unknown as Record<string, unknown>,
                expectedPlaintext: sanitizedLog,
              });
            }
            if (dryRun) {
              migratedKeys.push(key);
              continue;
            }
          } else if (key === KNOWN_KEY_NAMES.CUSTOM_WIDGETS) {
            const parsed = JSON.parse(rawValue);
            if (!Array.isArray(parsed)) {
              throw new Error('بنية قوالب الوحدات المخصصة غير صالحة (ليست مصفوفة).');
            }
            for (const widget of parsed as Array<Record<string, unknown>>) {
              const wId = typeof widget?.id === 'string' ? widget.id.trim() : '';
              if (!wId) {
                throw new Error('قالب وحدة مخصصة يفتقر إلى معرّف صالح.');
              }
              if (dryRun) {
                countsByTable.customWidgets += 1;
                continue;
              }
              const { iv, ciphertext } = await encryptRecordWithMandatoryReservation(
                database,
                dek,
                'customWidgets',
                wId,
                [],
                widget,
                CURRENT_RECORD_CRYPTO_VERSION,
                activeDekVersion,
                expectedGen
              );
              const entity: EncryptedCustomWidgetEntity = {
                id: wId,
                createdAt:
                  typeof widget.createdAt === 'string' ? widget.createdAt : now,
                updatedAt: now,
                recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
                dekVersion: activeDekVersion,
                iv,
                ciphertext,
              };
              stagedForThisKey.push({
                tableName: 'customWidgets',
                id: wId,
                parentIds: [],
                entity: entity as unknown as Record<string, unknown>,
                expectedPlaintext: widget,
              });
            }
            if (dryRun) {
              migratedKeys.push(key);
              continue;
            }
          } else if (key.startsWith(KNOWN_KEY_NAMES.EPISODE_STORE_PREFIX)) {
            const episodeIdFromKey = key.slice(KNOWN_KEY_NAMES.EPISODE_STORE_PREFIX.length).trim();
            if (!episodeIdFromKey) {
              throw new Error('مفتاح تقييم حلقة الرعاية يفتقر إلى episodeId.');
            }
            const parsed = JSON.parse(rawValue) as EpisodeScopedClinicalStore;
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
              throw new Error('بنية تقييم حلقة الرعاية غير صالحة.');
            }
            const resolvedEpisodeId = parsed.episodeId || episodeIdFromKey;
            const resolvedPatientId =
              parsed.patientId || episodeToPatient.get(resolvedEpisodeId) || '';
            if (!resolvedPatientId) {
              throw new Error(
                `سجل تقييم حلقة الرعاية "${resolvedEpisodeId}" يفتقر إلى patientId صالح.`
              );
            }
            const normalizedStore: EpisodeScopedClinicalStore = {
              ...parsed,
              episodeId: resolvedEpisodeId,
              patientId: resolvedPatientId,
              snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : [],
              hepProgram: Array.isArray(parsed.hepProgram) ? parsed.hepProgram : [],
              updatedAt: parsed.updatedAt || now,
            };

            if (dryRun) {
              countsByTable.episodeClinical += 1;
              migratedKeys.push(key);
              continue;
            }
            episodeClinicalToSaveViaGuard = normalizedStore;
          } else if (
            key.startsWith(KNOWN_KEY_NAMES.SESSION_FLOWSHEET_PREFIX) &&
            !key.startsWith(KNOWN_KEY_NAMES.SESSION_FLOWSHEET_LATEST_PREFIX)
          ) {
            const sessionId = key.slice(KNOWN_KEY_NAMES.SESSION_FLOWSHEET_PREFIX.length).trim();
            if (!sessionId) {
              throw new Error('مفتاح جدول التمارين يفتقر إلى sessionId.');
            }
            const parsed = JSON.parse(rawValue) as SessionFlowsheetData;
            if (
              !parsed ||
              typeof parsed !== 'object' ||
              Array.isArray(parsed) ||
              !Array.isArray(parsed.exercises) ||
              !Array.isArray(parsed.manualTherapy) ||
              !Array.isArray(parsed.physicalAgents)
            ) {
              throw new Error(`بنية جدول تمارين الجلسة "${sessionId}" غير صالحة.`);
            }

            const sessionEntity = await database.sessions.get(sessionId);
            const existingSoapEntity = await database.soapNotes
              .where('sessionId')
              .equals(sessionId)
              .first();

            if (!sessionEntity && !existingSoapEntity) {
              // Orphan flowsheet whose session no longer exists in db.sessions
              keyOrphanFlowsheets.push({
                key,
                sessionId,
                reason: 'Parent session does not exist in db.sessions',
              });
              orphanFlowsheets.push(...keyOrphanFlowsheets);
              if (dryRun) {
                migratedKeys.push(key);
                continue;
              }
            } else {
              const cleanFlowsheet: SoapFlowsheetData = {
                exercises: parsed.exercises,
                manualTherapy: parsed.manualTherapy,
                physicalAgents: parsed.physicalAgents,
              };

              if (existingSoapEntity) {
                const parentIds = existingSoapEntity.episodeId
                  ? [
                      existingSoapEntity.patientId,
                      existingSoapEntity.episodeId,
                      existingSoapEntity.sessionId,
                    ]
                  : [existingSoapEntity.patientId, existingSoapEntity.sessionId];
                const existingSoapData = await decryptRecordPayload<SoapNoteData>(
                  dek,
                  'soapNotes',
                  existingSoapEntity.id,
                  parentIds,
                  existingSoapEntity.iv,
                  existingSoapEntity.ciphertext,
                  existingSoapEntity.recordCryptoVersion || CURRENT_RECORD_CRYPTO_VERSION,
                  existingSoapEntity.dekVersion || CURRENT_DEK_VERSION
                );

                // If the note is already finalized AND sealed under canonical seal v1, do not mutate it
                if (existingSoapData.isFinalized && existingSoapData.sealVersion) {
                  if (
                    parsed.preSessionPainNrs !== undefined &&
                    existingSoapData.subjective?.painNrsScore !== undefined &&
                    existingSoapData.subjective.painNrsScore !== parsed.preSessionPainNrs
                  ) {
                    keyPainConflicts.push({
                      sessionId,
                      soapId: existingSoapEntity.id,
                      soapPainNrsScore: existingSoapData.subjective.painNrsScore,
                      flowsheetPreSessionPainNrs: parsed.preSessionPainNrs,
                      resolution: 'skipped_finalized_sealed',
                    });
                    painConflicts.push(...keyPainConflicts);
                  }
                } else {
                  const currentSub = { ...(existingSoapData.subjective || {}) };
                  if (parsed.preSessionPainNrs !== undefined) {
                    if (
                      currentSub.painNrsScore !== undefined &&
                      currentSub.painNrsScore !== parsed.preSessionPainNrs
                    ) {
                      keyPainConflicts.push({
                        sessionId,
                        soapId: existingSoapEntity.id,
                        soapPainNrsScore: currentSub.painNrsScore,
                        flowsheetPreSessionPainNrs: parsed.preSessionPainNrs,
                        resolution: 'flowsheet_won',
                      });
                      painConflicts.push(...keyPainConflicts);
                    }
                    currentSub.painNrsScore = parsed.preSessionPainNrs;
                    delete currentSub.painNotRecorded;
                  }
                  if (parsed.postSessionPainNrs !== undefined) {
                    currentSub.postSessionPainNrs = parsed.postSessionPainNrs;
                    delete currentSub.postPainNotRecorded;
                  }

                  const wasLegacyUnreviewed = Boolean(
                    !existingSoapData.isFinalized &&
                      !existingSoapData.legacyReviewedAt &&
                      (existingSoapData.legacyUnreviewed ||
                        (existingSoapData.soapSchemaVersion ?? 1) < CURRENT_SOAP_SCHEMA_VERSION)
                  );

                  const mergedSoapData: SoapNoteData = {
                    ...existingSoapData,
                    soapSchemaVersion: CURRENT_SOAP_SCHEMA_VERSION,
                    ...(wasLegacyUnreviewed ? { legacyUnreviewed: true } : {}),
                    subjective: currentSub,
                    objective: {
                      ...(existingSoapData.objective || {}),
                      flowsheet: cleanFlowsheet,
                    },
                  };

                  if (dryRun) {
                    countsByTable.soapNotes += 1;
                    migratedKeys.push(key);
                    continue;
                  }

                  const resolvedEpisodeId =
                    existingSoapEntity.episodeId || sessionEntity?.episodeId || '';
                  const updatedParentIds = resolvedEpisodeId
                    ? [existingSoapEntity.patientId, resolvedEpisodeId, sessionId]
                    : [existingSoapEntity.patientId, sessionId];

                  const { iv: soapIv, ciphertext: soapCipher } =
                    await encryptRecordWithMandatoryReservation(
                      database,
                      dek,
                      'soapNotes',
                      existingSoapEntity.id,
                      updatedParentIds,
                      mergedSoapData,
                      CURRENT_RECORD_CRYPTO_VERSION,
                      activeDekVersion,
                      expectedGen
                    );

                  const updatedSoapEntity: EncryptedSoapEntity = {
                    id: existingSoapEntity.id,
                    sessionId,
                    episodeId: resolvedEpisodeId,
                    patientId: existingSoapEntity.patientId,
                    createdAt: existingSoapEntity.createdAt,
                    updatedAt: now,
                    recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
                    dekVersion: activeDekVersion,
                    iv: soapIv,
                    ciphertext: soapCipher,
                  };

                  stagedForThisKey.push({
                    tableName: 'soapNotes',
                    id: existingSoapEntity.id,
                    parentIds: updatedParentIds,
                    entity: updatedSoapEntity as unknown as Record<string, unknown>,
                    expectedPlaintext: mergedSoapData,
                  });
                }
              } else if (sessionEntity) {
                // Session exists in db.sessions but had no db.soapNotes row yet
                const newSoapId = `soap_mig_${sessionId}`;
                const newSoapData: SoapNoteData = {
                  soapSchemaVersion: CURRENT_SOAP_SCHEMA_VERSION,
                  isFinalized: false,
                  legacyUnreviewed: true,
                  subjective: {
                    ...(parsed.preSessionPainNrs !== undefined
                      ? { painNrsScore: parsed.preSessionPainNrs }
                      : {}),
                    ...(parsed.postSessionPainNrs !== undefined
                      ? { postSessionPainNrs: parsed.postSessionPainNrs }
                      : {}),
                  },
                  objective: {
                    flowsheet: cleanFlowsheet,
                  },
                  assessment: {},
                  plan: {},
                };

                if (dryRun) {
                  countsByTable.soapNotes += 1;
                  migratedKeys.push(key);
                  continue;
                }

                const parentIds = [
                  sessionEntity.patientId,
                  sessionEntity.episodeId,
                  sessionId,
                ];
                const { iv: soapIv, ciphertext: soapCipher } =
                  await encryptRecordWithMandatoryReservation(
                    database,
                    dek,
                    'soapNotes',
                    newSoapId,
                    parentIds,
                    newSoapData,
                    CURRENT_RECORD_CRYPTO_VERSION,
                    activeDekVersion,
                    expectedGen
                  );

                const newSoapEntity: EncryptedSoapEntity = {
                  id: newSoapId,
                  sessionId,
                  episodeId: sessionEntity.episodeId,
                  patientId: sessionEntity.patientId,
                  createdAt: now,
                  updatedAt: now,
                  recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
                  dekVersion: activeDekVersion,
                  iv: soapIv,
                  ciphertext: soapCipher,
                };

                stagedForThisKey.push({
                  tableName: 'soapNotes',
                  id: newSoapId,
                  parentIds,
                  entity: newSoapEntity as unknown as Record<string, unknown>,
                  expectedPlaintext: newSoapData,
                });
              }
            }
          } else {
            // Any other physiorecord_* key (e.g. legacy patient widgets or organui meds):
            // Validate JSON so corrupt keys are caught and reported without deleting
            const parsed = JSON.parse(rawValue);
            if (parsed === null || typeof parsed !== 'object') {
              throw new Error(`بنية المفتاح "${key}" غير صالحة.`);
            }
            skippedNonClinicalKeys.push(key);
            continue;
          }

          // 3. Commit & verify in live mode
          if (!dryRun) {
            if (episodeClinicalToSaveViaGuard) {
              // Pre-read existing Dexie record to ensure idempotence when re-migrating identical snapshots,
              // while strictly enforcing append-only snapshots via saveEpisodeClinicalStoreEncrypted
              const savedEntity = await this.commitAndVerifyEpisodeClinical(
                episodeClinicalToSaveViaGuard,
                dek,
                database
              );
              countsByTable.episodeClinical += 1;
              await verifyWrittenRecordInDexie(database, dek, {
                tableName: 'episodeClinical',
                id: savedEntity.id,
                parentIds: [savedEntity.episodeId],
                entity: savedEntity as unknown as Record<string, unknown>,
                expectedPlaintext: {
                  ...episodeClinicalToSaveViaGuard,
                  updatedAt: savedEntity.updatedAt,
                },
              });
            }

            if (stagedForThisKey.length > 0) {
              const tableNames = Array.from(
                new Set(stagedForThisKey.map((s) => s.tableName))
              );
              const tablesToLock = tableNames.map((t) => database.table(t));
              await database.transaction('rw', tablesToLock, async () => {
                for (const item of stagedForThisKey) {
                  await database.table(item.tableName).put(item.entity);
                }
              });

              // Verify EVERY written record by decrypt + canonical deep-equal before marking key complete
              for (const item of stagedForThisKey) {
                await verifyWrittenRecordInDexie(database, dek, item);
                countsByTable[item.tableName] = (countsByTable[item.tableName] || 0) + 1;
              }
            }

            // Record per-key completion hash in db.migrationState (resumable progress)
            completedKeyHashSet.add(keyValueHash);
            keysCommittedInThisRun += 1;
            migratedKeys.push(key);

            await database.migrationState.put({
              id: LOCALSTORAGE_MIGRATION_STATE_ID,
              status: 'in_progress',
              vaultGeneration: expectedGen,
              completedKeyHashes: Array.from(completedKeyHashSet),
              failedKeyCount: corruptKeys.length,
              repairedSoapNotesCount: existingState?.repairedSoapNotesCount || 0,
              conflictCount: painConflicts.length,
              orphanFlowsheetCount: orphanFlowsheets.length,
              updatedAt: new Date().toISOString(),
            });
          }
        } catch (err: unknown) {
          const errorReason =
            err instanceof Error ? err.message : 'Corrupt or invalid JSON payload';
          corruptKeys.push({
            key,
            errorReason,
          });
          if (!dryRun) {
            await database.migrationState.put({
              id: LOCALSTORAGE_MIGRATION_STATE_ID,
              status: 'in_progress',
              vaultGeneration: expectedGen,
              completedKeyHashes: Array.from(completedKeyHashSet),
              failedKeyCount: corruptKeys.length,
              repairedSoapNotesCount: existingState?.repairedSoapNotesCount || 0,
              conflictCount: painConflicts.length,
              orphanFlowsheetCount: orphanFlowsheets.length,
              updatedAt: new Date().toISOString(),
            });
          }
        }
      }

      const finalReport: MigrationReportPayload = {
        id: reportId,
        createdAt: now,
        vaultGeneration: expectedGen,
        dryRun,
        migratedKeys,
        skippedAlreadyCompletedKeys,
        skippedNonClinicalKeys,
        countsByTable,
        painConflicts,
        orphanFlowsheets,
        corruptKeys,
      };

      if (dryRun) {
        return {
          status: 'dry_run',
          report: finalReport,
        };
      }

      // Persist encrypted migration report into `db.migrationReports` and verify by decrypt + deep-equal
      const { iv: repIv, ciphertext: repCipher } =
        await encryptRecordWithMandatoryReservation(
          database,
          dek,
          'migrationReports',
          reportId,
          [],
          finalReport,
          CURRENT_RECORD_CRYPTO_VERSION,
          activeDekVersion,
          expectedGen
        );

      const reportEntity: EncryptedMigrationReportEntity = {
        id: reportId,
        createdAt: now,
        recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
        dekVersion: activeDekVersion,
        iv: repIv,
        ciphertext: repCipher,
      };
      await database.migrationReports.put(reportEntity);
      await verifyWrittenRecordInDexie(database, dek, {
        tableName: 'migrationReports',
        id: reportId,
        parentIds: [],
        entity: reportEntity as unknown as Record<string, unknown>,
        expectedPlaintext: finalReport,
      });

      const finalStateStatus = wasInterrupted
        ? 'in_progress'
        : corruptKeys.length > 0
          ? 'failed'
          : 'completed';

      await database.migrationState.put({
        id: LOCALSTORAGE_MIGRATION_STATE_ID,
        status: finalStateStatus,
        vaultGeneration: expectedGen,
        completedKeyHashes: Array.from(completedKeyHashSet),
        failedKeyCount: corruptKeys.length,
        repairedSoapNotesCount: existingState?.repairedSoapNotesCount || 0,
        conflictCount: painConflicts.length,
        orphanFlowsheetCount: orphanFlowsheets.length,
        updatedAt: new Date().toISOString(),
      });

      return {
        status: wasInterrupted
          ? 'interrupted'
          : corruptKeys.length > 0
            ? 'partial_with_errors'
            : 'completed',
        alreadyCompleted:
          !wasInterrupted &&
          corruptKeys.length === 0 &&
          migratedKeys.length === 0 &&
          skippedAlreadyCompletedKeys.length > 0,
        report: finalReport,
      };
    });
  }

  private static async commitAndVerifyEpisodeClinical(
    store: EpisodeScopedClinicalStore,
    dek: CryptoKey,
    database: PhysioRecordDatabase
  ): Promise<EncryptedEpisodeClinicalEntity> {
    const existingEntity =
      (await database.episodeClinical.get(store.episodeId)) ||
      (await database.episodeClinical.where('episodeId').equals(store.episodeId).first());

    if (existingEntity) {
      const existingDecrypted = await decryptRecordPayload<EpisodeScopedClinicalStore>(
        dek,
        'episodeClinical',
        existingEntity.id,
        [existingEntity.episodeId],
        existingEntity.iv,
        existingEntity.ciphertext,
        existingEntity.recordCryptoVersion || CURRENT_RECORD_CRYPTO_VERSION,
        existingEntity.dekVersion || CURRENT_DEK_VERSION
      );
      assertAppendOnlySnapshots(
        existingDecrypted.snapshots || [],
        store.snapshots || []
      );
    }

    const meta = await database.vaultMeta.get('auth');
    const activeDekVersion = meta?.dekVersion || CURRENT_DEK_VERSION;
    const expectedGen = getDekGeneration(dek);
    const now = new Date().toISOString();
    const payloadToEncrypt: EpisodeScopedClinicalStore = {
      ...store,
      updatedAt: now,
    };

    const { iv, ciphertext } = await encryptRecordWithMandatoryReservation(
      database,
      dek,
      'episodeClinical',
      store.episodeId,
      [store.episodeId],
      payloadToEncrypt,
      CURRENT_RECORD_CRYPTO_VERSION,
      activeDekVersion,
      expectedGen
    );

    const entity: EncryptedEpisodeClinicalEntity = {
      id: store.episodeId,
      episodeId: store.episodeId,
      patientId: store.patientId,
      createdAt: existingEntity?.createdAt || now,
      updatedAt: now,
      recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
      dekVersion: activeDekVersion,
      iv,
      ciphertext,
    };

    await database.transaction('rw', [database.episodeClinical], async () => {
      const inTxExisting = await database.episodeClinical.get(store.episodeId);
      if (inTxExisting) {
        const inTxDecrypted = await decryptRecordPayload<EpisodeScopedClinicalStore>(
          dek,
          'episodeClinical',
          inTxExisting.id,
          [inTxExisting.episodeId],
          inTxExisting.iv,
          inTxExisting.ciphertext,
          inTxExisting.recordCryptoVersion || CURRENT_RECORD_CRYPTO_VERSION,
          inTxExisting.dekVersion || CURRENT_DEK_VERSION
        );
        assertAppendOnlySnapshots(
          inTxDecrypted.snapshots || [],
          payloadToEncrypt.snapshots || []
        );
      }
      await database.episodeClinical.put(entity);
    });

    return entity;
  }
}
