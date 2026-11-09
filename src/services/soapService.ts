// =======================================================================
// PhysioRecord — SOAP Clinical Documentation & Addenda Service Layer (v2.1)
// 1:1 Session-to-SOAP Constraint, Immutability Locking, Concurrency Fencing, and Canonical AAD
// =======================================================================

import { db as defaultDb, PhysioRecordDatabase } from '../db/db';
import {
  encryptRecordWithMandatoryReservation,
  decryptRecordPayload,
  CURRENT_RECORD_CRYPTO_VERSION,
  CURRENT_DEK_VERSION,
} from '../crypto/vault';
import { ReferentialIntegrityError } from '../db/registry';
import {
  ADDENDUM_REASONS,
  CannotDeleteFinalizedRecordError,
  StaleTabOverwriteError,
  CURRENT_SOAP_SCHEMA_VERSION,
  type SoapNoteRecord,
  type SoapNoteData,
  type SoapNoteUpdateInput,
  type SoapSubjectiveData,
  type LegacyPainDetail,
  type SoapObjectiveData,
  type SoapAssessmentData,
  type SoapPlanData,
  type SoapFlowsheetData,
  type EncryptedSoapEntity,
  type ClinicalAddendumRecord,
  type ClinicalAddendumData,
  type EncryptedClinicalAddendumEntity,
  type AddendumReason,
  type SessionClinicalData,
} from '../types/clinical';

import { isTestEnvironment } from '../utils/testHooks';

export const MAX_ADDENDUM_TEXT_LENGTH = 5000;

export type SoapMutationTestHook = (
  operation: 'updateSoapNote' | 'deleteSoapNote',
  context: { soapId: string; sessionId: string }
) => Promise<void> | void;

let soapMutationTestHook: SoapMutationTestHook | null = null;

export const setSoapMutationTestHook = (hook: SoapMutationTestHook | null) => {
  if (!isTestEnvironment()) {
    soapMutationTestHook = null;
    return;
  }
  soapMutationTestHook = hook;
};

function areUint8ArraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export interface LatestEpisodeFlowsheetResult {
  flowsheet: SoapFlowsheetData | null;
  sourceSessionId?: string;
  sourceSessionNumber?: number;
  sourceSessionDate?: string;
  failedCount: number;
}

export interface AddendaBySessionResult {
  records: ClinicalAddendumRecord[];
  failedCount: number;
}

/**
 * Shallow-merge a SOAP section while allowing callers to explicitly clear
 * optional properties by passing `null` or `undefined` as an own property in `patch`.
 */
function mergeSectionWithClear<T extends object>(
  base: T | undefined,
  patch: Record<string, unknown> | undefined
): T {
  const result: Record<string, unknown> = { ...(base ? (base as Record<string, unknown>) : {}) };
  if (!patch) {
    return result as T;
  }
  for (const key of Object.keys(patch)) {
    const val = patch[key];
    if (val === null || val === undefined) {
      delete result[key];
    } else {
      result[key] = val;
    }
  }
  return result as T;
}

/**
 * Extracts legacy pain sub-fields (`scoreAtRest`, `scoreWithMovement`, `scoreBestLast24h`,
 * `scoreWorstLast24h`, `contextNotes`, `assessedAt`) from `painAssessment`, `painVasBestLast24h`,
 * `painVasWorstLast24h`, or an existing `legacyPainDetail` so they are never lost when a legacy
 * draft is edited and saved in v2.
 */
export function extractLegacyPainDetail(
  sub: SoapSubjectiveData | undefined
): LegacyPainDetail | undefined {
  if (!sub) return undefined;
  const existing = sub.legacyPainDetail;
  const pa = sub.painAssessment;

  const scoreAtRest = existing?.scoreAtRest ?? pa?.scoreAtRest;
  const scoreWithMovement = existing?.scoreWithMovement ?? pa?.scoreWithMovement;
  const scoreBestLast24h =
    existing?.scoreBestLast24h ?? pa?.scoreBestLast24h ?? sub.painVasBestLast24h;
  const scoreWorstLast24h =
    existing?.scoreWorstLast24h ?? pa?.scoreWorstLast24h ?? sub.painVasWorstLast24h;
  const contextNotes = existing?.contextNotes ?? pa?.contextNotes;
  const assessedAt = existing?.assessedAt ?? pa?.assessedAt;

  const detail: LegacyPainDetail = {};
  if (scoreAtRest !== undefined) detail.scoreAtRest = scoreAtRest;
  if (scoreWithMovement !== undefined) detail.scoreWithMovement = scoreWithMovement;
  if (scoreBestLast24h !== undefined) detail.scoreBestLast24h = scoreBestLast24h;
  if (scoreWorstLast24h !== undefined) detail.scoreWorstLast24h = scoreWorstLast24h;
  if (contextNotes !== undefined && contextNotes.trim() !== '') {
    detail.contextNotes = contextNotes;
  }
  if (assessedAt !== undefined && assessedAt.trim() !== '') {
    detail.assessedAt = assessedAt;
  }

  return Object.keys(detail).length > 0 ? detail : undefined;
}

/**
 * Normalize subjective data for v2 persistence:
 * - No `?? 0` pain fallback: missing pain stays `undefined`.
 * - Write ONLY `painNrsScore` and `postSessionPainNrs` (plus `painNotRecorded`/`postPainNotRecorded`).
 * - Preserve any legacy pain sub-fields (`scoreAtRest`, `scoreWithMovement`, `24h` best/worst, `contextNotes`)
 *   inside `legacyPainDetail` before stripping `painVasCurrent`, `painAssessment`, `painVasBestLast24h`, `painVasWorstLast24h`.
 */
function sanitizeSubjectiveForWrite(sub: SoapSubjectiveData): SoapSubjectiveData {
  const cleaned: SoapSubjectiveData = { ...sub };
  const preservedLegacyDetail = extractLegacyPainDetail(cleaned);
  if (preservedLegacyDetail) {
    cleaned.legacyPainDetail = preservedLegacyDetail;
  } else {
    delete cleaned.legacyPainDetail;
  }

  delete cleaned.painVasCurrent;
  delete cleaned.painAssessment;
  delete cleaned.painVasBestLast24h;
  delete cleaned.painVasWorstLast24h;

  if (cleaned.painNotRecorded) {
    delete cleaned.painNrsScore;
  } else if (cleaned.painNrsScore === undefined) {
    delete cleaned.painNrsScore;
  }

  if (cleaned.postPainNotRecorded) {
    delete cleaned.postSessionPainNrs;
  } else if (cleaned.postSessionPainNrs === undefined) {
    delete cleaned.postSessionPainNrs;
  }

  return cleaned;
}

export class SoapService {
  /**
   * Fetch and decrypt the unique SOAP Note for a given Clinical Session.
   * Enforces 1:1 relationship check.
   */
  static async getSoapNoteBySession(
    sessionId: string,
    dek: CryptoKey,
    database: PhysioRecordDatabase = defaultDb
  ): Promise<SoapNoteRecord | null> {
    if (!sessionId || typeof sessionId !== 'string') return null;

    const entity = await database.soapNotes.where('sessionId').equals(sessionId).first();
    if (!entity) return null;

    return this.decryptSoapEntity(entity, dek);
  }

  /**
   * Fetch and decrypt a SOAP Note by its primary ID.
   */
  static async getSoapNoteById(
    soapId: string,
    dek: CryptoKey,
    database: PhysioRecordDatabase = defaultDb
  ): Promise<SoapNoteRecord | null> {
    if (!soapId || typeof soapId !== 'string') return null;

    const entity = await database.soapNotes.get(soapId);
    if (!entity) return null;

    return this.decryptSoapEntity(entity, dek);
  }

  /**
   * Fetch the previous session's non-empty flowsheet for an episode by sessionNumber / sessionDate
   * from `db.sessions` (highest session number lower than the current one — NOT by `updatedAt`),
   * and report decryption failures in `failedCount` instead of silently skipping them.
   */
  static async getLatestEpisodeFlowsheet(
    episodeId: string,
    currentSessionId: string | undefined,
    dek: CryptoKey,
    database: PhysioRecordDatabase = defaultDb,
    currentSessionNumber?: number,
    currentSessionDate?: string
  ): Promise<LatestEpisodeFlowsheetResult> {
    if (!episodeId || typeof episodeId !== 'string') {
      return { flowsheet: null, failedCount: 0 };
    }

    const sessionEntities = await database.sessions.where('episodeId').equals(episodeId).toArray();
    if (sessionEntities.length === 0) {
      return { flowsheet: null, failedCount: 0 };
    }

    let failedCount = 0;
    const decryptedSessions: Array<{
      id: string;
      sessionNumber: number;
      sessionDate: string;
      status: string;
    }> = [];

    let resolvedCurrentNumber = currentSessionNumber;
    let resolvedCurrentDate = currentSessionDate;

    for (const sEntity of sessionEntities) {
      try {
        const sData = await decryptRecordPayload<SessionClinicalData>(
          dek,
          'sessions',
          sEntity.id,
          [sEntity.patientId, sEntity.episodeId],
          sEntity.iv,
          sEntity.ciphertext,
          sEntity.recordCryptoVersion || CURRENT_RECORD_CRYPTO_VERSION,
          sEntity.dekVersion || CURRENT_DEK_VERSION
        );
        const num = Number(sData.sessionNumber) || 1;
        const dateStr = sData.sessionDate || sEntity.createdAt.slice(0, 10);
        if (currentSessionId && sEntity.id === currentSessionId) {
          if (resolvedCurrentNumber === undefined) resolvedCurrentNumber = num;
          if (resolvedCurrentDate === undefined) resolvedCurrentDate = dateStr;
          continue;
        }
        if (sData.status === 'cancelled') continue;
        decryptedSessions.push({
          id: sEntity.id,
          sessionNumber: num,
          sessionDate: dateStr,
          status: sData.status || 'draft',
        });
      } catch {
        failedCount++;
      }
    }

    // Filter to sessions preceding the current session by sessionNumber (or earlier date on tie)
    const candidateSessions = decryptedSessions.filter((s) => {
      if (resolvedCurrentNumber !== undefined) {
        if (s.sessionNumber < resolvedCurrentNumber) return true;
        if (
          s.sessionNumber === resolvedCurrentNumber &&
          resolvedCurrentDate &&
          s.sessionDate < resolvedCurrentDate
        ) {
          return true;
        }
        return false;
      }
      return true;
    });

    // Sort by highest sessionNumber lower than current first, then sessionDate descending
    candidateSessions.sort((a, b) => {
      if (b.sessionNumber !== a.sessionNumber) {
        return b.sessionNumber - a.sessionNumber;
      }
      return b.sessionDate.localeCompare(a.sessionDate);
    });

    for (const candidate of candidateSessions) {
      const soapEntity = await database.soapNotes
        .where('sessionId')
        .equals(candidate.id)
        .first();
      if (!soapEntity) continue;

      try {
        const note = await this.decryptSoapEntity(soapEntity, dek);
        const fs = note.data.objective?.flowsheet;
        if (
          fs &&
          (fs.exercises?.length > 0 ||
            fs.manualTherapy?.length > 0 ||
            fs.physicalAgents?.length > 0)
        ) {
          return {
            flowsheet: fs,
            sourceSessionId: candidate.id,
            sourceSessionNumber: candidate.sessionNumber,
            sourceSessionDate: candidate.sessionDate,
            failedCount,
          };
        }
      } catch {
        failedCount++;
      }
    }

    return { flowsheet: null, failedCount };
  }

  /**
   * Decrypt a raw EncryptedSoapEntity from the database.
   * Backward-compatible with v1 SOAP notes:
   * - Defaults `soapSchemaVersion` to 1 when absent.
   * - Reads legacy `painVasCurrent` or `painAssessment.score` into `painNrsScore` ONLY if present (never coerces missing pain to 0).
   * - Extracts legacy pain sub-fields (`scoreAtRest`, `scoreWithMovement`, `24h` best/worst, `contextNotes`) into `legacyPainDetail`.
   */
  private static async decryptSoapEntity(
    entity: EncryptedSoapEntity,
    dek: CryptoKey
  ): Promise<SoapNoteRecord> {
    const parentIds = entity.episodeId
      ? [entity.patientId, entity.episodeId, entity.sessionId]
      : [entity.patientId, entity.sessionId]; // backward-compatibility fallback

    const decryptedData = await decryptRecordPayload<SoapNoteData>(
      dek,
      'soapNotes',
      entity.id,
      parentIds,
      entity.iv,
      entity.ciphertext,
      entity.recordCryptoVersion || CURRENT_RECORD_CRYPTO_VERSION,
      entity.dekVersion || CURRENT_DEK_VERSION
    );

    const legacyOrCurrentPrePain =
      decryptedData.subjective?.painNrsScore ??
      decryptedData.subjective?.painVasCurrent ??
      decryptedData.subjective?.painAssessment?.score;

    const normalizedSubjective: SoapSubjectiveData = {
      ...(decryptedData.subjective || {}),
    };
    if (legacyOrCurrentPrePain !== undefined && !normalizedSubjective.painNotRecorded) {
      normalizedSubjective.painNrsScore = legacyOrCurrentPrePain;
    }

    const legacyPainDetail = extractLegacyPainDetail(decryptedData.subjective);
    if (legacyPainDetail) {
      normalizedSubjective.legacyPainDetail = legacyPainDetail;
    }

    const storedSchemaVersion = decryptedData.soapSchemaVersion ?? 1;
    const isUnreviewedLegacyDraft =
      !decryptedData.isFinalized &&
      !decryptedData.legacyReviewedAt &&
      (Boolean(decryptedData.legacyUnreviewed) ||
        storedSchemaVersion < CURRENT_SOAP_SCHEMA_VERSION);

    return {
      id: entity.id,
      sessionId: entity.sessionId,
      episodeId: entity.episodeId,
      patientId: entity.patientId,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      data: {
        ...decryptedData,
        soapSchemaVersion: storedSchemaVersion,
        ...(isUnreviewedLegacyDraft ? { legacyUnreviewed: true } : {}),
        subjective: normalizedSubjective,
      },
    };
  }

  /**
   * Create a new SOAP note for a Clinical Session.
   * - Strictly enforces 1:1 relationship and parent session draft state.
   * - Removes all `?? 0` pain fallbacks; missing pain stays `undefined`.
   * - Preserves `legacyUnreviewed: true` if passed (or if `data.soapSchemaVersion` was explicitly `< 2`).
   * - Computes all crypto BEFORE opening the Dexie transaction, then re-reads and re-checks
   *   parent session state and 1:1 uniqueness INSIDE the `rw` transaction before committing.
   */
  static async createSoapNote(
    patientId: string,
    episodeId: string,
    sessionId: string,
    data: SoapNoteData,
    dek: CryptoKey,
    explicitId?: string,
    database: PhysioRecordDatabase = defaultDb
  ): Promise<SoapNoteRecord> {
    if (!patientId || typeof patientId !== 'string') {
      throw new ReferentialIntegrityError('معرّف المريض غير صالح.');
    }
    if (!episodeId || typeof episodeId !== 'string') {
      throw new ReferentialIntegrityError('معرّف حلقة الرعاية غير صالح.');
    }
    if (!sessionId || typeof sessionId !== 'string') {
      throw new ReferentialIntegrityError('معرّف الجلسة غير صالح.');
    }

    // 1. Verify parent session exists
    const session = await database.sessions.get(sessionId);
    if (!session) {
      throw new ReferentialIntegrityError(
        `لا يمكن إنشاء توثيق SOAP: الجلسة بالمعرف "${sessionId}" غير موجودة.`
      );
    }

    // 2. Verify referential integrity bindings
    if (session.patientId !== patientId) {
      throw new ReferentialIntegrityError(
        `فشل التحقق من النزاهة المرجعية: الجلسة ترتبط بمريض مختلف (${session.patientId} != ${patientId}).`
      );
    }
    if (session.episodeId !== episodeId) {
      throw new ReferentialIntegrityError(
        `فشل التحقق من النزاهة المرجعية: الجلسة ترتبط بحلقة رعاية مختلفة (${session.episodeId} != ${episodeId}).`
      );
    }

    const baselineSessionUpdatedAt = session.updatedAt;
    const baselineSessionIv = session.iv;

    // 2b. Service-layer immutability: Reject creating SOAP note if parent session is already finalized
    const sessionDecrypted = await decryptRecordPayload<SessionClinicalData>(
      dek,
      'sessions',
      session.id,
      [session.patientId, session.episodeId],
      session.iv,
      session.ciphertext,
      session.recordCryptoVersion || CURRENT_RECORD_CRYPTO_VERSION,
      session.dekVersion || CURRENT_DEK_VERSION
    );
    if (sessionDecrypted.status === 'finalized') {
      throw new Error(
        'لا يمكن إنشاء ملاحظة SOAP جديدة لجلسة سريرية معتمدة ومغلقة نهائياً.'
      );
    }

    // 3. Pre-check 1:1 constraint before running crypto
    const existingSoap = await database.soapNotes.where('sessionId').equals(sessionId).first();
    if (existingSoap) {
      throw new Error(
        `توجد ملاحظة SOAP مسجلة مسبقاً للجلسة "${sessionId}". لا يمكن إنشاء أكثر من ملاحظة سريرية واحدة لنفس الجلسة العلاجية.`
      );
    }

    const id = explicitId || crypto.randomUUID();
    const now = new Date().toISOString();

    const cleanedSubjective = sanitizeSubjectiveForWrite(data.subjective || {});
    const shouldMarkLegacyUnreviewed = Boolean(
      data.legacyUnreviewed ||
        (data.soapSchemaVersion !== undefined &&
          data.soapSchemaVersion < CURRENT_SOAP_SCHEMA_VERSION)
    );

    const fullData: SoapNoteData = {
      ...data,
      soapSchemaVersion: CURRENT_SOAP_SCHEMA_VERSION,
      subjective: cleanedSubjective,
      objective: { ...(data.objective || {}) },
      assessment: { ...(data.assessment || {}) },
      plan: { ...(data.plan || {}) },
      isFinalized: false,
      ...(shouldMarkLegacyUnreviewed ? { legacyUnreviewed: true } : {}),
    };

    // Pre-compute encryption with mandatory invocation counter reservation BEFORE opening the commit transaction
    const meta = await database.vaultMeta.get('auth');
    const activeDekVersion = meta?.dekVersion || CURRENT_DEK_VERSION;

    const { iv, ciphertext } = await encryptRecordWithMandatoryReservation(
      database,
      dek,
      'soapNotes',
      id,
      [patientId, episodeId, sessionId],
      fullData,
      CURRENT_RECORD_CRYPTO_VERSION,
      activeDekVersion
    );

    const entity: EncryptedSoapEntity = {
      id,
      sessionId,
      episodeId,
      patientId,
      createdAt: now,
      updatedAt: now,
      recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
      dekVersion: activeDekVersion,
      iv,
      ciphertext,
    };

    // ATOMIC IN-TRANSACTION RE-READ & 1:1 / STALE-TAB CHECK
    await database.transaction(
      'rw',
      [database.sessions, database.soapNotes, database.vaultMeta],
      async () => {
        const latestSession = await database.sessions.get(sessionId);
        if (!latestSession) {
          throw new ReferentialIntegrityError(
            `لا يمكن حفظ ملاحظة SOAP: الجلسة "${sessionId}" لم تعد موجودة.`
          );
        }
        if (
          latestSession.updatedAt !== baselineSessionUpdatedAt ||
          !areUint8ArraysEqual(latestSession.iv, baselineSessionIv)
        ) {
          throw new StaleTabOverwriteError(
            'تم تعديل الجلسة أو اعتمادها في تبويب آخر (Changed in another tab). يرجى إعادة تحميل الجلسة.'
          );
        }

        const concurrentSoap = await database.soapNotes
          .where('sessionId')
          .equals(sessionId)
          .first();
        if (concurrentSoap) {
          throw new StaleTabOverwriteError(
            `تم إنشاء ملاحظة SOAP للجلسة "${sessionId}" في تبويب آخر (Changed in another tab — 1:1 constraint).`
          );
        }

        const duplicateId = await database.soapNotes.get(id);
        if (duplicateId) {
          throw new StaleTabOverwriteError(
            `ملاحظة SOAP بالمعرف "${id}" موجودة مسبقاً.`
          );
        }

        await database.soapNotes.put(entity);
      }
    );

    return {
      id,
      sessionId,
      episodeId,
      patientId,
      createdAt: now,
      updatedAt: now,
      data: fullData,
    };
  }

  /**
   * Update an existing draft SOAP note.
   * - Strictly enforces immutability in the service layer (rejects if SOAP or parent session is finalized).
   * - On the FIRST save of any non-finalized note whose stored schema version is `< 2`, persists `legacyUnreviewed: true`
   *   in the encrypted payload and preserves it across subsequent draft saves so autosave + reload never bypasses the review gate.
   * - Supports clearing optional fields/sections when passed as `null` or `undefined`.
   * - Preserves legacy pain sub-fields in `legacyPainDetail` and removes all `?? 0` pain fallbacks.
   * - Re-reads and verifies `updatedAt`, `iv`, and 1:1 constraint INSIDE the same `rw` Dexie transaction as `put`.
   */
  static async updateSoapNote(
    soapId: string,
    data: SoapNoteUpdateInput | SoapNoteData,
    dek: CryptoKey,
    database: PhysioRecordDatabase = defaultDb,
    expectedUpdatedAt?: string
  ): Promise<SoapNoteRecord> {
    const existingEntity = await database.soapNotes.get(soapId);
    if (!existingEntity) {
      throw new Error(`ملاحظة SOAP بالمعرف "${soapId}" غير موجودة.`);
    }

    if (expectedUpdatedAt !== undefined && existingEntity.updatedAt !== expectedUpdatedAt) {
      throw new StaleTabOverwriteError(
        'تم تعديل ملاحظة SOAP في تبويب آخر (Changed in another tab). يرجى إعادة تحميل الصفحة لتجنب فقدان البيانات.'
      );
    }

    const baselineSoapUpdatedAt = expectedUpdatedAt ?? existingEntity.updatedAt;
    const baselineSoapIv = existingEntity.iv;
    const existing = await this.decryptSoapEntity(existingEntity, dek);

    // IMMUTABILITY RULE 1: Cannot update finalized SOAP note
    if (existing.data.isFinalized) {
      throw new Error(
        'لا يمكن تعديل ملاحظة SOAP معتمدة نهائياً. يسمح النظام بإضافة ملحق سريري (Clinical Addendum) للتصحيح.'
      );
    }

    // IMMUTABILITY RULE 2: Cannot update SOAP note if parent session is finalized
    const parentSession = await database.sessions.get(existing.sessionId);
    const baselineSessionUpdatedAt = parentSession?.updatedAt;
    const baselineSessionIv = parentSession?.iv;
    if (parentSession) {
      const sessionDecrypted = await decryptRecordPayload<SessionClinicalData>(
        dek,
        'sessions',
        parentSession.id,
        [parentSession.patientId, parentSession.episodeId],
        parentSession.iv,
        parentSession.ciphertext,
        parentSession.recordCryptoVersion || CURRENT_RECORD_CRYPTO_VERSION,
        parentSession.dekVersion || CURRENT_DEK_VERSION
      );
      if (sessionDecrypted.status === 'finalized') {
        throw new Error(
          'لا يمكن تعديل ملاحظة SOAP التابعة لجلسة سريرية معتمدة ومغلقة نهائياً. يسمح النظام فقط بإضافة ملحق سريري (Clinical Addendum).'
        );
      }
    }

    const meta = await database.vaultMeta.get('auth');
    const activeDekVersion = meta?.dekVersion || CURRENT_DEK_VERSION;
    const now = new Date().toISOString();

    const mergedSubjective = sanitizeSubjectiveForWrite(
      mergeSectionWithClear<SoapSubjectiveData>(
        existing.data.subjective,
        data.subjective as Record<string, unknown> | undefined
      )
    );
    const mergedObjective = mergeSectionWithClear<SoapObjectiveData>(
      existing.data.objective,
      data.objective as Record<string, unknown> | undefined
    );
    const mergedAssessment = mergeSectionWithClear<SoapAssessmentData>(
      existing.data.assessment,
      data.assessment as Record<string, unknown> | undefined
    );
    const mergedPlan = mergeSectionWithClear<SoapPlanData>(
      existing.data.plan,
      data.plan as Record<string, unknown> | undefined
    );

    // Persist `legacyUnreviewed: true` on the FIRST save of any non-finalized note whose stored schemaVersion < 2,
    // and preserve `legacyUnreviewed: true` across all subsequent draft saves until finalized with review confirmation.
    const wasLegacyUnreviewed = Boolean(
      existing.data.legacyUnreviewed ||
        (data as SoapNoteData).legacyUnreviewed ||
        (!existing.data.legacyReviewedAt &&
          (existing.data.soapSchemaVersion ?? 1) < CURRENT_SOAP_SCHEMA_VERSION)
    );

    const updatedData: SoapNoteData = {
      ...existing.data,
      soapSchemaVersion: CURRENT_SOAP_SCHEMA_VERSION,
      subjective: mergedSubjective,
      objective: mergedObjective,
      assessment: mergedAssessment,
      plan: mergedPlan,
      isFinalized: false,
      ...(wasLegacyUnreviewed ? { legacyUnreviewed: true } : {}),
    };

    const { iv, ciphertext } = await encryptRecordWithMandatoryReservation(
      database,
      dek,
      'soapNotes',
      soapId,
      [existing.patientId, existing.episodeId, existing.sessionId],
      updatedData,
      CURRENT_RECORD_CRYPTO_VERSION,
      activeDekVersion
    );

    const updatedEntity: EncryptedSoapEntity = {
      id: soapId,
      sessionId: existing.sessionId,
      episodeId: existing.episodeId,
      patientId: existing.patientId,
      createdAt: existing.createdAt,
      updatedAt: now,
      recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
      dekVersion: activeDekVersion,
      iv,
      ciphertext,
    };

    if (soapMutationTestHook) {
      await soapMutationTestHook('updateSoapNote', {
        soapId,
        sessionId: existing.sessionId,
      });
    }

    // ATOMIC IN-TRANSACTION RE-READ & CONCURRENCY CHECK
    await database.transaction(
      'rw',
      [database.sessions, database.soapNotes, database.vaultMeta],
      async () => {
        const latestSoapEntity = await database.soapNotes.get(soapId);
        if (!latestSoapEntity) {
          throw new StaleTabOverwriteError(
            'تم حذف ملاحظة SOAP في تبويب آخر (Changed in another tab).'
          );
        }
        if (
          latestSoapEntity.updatedAt !== baselineSoapUpdatedAt ||
          !areUint8ArraysEqual(latestSoapEntity.iv, baselineSoapIv)
        ) {
          throw new StaleTabOverwriteError(
            'تم تعديل أو اعتماد ملاحظة SOAP في تبويب آخر (Changed in another tab). يرجى إعادة التحميل.'
          );
        }

        const latestSessionEntity = await database.sessions.get(existing.sessionId);
        if (!latestSessionEntity) {
          throw new ReferentialIntegrityError(
            `لا يمكن حفظ ملاحظة SOAP: الجلسة الأم "${existing.sessionId}" غير موجودة أو تم حذفها في تبويب آخر.`
          );
        }
        if (
          baselineSessionUpdatedAt !== undefined &&
          (latestSessionEntity.updatedAt !== baselineSessionUpdatedAt ||
            (baselineSessionIv &&
              !areUint8ArraysEqual(latestSessionEntity.iv, baselineSessionIv)))
        ) {
          throw new StaleTabOverwriteError(
            'تم تعديل أو اعتماد الجلسة الأم في تبويب آخر (Changed in another tab). يرجى إعادة التحميل.'
          );
        }

        const allForSession = await database.soapNotes
          .where('sessionId')
          .equals(existing.sessionId)
          .toArray();
        if (allForSession.some((n) => n.id !== soapId)) {
          throw new StaleTabOverwriteError(
            'تعارض 1:1 في ملاحظة SOAP للجلسة عبر التبويبات (Changed in another tab).'
          );
        }

        await database.soapNotes.put(updatedEntity);
      }
    );

    return {
      id: soapId,
      sessionId: existing.sessionId,
      episodeId: existing.episodeId,
      patientId: existing.patientId,
      createdAt: existing.createdAt,
      updatedAt: now,
      data: updatedData,
    };
  }

  /**
   * Delete an unfinalized draft SOAP note atomically.
   * Strictly rejects deletion if the SOAP note is finalized, its parent session is finalized,
   * clinical addenda exist, or another tab modified/finalized either record in between.
   */
  static async deleteSoapNote(
    soapId: string,
    dek: CryptoKey,
    database: PhysioRecordDatabase = defaultDb,
    expectedUpdatedAt?: string
  ): Promise<void> {
    const existingEntity = await database.soapNotes.get(soapId);
    if (!existingEntity) {
      throw new Error(`ملاحظة SOAP بالمعرف "${soapId}" غير موجودة.`);
    }

    if (expectedUpdatedAt !== undefined && existingEntity.updatedAt !== expectedUpdatedAt) {
      throw new StaleTabOverwriteError(
        'تم تعديل ملاحظة SOAP في تبويب آخر (Changed in another tab). يرجى إعادة التحميل.'
      );
    }

    const baselineSoapUpdatedAt = expectedUpdatedAt ?? existingEntity.updatedAt;
    const baselineSoapIv = existingEntity.iv;
    const soap = await this.decryptSoapEntity(existingEntity, dek);

    if (soap.data.isFinalized) {
      throw new CannotDeleteFinalizedRecordError(
        'لا يمكن حذف ملاحظة SOAP معتمدة نهائياً. يجب الحفاظ على السجلات السريرية المعتمدة وفق سياسة الاحتفاظ.'
      );
    }

    const sessionEntity = await database.sessions.get(soap.sessionId);
    const baselineSessionUpdatedAt = sessionEntity?.updatedAt;
    const baselineSessionIv = sessionEntity?.iv;

    if (sessionEntity) {
      const sessionDecrypted = await decryptRecordPayload<SessionClinicalData>(
        dek,
        'sessions',
        sessionEntity.id,
        [sessionEntity.patientId, sessionEntity.episodeId],
        sessionEntity.iv,
        sessionEntity.ciphertext,
        sessionEntity.recordCryptoVersion || CURRENT_RECORD_CRYPTO_VERSION,
        sessionEntity.dekVersion || CURRENT_DEK_VERSION
      );
      if (sessionDecrypted.status === 'finalized') {
        throw new CannotDeleteFinalizedRecordError(
          'لا يمكن حذف ملاحظة SOAP التابعة لجلسة سريرية معتمدة ومؤرخة.'
        );
      }
    }

    if (soapMutationTestHook) {
      await soapMutationTestHook('deleteSoapNote', {
        soapId,
        sessionId: soap.sessionId,
      });
    }

    await database.transaction(
      'rw',
      [database.sessions, database.soapNotes, database.clinicalAddenda],
      async () => {
        const latestSoapEntity = await database.soapNotes.get(soapId);
        if (!latestSoapEntity) {
          return;
        }
        if (
          latestSoapEntity.updatedAt !== baselineSoapUpdatedAt ||
          !areUint8ArraysEqual(latestSoapEntity.iv, baselineSoapIv)
        ) {
          throw new StaleTabOverwriteError(
            'تم تعديل أو اعتماد ملاحظة SOAP في تبويب آخر أثناء محاولة الحذف (Changed in another tab).'
          );
        }

        if (baselineSessionUpdatedAt !== undefined) {
          const latestSessionEntity = await database.sessions.get(soap.sessionId);
          if (
            !latestSessionEntity ||
            latestSessionEntity.updatedAt !== baselineSessionUpdatedAt ||
            (baselineSessionIv &&
              !areUint8ArraysEqual(latestSessionEntity.iv, baselineSessionIv))
          ) {
            throw new StaleTabOverwriteError(
              'تم تعديل أو اعتماد الجلسة الأم في تبويب آخر أثناء محاولة حذف ملاحظة SOAP (Changed in another tab).'
            );
          }
        }

        const addendaCount = await database.clinicalAddenda
          .where('sessionId')
          .equals(soap.sessionId)
          .count();
        if (addendaCount > 0) {
          throw new CannotDeleteFinalizedRecordError(
            'لا يمكن حذف ملاحظة SOAP: توجد ملاحق سريرية (Clinical Addenda) مرتبطة بالجلسة.'
          );
        }

        await database.soapNotes.delete(soapId);
      }
    );
  }

  /**
   * Add a Clinical Addendum (correction/amendment) to a finalized session or SOAP note.
   * Preserves the immutable original record and appends a cryptographically authenticated amendment.
   *
   * Note on `signedByTherapistName`: This records the self-declared active staff label ("Recorded by")
   * selected in the local app, NOT a cryptographically authenticated user identity.
   */
  static async addClinicalAddendum(
    sessionId: string,
    targetTable: 'sessions' | 'soapNotes',
    targetId: string,
    data: {
      reasonForAmendment: AddendumReason;
      amendmentText: string;
      signedByTherapistName: string;
    },
    dek: CryptoKey,
    explicitId?: string,
    database: PhysioRecordDatabase = defaultDb
  ): Promise<ClinicalAddendumRecord> {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new ReferentialIntegrityError('معرّف الجلسة غير صالح لإضافة ملحق.');
    }
    if (targetTable !== 'sessions' && targetTable !== 'soapNotes') {
      throw new ReferentialIntegrityError('جدول الهدف للملحق السريري غير صالح.');
    }
    if (!targetId || typeof targetId !== 'string') {
      throw new ReferentialIntegrityError('معرّف السجل المستهدف غير صالح لإضافة ملحق.');
    }
    if (
      !data.reasonForAmendment ||
      !Object.prototype.hasOwnProperty.call(ADDENDUM_REASONS, data.reasonForAmendment)
    ) {
      throw new Error('سبب الملحق السريري غير صالح (Invalid reasonForAmendment).');
    }

    const trimmedText = data.amendmentText?.trim() ?? '';
    if (!trimmedText) {
      throw new Error('نص التصحيح أو الإضافة السريرية إلزامي (Amendment Text is required).');
    }
    if (trimmedText.length > MAX_ADDENDUM_TEXT_LENGTH) {
      throw new Error(
        `نص الملحق السريري يتجاوز الحد الأقصى المسموح به (${MAX_ADDENDUM_TEXT_LENGTH} حرف).`
      );
    }

    if (!data.signedByTherapistName?.trim()) {
      throw new Error('اسم المعالج المسجّل (Recorded by) إلزامي لإضافة الملحق السريري.');
    }

    const session = await database.sessions.get(sessionId);
    if (!session) {
      throw new ReferentialIntegrityError(`الجلسة بالمعرف "${sessionId}" غير موجودة.`);
    }

    // Append-only rule: clinical addenda can ONLY be attached to finalized records
    const sessionDecrypted = await decryptRecordPayload<SessionClinicalData>(
      dek,
      'sessions',
      session.id,
      [session.patientId, session.episodeId],
      session.iv,
      session.ciphertext,
      session.recordCryptoVersion || CURRENT_RECORD_CRYPTO_VERSION,
      session.dekVersion || CURRENT_DEK_VERSION
    );

    if (sessionDecrypted.status !== 'finalized') {
      throw new Error(
        'لا يمكن إضافة ملحق سريري لجلسة مسودة أو غير معتمدة. الملاحق السريرية مخصصة حصرياً للسجلات المعتمدة نهائياً.'
      );
    }

    let resolvedTargetId = targetId;

    if (targetTable === 'sessions') {
      if (targetId !== sessionId) {
        throw new ReferentialIntegrityError(
          `رفض إضافة الملحق: معرّف الهدف (${targetId}) لا يطابق معرّف الجلسة (${sessionId}).`
        );
      }
      resolvedTargetId = session.id;
    } else {
      // Strictly look up SOAP note by its real ID (no sessionId fallback)
      const soap = await this.getSoapNoteById(targetId, dek, database);
      if (!soap) {
        throw new ReferentialIntegrityError(`ملاحظة SOAP بالمعرف "${targetId}" غير موجودة.`);
      }
      if (soap.sessionId !== sessionId) {
        throw new ReferentialIntegrityError(
          `رفض إضافة الملحق: ملاحظة SOAP (${soap.id}) تنتمي لجلسة أخرى (${soap.sessionId} != ${sessionId}).`
        );
      }
      if (soap.patientId !== session.patientId) {
        throw new ReferentialIntegrityError(
          `رفض إضافة الملحق: ملاحظة SOAP (${soap.id}) تنتمي لمريض آخر (${soap.patientId} != ${session.patientId}).`
        );
      }
      if (!soap.data.isFinalized) {
        throw new Error(
          'لا يمكن إضافة ملحق سريري لملاحظة SOAP غير معتمدة. الملاحق السريرية مخصصة حصرياً للسجلات المعتمدة نهائياً.'
        );
      }
      resolvedTargetId = soap.id;
    }

    const id = explicitId || crypto.randomUUID();
    const now = new Date().toISOString();

    const addendumData: ClinicalAddendumData = {
      targetTable,
      targetId: resolvedTargetId,
      reasonForAmendment: data.reasonForAmendment,
      amendmentText: trimmedText,
      signedByTherapistName: data.signedByTherapistName.trim(),
      createdAt: now,
    };

    const meta = await database.vaultMeta.get('auth');
    const activeDekVersion = meta?.dekVersion || CURRENT_DEK_VERSION;

    // Canonical AAD: clinicalAddenda:id:patientId,sessionId:1:dekVersion
    const { iv, ciphertext } = await encryptRecordWithMandatoryReservation(
      database,
      dek,
      'clinicalAddenda',
      id,
      [session.patientId, sessionId],
      addendumData,
      CURRENT_RECORD_CRYPTO_VERSION,
      activeDekVersion
    );

    const entity: EncryptedClinicalAddendumEntity = {
      id,
      sessionId,
      patientId: session.patientId,
      targetId: resolvedTargetId,
      createdAt: now,
      recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
      dekVersion: activeDekVersion,
      iv,
      ciphertext,
    };

    await database.clinicalAddenda.put(entity);

    return {
      id,
      sessionId,
      patientId: session.patientId,
      targetId: resolvedTargetId,
      createdAt: now,
      data: addendumData,
    };
  }

  /**
   * Fetch and decrypt all Clinical Addenda associated with a given Session.
   * Returns both decrypted `records` and `failedCount` so the UI can warn if any record failed decryption.
   */
  static async getAddendaBySession(
    sessionId: string,
    dek: CryptoKey,
    database: PhysioRecordDatabase = defaultDb
  ): Promise<AddendaBySessionResult> {
    if (!sessionId || typeof sessionId !== 'string') {
      return { records: [], failedCount: 0 };
    }

    const entities = await database.clinicalAddenda.where('sessionId').equals(sessionId).toArray();
    const records: ClinicalAddendumRecord[] = [];
    let failedCount = 0;

    for (const entity of entities) {
      try {
        const decryptedData = await decryptRecordPayload<ClinicalAddendumData>(
          dek,
          'clinicalAddenda',
          entity.id,
          [entity.patientId, entity.sessionId],
          entity.iv,
          entity.ciphertext,
          entity.recordCryptoVersion || CURRENT_RECORD_CRYPTO_VERSION,
          entity.dekVersion || CURRENT_DEK_VERSION
        );

        records.push({
          id: entity.id,
          sessionId: entity.sessionId,
          patientId: entity.patientId,
          targetId: entity.targetId,
          createdAt: entity.createdAt,
          data: decryptedData,
        });
      } catch (err) {
        failedCount++;
        console.error(`Failed to decrypt addendum ${entity.id}:`, err);
      }
    }

    records.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return { records, failedCount };
  }

  /**
   * Append-only enforcement: Modifying an existing Clinical Addendum is strictly forbidden.
   */
  static async updateClinicalAddendum(): Promise<never> {
    throw new Error(
      'محظور: الملاحق السريرية (Clinical Addenda) هي سجل تراكمي غير قابل للتعديل (Append-only Ledger).'
    );
  }

  /**
   * Append-only enforcement: Deleting an existing Clinical Addendum is strictly forbidden.
   */
  static async deleteClinicalAddendum(): Promise<never> {
    throw new Error(
      'محظور: الملاحق السريرية (Clinical Addenda) هي سجل تراكمي غير قابل للحذف (Append-only Ledger).'
    );
  }
}
