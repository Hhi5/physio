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
import { isTestEnvironment, registerTestHooks } from '../utils/testHooks';
import { ReferentialIntegrityError } from '../db/registry';
import { EpisodeService } from './episodeService';
import { SoapService } from './soapService';
import {
  CannotDeleteFinalizedRecordError,
  VaultGenerationChangedError,
  UnboundVaultKeyError,
  StaleTabOverwriteError,
  CURRENT_SOAP_SCHEMA_VERSION,
  CURRENT_SEAL_VERSION,
  type SealVerificationResult,
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

export const HALF_FINALIZED_REPAIR_STATE_ID = 'half_finalized_soap_repair_v1';


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

function areUint8ArraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Recursively canonicalizes an object with alphabetically sorted keys, omitting `undefined` values
 * and any keys listed in `excludeTopLevelKeys` at the root object level.
 */
export function canonicalizeObjectExcluding(
  value: unknown,
  excludeTopLevelKeys?: Set<string>
): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeObjectExcluding(item));
  }
  const obj = value as Record<string, unknown>;
  const sortedKeys = Object.keys(obj).sort();
  const result: Record<string, unknown> = {};
  for (const key of sortedKeys) {
    if (excludeTopLevelKeys?.has(key)) continue;
    const v = obj[key];
    if (v === undefined) continue;
    result[key] = canonicalizeObjectExcluding(v);
  }
  return result;
}

/**
 * Deterministic canonical JSON serializer (sorted keys at every depth) for integrity seals.
 */
export function canonicalizeForSeal(value: unknown, excludeKeys?: string[]): string {
  return JSON.stringify(
    canonicalizeObjectExcluding(value, excludeKeys ? new Set(excludeKeys) : undefined)
  );
}

/**
 * Verifies the SHA-256 content integrity seal on a finalized SOAP note.
 * Returns a tri-state `SealVerificationResult` (`status: 'valid' | 'unsealed' | 'mismatch'`):
 * - `'unsealed'`: `contentDigestSha256` is absent (e.g., repaired legacy note) OR `sealVersion !== 1`
 *   (legacy note finalized by earlier code before canonical sorted-key seal v1).
 * - `'valid'`: `sealVersion === 1` and canonical SHA-256 digest matches `contentDigestSha256`.
 * - `'mismatch'`: `sealVersion === 1` and computed canonical SHA-256 digest differs from `contentDigestSha256`.
 */
export async function verifySoapSeal(
  soapData: SoapNoteData
): Promise<SealVerificationResult> {
  const expected = soapData.contentDigestSha256;
  if (!expected || soapData.sealVersion !== CURRENT_SEAL_VERSION) {
    return { status: 'unsealed', expected, actual: undefined };
  }
  const canonical = canonicalizeForSeal(soapData, ['contentDigestSha256']);
  const actual = await computeSha256Digest(canonical);
  return {
    status: actual === expected ? 'valid' : 'mismatch',
    expected,
    actual,
  };
}

/**
 * Verifies the SHA-256 content integrity seal on a finalized Session (and its linked SOAP note when present).
 * Returns a tri-state `SealVerificationResult` (`status: 'valid' | 'unsealed' | 'mismatch'`):
 * - `'unsealed'`: `contentIntegrityDigestSha256` is absent, `sessionData.sealVersion !== 1`, or the linked
 *   SOAP note is `'unsealed'`.
 * - `'mismatch'`: `sealVersion === 1` and either the SOAP seal is `'mismatch'`, an attended session is missing
 *   its SOAP note, or the session envelope digest does not match `contentIntegrityDigestSha256`.
 * - `'valid'`: both session and SOAP seals have `sealVersion === 1` and match their canonical SHA-256 digests.
 */
export async function verifySessionSeal(
  sessionData: SessionClinicalData,
  soapData?: SoapNoteData | null
): Promise<SealVerificationResult> {
  if (soapData) {
    const soapCheck = await verifySoapSeal(soapData);
    if (soapCheck.status === 'mismatch') {
      return {
        status: 'mismatch',
        expected: soapCheck.expected,
        actual: soapCheck.actual,
      };
    }
    if (soapCheck.status === 'unsealed') {
      return {
        status: 'unsealed',
        expected: soapCheck.expected,
        actual: soapCheck.actual,
      };
    }
  }

  const expected = sessionData.contentIntegrityDigestSha256;
  if (!expected || sessionData.sealVersion !== CURRENT_SEAL_VERSION) {
    return { status: 'unsealed', expected, actual: undefined };
  }

  if (!soapData && sessionData.attendanceStatus === 'attended') {
    return { status: 'mismatch', expected, actual: undefined };
  }

  const canonicalEnvelope = canonicalizeForSeal({
    session: canonicalizeObjectExcluding(
      sessionData,
      new Set(['contentIntegrityDigestSha256'])
    ),
    soapDigestSha256: soapData?.contentDigestSha256 ?? null,
  });
  const actual = await computeSha256Digest(canonicalEnvelope);
  return {
    status: actual === expected ? 'valid' : 'mismatch',
    expected,
    actual,
  };
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
  if (!isTestEnvironment()) {
    sessionCreationTestHook = null;
    return;
  }
  sessionCreationTestHook = hook;
};

export type SessionMutationTestHook = (
  operation: 'updateSession' | 'cancelSession' | 'deleteSession',
  context: { sessionId: string }
) => Promise<void> | void;

let sessionMutationTestHook: SessionMutationTestHook | null = null;

export const setSessionMutationTestHook = (hook: SessionMutationTestHook | null) => {
  if (!isTestEnvironment()) {
    sessionMutationTestHook = null;
    return;
  }
  sessionMutationTestHook = hook;
};

// Safely register test hook on window for test environments only (no-op in production)
registerTestHooks({
  setSessionCreationTestHook,
  setSessionMutationTestHook,
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
   * Prevents direct modifications of finalized sessions and protects against check-then-put races:
   * - Accepts optional `expectedUpdatedAt`
   * - Computes all crypto BEFORE opening the Dexie transaction
   * - Re-reads and verifies `updatedAt` and `iv` on both session and linked SOAP note inside ONE `rw` transaction before `put`.
   */
  static async updateSession(
    sessionId: string,
    data: Partial<SessionClinicalData>,
    dek: CryptoKey,
    database: PhysioRecordDatabase = defaultDb,
    expectedUpdatedAt?: string
  ): Promise<SessionRecord> {
    const existingEntity = await database.sessions.get(sessionId);
    if (!existingEntity) {
      throw new Error(`الجلسة بالمعرف "${sessionId}" غير موجودة.`);
    }

    if (expectedUpdatedAt !== undefined && existingEntity.updatedAt !== expectedUpdatedAt) {
      throw new StaleTabOverwriteError(
        'تم تعديل الجلسة في تبويب آخر (Changed in another tab). يرجى إعادة تحميل الجلسة.'
      );
    }

    const baselineSessionUpdatedAt = expectedUpdatedAt ?? existingEntity.updatedAt;
    const baselineSessionIv = existingEntity.iv;

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
    const existingSoapEntity = await database.soapNotes
      .where('sessionId')
      .equals(sessionId)
      .first();
    const baselineSoapUpdatedAt = existingSoapEntity?.updatedAt;
    const baselineSoapIv = existingSoapEntity?.iv;

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

    if (sessionMutationTestHook) {
      await sessionMutationTestHook('updateSession', { sessionId });
    }

    // ATOMIC IN-TRANSACTION RE-READ & CONCURRENCY CHECK
    await database.transaction(
      'rw',
      [database.sessions, database.soapNotes, database.vaultMeta],
      async () => {
        const latestSessionEntity = await database.sessions.get(sessionId);
        if (!latestSessionEntity) {
          throw new StaleTabOverwriteError(
            'تم حذف الجلسة في تبويب آخر (Changed in another tab).'
          );
        }
        if (
          latestSessionEntity.updatedAt !== baselineSessionUpdatedAt ||
          !areUint8ArraysEqual(latestSessionEntity.iv, baselineSessionIv)
        ) {
          throw new StaleTabOverwriteError(
            'تم تعديل أو اعتماد الجلسة في تبويب آخر (Changed in another tab). يرجى إعادة تحميل الجلسة.'
          );
        }

        const latestSoapEntity = await database.soapNotes
          .where('sessionId')
          .equals(sessionId)
          .first();
        if (baselineSoapUpdatedAt !== undefined) {
          if (
            !latestSoapEntity ||
            latestSoapEntity.updatedAt !== baselineSoapUpdatedAt ||
            (baselineSoapIv && !areUint8ArraysEqual(latestSoapEntity.iv, baselineSoapIv))
          ) {
            throw new StaleTabOverwriteError(
              'تم تعديل أو اعتماد ملاحظة SOAP المرتبطة بهذه الجلسة في تبويب آخر (Changed in another tab).'
            );
          }
        } else if (latestSoapEntity) {
          throw new StaleTabOverwriteError(
            'تم إنشاء أو اعتماد ملاحظة SOAP لهذه الجلسة في تبويب آخر (Changed in another tab).'
          );
        }

        await database.sessions.put(updatedEntity);
      }
    );

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
   * Protects against check-then-put races using the same pre-transaction crypto + in-transaction re-read pattern.
   */
  static async cancelSession(
    sessionId: string,
    cancellationReason: string,
    attendanceStatus: 'cancelled_patient' | 'cancelled_clinic' | 'no_show',
    dek: CryptoKey,
    database: PhysioRecordDatabase = defaultDb,
    expectedUpdatedAt?: string
  ): Promise<SessionRecord> {
    const existingEntity = await database.sessions.get(sessionId);
    if (!existingEntity) {
      throw new Error(`الجلسة بالمعرف "${sessionId}" غير موجودة.`);
    }

    if (expectedUpdatedAt !== undefined && existingEntity.updatedAt !== expectedUpdatedAt) {
      throw new StaleTabOverwriteError(
        'تم تعديل الجلسة في تبويب آخر (Changed in another tab). يرجى إعادة تحميل الجلسة.'
      );
    }

    const baselineSessionUpdatedAt = expectedUpdatedAt ?? existingEntity.updatedAt;
    const baselineSessionIv = existingEntity.iv;

    const existing = await this.getSessionById(sessionId, dek, database);
    if (!existing) {
      throw new Error(`الجلسة بالمعرف "${sessionId}" غير موجودة.`);
    }

    if (existing.status === 'finalized') {
      throw new Error('لا يمكن إلغاء جلسة سريرية معتمدة ومغلقة نهائياً.');
    }

    const existingSoapEntity = await database.soapNotes
      .where('sessionId')
      .equals(sessionId)
      .first();
    const baselineSoapUpdatedAt = existingSoapEntity?.updatedAt;
    const baselineSoapIv = existingSoapEntity?.iv;

    const existingSoap = await SoapService.getSoapNoteBySession(sessionId, dek, database);
    if (existingSoap && existingSoap.data.isFinalized) {
      throw new Error(
        'لا يمكن إلغاء جلسة سريرية مرتبطة بملاحظة SOAP معتمدة ومغلقة نهائياً.'
      );
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

    if (sessionMutationTestHook) {
      await sessionMutationTestHook('cancelSession', { sessionId });
    }

    await database.transaction(
      'rw',
      [database.sessions, database.soapNotes, database.vaultMeta],
      async () => {
        const latestSessionEntity = await database.sessions.get(sessionId);
        if (!latestSessionEntity) {
          throw new StaleTabOverwriteError(
            'تم حذف الجلسة في تبويب آخر (Changed in another tab).'
          );
        }
        if (
          latestSessionEntity.updatedAt !== baselineSessionUpdatedAt ||
          !areUint8ArraysEqual(latestSessionEntity.iv, baselineSessionIv)
        ) {
          throw new StaleTabOverwriteError(
            'تم تعديل أو اعتماد الجلسة في تبويب آخر أثناء محاولة الإلغاء (Changed in another tab).'
          );
        }

        const latestSoapEntity = await database.soapNotes
          .where('sessionId')
          .equals(sessionId)
          .first();
        if (baselineSoapUpdatedAt !== undefined) {
          if (
            !latestSoapEntity ||
            latestSoapEntity.updatedAt !== baselineSoapUpdatedAt ||
            (baselineSoapIv && !areUint8ArraysEqual(latestSoapEntity.iv, baselineSoapIv))
          ) {
            throw new StaleTabOverwriteError(
              'تم تعديل أو اعتماد ملاحظة SOAP المرتبطة بهذه الجلسة في تبويب آخر أثناء محاولة الإلغاء (Changed in another tab).'
            );
          }
        } else if (latestSoapEntity) {
          throw new StaleTabOverwriteError(
            'تم إنشاء أو اعتماد ملاحظة SOAP لهذه الجلسة في تبويب آخر أثناء محاولة الإلغاء (Changed in another tab).'
          );
        }

        await database.sessions.put(entity);
      }
    );

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
   * Single finalization path in the codebase:
   * 1. Attended sessions MUST have a completed SOAP note with:
   *    - Pre-session pain & post-session pain recorded (or explicitly marked `painNotRecorded` / `postPainNotRecorded`)
   *    - At least one documented intervention (flowsheet item or free-text summary/observation)
   *    - Non-empty `clinicalImpressionCurrent`
   *    - Selected `progressStatus`
   * 2. Computes canonical SHA-256 content integrity digests over the EXACT finalized payloads
   *    (excluding the digest field itself) and AES-256-GCM ciphertexts BEFORE opening the Dexie transaction.
   * 3. Re-reads and verifies `updatedAt`, `iv`, finalized flags, and 1:1 SOAP constraint INSIDE the `rw` transaction
   *    before committing both `soapNote.isFinalized = true` and `session.status = 'finalized'`.
   *
   * Note on `therapistName`: This is a self-declared active staff label ("Recorded by") from the local app,
   * NOT a cryptographically authenticated identity.
   */
  static async finalizeSession(
    sessionId: string,
    therapistName: string,
    dek: CryptoKey,
    database: PhysioRecordDatabase = defaultDb,
    expectedSessionUpdatedAt?: string,
    expectedSoapUpdatedAt?: string,
    legacyReviewConfirmed = false
  ): Promise<SessionRecord> {
    if (!therapistName?.trim()) {
      throw new Error('اسم المعالج المسجّل (Recorded by) إلزامي لاعتماد السجل السريري.');
    }

    const expectedGen = getDekGeneration(dek);
    if (expectedGen === undefined) {
      throw new UnboundVaultKeyError(
        'تم رفض اعتماد الجلسة: مفتاح التشفير التشغيلي (DEK) غير مرتبط بأي جيل خزينة معتمد.'
      );
    }

    const sessionEntityPre = await database.sessions.get(sessionId);
    if (!sessionEntityPre) {
      throw new Error(`الجلسة بالمعرف "${sessionId}" غير موجودة.`);
    }

    const session = await this.getSessionById(sessionId, dek, database);
    if (!session) {
      throw new Error(`الجلسة بالمعرف "${sessionId}" غير موجودة.`);
    }

    if (session.status === 'finalized') {
      throw new Error('هذه الجلسة معتمدة مسبقاً.');
    }

    if (
      expectedSessionUpdatedAt !== undefined &&
      session.updatedAt !== expectedSessionUpdatedAt
    ) {
      throw new StaleTabOverwriteError(
        'تم تعديل الجلسة في تبويب آخر (Changed in another tab). يرجى إعادة تحميل الجلسة.'
      );
    }

    const baselineSessionUpdatedAt = expectedSessionUpdatedAt ?? session.updatedAt;
    const baselineSessionIv = sessionEntityPre.iv;
    let baselineSoapUpdatedAt: string | undefined;
    let baselineSoapIv: Uint8Array | undefined;

    const now = new Date().toISOString();
    const signer = therapistName.trim();
    const meta = await database.vaultMeta.get('auth');
    const activeDekVersion = meta?.dekVersion || CURRENT_DEK_VERSION;

    let finalizedSoapDigestSha256: string | null = null;
    let finalizedSoapEntity: EncryptedSoapEntity | null = null;

    // If attended, SOAP note is mandatory and required clinical fields must be documented
    if (session.attendanceStatus === 'attended') {
      const soapEntities = await database.soapNotes
        .where('sessionId')
        .equals(sessionId)
        .toArray();
      if (soapEntities.length === 0) {
        throw new Error(
          'لا يمكن اعتماد الجلسة السريرية: يجب توثيق وإكمال ملاحظة SOAP أولاً للجلسات التي حضرها المريض.'
        );
      }
      if (soapEntities.length > 1) {
        throw new StaleTabOverwriteError(
          'تعارض 1:1 في ملاحظات SOAP للجلسة عبر التبويبات (Changed in another tab).'
        );
      }

      const soap = await SoapService.getSoapNoteBySession(sessionId, dek, database);
      if (!soap) {
        throw new Error(
          'لا يمكن اعتماد الجلسة السريرية: يجب توثيق وإكمال ملاحظة SOAP أولاً للجلسات التي حضرها المريض.'
        );
      }

      if (soap.data.isFinalized) {
        throw new Error('ملاحظة SOAP المرتبطة بهذه الجلسة معتمدة مسبقاً.');
      }

      if (
        expectedSoapUpdatedAt !== undefined &&
        soap.updatedAt !== expectedSoapUpdatedAt
      ) {
        throw new StaleTabOverwriteError(
          'تم تعديل ملاحظة SOAP في تبويب آخر (Changed in another tab). يرجى إعادة تحميل الجلسة.'
        );
      }
      baselineSoapUpdatedAt = expectedSoapUpdatedAt ?? soap.updatedAt;
      baselineSoapIv = soapEntities[0].iv;

      // Service-level Legacy Draft Review Gate (Finding 1):
      // Reject finalizing a note with legacyUnreviewed === true unless legacyReviewConfirmed is explicitly passed.
      const isLegacyUnreviewedNote = Boolean(soap.data.legacyUnreviewed);
      if (isLegacyUnreviewedNote && !legacyReviewConfirmed) {
        throw new Error(
          'لا يمكن اعتماد وقفل هذه المسودة السريرية المنشأة بإصدار سابق قبل تأكيد مراجعتها صراحةً (legacyReviewConfirmed is required).'
        );
      }

      const sub = soap.data.subjective;
      const hasPrePain =
        sub?.painNrsScore !== undefined || sub?.painNotRecorded === true;
      // Finding 4: Removed soapSchemaVersion === 1 bypass; post-session pain or explicit postPainNotRecorded is always required.
      const hasPostPain =
        sub?.postSessionPainNrs !== undefined || sub?.postPainNotRecorded === true;

      if (!hasPrePain) {
        throw new Error(
          'يجب تسجيل شدة الألم قبل الجلسة (أو تحديد "لم يُسجّل") قبل اعتماد وقفل الجلسة.'
        );
      }
      if (!hasPostPain) {
        throw new Error(
          'يجب تسجيل شدة الألم بعد الجلسة (أو تحديد "لم يُسجّل") قبل اعتماد وقفل الجلسة.'
        );
      }

      // Check documented intervention or objective finding
      const obj = soap.data.objective;
      const hasFlowsheetItems = Boolean(
        obj?.flowsheet &&
          ((obj.flowsheet.exercises && obj.flowsheet.exercises.length > 0) ||
            (obj.flowsheet.manualTherapy && obj.flowsheet.manualTherapy.length > 0) ||
            (obj.flowsheet.physicalAgents && obj.flowsheet.physicalAgents.length > 0))
      );
      const hasObjectiveFindings = Boolean(
        hasFlowsheetItems ||
          obj?.dailyInterventionsSummary?.trim() ||
          obj?.objectiveFindings?.trim() ||
          obj?.clinicalObservations?.trim() ||
          obj?.functionalOrPreliminaryMeasurements?.trim() ||
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
          'يجب توثيق تدخل علاجي واحد على الأقل (تمرين، علاج يدوي، جهاز، أو ملخص تدخلات/ملاحظات موضوعية) قبل اعتماد وقفل الجلسة.'
        );
      }

      // Check Axis A (Assessment): Clinical Impression and Progress Status are mandatory
      if (!soap.data.assessment?.clinicalImpressionCurrent?.trim()) {
        throw new Error(
          'الانطباع والتفسير السريري (Clinical Impression) إلزامي في محور A لاعتماد الجلسة.'
        );
      }
      if (!soap.data.assessment?.progressStatus) {
        throw new Error(
          'تحديد مسار تقدم الحالة (Progress Status) إلزامي في محور A لاعتماد الجلسة.'
        );
      }

      // Prepare exact finalized SOAP payload and compute canonical SHA-256 content seal (excluding contentDigestSha256)
      const soapContentForSeal: SoapNoteData = {
        ...soap.data,
        soapSchemaVersion: CURRENT_SOAP_SCHEMA_VERSION,
        isFinalized: true,
        finalizedAt: now,
        finalizedBy: signer,
        sealVersion: CURRENT_SEAL_VERSION,
      };
      if (isLegacyUnreviewedNote && legacyReviewConfirmed) {
        soapContentForSeal.legacyUnreviewed = false;
        soapContentForSeal.legacyReviewedAt = now;
        soapContentForSeal.legacyReviewedBy = signer;
      }
      delete soapContentForSeal.contentDigestSha256;

      const soapContentSeal = await computeSha256Digest(
        canonicalizeForSeal(soapContentForSeal, ['contentDigestSha256'])
      );
      const finalizedSoapData: SoapNoteData = {
        ...soapContentForSeal,
        contentDigestSha256: soapContentSeal,
      };
      finalizedSoapDigestSha256 = soapContentSeal;

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
    }

    // Build exact finalized session payload (excluding contentIntegrityDigestSha256) and compute canonical seal
    const finalizedSessionBase: SessionClinicalData = {
      ...session.data,
      status: 'finalized',
      finalizedAt: now,
      finalizedBy: signer,
      attestationByTherapistName: signer,
      attestationTimestamp: now,
      sealVersion: CURRENT_SEAL_VERSION,
    };
    delete finalizedSessionBase.contentIntegrityDigestSha256;

    const canonicalSessionEnvelope = canonicalizeForSeal({
      session: canonicalizeObjectExcluding(
        finalizedSessionBase,
        new Set(['contentIntegrityDigestSha256'])
      ),
      soapDigestSha256: finalizedSoapDigestSha256,
    });
    const digestHex = await computeSha256Digest(canonicalSessionEnvelope);

    const finalizedData: SessionClinicalData = {
      ...finalizedSessionBase,
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

    // ATOMIC SINGLE-TRANSACTION RE-READ, CONCURRENCY CHECK & COMMIT:
    // Both soapNote (isFinalized = true + seal + signer) and session (status = 'finalized')
    // are verified and committed together in ONE Dexie readwrite transaction.
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

        const latestSessionEntity = await database.sessions.get(sessionId);
        if (
          !latestSessionEntity ||
          latestSessionEntity.updatedAt !== baselineSessionUpdatedAt ||
          !areUint8ArraysEqual(latestSessionEntity.iv, baselineSessionIv)
        ) {
          throw new StaleTabOverwriteError(
            'تم تعديل أو اعتماد الجلسة في تبويب آخر (Changed in another tab). يرجى إعادة تحميل الجلسة.'
          );
        }

        if (finalizedSoapEntity) {
          const latestSoapList = await database.soapNotes
            .where('sessionId')
            .equals(sessionId)
            .toArray();
          if (
            latestSoapList.length !== 1 ||
            latestSoapList[0].id !== finalizedSoapEntity.id ||
            latestSoapList[0].updatedAt !== baselineSoapUpdatedAt ||
            (baselineSoapIv && !areUint8ArraysEqual(latestSoapList[0].iv, baselineSoapIv))
          ) {
            throw new StaleTabOverwriteError(
              'تم تعديل أو اعتماد ملاحظة SOAP في تبويب آخر (Changed in another tab). يرجى إعادة تحميل الجلسة.'
            );
          }
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
   * Idempotent repair routine (wired to run after unlock in VaultContext):
   * - Checks `migrationState` (`id: HALF_FINALIZED_REPAIR_STATE_ID`) first; if a clean repair run already
   *   completed for the CURRENT `vaultGeneration` (`status === 'completed' && vaultGeneration === expectedGen`),
   *   returns immediately without decrypting every session on every unlock.
   *   (Restoring a `.ptbackup` both increments `vaultGeneration` and clears this `migrationState` record so
   *   restored half-finalized sessions are always repaired on unlock.)
   * - Finds any sessions with `status === 'finalized'` whose associated `soapNote.data.isFinalized` is false
   *   (caused by the pre-Phase-1A TreatmentSessionView bug), finalizes the SOAP note using the session's
   *   recorded signer/timestamp, and marks `repairedDuringMigration: true`, `legacyUnreviewed: true`, and `repairedAt`.
   * - Pre-1A-i.5 notes may contain auto-generated default values (e.g. pain 5->3, progressStatus 'improved'):
   *   `contentDigestSha256` and `sealVersion` are omitted (`status: 'unsealed'`) and `legacyUnreviewed: true` is set.
   * - Computes all crypto BEFORE opening the Dexie transaction.
   * - Inside the transaction: if one note is stale (`updatedAt` or `iv` changed concurrently in another tab),
   *   does NOT roll back the entire batch — commits the valid ones, skips and reports the stale ones
   *   (`{ repairedCount, skippedCount, repairedSessionIds, skippedSessionIds }`), and only marks `migrationState`
   *   as `'completed'` when `skippedCount === 0`.
   */
  static async repairHalfFinalizedSessions(
    dek: CryptoKey,
    database: PhysioRecordDatabase = defaultDb
  ): Promise<{
    repairedCount: number;
    skippedCount: number;
    repairedSessionIds: string[];
    repairedSessions: Array<{ sessionId: string; episodeId: string; patientId: string }>;
    skippedSessionIds: string[];
    alreadyCompleted?: boolean;
  }> {
    const expectedGen = getDekGeneration(dek);
    if (expectedGen === undefined) {
      throw new UnboundVaultKeyError(
        'تم رفض فحص وإصلاح الجلسات: مفتاح التشفير التشغيلي (DEK) غير مرتبط بأي جيل خزينة معتمد.'
      );
    }

    const existingRepairState = await database.migrationState.get(HALF_FINALIZED_REPAIR_STATE_ID);
    if (
      existingRepairState?.status === 'completed' &&
      existingRepairState.vaultGeneration === expectedGen
    ) {
      return {
        repairedCount: 0,
        skippedCount: 0,
        repairedSessionIds: [],
        repairedSessions: [],
        skippedSessionIds: [],
        alreadyCompleted: true,
      };
    }

    const meta = await database.vaultMeta.get('auth');
    const activeDekVersion = meta?.dekVersion || CURRENT_DEK_VERSION;
    const allSessionEntities = await database.sessions.toArray();

    const stagedSoapRepairs: Array<{
      entity: EncryptedSoapEntity;
      baselineUpdatedAt: string;
      baselineIv: Uint8Array;
      sessionId: string;
      episodeId: string;
      patientId: string;
    }> = [];
    const repairedAt = new Date().toISOString();
    let decryptSkippedCount = 0;
    const skippedSessionIds: string[] = [];

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
        decryptSkippedCount++;
        skippedSessionIds.push(sEntity.id);
        continue;
      }

      if (sData.status !== 'finalized') continue;

      const rawSoapEntity = await database.soapNotes
        .where('sessionId')
        .equals(sEntity.id)
        .first();
      if (!rawSoapEntity) continue;

      let soap;
      try {
        soap = await SoapService.getSoapNoteBySession(sEntity.id, dek, database);
      } catch {
        decryptSkippedCount++;
        skippedSessionIds.push(sEntity.id);
        continue;
      }
      if (!soap || soap.data.isFinalized) continue;

      const recordedSigner =
        sData.finalizedBy ||
        sData.attestationByTherapistName ||
        sData.therapistName ||
        'System Migration Repair';
      const recordedFinalizedAt =
        sData.finalizedAt || sData.attestationTimestamp || sEntity.updatedAt || repairedAt;

      // Do NOT compute contentDigestSha256 or sealVersion on repaired legacy notes (Finding 3c)
      const repairedSoapData: SoapNoteData = {
        ...soap.data,
        soapSchemaVersion: soap.data.soapSchemaVersion ?? CURRENT_SOAP_SCHEMA_VERSION,
        isFinalized: true,
        finalizedAt: recordedFinalizedAt,
        finalizedBy: recordedSigner,
        repairedDuringMigration: true,
        repairedAt,
        legacyUnreviewed: true,
      };
      delete repairedSoapData.contentDigestSha256;
      delete repairedSoapData.sealVersion;

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
        entity: {
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
        },
        baselineUpdatedAt: rawSoapEntity.updatedAt,
        baselineIv: rawSoapEntity.iv,
        sessionId: sEntity.id,
        episodeId: sEntity.episodeId,
        patientId: sEntity.patientId,
      });
    }

    const committedSessionIds: string[] = [];
    const committedSessions: Array<{ sessionId: string; episodeId: string; patientId: string }> = [];

    await database.transaction(
      'rw',
      [database.soapNotes, database.vaultMeta, database.migrationState],
      async () => {
        const currentMeta = await database.vaultMeta.get('auth');
        const currentGen = currentMeta?.vaultGeneration ?? 1;
        if (currentGen !== expectedGen) {
          throw new VaultGenerationChangedError(
            `تم رفض حفظ إصلاح الملاحظات السريرية: تغير جيل الخزينة (${expectedGen} != ${currentGen}).`
          );
        }

        const verifiedEntitiesToPut: EncryptedSoapEntity[] = [];
        for (const item of stagedSoapRepairs) {
          const currentSoap = await database.soapNotes.get(item.entity.id);
          if (
            !currentSoap ||
            currentSoap.updatedAt !== item.baselineUpdatedAt ||
            !areUint8ArraysEqual(currentSoap.iv, item.baselineIv)
          ) {
            // Do NOT roll back the whole batch: skip the stale note and report it
            skippedSessionIds.push(item.sessionId);
            continue;
          }
          verifiedEntitiesToPut.push(item.entity);
          committedSessionIds.push(item.sessionId);
          committedSessions.push({
            sessionId: item.sessionId,
            episodeId: item.episodeId,
            patientId: item.patientId,
          });
        }

        if (verifiedEntitiesToPut.length > 0) {
          await database.soapNotes.bulkPut(verifiedEntitiesToPut);
        }

        const totalSkipped = skippedSessionIds.length;
        const previousState = await database.migrationState.get(HALF_FINALIZED_REPAIR_STATE_ID);
        const cumulativeRepaired =
          (previousState?.repairedSoapNotesCount || 0) + committedSessionIds.length;

        await database.migrationState.put({
          id: HALF_FINALIZED_REPAIR_STATE_ID,
          status: totalSkipped === 0 ? 'completed' : 'pending',
          vaultGeneration: expectedGen,
          completedKeyHashes: committedSessionIds,
          failedKeyCount: totalSkipped,
          repairedSoapNotesCount: cumulativeRepaired,
          conflictCount: totalSkipped - decryptSkippedCount,
          orphanFlowsheetCount: 0,
          updatedAt: repairedAt,
        });
      }
    );

    return {
      repairedCount: committedSessionIds.length,
      skippedCount: skippedSessionIds.length,
      repairedSessionIds: committedSessionIds,
      repairedSessions: committedSessions,
      skippedSessionIds,
    };
  }

  /**
   * Delete a draft session atomically with its child draft SOAP notes.
   * Strictly rejects deletion of finalized sessions, finalized SOAP notes, or sessions with addenda,
   * and re-verifies `updatedAt`, `iv`, and `clinicalAddenda.count()` inside ONE `rw` transaction.
   */
  static async deleteSession(
    sessionId: string,
    dek: CryptoKey,
    database: PhysioRecordDatabase = defaultDb,
    expectedUpdatedAt?: string
  ): Promise<void> {
    const existingEntity = await database.sessions.get(sessionId);
    if (!existingEntity) {
      throw new Error(`الجلسة بالمعرف "${sessionId}" غير موجودة.`);
    }

    if (expectedUpdatedAt !== undefined && existingEntity.updatedAt !== expectedUpdatedAt) {
      throw new StaleTabOverwriteError(
        'تم تعديل الجلسة في تبويب آخر (Changed in another tab). يرجى إعادة تحميل الجلسة.'
      );
    }

    const baselineSessionUpdatedAt = expectedUpdatedAt ?? existingEntity.updatedAt;
    const baselineSessionIv = existingEntity.iv;

    const session = await this.getSessionById(sessionId, dek, database);
    if (!session) {
      throw new Error(`الجلسة بالمعرف "${sessionId}" غير موجودة.`);
    }

    if (session.status === 'finalized') {
      throw new CannotDeleteFinalizedRecordError(
        'لا يمكن حذف جلسة سريرية معتمدة ومؤرخة. يجب الحفاظ على السجلات السريرية التاريخية وفق سياسة الاحتفاظ السريري.'
      );
    }

    // Append-only integrity pre-check: verify no clinical addenda exist for this session
    const addendaCount = await database.clinicalAddenda.where('sessionId').equals(sessionId).count();
    if (addendaCount > 0) {
      throw new CannotDeleteFinalizedRecordError(
        'لا يمكن حذف الجلسة: توجد ملاحق سريرية (Clinical Addenda) مرتبطة بها. سياسة الاحتفاظ السريري تمنع حذف السجلات التي تحتوي على ملاحق موثقة.'
      );
    }

    // Check if the associated SOAP note is finalized
    const existingSoapEntity = await database.soapNotes
      .where('sessionId')
      .equals(sessionId)
      .first();
    const baselineSoapUpdatedAt = existingSoapEntity?.updatedAt;
    const baselineSoapIv = existingSoapEntity?.iv;

    const soap = await SoapService.getSoapNoteBySession(sessionId, dek, database);
    if (soap && soap.data.isFinalized) {
      throw new CannotDeleteFinalizedRecordError(
        'لا يمكن حذف الجلسة: ملاحظة SOAP المرتبطة بها معتمدة نهائياً.'
      );
    }

    if (sessionMutationTestHook) {
      await sessionMutationTestHook('deleteSession', { sessionId });
    }

    await database.transaction(
      'rw',
      [database.sessions, database.soapNotes, database.clinicalAddenda],
      async () => {
        const latestSessionEntity = await database.sessions.get(sessionId);
        if (!latestSessionEntity) {
          return;
        }
        if (
          latestSessionEntity.updatedAt !== baselineSessionUpdatedAt ||
          !areUint8ArraysEqual(latestSessionEntity.iv, baselineSessionIv)
        ) {
          throw new StaleTabOverwriteError(
            'تم تعديل أو اعتماد الجلسة في تبويب آخر أثناء محاولة الحذف (Changed in another tab).'
          );
        }

        const latestSoapList = await database.soapNotes
          .where('sessionId')
          .equals(sessionId)
          .toArray();
        if (baselineSoapUpdatedAt !== undefined) {
          if (
            latestSoapList.length !== 1 ||
            latestSoapList[0].updatedAt !== baselineSoapUpdatedAt ||
            (baselineSoapIv && !areUint8ArraysEqual(latestSoapList[0].iv, baselineSoapIv))
          ) {
            throw new StaleTabOverwriteError(
              'تم تعديل أو اعتماد ملاحظة SOAP المرتبطة بالجلسة في تبويب آخر أثناء محاولة الحذف (Changed in another tab).'
            );
          }
        } else if (latestSoapList.length > 0) {
          throw new StaleTabOverwriteError(
            'تم إنشاء أو اعتماد ملاحظة SOAP لهذه الجلسة في تبويب آخر أثناء محاولة الحذف (Changed in another tab).'
          );
        }

        const inTxAddendaCount = await database.clinicalAddenda
          .where('sessionId')
          .equals(sessionId)
          .count();
        if (inTxAddendaCount > 0) {
          throw new CannotDeleteFinalizedRecordError(
            'لا يمكن حذف الجلسة: توجد ملاحق سريرية (Clinical Addenda) مرتبطة بها.'
          );
        }

        if (latestSoapList.length > 0) {
          await database.soapNotes.bulkDelete(latestSoapList.map((n) => n.id));
        }
        await database.sessions.delete(sessionId);
      }
    );

    await this.releaseSessionNumber(session.episodeId, session.sessionNumber, dek, database);
  }
}
