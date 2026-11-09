// =======================================================================
// PhysioRecord — Backup & Restoration Engine (.ptbackup v1.1)
// =======================================================================

import { PhysioRecordDatabase } from '../db/db';
import {
  CLINICAL_STORES_REGISTRY,
  extractAndValidateParentIds,
  validateSnapshotReferentialIntegrity,
  type SnapshotEntityRecord,
} from '../db/registry';
import { broadcastVaultEvent } from '../utils/vaultEvents';
import { registerTestHooks } from '../utils/testHooks';
import type { VaultMetaEntity, BackupHeader, EpisodeSequenceEntity } from '../types/clinical';
import {
  subtle,
  deriveBackupKeys,
  wrapDEKForBackup,
  unwrapDEKFromBackup,
  decryptRawDEKForBackup,
  encryptBackupPayload,
  decryptBackupPayload,
  validateBackupHeaderPreDerivation,
  validateRawBackupString,
  BackupHeaderValidationError,
  deriveKEK,
  generateVerifier,
  encryptRecordPayload,
  decryptRecordPayload,
  deriveSequenceHmacKey,
  registerSequenceHmacKey,
  computeSessionNumberHmacToken,
  bindDekToGeneration,
  randomBytes,
  CONSTANTS,
  CURRENT_DEK_VERSION,
  CURRENT_RECORD_CRYPTO_VERSION,
  MAX_BACKUP_SIZE_BYTES,
  MAX_GCM_INVOCATIONS_PER_DEK,
  DekExhaustedError,
} from './vault';

export const BACKUP_WARNING_THRESHOLD_BYTES = 20 * 1024 * 1024; // 20 MB (80% of 25MB max limit)

/**
 * Canonical deterministic serialization of the backup header Additional Authenticated Data (AAD).
 * This byte string is passed as the `additionalData` parameter of the AES-256-GCM payload cipher
 * so that any modification to any authenticated field causes decryption to fail immediately.
 *
 * Fields authenticated (in strict order):
 * 1. formatVersion   — Explicit independent format version string ('1.1'), first field for unambiguous versioning.
 * 2. magic           — File type identifier ('PHYSIORECORD_BACKUP_V1.1').
 * 3. exportDateUtc   — ISO 8601 export timestamp.
 * 4. clinicTimezone  — Clinic local timezone (e.g. 'Asia/Baghdad').
 * 5. schemaVersion   — Dexie database schema version number.
 * 6. kdfAlgorithm    — KDF identifier ('PBKDF2-HMAC-SHA256').
 * 7. kdfIterations   — PBKDF2 iteration count (600,000).
 * 8. keyExpansion    — Key expansion identifier ('HKDF-SHA256').
 * 9. hkdfHash        — HKDF hash function ('SHA-256').
 * 10. hkdfSalt       — 32 cryptographically random bytes for HKDF domain separation (authenticated as Array).
 * 11. hkdfInfoDekWrap    — HKDF info label for DEK wrapping key ('physiorecord-backup-dek-wrap-v1.1').
 * 12. hkdfInfoPayloadEnc — HKDF info label for payload encryption key ('physiorecord-backup-payload-enc-v1.1').
 * 13. derivedKeyLengthBits — Derived key length in bits (256).
 * 14. backupSalt     — 16 bytes PBKDF2 salt for Backup KEK derivation.
 * 15. backupDekIv    — 12-byte IV used to AES-GCM-wrap the DEK.
 * 16. backupWrappedDek — The raw DEK bytes wrapped under the Backup DEK Wrap Key.
 * 17. dekVersion     — Source DEK version number.
 * 18. encryptionInvocationCount — Recorded aggregate invocation count from source device.
 * 19. maxBackupSizeBytes — Enforced maximum backup size limit.
 * 20. payloadLength  — Length of the plaintext payload (pre-encryption).
 *
 * NOTE: backupDataIv (the AES-GCM cipher IV for the payload ciphertext) is supplied as the
 * cipher `iv` parameter directly — not in the AAD — per AES-GCM specification. The AAD
 * authenticates all security-relevant header metadata orthogonally to the cipher IV.
 */
export const buildCanonicalBackupHeaderAAD = (untrustedHeader: BackupHeader | Record<string, unknown>): Uint8Array => {
  if (!untrustedHeader || typeof untrustedHeader !== 'object') {
    throw new BackupHeaderValidationError('ترويسة النسخة الاحتياطية مفقودة أو غير صالحة لبناء AAD.');
  }
  const header = untrustedHeader as Record<string, unknown>;

  // Strict check: No silent default fallbacks hiding missing or incomplete fields
  const requiredFields = [
    'magic',
    'exportDateUtc',
    'clinicTimezone',
    'schemaVersion',
    'kdfAlgorithm',
    'kdfIterations',
    'keyExpansion',
    'hkdfHash',
    'hkdfSalt',
    'hkdfInfoDekWrap',
    'hkdfInfoPayloadEnc',
    'derivedKeyLengthBits',
    'backupSalt',
    'backupDekIv',
    'backupWrappedDek',
    'dekVersion',
    'encryptionInvocationCount',
    'maxBackupSizeBytes',
    'payloadLength',
  ];

  for (const field of requiredFields) {
    if (header[field] === undefined || header[field] === null) {
      throw new BackupHeaderValidationError(
        `الحقل الإلزامي "${field}" مفقود في ترويسة النسخة الاحتياطية ولا يمكن استخدام قيمة افتراضية.`
      );
    }
  }

  const canonicalObj = {
    formatVersion: '1.1', // Explicit independent format version for canonical AAD
    magic: header.magic,
    exportDateUtc: header.exportDateUtc,
    clinicTimezone: String(header.clinicTimezone),
    schemaVersion: Number(header.schemaVersion),
    kdfAlgorithm: header.kdfAlgorithm,
    kdfIterations: Number(header.kdfIterations),
    keyExpansion: header.keyExpansion,
    hkdfHash: String(header.hkdfHash),
    hkdfSalt: Array.from(header.hkdfSalt as ArrayLike<number>),
    hkdfInfoDekWrap: header.hkdfInfoDekWrap,
    hkdfInfoPayloadEnc: header.hkdfInfoPayloadEnc,
    derivedKeyLengthBits: Number(header.derivedKeyLengthBits),
    backupSalt: Array.from(header.backupSalt as ArrayLike<number>),
    backupDekIv: Array.from(header.backupDekIv as ArrayLike<number>),
    backupWrappedDek: Array.from(header.backupWrappedDek as ArrayLike<number>),
    dekVersion: Number(header.dekVersion),
    encryptionInvocationCount: Number(header.encryptionInvocationCount),
    maxBackupSizeBytes: Number(header.maxBackupSizeBytes),
    payloadLength: Number(header.payloadLength),
  };
  return new TextEncoder().encode(JSON.stringify(canonicalObj));
};

export interface ExportedBackupPackage {
  header: {
    magic: string;
    exportDateUtc: string;
    clinicTimezone: string;
    schemaVersion: number;
    kdfAlgorithm: string;
    kdfIterations: number;
    keyExpansion: string;
    hkdfHash: string;
    hkdfSalt: number[];
    hkdfInfoDekWrap: string;
    hkdfInfoPayloadEnc: string;
    derivedKeyLengthBits: number;
    backupSalt: number[];
    backupDekIv: number[];
    backupWrappedDek: number[];
    backupDataIv: number[];
    dekVersion: number;
    encryptionInvocationCount: number;
    maxBackupSizeBytes: number;
    payloadLength: number;
  };
  payloadCiphertext: number[]; // Array of byte values for JSON serialization
}

export interface RestoredBackupSummary {
  patientCount: number;
  episodeCount: number;
  sessionCount: number;
  soapCount: number;
  addendaCount?: number;
  countsByStore: Record<string, number>;
  destinationOperationalDek: CryptoKey;
  restoredInvocationCount: number;
}

export interface BackupPreviewSummary {
  exportDateUtc: string;
  schemaVersion: number;
  clinicTimezone: string;
  restoredPatientCount: number;
  restoredEpisodeCount: number;
  restoredSessionCount: number;
  restoredSoapCount: number;
  restoredAddendaCount: number;
  countsByStore: Record<string, number>;
  currentPatientCount: number;
  currentLatestModificationDate: string | null;
}

/**
 * Inspect and preview incoming backup package against current database state
 * BEFORE any database replacement occurs (Data Loss Prevention & Comparison).
 */
export const inspectBackupPreview = async (
  backupJsonStr: string,
  backupPassword: string,
  targetDatabase: PhysioRecordDatabase
): Promise<BackupPreviewSummary> => {
  // 1. Raw string pre-check BEFORE JSON.parse
  validateRawBackupString(backupJsonStr);

  let pkg: ExportedBackupPackage;
  try {
    pkg = JSON.parse(backupJsonStr);
  } catch {
    throw new BackupHeaderValidationError('ملف النسخة الاحتياطية غير صالح (صيغة JSON معطوبة).');
  }

  if (!pkg || typeof pkg !== 'object') {
    throw new BackupHeaderValidationError('حزمة النسخة الاحتياطية غير صالحة.');
  }

  const rawPayloadCipher = (pkg as unknown as Record<string, unknown>).payloadCiphertext;
  if (!rawPayloadCipher || (!Array.isArray(rawPayloadCipher) && !(rawPayloadCipher instanceof Uint8Array))) {
    throw new BackupHeaderValidationError('حقل النص المشفر للحمولة (payloadCiphertext) مفقود أو غير صالح.');
  }
  if (pkg.payloadCiphertext.length < 16) {
    throw new BackupHeaderValidationError('حجم النص المشفر للحمولة أصغر من وسم المصادقة الأدنى.');
  }

  // Pre-validate untrusted header before deriving any keys
  validateBackupHeaderPreDerivation(pkg.header);

  const header = pkg.header;
  const backupSalt = new Uint8Array(header.backupSalt);
  const hkdfSalt = new Uint8Array(header.hkdfSalt);
  const backupDataIv = new Uint8Array(header.backupDataIv);
  const payloadCiphertext = new Uint8Array(pkg.payloadCiphertext);

  const { backupPayloadEncKey } = await deriveBackupKeys(
    backupPassword,
    backupSalt,
    hkdfSalt,
    header.kdfIterations
  );

  const headerAad = buildCanonicalBackupHeaderAAD(header);

  // Authenticated decryption of outer payload (Strict AES-GCM verification)
  const decryptedPayloadJson = await decryptBackupPayload(
    backupPayloadEncKey,
    headerAad,
    backupDataIv,
    payloadCiphertext
  );

  let snapshot: Record<string, unknown[]>;
  try {
    snapshot = JSON.parse(decryptedPayloadJson) as Record<string, unknown[]>;
  } catch {
    throw new Error('فشل قراءة حمولة السجلات السريرية في النسخة.');
  }

  // Count records for every registered clinical store
  const countsByStore: Record<string, number> = {};
  for (const storeDef of Object.values(CLINICAL_STORES_REGISTRY)) {
    countsByStore[storeDef.name] = Array.isArray(snapshot[storeDef.name]) ? snapshot[storeDef.name].length : 0;
  }

  // Query current target database state
  const currentPatients = await targetDatabase.patients.toArray();
  let currentLatestDate: string | null = null;
  for (const cp of currentPatients) {
    if (!currentLatestDate || (cp.updatedAt && cp.updatedAt > currentLatestDate)) {
      currentLatestDate = cp.updatedAt;
    }
  }

  return {
    exportDateUtc: header.exportDateUtc,
    schemaVersion: header.schemaVersion,
    clinicTimezone: header.clinicTimezone,
    restoredPatientCount: countsByStore['patients'] || 0,
    restoredEpisodeCount: countsByStore['episodes'] || 0,
    restoredSessionCount: countsByStore['sessions'] || 0,
    restoredSoapCount: countsByStore['soapNotes'] || 0,
    restoredAddendaCount: countsByStore['clinicalAddenda'] || 0,
    countsByStore,
    currentPatientCount: currentPatients.length,
    currentLatestModificationDate: currentLatestDate,
  };
};

/**
 * Export full encrypted database snapshot into .ptbackup v1.1
 * Note: Local device secrets (vaultMeta) are strictly EXCLUDED from payload.
 * Clinical stores are dynamically gathered from CLINICAL_STORES_REGISTRY.
 */
export const exportBackupPackage = async (
  database: PhysioRecordDatabase,
  vaultMeta: VaultMetaEntity,
  vaultKek: CryptoKey,
  backupPassword: string,
  clinicTimezone = 'Asia/Baghdad'
): Promise<string> => {
  // 1. Fetch encrypted clinical records for all registered clinical stores
  // vaultMeta is deliberately EXCLUDED as a device-specific store.
  const snapshot: Record<string, Record<string, unknown>[]> = {};
  for (const storeDef of Object.values(CLINICAL_STORES_REGISTRY)) {
    const table = database.table<Record<string, unknown>, string>(storeDef.name);
    if (table) {
      const records = await table.toArray();
      snapshot[storeDef.name] = records.map((r) => ({
        ...r,
        iv: Array.from(r.iv as ArrayLike<number>),
        ciphertext: Array.from(r.ciphertext as ArrayLike<number>),
      }));
    }
  }

  const payloadJson = JSON.stringify(snapshot);

  // Enforce memory & payload limits for low-memory devices (25 MB max limit)
  if (payloadJson.length > MAX_BACKUP_SIZE_BYTES) {
    throw new Error(
      `حجم حمولة قاعدة البيانات (${payloadJson.length} بايت) يتجاوز الحد الأقصى المسموح به (${MAX_BACKUP_SIZE_BYTES} بايت).`
    );
  }

  // Warning when approaching the 25 MB limit (>= 20 MB)
  if (payloadJson.length >= BACKUP_WARNING_THRESHOLD_BYTES) {
    console.warn(
      `[PhysioRecord Security Warning] حجم حمولة النسخة الاحتياطية (${(payloadJson.length / (1024 * 1024)).toFixed(2)} MB) يقترب من الحد الأقصى المعتمد (${MAX_BACKUP_SIZE_BYTES / (1024 * 1024)} MB). تنبيه: تُضمَّن السجلات المؤرشفة في النسخ الاحتياطية الكاملة ولا يُخفف أرشفتها من حجم الملف. يُوصى بالنظر في حذف السجلات المكتملة نهائياً لتخفيف الحجم.`
    );
  }

  // 2. Derive separate backup keys via PBKDF2 + HKDF with dedicated 32-byte HKDF salt
  const backupSalt = randomBytes(CONSTANTS.SALT_BYTES);
  const hkdfSalt = randomBytes(CONSTANTS.HKDF_SALT_BYTES); // 32 cryptographically random bytes
  const { backupDekWrapKey, backupPayloadEncKey } = await deriveBackupKeys(
    backupPassword,
    backupSalt,
    hkdfSalt,
    CONSTANTS.DEFAULT_PBKDF2_ITERATIONS
  );

  // 3. Temporarily recover raw DEK bytes using in-memory Vault KEK
  const rawDekBytes = await decryptRawDEKForBackup(
    vaultMeta.wrappedDek,
    vaultMeta.wrappedDekIv,
    vaultKek
  );

  // 4. Wrap raw DEK under dedicated backupDekWrapKey
  const { backupWrappedDek, backupDekIv } = await wrapDEKForBackup(
    rawDekBytes,
    backupDekWrapKey
  );

  // Best-effort zeroing of temporary raw DEK buffer
  rawDekBytes.fill(0);

  // 5. Build Complete Authenticated Header
  const header = {
    magic: 'PHYSIORECORD_BACKUP_V1.1',
    exportDateUtc: new Date().toISOString(),
    clinicTimezone,
    schemaVersion: database.verno,
    kdfAlgorithm: 'PBKDF2-HMAC-SHA256',
    kdfIterations: CONSTANTS.DEFAULT_PBKDF2_ITERATIONS,
    keyExpansion: 'HKDF-SHA256',
    hkdfHash: 'SHA-256',
    hkdfSalt: Array.from(hkdfSalt),
    hkdfInfoDekWrap: 'physiorecord-backup-dek-wrap-v1.1',
    hkdfInfoPayloadEnc: 'physiorecord-backup-payload-enc-v1.1',
    derivedKeyLengthBits: 256,
    backupSalt: Array.from(backupSalt),
    backupDekIv: Array.from(backupDekIv),
    backupWrappedDek: Array.from(backupWrappedDek),
    backupDataIv: [] as number[],
    dekVersion: vaultMeta.dekVersion || CURRENT_DEK_VERSION,
    encryptionInvocationCount: vaultMeta.encryptionInvocationCount || 0,
    maxBackupSizeBytes: MAX_BACKUP_SIZE_BYTES,
    payloadLength: payloadJson.length,
  };

  // 6. Canonical Header serialization as AAD
  const headerAad = buildCanonicalBackupHeaderAAD(header);

  // 7. Encrypt database payload using dedicated backupPayloadEncKey + header AAD
  const { backupDataIv, ciphertext } = await encryptBackupPayload(
    backupPayloadEncKey,
    headerAad,
    payloadJson
  );

  header.backupDataIv = Array.from(backupDataIv);

  const backupPackage: ExportedBackupPackage = {
    header,
    payloadCiphertext: Array.from(ciphertext),
  };

  return JSON.stringify(backupPackage, null, 2);
};

/**
 * 10-Step Safe Restoration Workflow
 * Validates untrusted header -> Derives keys -> Authenticates DEK ->
 * Authenticates Payload -> Validates schema -> Generates new local VaultMeta ->
 * Re-encrypts with isolated in-memory staging counter -> Performs atomic replacement.
 */
export const restoreBackupPackage = async (
  backupJsonStr: string,
  backupPassword: string,
  newDestinationVaultPassword: string,
  targetDatabase: PhysioRecordDatabase
): Promise<RestoredBackupSummary> => {
  // 1. Raw string pre-check BEFORE JSON.parse
  validateRawBackupString(backupJsonStr);

  let pkg: ExportedBackupPackage;
  try {
    pkg = JSON.parse(backupJsonStr);
  } catch {
    throw new BackupHeaderValidationError('ملف النسخة الاحتياطية غير صالح (صيغة JSON معطوبة).');
  }

  if (!pkg || typeof pkg !== 'object') {
    throw new BackupHeaderValidationError('حزمة النسخة الاحتياطية غير صالحة.');
  }

  const rawPayloadCipher = (pkg as unknown as Record<string, unknown>).payloadCiphertext;
  if (!rawPayloadCipher || (!Array.isArray(rawPayloadCipher) && !(rawPayloadCipher instanceof Uint8Array))) {
    throw new BackupHeaderValidationError('حقل النص المشفر للحمولة (payloadCiphertext) مفقود أو غير صالح.');
  }
  if (pkg.payloadCiphertext.length < 16) {
    throw new BackupHeaderValidationError('حجم النص المشفر للحمولة أصغر من وسم المصادقة الأدنى.');
  }

  // STEP 1: Pre-validation of untrusted header structure BEFORE key derivation
  validateBackupHeaderPreDerivation(pkg.header);

  const header = pkg.header;
  const backupSalt = new Uint8Array(header.backupSalt);
  const hkdfSalt = new Uint8Array(header.hkdfSalt);
  const backupDekIv = new Uint8Array(header.backupDekIv);
  const backupWrappedDek = new Uint8Array(header.backupWrappedDek);
  const backupDataIv = new Uint8Array(header.backupDataIv);
  const payloadCiphertext = new Uint8Array(pkg.payloadCiphertext);

  // STEP 2: Derive separate keys using PBKDF2 + HKDF with persisted parameters
  const { backupDekWrapKey, backupPayloadEncKey } = await deriveBackupKeys(
    backupPassword,
    backupSalt,
    hkdfSalt,
    header.kdfIterations
  );

  // STEP 3: Authenticated unwrapping of the DEK (Verifies auth tag on wrapped DEK)
  const rawDek = await unwrapDEKFromBackup(
    backupWrappedDek,
    backupDekIv,
    backupDekWrapKey
  );

  // STEP 4: Authenticated decryption of the payload (Verifies header AAD & payload auth tag)
  const headerAad = buildCanonicalBackupHeaderAAD(header);

  const decryptedPayloadJson = await decryptBackupPayload(
    backupPayloadEncKey,
    headerAad,
    backupDataIv,
    payloadCiphertext
  );

  // STEP 5: Validate decrypted snapshot records and strict referential integrity
  type SerializedEncryptedRecord = SnapshotEntityRecord & {
    id: string;
    iv: number[] | Uint8Array;
    ciphertext: number[] | Uint8Array;
    recordCryptoVersion?: number;
    dekVersion?: number;
  };
  let snapshot: Record<string, SerializedEncryptedRecord[]>;
  try {
    snapshot = JSON.parse(decryptedPayloadJson) as Record<string, SerializedEncryptedRecord[]>;
  } catch {
    throw new Error('فشل قراءة حمولة السجلات السريرية بعد فك التشفير.');
  }

  // Enforce referential integrity: no orphaned episodes, sessions, or notes allowed!
  validateSnapshotReferentialIntegrity(snapshot);

  // STEP 6: Import source DEK as temporary decryptor
  const sourceDek = await subtle.importKey(
    'raw',
    rawDek,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // Read existing target vaultMeta to determine current and next vaultGeneration epoch
  const existingTargetMeta = await targetDatabase.vaultMeta.get('auth');
  const currentVaultGen = existingTargetMeta?.vaultGeneration ?? 1;
  const nextVaultGeneration = currentVaultGen + 1;

  // STEP 7: Generate a brand new random 256-bit DEK for the destination
  const freshRawDek = randomBytes(32);
  const newVaultSalt = randomBytes(CONSTANTS.SALT_BYTES);
  const destinationVaultKek = await deriveKEK(newDestinationVaultPassword, newVaultSalt);

  const newWrappedDekIv = randomBytes(CONSTANTS.IV_BYTES);
  const wrapAad = new TextEncoder().encode('vault-dek-wrap:v1.1');
  const cipherBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv: newWrappedDekIv, additionalData: wrapAad },
    destinationVaultKek,
    freshRawDek
  );

  const destinationOperationalDek = await subtle.importKey(
    'raw',
    freshRawDek,
    { name: 'AES-GCM', length: 256 },
    false, // strictly NON-EXTRACTABLE
    ['encrypt', 'decrypt']
  );

  // Immediately bind destination operational DEK to its target vaultGeneration epoch
  bindDekToGeneration(destinationOperationalDek, nextVaultGeneration);

  // Derive domain-separated HKDF subkey for atomic session sequence tokens
  const destinationHmacKey = await deriveSequenceHmacKey(freshRawDek);
  registerSequenceHmacKey(destinationOperationalDek, destinationHmacKey);

  const verifier = await generateVerifier(destinationVaultKek);
  const newDekVersion = (header.dekVersion || CURRENT_DEK_VERSION) + 1;

  // STEP 8: Staging In-Memory Counter & Re-encryption across all registered clinical stores
  // The staging counter starts at zero and tracks every AES-GCM invocation under fresh DEK.
  type StagedEncryptedRecord = SnapshotEntityRecord & {
    id: string;
    iv: Uint8Array;
    ciphertext: Uint8Array;
    recordCryptoVersion: number;
    dekVersion: number;
  };
  let stagingInvocationCount = 0;
  const stagedStores: Record<string, StagedEncryptedRecord[]> = {};
  const restoredSessionsByEpisode = new Map<string, number[]>();

  try {
    for (const storeDef of Object.values(CLINICAL_STORES_REGISTRY)) {
      const storeName = storeDef.name;
      const records = snapshot[storeName];
      stagedStores[storeName] = [];

      if (Array.isArray(records)) {
        for (const r of records) {
          // Strictly resolve and validate parent IDs from registry
          const parentIds = extractAndValidateParentIds(storeName, r);

          // Decrypt from source DEK (authenticating source dekVersion in AAD)
          const sourceDekVersion = r.dekVersion || header.dekVersion || CURRENT_DEK_VERSION;
          const clinicalData = await decryptRecordPayload<Record<string, unknown>>(
            sourceDek,
            storeName,
            r.id,
            parentIds,
            new Uint8Array(r.iv),
            new Uint8Array(r.ciphertext),
            r.recordCryptoVersion || CURRENT_RECORD_CRYPTO_VERSION,
            sourceDekVersion
          );

          // Track restored session numbers per episode for sequence table reconstruction
          const sessionNum = clinicalData?.sessionNumber;
          if (storeName === 'sessions' && r.episodeId && sessionNum !== undefined) {
            if (!restoredSessionsByEpisode.has(r.episodeId)) {
              restoredSessionsByEpisode.set(r.episodeId, []);
            }
            restoredSessionsByEpisode.get(r.episodeId)!.push(Number(sessionNum));
          }

          // Reserve and increment staging invocation counter BEFORE encryption
          // Enforce MAX_GCM_INVOCATIONS_PER_DEK (1,000,000)
          if (stagingInvocationCount + 1 > MAX_GCM_INVOCATIONS_PER_DEK) {
            throw new DekExhaustedError('تجاوزت عمليات إعادة التشفير أثناء الاستعادة سقف استخدام المفتاح (1,000,000 عملية).');
          }
          stagingInvocationCount += 1;

          // Re-encrypt under destination DEK with newDekVersion bound deterministically in canonical AAD
          const { iv: newIv, ciphertext: newCiphertext } = await encryptRecordPayload(
            destinationOperationalDek,
            storeName,
            r.id,
            parentIds,
            clinicalData,
            r.recordCryptoVersion || CURRENT_RECORD_CRYPTO_VERSION,
            newDekVersion
          );

          // Preserve original entity attributes while attaching new cryptographic wrapper
          const stagedEntity: StagedEncryptedRecord = {
            ...r,
            recordCryptoVersion: r.recordCryptoVersion || CURRENT_RECORD_CRYPTO_VERSION,
            dekVersion: newDekVersion,
            iv: newIv,
            ciphertext: newCiphertext,
          };

          stagedStores[storeName].push(stagedEntity);
        }
      }
    }

    // STEP 9: In-Memory Pre-Commit Cryptographic Verification
    // Verify that every single re-encrypted entity can be cleanly decrypted with destinationOperationalDek
    for (const storeDef of Object.values(CLINICAL_STORES_REGISTRY)) {
      const storeName = storeDef.name;
      const stagedList = stagedStores[storeName] || [];
      for (const sr of stagedList) {
        const parentIds = storeDef.parentKeys
          .map((k) => sr[k])
          .filter((v): v is string => typeof v === 'string' && Boolean(v));
        await decryptRecordPayload(
          destinationOperationalDek,
          storeName,
          sr.id,
          parentIds,
          sr.iv,
          sr.ciphertext,
          sr.recordCryptoVersion,
          sr.dekVersion
        );
      }
    }

    // Pre-calculate reconstructed sequence entities with HMAC tokens for every restored episode
    const reconstructedSequences: EpisodeSequenceEntity[] = [];
    for (const [epId, numbers] of restoredSessionsByEpisode.entries()) {
      const tokens: string[] = [];
      for (const num of numbers) {
        const token = await computeSessionNumberHmacToken(destinationOperationalDek, epId, num);
        tokens.push(token);
      }
      const maxNum = numbers.reduce((max, n) => Math.max(max, n), 0);
      reconstructedSequences.push({
        episodeId: epId,
        lastSequenceNumber: maxNum,
        allocatedTokens: tokens,
        updatedAt: new Date().toISOString(),
      });
    }

    // STEP 10: Atomic transactional activation confined strictly to targetDatabase
    // Architectural Note on IndexedDB Scoping: IndexedDB transactions are strictly scoped
    // to a single database connection. This single read/write transaction clears and commits
    // the pre-validated in-memory staged records entirely within targetDatabase.
    const tablesToLock = [
      ...Object.keys(CLINICAL_STORES_REGISTRY)
        .map((name) => targetDatabase.table(name))
        .filter(Boolean),
      targetDatabase.vaultMeta,
      ...(targetDatabase.episodeSequences ? [targetDatabase.episodeSequences] : []),
    ];

    await targetDatabase.transaction(
      'rw',
      tablesToLock,
      async () => {
        // 1. Clear existing destination data for all registered clinical stores
        for (const storeDef of Object.values(CLINICAL_STORES_REGISTRY)) {
          const table = targetDatabase.table(storeDef.name);
          if (table) {
            await table.clear();
          }
        }
        await targetDatabase.vaultMeta.clear();

        // 1b. Clear old local sequence allocations completely (eliminates stale sequence numbers)
        if (targetDatabase.episodeSequences) {
          await targetDatabase.episodeSequences.clear();
        }

        // 2. Insert verified re-encrypted entities
        for (const storeDef of Object.values(CLINICAL_STORES_REGISTRY)) {
          const table = targetDatabase.table(storeDef.name);
          const stagedList = stagedStores[storeDef.name];
          if (table && stagedList && stagedList.length > 0) {
            await table.bulkPut(stagedList);
          }
        }

        // 2b. Insert fresh reconstructed sequence allocations matching restored sessions
        if (targetDatabase.episodeSequences && reconstructedSequences.length > 0) {
          await targetDatabase.episodeSequences.bulkPut(reconstructedSequences);
        }

        // 3. Write brand new destination VaultMeta persisting the ACTUAL stagingInvocationCount
        // and advancing vaultGeneration to fence out concurrent stale writes from old vault sessions
        await targetDatabase.vaultMeta.put({
          id: 'auth',
          salt: newVaultSalt,
          wrappedDek: new Uint8Array(cipherBuffer),
          wrappedDekIv: newWrappedDekIv,
          verifierIv: verifier.verifierIv,
          verifierCiphertext: verifier.verifierCiphertext,
          schemaVersion: header.schemaVersion || 1,
          kdfAlgorithm: 'PBKDF2-HMAC-SHA256',
          kdfIterations: CONSTANTS.DEFAULT_PBKDF2_ITERATIONS,
          dekVersion: newDekVersion,
          encryptionInvocationCount: stagingInvocationCount, // Persist actual staging consumption!
          vaultGeneration: nextVaultGeneration,
        });
      }
    );

    // Bind destination operational DEK to its newly established vaultGeneration
    bindDekToGeneration(destinationOperationalDek, nextVaultGeneration);

    // Cross-Tab Vault Synchronization:
    // Broadcast vault generation change to inform other open tabs to lock and purge memory
    broadcastVaultEvent({
      type: 'VAULT_GENERATION_CHANGED',
      generation: nextVaultGeneration,
    });
  } finally {
    // Best-effort zeroing of temporary raw key buffers
    rawDek.fill(0);
    freshRawDek.fill(0);
  }

  const countsByStore: Record<string, number> = {};
  for (const storeDef of Object.values(CLINICAL_STORES_REGISTRY)) {
    countsByStore[storeDef.name] = (stagedStores[storeDef.name] || []).length;
  }

  return {
    patientCount: countsByStore['patients'] || 0,
    episodeCount: countsByStore['episodes'] || 0,
    sessionCount: countsByStore['sessions'] || 0,
    soapCount: countsByStore['soapNotes'] || 0,
    addendaCount: countsByStore['clinicalAddenda'] || 0,
    countsByStore,
    destinationOperationalDek,
    restoredInvocationCount: stagingInvocationCount,
  };
};

// Safely register test hooks for test environments only (isolated/no-op in production)
registerTestHooks({
  restoreBackupPackage,
  exportBackupPackage,
});
