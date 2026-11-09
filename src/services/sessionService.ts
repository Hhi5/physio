// =======================================================================
// PhysioRecord — Clinical Session Service Layer (v2.0)
// Centralized Envelope Encryption with Mandatory DEK Reservation & Referential Integrity
// =======================================================================

import { db as defaultDb, PhysioRecordDatabase } from '../db/db';
import {
  encryptRecordWithMandatoryReservation,
  decryptRecordPayload,
  computeSessionNumberHmacToken,
  getDekGeneration,
  CURRENT_RECORD_CRYPTO_VERSION,
  CURRENT_DEK_VERSION,
} from '../crypto/vault';
import { registerTestHooks } from '../utils/testHooks';
import { ReferentialIntegrityError } from '../db/registry';
import { EpisodeService } from './episodeService';
import { SoapService } from './soapService';
import {
  CannotDeleteFinalizedRecordError,
  VaultGenerationChangedError,
  UnboundVaultKeyError,
  CURRENT_SOAP_SCHEMA_VERSION,
  type SessionRecord,
  type SessionClinicalData,
  type EncryptedSessionEntity,
  type SoapNoteData,
  type EncryptedSoapEntity,
  type SessionType,
  type SessionStatus,
  type AttendanceStatus,
} from '../types/clinical';
import { localDate } from '../utils/date';


interface LegacyEncryptedSessionEntity extends EncryptedSessionEntity {
  sessionDate?: string;
  sessionType?: SessionType;
  sessionStatus?: SessionStatus;
  status?: SessionStatus;
}

/**
 * Compute SHA-256 digest for content integrity verification
 */
async function computeSha256Digest(data: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Keyed FIFO Async Mutex to guarantee atomic sequential execution per resource key (e.g. episodeId).
 * Solves concurrency race conditions without blocking concurrent operations on different keys.
 */
class AsyncKeyedMutex {
  private queues = new Map<string, Promise<void>>();

  async runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const currentQueue = this.queues.get(key) || Promise.resolve();

    let release: () => void;
    const nextInQueue = new Promise<void>((resolve) => {
      release = resolve;
    });

    const tail = currentQueue.then(() => nextInQueue, () => nextInQueue);
    this.queues.set(key, tail);

    await currentQueue;
    try {
      return await fn();
    } finally {
      if (this.queues.get(key) === tail) {
        this.queues.delete(key);
      }
      release!();
    }
  }
}

const sessionCreationMutex = new AsyncKeyedMutex();

/**
 * Test hook signature for intercepting session creation steps during automated E2E concurrency tests.
 * Only active when explicitly set by tests.
 */
export type SessionCreationTestHook = (
  stage: 'after-reservation' | 'before-commit',
  context: {
    episodeId: string;
    sessionNumber: number;
    expectedVaultGeneration: number;
  }
) => Promise<void> | void;

let sessionCreationTestHook: SessionCreationTestHook | null = null;

export const setSessionCreationTestHook = (hook: SessionCreationTestHook | null) => {
  sessionCreationTestHook = hook;
};

// Safely register test hook on window for test environments only (no-op in production)
registerTestHooks({
  setSessionCreationTestHook,
});

export class SessionService {
  /**
   * Compute the next unique session number from an array of existing sessions in an episode.
   * Ensures deleted drafts or manual numbers never cause a count+1 collision.
   */
  static computeNextSessionNumber(
    existingSessions: Array<{ sessionNumber?: number; data?: { sessionNumber?: number } }>
  ): number {
    if (!existingSessions || existingSessions.length === 0) return 1;
    const usedNumbers = new Set<number>();
    let maxNum = 0;
    for (const s of existingSessions) {
      const n = Number(s.sessionNumber ?? s.data?.sessionNumber);
      if (Number.isInteger(n) && n > 0) {
        usedNumbers.add(n);
        if (n > maxNum) maxNum = n;
      }
    }
    let candidate = maxNum + 1;
    while (usedNumbers.has(candidate)) {
      candidate++;
    }
    return candidate;
  }

  /**
   * Fetch and decrypt all sessions belonging to a specific Episode.
   * Enforces referential integrity check: verifies episode and parent patient existence.
   * Chronologically sorts sessions by sessionNumber and sessionDate ascending.
   */
  static async getSessionsByEpisode(
    episodeId: string,
    dek: CryptoKey,
    database: PhysioRecordDatabase = defaultDb
  ): Promise<SessionRecord[]> {
    if (!episodeId || typeof episodeId !== 'string') {
      throw new ReferentialIntegrityError('معرّف حلقة الرعاية غير صالح.');
    }

    const episode = await database.episodes.get(episodeId);
    if (!episode) {
      throw new ReferentialIntegrityError(`حلقة الرعاية بالمعرف "${episodeId}" غير موجودة.`);
    }

    const encryptedEntities = await database.sessions.where('episodeId').equals(episodeId).toArray();
    const records: SessionRecord[] = [];

    for (const entity of encryptedEntities) {
      try {
        const decryptedData = await decryptRecordPayload<SessionClinicalData>(
          dek,
          'sessions',
          entity.id,
          [entity.patientId, entity.episodeId],
          entity.iv,
          entity.ciphertext,
          entity.recordCryptoVersion || CURRENT_RECORD_CRYPTO_VERSION,
          entity.dekVersion || CURRENT_DEK_VERSION
        );

        const legacyEntity = entity as LegacyEncryptedSessionEntity;
        const sessionNumber: number = decryptedData.sessionNumber || 1;
        const sessionDate: string =
          decryptedData.sessionDate || legacyEntity.sessionDate || localDate(entity.createdAt);
        const sessionType: SessionType =
          decryptedData.sessionType || legacyEntity.sessionType || 'follow_up';
        const status: SessionStatus =
          decryptedData.status || legacyEntity.sessionStatus || legacyEntity.status || 'draft';
        const attendanceStatus: AttendanceStatus = decryptedData.attendanceStatus || 'attended';

        records.push({
          id: entity.id,
          episodeId: entity.episodeId,
          patientId: entity.patientId,
          sessionNumber,
          sessionDate,
          sessionType,
          status,
          attendanceStatus,
          createdAt: entity.createdAt,
          updatedAt: entity.updatedAt,
          data: {
            ...decryptedData,
            sessionNumber,
            sessionDate,
            sessionType,
            status,
            attendanceStatus,
          },
        });
      } catch (err) {
        console.error(`Failed to decrypt session record ${entity.id}:`, err);
      }
    }

    // Sort chronologically ascending by actual decrypted clinical date (sessionDate),
    // with sessionNumber and createdAt as deterministic tiebreakers
    records.sort((a, b) => {
      const dateA = new Date(a.sessionDate).getTime();
      const dateB = new Date(b.sessionDate).getTime();
      if (dateA !== dateB) {
        return dateA - dateB;
      }
      if (a.sessionNumber !== b.sessionNumber) {
        return a.sessionNumber - b.sessionNumber;
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    return records;
  }

  /**
   * Fetch and decrypt a single session by its unique ID.
   */
  static async getSessionById(
    sessionId: string,
    dek: CryptoKey,
    database: PhysioRecordDatabase = defaultDb
  ): Promise<SessionRecord | null> {
    if (!sessionId || typeof sessionId !== 'string') return null;

    const entity = await database.sessions.get(sessionId);
    if (!entity) return null;

    const decryptedData = await decryptRecordPayload<SessionClinicalData>(
      dek,
      'sessions',
      entity.id,
      [entity.patientId, entity.episodeId],
      entity.iv,
      entity.ciphertext,
      entity.recordCryptoVersion || CURRENT_RECORD_CRYPTO_VERSION,
      entity.dekVersion || CURRENT_DEK_VERSION
    );

    const legacyEntity = entity as LegacyEncryptedSessionEntity;
    const sessionNumber: number = decryptedData.sessionNumber || 1;
    const sessionDate: string =
      decryptedData.sessionDate || legacyEntity.sessionDate || localDate(entity.createdAt);
    const sessionType: SessionType =
      decryptedData.sessionType || legacyEntity.sessionType || 'follow_up';
    const status: SessionStatus =
      decryptedData.status || legacyEntity.sessionStatus || legacyEntity.status || 'draft';
    const attendanceStatus: AttendanceStatus = decryptedData.attendanceStatus || 'attended';

    return {
      id: entity.id,
      episodeId: entity.episodeId,
      patientId: entity.patientId,
      sessionNumber,
      sessionDate,
      sessionType,
      status,
      attendanceStatus,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      data: {
        ...decryptedData,
        sessionNumber,
        sessionDate,
        sessionType,
        status,
        attendanceStatus,
      },
    };
  }

  /**
   * Atomically reserve the next session number for an episode in IndexedDB.
   * Uses a Dexie readwrite transaction on `episodeSequences` to guarantee mutual exclusion
   * across multiple browser tabs and windows sharing the same database origin.
   * Protects session numbers by storing them as opaque HMAC-SHA-256 tokens rather than plaintext integers.
   */
  static async reserveNextSessionNumber(
    episodeId: string,
    requestedNumber: number | undefined,
    dek: CryptoKey,
    database: PhysioRecordDatabase = defaultDb,
    explicitExpectedGeneration?: number
  ): Promise<number> {
    const actualBoundGeneration = getDekGeneration(dek);
    if (actualBoundGeneration === undefined) {
      throw new UnboundVaultKeyError(
        'تم رفض حجز رقم الجلسة: مفتاح التشفير التشغيلي (DEK) غير مرتبط بأي جيل خزينة معتمد (Unbound Vault Key). لا يمكن حجز رقم تسلسلي بمفتاح مجهول الجيل.'
      );
    }

    if (
      explicitExpectedGeneration !== undefined &&
      explicitExpectedGeneration !== actualBoundGeneration
    ) {
      throw new VaultGenerationChangedError(
        `تم رفض حجز رقم الجلسة: الجيل الممرر صراحة (${explicitExpectedGeneration}) لا يطابق جيل الخزينة الفعلي المرتبط بالمفتاح (${actualBoundGeneration}).`
      );
    }

    const boundGen = actualBoundGeneration;

    // 1. Always inspect existing sessions outside transaction so manual numbers and deleted drafts are reconciled
    const existingSeq = await database.episodeSequences.get(episodeId);
    const seededTokens: string[] = [];
    const activeSessionNumbers = new Set<number>();
    let maxSeed = 0;

    // Check vaultGeneration before reading sessions to prevent seeding with stale DEK
    const preMeta = await database.vaultMeta.get('auth');
    const preGen = preMeta?.vaultGeneration ?? 1;
    if (preGen !== boundGen) {
      throw new VaultGenerationChangedError(
        `تم رفض حجز رقم الجلسة: تم تغيير جيل الخزينة (المفتاح الحالي ينتمي للجيل: ${boundGen}، بينما جيل الخزينة في قاعدة البيانات: ${preGen}) بسبب عملية استعادة كاملة في تبويب آخر. يرجى إعادة فتح الخزينة بالمفتاح الصحيح.`
      );
    }

    const existingSessions = await this.getSessionsByEpisode(episodeId, dek, database);
    for (const s of existingSessions) {
      if (s.sessionNumber) {
        activeSessionNumbers.add(s.sessionNumber);
        const t = await computeSessionNumberHmacToken(dek, episodeId, s.sessionNumber);
        seededTokens.push(t);
        if (s.sessionNumber > maxSeed) maxSeed = s.sessionNumber;
      }
    }

    // 2. Pre-compute HMAC tokens OUTSIDE the transaction to avoid Dexie PrematureCommitError
    //    (Web Crypto promises cannot be awaited inside an active IndexedDB transaction).
    //    Since baseSeq = max(existingSeq.lastSequenceNumber, max(existingSessions)),
    //    baseSeq + 1 is guaranteed free unless another browser tab reserves it concurrently
    //    in the few milliseconds before the transaction lock is acquired.
    const CONCURRENT_TAB_LOOKAHEAD = 8;
    let requestedToken: string | undefined;
    const candidateTokens = new Map<number, string>();
    if (requestedNumber !== undefined) {
      requestedToken = await computeSessionNumberHmacToken(dek, episodeId, requestedNumber);
    } else {
      const baseSeq = Math.max(existingSeq?.lastSequenceNumber || 0, maxSeed);
      for (let c = baseSeq + 1; c <= baseSeq + CONCURRENT_TAB_LOOKAHEAD; c++) {
        candidateTokens.set(c, await computeSessionNumberHmacToken(dek, episodeId, c));
      }
    }

    // 3. Execute atomic reservation inside an exclusive IndexedDB readwrite transaction
    // MUST cover BOTH episodeSequences and vaultMeta to atomically verify vaultGeneration
    return await database.transaction('rw', [database.episodeSequences, database.vaultMeta], async () => {
      // ATOMIC GENERATION CHECK: Fences out stale DEK from allocating numbers or writing HMAC tokens
      const currentMeta = await database.vaultMeta.get('auth');
      const currentGen = currentMeta?.vaultGeneration ?? 1;
      if (currentGen !== boundGen) {
        throw new VaultGenerationChangedError(
          `تم رفض حجز رقم الجلسة: تم تغيير جيل الخزينة (المفتاح الحالي ينتمي للجيل: ${boundGen}، بينما جيل الخزينة في قاعدة البيانات: ${currentGen}) بسبب عملية استعادة كاملة في تبويب آخر. يرجى إعادة فتح الخزينة بالمفتاح الصحيح.`
        );
      }

      let seq = await database.episodeSequences.get(episodeId);

      if (!seq) {
        seq = {
          episodeId,
          lastSequenceNumber: maxSeed,
          allocatedTokens: [...seededTokens],
          updatedAt: new Date().toISOString(),
        };
      } else {
        // Ensure any existing sessions' tokens and maxSeed are merged into seq
        for (const t of seededTokens) {
          if (!seq.allocatedTokens.includes(t)) {
            seq.allocatedTokens.push(t);
          }
        }
        if (maxSeed > seq.lastSequenceNumber) {
          seq.lastSequenceNumber = maxSeed;
        }
      }

      let allocated: number;

      if (requestedNumber !== undefined && requestedToken !== undefined) {
        if (seq.allocatedTokens.includes(requestedToken) || activeSessionNumbers.has(requestedNumber)) {
          throw new Error(
            `رقم الجلسة #${requestedNumber} مستخدم مسبقاً في هذه الحلقة. يجب أن يكون رقم الجلسة فريداً ضمن حلقة الرعاية.`
          );
        }
        seq.allocatedTokens.push(requestedToken);
        if (requestedNumber > seq.lastSequenceNumber) {
          seq.lastSequenceNumber = requestedNumber;
        }
        allocated = requestedNumber;
      } else {
        let candidate = seq.lastSequenceNumber + 1;
        let candidateToken = candidateTokens.get(candidate);
        while (
          candidateToken &&
          (seq.allocatedTokens.includes(candidateToken) || activeSessionNumbers.has(candidate))
        ) {
          candidate++;
          candidateToken = candidateTokens.get(candidate);
        }
        if (!candidateToken) {
          throw new Error('فشل تخصيص رقم متسلسل للجلسة ضمن نافذة الحجز المسبق.');
        }
        seq.lastSequenceNumber = candidate;
        seq.allocatedTokens.push(candidateToken);
        allocated = candidate;
      }

      seq.updatedAt = new Date().toISOString();
      await database.episodeSequences.put(seq);
      return allocated;
    });
  }

  /**
   * Release an allocated session number token back if session creation fails prior to persistence,
   * or when a draft session is deleted.
   */
  static async releaseSessionNumber(
    episodeId: string,
    sessionNumber: number,
    dek: CryptoKey,
    database: PhysioRecordDatabase = defaultDb
  ): Promise<void> {
    try {
      // Pre-compute token OUTSIDE transaction to prevent IDB transaction timeout
      const token = await computeSessionNumberHmacToken(dek, episodeId, sessionNumber);
      await database.transaction('rw', database.episodeSequences, async () => {
        const seq = await database.episodeSequences.get(episodeId);
        if (seq) {
          seq.allocatedTokens = seq.allocatedTokens.filter((t) => t !== token);
          seq.updatedAt = new Date().toISOString();
          await database.episodeSequences.put(seq);
        }
      });
    } catch (err) {
      console.warn('Failed to release session number token:', err);
    }
  }

  /**
   * Create a new Clinical Session within an active Episode of Care.
   * Enforces referential integrity, parent matching, active episode status, and mandatory DEK reservation.
   * Combines an episode-keyed FIFO mutex (for in-tab concurrency) with an atomic IndexedDB readwrite
   * transaction on `episodeSequences` to guarantee mutual exclusion and unique numbering across browser tabs.
   */
  static async createSession(
    patientId: string,
    episodeId: string,
    data: Partial<SessionClinicalData>,
    dek: CryptoKey,
    explicitId?: string,
    database: PhysioRecordDatabase = defaultDb,
    keyGeneration?: number
  ): Promise<SessionRecord> {
    if (!patientId || typeof patientId !== 'string') {
      throw new ReferentialIntegrityError('معرّف المريض غير صالح.');
    }
    if (!episodeId || typeof episodeId !== 'string') {
      throw new ReferentialIntegrityError('معرّف حلقة الرعاية غير صالح.');
    }

    // Atomic serialization per episode: ensures concurrent requests calculate distinct sequential numbers
    return await sessionCreationMutex.runExclusive(episodeId, async () => {
      // 1. Capture bound vaultGeneration epoch from DEK in memory (FAIL-CLOSED: WeakMap is the SOLE authoritative source!)
      const actualBoundGeneration = getDekGeneration(dek);
      if (actualBoundGeneration === undefined) {
        throw new UnboundVaultKeyError(
          'تم رفض إنشاء الجلسة: مفتاح التشفير التشغيلي (DEK) غير مرتبط بأي جيل خزينة معتمد (Unbound Vault Key). لا يمكن استنتاج جيل المفتاح من قاعدة البيانات.'
        );
      }

      if (
        keyGeneration !== undefined &&
        keyGeneration !== actualBoundGeneration
      ) {
        throw new VaultGenerationChangedError(
          `تم رفض إنشاء الجلسة: جيل المفتاح الممرر صراحة (${keyGeneration}) لا يطابق جيل الخزينة الفعلي المرتبط بالمفتاح (${actualBoundGeneration}).`
        );
      }

      const expectedVaultGeneration = actualBoundGeneration;

      // 2. Referential integrity: check patient exists
      const patient = await database.patients.get(patientId);
      if (!patient) {
        throw new ReferentialIntegrityError(`لا يمكن إنشاء جلسة: المريض بالمعرف "${patientId}" غير موجود.`);
      }

      // 3. Referential integrity: check episode exists and belongs to this patient
      const episode = await EpisodeService.getEpisodeById(episodeId, dek, database);
      if (!episode) {
        throw new ReferentialIntegrityError(`لا يمكن إنشاء جلسة: حلقة الرعاية بالمعرف "${episodeId}" غير موجودة.`);
      }
      if (episode.patientId !== patientId) {
        throw new ReferentialIntegrityError(
          `فشل التحقق من النزاهة المرجعية: حلقة الرعاية "${episodeId}" لا تنتمي للمريض "${patientId}".`
        );
      }

      // 4. Episode lifecycle rule: Cannot create session in closed or archived episode
      if (episode.status === 'completed' || episode.status === 'archived') {
        throw new Error(
          `لا يمكن إنشاء جلسة جديدة: حلقة الرعاية في حالة (${episode.status === 'completed' ? 'مكتملة' : 'مؤرشفة'}). يرجى إعادة فتح الحلقة أولاً.`
        );
      }

      // 5. Validate mandatory session fields
      if (!data.sessionType) {
        throw new Error('نوع الجلسة العلاجية إلزامي (Session Type is required).');
      }

      const id = explicitId || crypto.randomUUID();

      // Check duplicate ID
      const duplicate = await database.sessions.get(id);
      if (duplicate) {
        throw new Error(`الجلسة بالمعرف "${id}" موجودة مسبقاً.`);
      }

      // Cross-tab atomic reservation in IndexedDB: guarantees unique sessionNumber across tabs
      // AND verifies vaultGeneration inside the atomic reservation transaction
      const sessionNumber = await this.reserveNextSessionNumber(
        episodeId,
        data.sessionNumber,
        dek,
        database,
        expectedVaultGeneration
      );

      // Pre-compute HMAC reservation token outside transaction to avoid non-IDB async delays
      const sessionToken = await computeSessionNumberHmacToken(dek, episodeId, sessionNumber);

      // Optional test hook invocation (stage: 'after-reservation')
      if (sessionCreationTestHook) {
        await sessionCreationTestHook('after-reservation', {
          episodeId,
          sessionNumber,
          expectedVaultGeneration,
        });
      }

      try {
        const now = new Date().toISOString();
        const sessionDate = data.sessionDate || localDate();
        const sessionDurationMinutes = data.sessionDurationMinutes || 45;
        const sessionType = data.sessionType;
        const status: SessionStatus = 'draft'; // Always starts as draft
        const attendanceStatus: AttendanceStatus = data.attendanceStatus || 'attended';

        const fullClinicalData: SessionClinicalData = {
          ...data,
          sessionNumber,
          sessionDate,
          sessionDurationMinutes,
          sessionType,
          status,
          attendanceStatus,
        };

        // Centralized encryption with MANDATORY transactional invocation counter reservation
        // Canonical AAD: sessions:id:patientId,episodeId:1:dekVersion
        const meta = await database.vaultMeta.get('auth');
        const activeDekVersion = meta?.dekVersion || CURRENT_DEK_VERSION;

        const { iv, ciphertext } = await encryptRecordWithMandatoryReservation(
          database,
          dek,
          'sessions',
          id,
          [patientId, episodeId],
          fullClinicalData,
          CURRENT_RECORD_CRYPTO_VERSION,
          activeDekVersion,
          expectedVaultGeneration
        );

        // Optional test hook invocation (stage: 'before-commit')
        if (sessionCreationTestHook) {
          await sessionCreationTestHook('before-commit', {
            episodeId,
            sessionNumber,
            expectedVaultGeneration,
          });
        }

        // Entity stored in IndexedDB: strictly random IDs and technical timestamps
        // No Plaintext Clinical Payload — Technical Metadata Remains Visible
        const entity: EncryptedSessionEntity = {
          id,
          episodeId,
          patientId,
          createdAt: now,
          updatedAt: now,
          recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
          dekVersion: activeDekVersion,
          iv,
          ciphertext,
        };

        // VAULT GENERATION & RESERVATION FENCE:
        // Open an exclusive Dexie read-write transaction covering sessions, episodeSequences, and vaultMeta.
        // Guarantees that:
        // 1. vaultGeneration has NOT changed (fences out concurrent Full Restore that rotated keys)
        // 2. The reserved HMAC token is still present and valid in episodeSequences
        // 3. The session entity is committed atomically in the same transaction
        await database.transaction(
          'rw',
          [database.sessions, database.episodeSequences, database.vaultMeta],
          async () => {
            const currentMeta = await database.vaultMeta.get('auth');
            const currentGen = currentMeta?.vaultGeneration ?? 1;
            if (currentGen !== expectedVaultGeneration) {
              throw new VaultGenerationChangedError(
                `تم رفض حفظ الجلسة: تم تغيير جيل الخزينة (متوقع: ${expectedVaultGeneration}، الحالي: ${currentGen}) بواسطة عملية استعادة كاملة أثناء العملية. تم إلغاء العملية لحماية اتساق التشفير وقاعدة البيانات.`
              );
            }

            const seq = await database.episodeSequences.get(episodeId);
            if (!seq || !seq.allocatedTokens.includes(sessionToken)) {
              throw new VaultGenerationChangedError(
                `تم رفض حفظ الجلسة: حجز رقم الجلسة #${sessionNumber} لم يعد موجوداً أو صالحاً في تسلسل الحلقة (ربما تم استبدال قاعدة البيانات بالكامل).`
              );
            }

            await database.sessions.put(entity);
          }
        );

        return {
          id,
          episodeId,
          patientId,
          sessionNumber,
          sessionDate,
          sessionType,
          status,
          attendanceStatus,
          createdAt: now,
          updatedAt: now,
          data: fullClinicalData,
        };
      } catch (err) {
        // If the error was caused by a vault generation change (e.g. database replaced by Full Restore)
        // or an unbound key error, do NOT attempt releaseSessionNumber because the local database was already replaced
        // or the reservation token was never properly allocated under a valid generation.
        if (!(err instanceof VaultGenerationChangedError) && !(err instanceof UnboundVaultKeyError)) {
          await this.releaseSessionNumber(episodeId, sessionNumber, dek, database);
        }
        throw err;
      }
    });
  }

  /**
   * Update an existing draft Clinical Session.
   * Prevents direct modifications of finalized sessions.
   */
  static async updateSession(
    sessionId: string,
    data: Partial<SessionClinicalData>,
    dek: CryptoKey,
    database: PhysioRecordDatabase = defaultDb
  ): Promise<SessionRecord> {
    const existing = await this.getSessionById(sessionId, dek, database);
    if (!existing) {
      throw new Error(`الجلسة بالمعرف "${sessionId}" غير موجودة.`);
    }

    // IMMUTABILITY RULE 1: Finalized sessions cannot be modified directly
    if (existing.status === 'finalized') {
      throw new Error(
        'لا يمكن تعديل جلسة سريرية معتمدة نهائياً. يسمح النظام فقط بإضافة ملحق سريري (Clinical Addendum) للتصحيح أو الاستكمال.'
      );
    }

    // IMMUTABILITY RULE 2: Session cannot be modified if its associated SOAP note is finalized
    const existingSoap = await SoapService.getSoapNoteBySession(sessionId, dek, database);
    if (existingSoap && existingSoap.data.isFinalized) {
      throw new Error(
        'لا يمكن تعديل جلسة سريرية مرتبطة بملاحظة SOAP معتمدة ومغلقة نهائياً.'
      );
    }

    const meta = await database.vaultMeta.get('auth');
    const activeDekVersion = meta?.dekVersion || CURRENT_DEK_VERSION;
    const now = new Date().toISOString();

    const updatedData: SessionClinicalData = {
      ...existing.data,
      ...data,
      sessionNumber: existing.sessionNumber, // preserve immutable sequence number
      status: existing.status, // preserve draft status
    };

    const { iv, ciphertext } = await encryptRecordWithMandatoryReservation(
      database,
      dek,
      'sessions',
      sessionId,
      [existing.patientId, existing.episodeId],
      updatedData,
      CURRENT_RECORD_CRYPTO_VERSION,
      activeDekVersion
    );

    const updatedEntity: EncryptedSessionEntity = {
      id: sessionId,
      episodeId: existing.episodeId,
      patientId: existing.patientId,
      createdAt: existing.createdAt,
      updatedAt: now,
      recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
      dekVersion: activeDekVersion,
      iv,
      ciphertext,
    };

    await database.sessions.put(updatedEntity);

    return {
      id: sessionId,
      episodeId: existing.episodeId,
      patientId: existing.patientId,
      sessionNumber: existing.sessionNumber,
      sessionDate: updatedData.sessionDate,
      sessionType: updatedData.sessionType,
      status: updatedData.status,
      attendanceStatus: updatedData.attendanceStatus,
      createdAt: existing.createdAt,
      updatedAt: now,
      data: updatedData,
    };
  }

  /**
   * Cancel a draft session with documented cancellation reason.
   */
  static async cancelSession(
    sessionId: string,
    cancellationReason: string,
    attendanceStatus: 'cancelled_patient' | 'cancelled_clinic' | 'no_show',
    dek: CryptoKey,
    database: PhysioRecordDatabase = defaultDb
  ): Promise<SessionRecord> {
    const existing = await this.getSessionById(sessionId, dek, database);
    if (!existing) {
      throw new Error(`الجلسة بالمعرف "${sessionId}" غير موجودة.`);
    }

    if (existing.status === 'finalized') {
      throw new Error('لا يمكن إلغاء جلسة سريرية معتمدة ومغلقة نهائياً.');
    }

    if (!cancellationReason?.trim()) {
      throw new Error('سبب إلغاء الجلسة إلزامي للتوثيق الإداري والسريري.');
    }

    const meta = await database.vaultMeta.get('auth');
    const activeDekVersion = meta?.dekVersion || CURRENT_DEK_VERSION;
    const now = new Date().toISOString();

    const updatedData: SessionClinicalData = {
      ...existing.data,
      status: 'cancelled',
      attendanceStatus,
      cancellationReason: cancellationReason.trim(),
    };

    const { iv, ciphertext } = await encryptRecordWithMandatoryReservation(
      database,
      dek,
      'sessions',
      sessionId,
      [existing.patientId, existing.episodeId],
      updatedData,
      CURRENT_RECORD_CRYPTO_VERSION,
      activeDekVersion
    );

    const entity: EncryptedSessionEntity = {
      id: sessionId,
      episodeId: existing.episodeId,
      patientId: existing.patientId,
      createdAt: existing.createdAt,
      updatedAt: now,
      recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
      dekVersion: activeDekVersion,
      iv,
      ciphertext,
    };

    await database.sessions.put(entity);

    return {
      id: sessionId,
      episodeId: existing.episodeId,
      patientId: existing.patientId,
      sessionNumber: existing.sessionNumber,
      sessionDate: updatedData.sessionDate,
      sessionType: updatedData.sessionType,
      status: 'cancelled',
      attendanceStatus,
      createdAt: existing.createdAt,
      updatedAt: now,
      data: updatedData,
    };
  }

  /**
   * Finalize a Clinical Session and its associated SOAP Note atomically in ONE Dexie transaction.
   * Strictly enforces:
   * 1. Attended sessions MUST have a completed SOAP note before finalization.
   * 2. Subjective chief complaint, Objective findings/flowsheet, Assessment impression, and Plan must be filled.
   * 3. Computes SHA-256 content integrity digests and AES-256-GCM ciphertexts BEFORE opening the Dexie transaction.
   * 4. Commits both `soapNote.isFinalized = true` and `session.status = 'finalized'` in ONE atomic Dexie transaction.
   */
  static async finalizeSession(
    sessionId: string,
    therapistName: string,
    dek: CryptoKey,
    database: PhysioRecordDatabase = defaultDb
  ): Promise<SessionRecord> {
    if (!therapistName?.trim()) {
      throw new Error('اسم المعالج الطبيعي المعتمد إلزامي لاعتماد السجل السريري.');
    }

    const expectedGen = getDekGeneration(dek);
    if (expectedGen === undefined) {
      throw new UnboundVaultKeyError(
        'تم رفض اعتماد الجلسة: مفتاح التشفير التشغيلي (DEK) غير مرتبط بأي جيل خزينة معتمد.'
      );
    }

    const session = await this.getSessionById(sessionId, dek, database);
    if (!session) {
      throw new Error(`الجلسة بالمعرف "${sessionId}" غير موجودة.`);
    }

    if (session.status === 'finalized') {
      throw new Error('هذه الجلسة معتمدة مسبقاً.');
    }

    const now = new Date().toISOString();
    const signer = therapistName.trim();
    const meta = await database.vaultMeta.get('auth');
    const activeDekVersion = meta?.dekVersion || CURRENT_DEK_VERSION;

    let soapDigest = '';
    let finalizedSoapEntity: EncryptedSoapEntity | null = null;

    // If attended, SOAP note is mandatory and ALL 4 AXES must be addressed!
    if (session.attendanceStatus === 'attended') {
      const soap = await SoapService.getSoapNoteBySession(sessionId, dek, database);
      if (!soap) {
        throw new Error(
          'لا يمكن اعتماد الجلسة السريرية: يجب توثيق وإكمال ملاحظة SOAP أولاً للجلسات التي حضرها المريض.'
        );
      }

      // 1. Check Axis S (Subjective): Chief Complaint is mandatory
      if (!soap.data.subjective?.chiefComplaint?.trim()) {
        throw new Error('الشكوى الحالية للمريض (Chief Complaint) إلزامية في محور S لاعتماد الجلسة.');
      }

      // 2. Check Axis O (Objective): Must document findings, flowsheet, or explicitly justify not_assessed
      const obj = soap.data.objective;
      const hasFlowsheetItems = Boolean(
        obj?.flowsheet &&
          ((obj.flowsheet.exercises && obj.flowsheet.exercises.length > 0) ||
            (obj.flowsheet.manualTherapy && obj.flowsheet.manualTherapy.length > 0) ||
            (obj.flowsheet.physicalAgents && obj.flowsheet.physicalAgents.length > 0))
      );
      const hasObjectiveFindings = Boolean(
        hasFlowsheetItems ||
          obj?.objectiveFindings?.trim() ||
          obj?.clinicalObservations?.trim() ||
          obj?.functionalOrPreliminaryMeasurements?.trim() ||
          obj?.dailyInterventionsSummary?.trim() ||
          (obj?.romBattery?.entries && obj.romBattery.entries.length > 0) ||
          (obj?.mmtBattery?.entries && obj.mmtBattery.entries.length > 0) ||
          (obj?.neuroScreening &&
            ((obj.neuroScreening.myotomes && obj.neuroScreening.myotomes.length > 0) ||
              (obj.neuroScreening.dermatomes && obj.neuroScreening.dermatomes.length > 0) ||
              (obj.neuroScreening.reflexes && obj.neuroScreening.reflexes.length > 0))) ||
          obj?.isWithinNormalLimits ||
          obj?.status === 'normal_findings'
      );
      const isExplicitlyNotAssessed =
        obj?.status === 'not_assessed' && Boolean(obj?.notAssessedReason?.trim());

      if (!hasObjectiveFindings && !isExplicitlyNotAssessed) {
        throw new Error(
          'محور الفحص والملاحظات الموضوعية (Objective — O) إلزامي لاعتماد الجلسة. يجب تدوين نتائج الفحص السريري أو تحديد حالة "لم يتم إجراء فحص موضوعي" مع تسجيل السبب السريري المبرر.'
        );
      }

      // 3. Check Axis A (Assessment): Clinical Impression is mandatory
      if (!soap.data.assessment?.clinicalImpressionCurrent?.trim()) {
        throw new Error('الانطباع والتفسير السريري (Clinical Impression) إلزامي في محور A لاعتماد الجلسة.');
      }

      // 4. Check Axis P (Plan): Next Session Plan is mandatory
      if (!soap.data.plan?.nextSessionPlan?.trim()) {
        throw new Error('الخطة للجلسة القادمة (Next Session Plan) إلزامية في محور P لاعتماد الجلسة.');
      }

      // Prepare finalized SOAP payload and compute SHA-256 content seal BEFORE opening Dexie transaction
      const soapContentForSeal: SoapNoteData = {
        ...soap.data,
        soapSchemaVersion: soap.data.soapSchemaVersion ?? CURRENT_SOAP_SCHEMA_VERSION,
        isFinalized: true,
        finalizedAt: now,
        finalizedBy: signer,
      };
      const soapContentSeal = await computeSha256Digest(JSON.stringify(soapContentForSeal));
      const finalizedSoapData: SoapNoteData = {
        ...soapContentForSeal,
        contentDigestSha256: soapContentSeal,
      };

      const { iv: soapIv, ciphertext: soapCiphertext } =
        await encryptRecordWithMandatoryReservation(
          database,
          dek,
          'soapNotes',
          soap.id,
          [soap.patientId, soap.episodeId, soap.sessionId],
          finalizedSoapData,
          CURRENT_RECORD_CRYPTO_VERSION,
          activeDekVersion,
          expectedGen
        );

      finalizedSoapEntity = {
        id: soap.id,
        sessionId: soap.sessionId,
        episodeId: soap.episodeId,
        patientId: soap.patientId,
        createdAt: soap.createdAt,
        updatedAt: now,
        recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
        dekVersion: activeDekVersion,
        iv: soapIv,
        ciphertext: soapCiphertext,
      };

      soapDigest = JSON.stringify(finalizedSoapData);
    }

    // Compute content integrity digest (SHA-256 cryptographic digest across session and SOAP payloads)
    const contentToDigest = `${JSON.stringify(session.data)}::${soapDigest}`;
    const digestHex = await computeSha256Digest(contentToDigest);

    const finalizedData: SessionClinicalData = {
      ...session.data,
      status: 'finalized',
      finalizedAt: now,
      finalizedBy: signer,
      attestationByTherapistName: signer,
      attestationTimestamp: now,
      contentIntegrityDigestSha256: digestHex,
    };

    const { iv, ciphertext } = await encryptRecordWithMandatoryReservation(
      database,
      dek,
      'sessions',
      sessionId,
      [session.patientId, session.episodeId],
      finalizedData,
      CURRENT_RECORD_CRYPTO_VERSION,
      activeDekVersion,
      expectedGen
    );

    const entity: EncryptedSessionEntity = {
      id: sessionId,
      episodeId: session.episodeId,
      patientId: session.patientId,
      createdAt: session.createdAt,
      updatedAt: now,
      recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
      dekVersion: activeDekVersion,
      iv,
      ciphertext,
    };

    // ATOMIC SINGLE-TRANSACTION COMMIT:
    // Both soapNote (isFinalized = true + seal + signer) and session (status = 'finalized')
    // are committed together in ONE Dexie readwrite transaction.
    await database.transaction(
      'rw',
      [database.sessions, database.soapNotes, database.vaultMeta],
      async () => {
        const currentMeta = await database.vaultMeta.get('auth');
        const currentGen = currentMeta?.vaultGeneration ?? 1;
        if (currentGen !== expectedGen) {
          throw new VaultGenerationChangedError(
            `تم رفض اعتماد الجلسة: تغير جيل الخزينة (${expectedGen} != ${currentGen}) أثناء العملية.`
          );
        }
        if (finalizedSoapEntity) {
          await database.soapNotes.put(finalizedSoapEntity);
        }
        await database.sessions.put(entity);
      }
    );

    return {
      id: sessionId,
      episodeId: session.episodeId,
      patientId: session.patientId,
      sessionNumber: session.sessionNumber,
      sessionDate: finalizedData.sessionDate,
      sessionType: finalizedData.sessionType,
      status: 'finalized',
      attendanceStatus: finalizedData.attendanceStatus,
      createdAt: session.createdAt,
      updatedAt: now,
      data: finalizedData,
    };
  }

  /**
   * Idempotent repair routine (runs after unlock):
   * Finds any sessions with `status === 'finalized'` whose associated `soapNote.data.isFinalized` is false
   * (caused by the pre-Phase-1A TreatmentSessionView bug), finalizes the SOAP note using the session's
   * recorded signer/timestamp, and marks `repairedDuringMigration: true` + `repairedAt` for honesty.
   * All crypto is computed BEFORE opening the Dexie transaction.
   */
  static async repairHalfFinalizedSessions(
    dek: CryptoKey,
    database: PhysioRecordDatabase = defaultDb
  ): Promise<{ repairedCount: number; repairedSessionIds: string[] }> {
    const expectedGen = getDekGeneration(dek);
    if (expectedGen === undefined) {
      throw new UnboundVaultKeyError(
        'تم رفض فحص وإصلاح الجلسات: مفتاح التشفير التشغيلي (DEK) غير مرتبط بأي جيل خزينة معتمد.'
      );
    }

    const meta = await database.vaultMeta.get('auth');
    const activeDekVersion = meta?.dekVersion || CURRENT_DEK_VERSION;
    const allSessionEntities = await database.sessions.toArray();

    const stagedSoapRepairs: EncryptedSoapEntity[] = [];
    const repairedSessionIds: string[] = [];
    const repairedAt = new Date().toISOString();

    for (const sEntity of allSessionEntities) {
      let sData: SessionClinicalData;
      try {
        sData = await decryptRecordPayload<SessionClinicalData>(
          dek,
          'sessions',
          sEntity.id,
          [sEntity.patientId, sEntity.episodeId],
          sEntity.iv,
          sEntity.ciphertext,
          sEntity.recordCryptoVersion || CURRENT_RECORD_CRYPTO_VERSION,
          sEntity.dekVersion || CURRENT_DEK_VERSION
        );
      } catch {
        continue;
      }

      if (sData.status !== 'finalized') continue;

      const soap = await SoapService.getSoapNoteBySession(sEntity.id, dek, database);
      if (!soap || soap.data.isFinalized) continue;

      const recordedSigner =
        sData.finalizedBy ||
        sData.attestationByTherapistName ||
        sData.therapistName ||
        'System Migration Repair';
      const recordedFinalizedAt =
        sData.finalizedAt || sData.attestationTimestamp || sEntity.updatedAt || repairedAt;

      const repairedBase: SoapNoteData = {
        ...soap.data,
        soapSchemaVersion: soap.data.soapSchemaVersion ?? CURRENT_SOAP_SCHEMA_VERSION,
        isFinalized: true,
        finalizedAt: recordedFinalizedAt,
        finalizedBy: recordedSigner,
        repairedDuringMigration: true,
        repairedAt,
      };
      const seal = await computeSha256Digest(JSON.stringify(repairedBase));
      const repairedSoapData: SoapNoteData = {
        ...repairedBase,
        contentDigestSha256: seal,
      };

      const { iv: newIv, ciphertext: newCiphertext } =
        await encryptRecordWithMandatoryReservation(
          database,
          dek,
          'soapNotes',
          soap.id,
          [soap.patientId, soap.episodeId, soap.sessionId],
          repairedSoapData,
          CURRENT_RECORD_CRYPTO_VERSION,
          activeDekVersion,
          expectedGen
        );

      stagedSoapRepairs.push({
        id: soap.id,
        sessionId: soap.sessionId,
        episodeId: soap.episodeId,
        patientId: soap.patientId,
        createdAt: soap.createdAt,
        updatedAt: repairedAt,
        recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
        dekVersion: activeDekVersion,
        iv: newIv,
        ciphertext: newCiphertext,
      });
      repairedSessionIds.push(sEntity.id);
    }

    if (stagedSoapRepairs.length > 0) {
      await database.transaction('rw', [database.soapNotes, database.vaultMeta], async () => {
        const currentMeta = await database.vaultMeta.get('auth');
        const currentGen = currentMeta?.vaultGeneration ?? 1;
        if (currentGen !== expectedGen) {
          throw new VaultGenerationChangedError(
            `تم رفض حفظ إصلاح الملاحظات السريرية: تغير جيل الخزينة (${expectedGen} != ${currentGen}).`
          );
        }
        await database.soapNotes.bulkPut(stagedSoapRepairs);
      });
    }

    return {
      repairedCount: stagedSoapRepairs.length,
      repairedSessionIds,
    };
  }

  /**
   * Delete a draft session atomically with its child draft SOAP notes.
   * Strictly rejects deletion of finalized sessions and finalized SOAP notes.
   */
  static async deleteSession(
    sessionId: string,
    dek: CryptoKey,
    database: PhysioRecordDatabase = defaultDb
  ): Promise<void> {
    const session = await this.getSessionById(sessionId, dek, database);
    if (!session) {
      throw new Error(`الجلسة بالمعرف "${sessionId}" غير موجودة.`);
    }

    if (session.status === 'finalized') {
      throw new CannotDeleteFinalizedRecordError(
        'لا يمكن حذف جلسة سريرية معتمدة ومؤرخة. يجب الحفاظ على السجلات السريرية التاريخية وفق سياسة الاحتفاظ السريري.'
      );
    }

    // Append-only integrity: verify no clinical addenda exist for this session
    const addendaCount = await database.clinicalAddenda.where('sessionId').equals(sessionId).count();
    if (addendaCount > 0) {
      throw new CannotDeleteFinalizedRecordError(
        'لا يمكن حذف الجلسة: توجد ملاحق سريرية (Clinical Addenda) مرتبطة بها. سياسة الاحتفاظ السريري تمنع حذف السجلات التي تحتوي على ملاحق موثقة.'
      );
    }

    // Check if the associated SOAP note is finalized
    const soap = await SoapService.getSoapNoteBySession(sessionId, dek, database);
    if (soap && soap.data.isFinalized) {
      throw new CannotDeleteFinalizedRecordError(
        'لا يمكن حذف الجلسة: ملاحظة SOAP المرتبطة بها معتمدة نهائياً.'
      );
    }

    await database.deleteSessionCascade(sessionId);
    await this.releaseSessionNumber(session.episodeId, session.sessionNumber, dek, database);
  }
}
