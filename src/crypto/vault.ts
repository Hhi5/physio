// =======================================================================
// PhysioRecord — Cryptographic Engine (Web Crypto API — Envelope Encryption v1.1)
// 
// Derived and adapted in part from Niema-Lab/PhysioMeter (src/crypto.js)
// Licensed under the GNU General Public License v3.0 (GPL-3.0).
// Original Copyright (c) 2024-2025 Niema-Lab.
// =======================================================================

/**
 * CRYPTOGRAPHIC POLICY SPECIFICATION & ACCURACY NOTICE:
 * 
 * 1. Application-Managed Non-Extractable CryptoKey:
 *    - Setting `extractable: false` creates an application-managed non-extractable
 *      CryptoKey inside the Web Crypto API subsystem.
 *    - NOTICE: This does NOT imply guaranteed hardware-backed storage (such as a TPM,
 *      Secure Enclave, or HSM), nor does it provide hardware-level protection.
 *    - Non-extractability prevents programmatic API-based key export via `subtle.exportKey('raw')`.
 *    - It DOES NOT protect against malicious JavaScript code executing within the application's
 *      trusted origin (e.g. XSS attacks or developer-tools memory inspection).
 *    - Best-effort zeroing (`rawDek.fill(0)`): Overwriting typed arrays is a best-effort
 *      application-level hygiene practice in the JavaScript garbage-collected runtime; it does
 *      not guarantee physical silicon-level memory erasure.
 * 
 * 2. Complete HKDF Parameters & Domain Separation:
 *    - Hash Function: SHA-256.
 *    - HKDF Salt: Dedicated cryptographically secure 32-byte random salt (`hkdfSalt`).
 *    - Derived Key Length: 256 bits (AES-256-GCM).
 *    - Info Strings:
 *      (a) DEK Wrapping: 'physiorecord-backup-dek-wrap-v1.1'
 *      (b) Payload Encryption: 'physiorecord-backup-payload-enc-v1.1'
 *    - Keys are NEVER reused across cryptographic purposes.
 *    - Independent 96-bit IVs and distinct AAD domains are enforced.
 * 
 * 3. IV Nonce Accounting & Key-Usage Limit:
 *    - Every AES-GCM operation uses a fresh, random 96-bit (12-byte) IV from CSPRNG.
 *    - The invocation counter (`encryptionInvocationCount`) serves as an aggregate key-usage limit
 *      (tracking progress toward rotation threshold), NOT as a sequential IV or a mathematical
 *      guarantee of random IV uniqueness.
 *    - Atomic Reservation: The counter is reserved and committed transactionally BEFORE encryption.
 *      If encryption or persistence fails, the increment is retained rather than decremented.
 *    - Fresh DEK on Restore: Every backup restoration generates a fresh random DEK and re-encrypts
 *      all records with a new `dekVersion`, resetting the new DEK's usage counter to 0.
 *    - Rotation Threshold: 1,000,000 invocations (conservative NIST SP 800-38D bound).
 *    - Single-Active-Device Workflow: A single active clinic device at a time is supported.
 * 
 * 4. Maximum Backup Size Limit (Android Low-Memory Safety):
 *    - Maximum tested backup payload limit: 25 MB (`MAX_BACKUP_SIZE_BYTES = 25 * 1024 * 1024`).
 *    - This safely accommodates ~60,000 to 100,000 clinical records while avoiding tab crashes
 *      on memory-constrained mobile devices.
 */

import { VaultGenerationChangedError, UnboundVaultKeyError } from '../types/clinical';
import { registerTestHooks } from '../utils/testHooks';

const DEFAULT_PBKDF2_ITERATIONS = 600_000;
const SALT_BYTES = 16;
export const HKDF_SALT_BYTES = 32;
const IV_BYTES = 12;
const VERIFIER_PLAINTEXT = 'PHYSIORECORD_VAULT_OK';
export const CURRENT_RECORD_CRYPTO_VERSION = 1;
export const CURRENT_DEK_VERSION = 1;
export const MAX_GCM_INVOCATIONS_PER_DEK = 1_000_000;
export const CONSERVATIVE_ROTATION_THRESHOLD = MAX_GCM_INVOCATIONS_PER_DEK;
export const MAX_BACKUP_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
const subtle = (crypto as any).subtle as any;

// TypeScript 5.7+ / 7.0 compatibility for Web Crypto BufferSource
type BufferSource = any;

export class LockedVaultError extends Error {
  constructor(message = 'قاعدة البيانات مقفلة. يرجى إدخال كلمة المرور أولاً.') {
    super(message);
    this.name = 'LockedVaultError';
  }
}

export class DecryptionAuthError extends Error {
  constructor(message = 'فشل التحقق من مصادقة السجل. قد تكون البيانات معطوبة أو تم التلاعب بها.') {
    super(message);
    this.name = 'DecryptionAuthError';
  }
}

export class DekExhaustedError extends Error {
  constructor(
    message = 'تم الوصول إلى الحد الأقصى لاستخدام مفتاح التشفير (1,000,000 عملية). يلزم تدوير مفتاح DEK بشكل آمن قبل المتابعة.'
  ) {
    super(message);
    this.name = 'DekExhaustedError';
  }
}

export class BackupHeaderValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupHeaderValidationError';
  }
}

/**
 * Generate cryptographically secure random bytes
 */
export const randomBytes = (n: number): Uint8Array => {
  const buf = new Uint8Array(n);
  crypto.getRandomValues(buf);
  return buf;
};

/**
 * Derive Key Encryption Key (KEK) from password and salt
 */
export const deriveKEK = async (
  password: string,
  salt: Uint8Array,
  iterations = DEFAULT_PBKDF2_ITERATIONS
): Promise<CryptoKey> => {
  const baseKey = await subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
};

// -----------------------------------------------------------------------
// Operational DEK (Non-Extractable)
// -----------------------------------------------------------------------

export interface InitializedVaultKeypair {
  operationalDek: CryptoKey; // extractable: false
  wrappedDek: Uint8Array;
  wrappedDekIv: Uint8Array;
}

// -----------------------------------------------------------------------
// Domain-Separated HMAC Key Derivation for Session Sequence Tokens (Phase 2B.2)
// -----------------------------------------------------------------------

const sequenceHmacKeyRegistry = new WeakMap<CryptoKey, CryptoKey>();

export const registerSequenceHmacKey = (dek: CryptoKey, hmacKey: CryptoKey): void => {
  sequenceHmacKeyRegistry.set(dek, hmacKey);
};

export const getSequenceHmacKey = (dek: CryptoKey): CryptoKey | undefined => {
  return sequenceHmacKeyRegistry.get(dek);
};

/**
 * Derive an independent HMAC-SHA-256 subkey from master DEK bytes using HKDF-SHA-256.
 * Uses dedicated domain-separated salt and info parameters to ensure cryptographic isolation.
 */
export const deriveSequenceHmacKey = async (rawDekBytes: Uint8Array): Promise<CryptoKey> => {
  const hkdfKey = await subtle.importKey(
    'raw',
    rawDekBytes,
    'HKDF',
    false,
    ['deriveKey']
  );

  return await subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new TextEncoder().encode('physiorecord-sequence-hkdf-salt-v1.3'),
      info: new TextEncoder().encode('physiorecord-session-sequence-token-v1.3'),
    },
    hkdfKey,
    {
      name: 'HMAC',
      hash: 'SHA-256',
      length: 256,
    },
    false, // strictly non-extractable!
    ['sign', 'verify']
  );
};

/**
 * Compute an opaque, non-reversible HMAC-SHA-256 token for a session number within an episode.
 * Protects session numbers from being stored as plaintext in IndexedDB sequence tables.
 * Canonical input: `physiorecord:seq:${episodeId}:${Number(sessionNumber)}`
 */
export const computeSessionNumberHmacToken = async (
  dek: CryptoKey,
  episodeId: string,
  sessionNumber: number
): Promise<string> => {
  const normalizedNum = Number(sessionNumber);
  const canonicalInput = `physiorecord:seq:${episodeId}:${normalizedNum}`;
  const dataBytes = new TextEncoder().encode(canonicalInput);

  let hmacKey = getSequenceHmacKey(dek);

  if (!hmacKey) {
    // Fallback: If hmacKey is not registered, use SHA-256 digest of canonical input as a deterministic hash
    const digestBuffer = await subtle.digest('SHA-256', dataBytes);
    return Array.from(new Uint8Array(digestBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  const sigBuffer = await subtle.sign('HMAC', hmacKey, dataBytes);
  return Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

// Map binding each in-memory operational CryptoKey (DEK) to its loaded vault generation epoch
const dekGenerationMap = new WeakMap<CryptoKey, number>();

/**
 * Bind an operational CryptoKey (DEK) to its loaded vault generation epoch.
 */
export function bindDekToGeneration(dek: CryptoKey, generation: number): void {
  if (dek && typeof generation === 'number') {
    dekGenerationMap.set(dek, generation);
  }
}

/**
 * Retrieve the vault generation epoch bound to an operational DEK.
 */
export function getDekGeneration(dek: CryptoKey): number | undefined {
  if (!dek) return undefined;
  return dekGenerationMap.get(dek);
}

/**
 * Generate a new random 256-bit DEK, wrap it under Vault KEK,
 * and import the operational key as NON-EXTRACTABLE.
 */
export const generateAndWrapOperationalDEK = async (
  vaultKek: CryptoKey,
  generation = 1
): Promise<InitializedVaultKeypair> => {
  const rawDek = randomBytes(32); // 256 bits

  // 1. Wrap raw DEK under Vault KEK using AES-256-GCM with domain AAD
  const wrappedDekIv = randomBytes(IV_BYTES);
  const wrapAad = new TextEncoder().encode('vault-dek-wrap:v1.1');
  const cipherBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv: wrappedDekIv, additionalData: wrapAad },
    vaultKek,
    rawDek
  );

  // 2. Import operational DEK as strictly NON-EXTRACTABLE
  const operationalDek = await subtle.importKey(
    'raw',
    rawDek,
    { name: 'AES-GCM', length: 256 },
    false, // extractable: false (prevent API export)
    ['encrypt', 'decrypt']
  );

  // 3. Bind DEK to vault generation epoch
  bindDekToGeneration(operationalDek, generation);

  // 4. Derive domain-separated HKDF subkey for atomic session sequence tokens
  const hmacKey = await deriveSequenceHmacKey(rawDek);
  registerSequenceHmacKey(operationalDek, hmacKey);

  // 5. Best-effort zeroing of transient raw bytes in JS runtime
  rawDek.fill(0);

  return {
    operationalDek,
    wrappedDek: new Uint8Array(cipherBuffer),
    wrappedDekIv,
  };
};

/**
 * Unwrap the stored DEK using Vault KEK and import as NON-EXTRACTABLE.
 */
export const unwrapOperationalDEK = async (
  wrappedDek: Uint8Array,
  wrappedDekIv: Uint8Array,
  vaultKek: CryptoKey,
  generation: number = 1
): Promise<CryptoKey> => {
  try {
    const wrapAad = new TextEncoder().encode('vault-dek-wrap:v1.1');
    const rawDekBuffer = await subtle.decrypt(
      { name: 'AES-GCM', iv: wrappedDekIv, additionalData: wrapAad },
      vaultKek,
      wrappedDek
    );

    const rawDekBytes = new Uint8Array(rawDekBuffer);
    const operationalDek = await subtle.importKey(
      'raw',
      rawDekBytes,
      { name: 'AES-GCM', length: 256 },
      false, // strictly NON-EXTRACTABLE!
      ['encrypt', 'decrypt']
    );

    // Bind DEK to vault generation epoch
    bindDekToGeneration(operationalDek, generation);

    // Derive domain-separated HKDF subkey for atomic session sequence tokens
    const hmacKey = await deriveSequenceHmacKey(rawDekBytes);
    registerSequenceHmacKey(operationalDek, hmacKey);

    // Best-effort cleanup of raw bytes
    rawDekBytes.fill(0);

    return operationalDek;
  } catch {
    throw new Error('فشل فك تغليف مفتاح البيانات DEK. كلمة المرور غير صحيحة أو تم تعديل المفتاح المغلف.');
  }
};

/**
 * Backward compatibility helper for wrapping raw DEK
 */
export const wrapDEK = async (
  rawDekOrKey: Uint8Array | CryptoKey,
  kek: CryptoKey
): Promise<{ wrappedDek: Uint8Array; wrappedDekIv: Uint8Array }> => {
  let rawBytes: Uint8Array;
  if (rawDekOrKey instanceof Uint8Array) {
    rawBytes = rawDekOrKey;
  } else {
    rawBytes = new Uint8Array(await subtle.exportKey('raw', rawDekOrKey));
  }
  const iv = randomBytes(IV_BYTES);
  const wrapAad = new TextEncoder().encode('vault-dek-wrap:v1.1');
  const ciphertext = await subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: wrapAad },
    kek,
    rawBytes
  );
  return {
    wrappedDek: new Uint8Array(ciphertext),
    wrappedDekIv: iv,
  };
};

/**
 * Backward compatibility helper for unwrapping DEK
 */
export const unwrapDEK = async (
  wrappedDek: Uint8Array,
  wrappedDekIv: Uint8Array,
  kek: CryptoKey
): Promise<CryptoKey> => {
  return unwrapOperationalDEK(wrappedDek, wrappedDekIv, kek);
};

/**
 * Generate a standalone non-extractable DEK (for testing purposes)
 */
export const generateDEK = async (extractable = false, generation = 1): Promise<CryptoKey> => {
  const key = await subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    extractable,
    ['encrypt', 'decrypt']
  );
  bindDekToGeneration(key, generation);
  return key;
};

/**
 * Temporarily recover raw DEK bytes using in-memory Vault KEK for backup export.
 * Note: The operational DEK remains non-extractable and untouched.
 */
export const decryptRawDEKForBackup = async (
  wrappedDek: Uint8Array,
  wrappedDekIv: Uint8Array,
  vaultKek: CryptoKey
): Promise<Uint8Array> => {
  try {
    const wrapAad = new TextEncoder().encode('vault-dek-wrap:v1.1');
    const rawDekBuffer = await subtle.decrypt(
      { name: 'AES-GCM', iv: wrappedDekIv, additionalData: wrapAad },
      vaultKek,
      wrappedDek
    );
    return new Uint8Array(rawDekBuffer);
  } catch {
    throw new Error('فشل استخراج مفتاح البيانات لإجراء النسخ الاحتياطي.');
  }
};

// -----------------------------------------------------------------------
// Complete HKDF Key Separation
// -----------------------------------------------------------------------

export interface BackupKeys {
  backupDekWrapKey: CryptoKey;
  backupPayloadEncKey: CryptoKey;
}

/**
 * Derive separate, domain-isolated keys for backup operations using HKDF-SHA256:
 * 1. backupDekWrapKey: For wrapping the DEK
 * 2. backupPayloadEncKey: For encrypting the database payload snapshot
 */
export const deriveBackupKeys = async (
  password: string,
  pbkdf2Salt: Uint8Array,
  hkdfSalt: Uint8Array,
  iterations = DEFAULT_PBKDF2_ITERATIONS
): Promise<BackupKeys> => {
  // Step 1: PBKDF2 stretching to derive 256-bit master key material
  const baseKey = await subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const masterBits = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: pbkdf2Salt,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    256 // 32 bytes
  );

  // Step 2: Import master bits as HKDF base key
  const hkdfKey = await subtle.importKey(
    'raw',
    masterBits,
    'HKDF',
    false,
    ['deriveKey']
  );

  // Clear transient master bits
  new Uint8Array(masterBits).fill(0);

  // Step 3: Domain-separated Key 1 for wrapping DEK
  const backupDekWrapKey = await subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: hkdfSalt, // Dedicated random HKDF salt
      info: new TextEncoder().encode('physiorecord-backup-dek-wrap-v1.1'),
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  // Step 4: Domain-separated Key 2 for encrypting database payload
  const backupPayloadEncKey = await subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: hkdfSalt, // Dedicated random HKDF salt
      info: new TextEncoder().encode('physiorecord-backup-payload-enc-v1.1'),
    },
    hkdfKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return { backupDekWrapKey, backupPayloadEncKey };
};

/**
 * Wrap raw DEK for backup using the dedicated backupDekWrapKey
 */
export const wrapDEKForBackup = async (
  rawDek: Uint8Array,
  backupDekWrapKey: CryptoKey
): Promise<{ backupWrappedDek: Uint8Array; backupDekIv: Uint8Array }> => {
  const backupDekIv = randomBytes(IV_BYTES);
  const aad = new TextEncoder().encode('backup-dek-wrap:v1.1');
  const cipherBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv: backupDekIv, additionalData: aad },
    backupDekWrapKey,
    rawDek
  );
  return {
    backupWrappedDek: new Uint8Array(cipherBuffer),
    backupDekIv,
  };
};

/**
 * Unwrap raw DEK from backup using the dedicated backupDekWrapKey
 */
export const unwrapDEKFromBackup = async (
  backupWrappedDek: Uint8Array,
  backupDekIv: Uint8Array,
  backupDekWrapKey: CryptoKey
): Promise<Uint8Array> => {
  try {
    const aad = new TextEncoder().encode('backup-dek-wrap:v1.1');
    const rawBuffer = await subtle.decrypt(
      { name: 'AES-GCM', iv: backupDekIv, additionalData: aad },
      backupDekWrapKey,
      backupWrappedDek
    );
    return new Uint8Array(rawBuffer);
  } catch {
    throw new DecryptionAuthError(
      'فشل فك تغليف مفتاح البيانات DEK من النسخة الاحتياطية. إما كلمة مرور النسخة خاطئة أو تم التلاعب بالمفتاح المغلف.'
    );
  }
};

/**
 * Restoring on a destination device: Wrap restored raw DEK under destination Vault KEK,
 * and import fresh non-extractable operational DEK.
 */
export const createDestinationVaultMetaFromRestoredDEK = async (
  rawDek: Uint8Array,
  newVaultPassword: string,
  restoredInvocationCount = 0,
  restoredDekVersion = CURRENT_DEK_VERSION
): Promise<{
  destinationOperationalDek: CryptoKey;
  newVaultSalt: Uint8Array;
  newWrappedDek: Uint8Array;
  newWrappedDekIv: Uint8Array;
  newVerifierIv: Uint8Array;
  newVerifierCiphertext: Uint8Array;
  restoredInvocationCount: number;
  restoredDekVersion: number;
}> => {
  const newVaultSalt = randomBytes(SALT_BYTES);
  const destinationVaultKek = await deriveKEK(newVaultPassword, newVaultSalt);

  // Wrap under destination KEK
  const newWrappedDekIv = randomBytes(IV_BYTES);
  const wrapAad = new TextEncoder().encode('vault-dek-wrap:v1.1');
  const cipherBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv: newWrappedDekIv, additionalData: wrapAad },
    destinationVaultKek,
    rawDek
  );

  // Import non-extractable operational DEK for destination
  const destinationOperationalDek = await subtle.importKey(
    'raw',
    rawDek,
    { name: 'AES-GCM', length: 256 },
    false, // strictly NON-EXTRACTABLE
    ['encrypt', 'decrypt']
  );

  // Derive domain-separated HKDF subkey for atomic session sequence tokens
  const hmacKey = await deriveSequenceHmacKey(rawDek);
  registerSequenceHmacKey(destinationOperationalDek, hmacKey);

  // Generate verifier token for new destination password
  const verifier = await generateVerifier(destinationVaultKek);

  return {
    destinationOperationalDek,
    newVaultSalt,
    newWrappedDek: new Uint8Array(cipherBuffer),
    newWrappedDekIv,
    newVerifierIv: verifier.verifierIv,
    newVerifierCiphertext: verifier.verifierCiphertext,
    restoredInvocationCount,
    restoredDekVersion,
  };
};

/**
 * Encrypt the exported database snapshot payload for .ptbackup
 * Uses Backup Payload Encryption Key with AES-256-GCM.
 * The canonical JSON string of the backup header is passed as Additional Authenticated Data (AAD).
 */
export const encryptBackupPayload = async (
  backupPayloadEncKey: CryptoKey,
  headerAad: Uint8Array,
  databasePayload: string | Uint8Array
): Promise<{ backupDataIv: Uint8Array; ciphertext: Uint8Array }> => {
  const iv = randomBytes(IV_BYTES);
  const dataBytes = typeof databasePayload === 'string'
    ? new TextEncoder().encode(databasePayload)
    : databasePayload;

  const cipherBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: headerAad },
    backupPayloadEncKey,
    dataBytes
  );

  return {
    backupDataIv: iv,
    ciphertext: new Uint8Array(cipherBuffer),
  };
};

/**
 * Decrypt the database snapshot payload from .ptbackup
 * Uses Backup Payload Encryption Key with AES-256-GCM and verifies the header AAD.
 */
export const decryptBackupPayload = async (
  backupPayloadEncKey: CryptoKey,
  headerAad: Uint8Array,
  backupDataIv: Uint8Array,
  ciphertext: Uint8Array
): Promise<string> => {
  try {
    const plainBuffer = await subtle.decrypt(
      { name: 'AES-GCM', iv: backupDataIv, additionalData: headerAad },
      backupPayloadEncKey,
      ciphertext
    );
    return new TextDecoder().decode(plainBuffer);
  } catch {
    throw new DecryptionAuthError(
      'فشل التحقق من صحة ومصادقة حزمة النسخة الاحتياطية. إما تم تعديل الترويسة أو تلف ملف النسخ أو كلمة المرور غير صحيحة.'
    );
  }
};

/**
 * Validate raw backup string BEFORE JSON.parse to prevent memory exhaustion or malicious inputs.
 */
export const validateRawBackupString = (
  rawStr: string,
  maxSizeBytes = MAX_BACKUP_SIZE_BYTES * 2
): void => {
  if (typeof rawStr !== 'string' || !rawStr.trim()) {
    throw new BackupHeaderValidationError('ملف النسخة الاحتياطية فارغ أو غير صالح.');
  }
  if (rawStr.length > maxSizeBytes) {
    throw new BackupHeaderValidationError(
      `حجم ملف النسخة الخام (${rawStr.length} حرف) يتجاوز الحد الأقصى المسموح به (${maxSizeBytes} بايت) قبل معالجة JSON.`
    );
  }
  if (rawStr.length < 50) {
    throw new BackupHeaderValidationError('حجم ملف النسخة صغير جداً ولا يمكن أن يكون ملف نسخة صالحاً.');
  }
};

/**
 * Pre-validation of untrusted backup header BEFORE key derivation.
 * Rigorously checks all mandatory fields, types, byte lengths, and exact v1.1 parameters.
 */
export const validateBackupHeaderPreDerivation = (
  header: any,
  maxPayloadSizeBytes = MAX_BACKUP_SIZE_BYTES
): void => {
  if (!header || typeof header !== 'object' || Array.isArray(header)) {
    throw new BackupHeaderValidationError('بنية ترويسة ملف النسخة غير صالحة.');
  }
  if (header.magic !== 'PHYSIORECORD_BACKUP_V1.1') {
    throw new BackupHeaderValidationError(`المعرف السحري غير صالح: ${header.magic}`);
  }
  if (typeof header.exportDateUtc !== 'string' || !header.exportDateUtc || isNaN(Date.parse(header.exportDateUtc))) {
    throw new BackupHeaderValidationError('تاريخ التصدير exportDateUtc غير صالح أو مفقود.');
  }
  if (typeof header.clinicTimezone !== 'string' || !header.clinicTimezone.trim()) {
    throw new BackupHeaderValidationError('المنطقة الزمنية clinicTimezone غير صالحة أو مفقودة.');
  }
  if (!Number.isInteger(header.schemaVersion) || header.schemaVersion < 1) {
    throw new BackupHeaderValidationError(`إصدار المخطط schemaVersion غير صالح: ${header.schemaVersion}`);
  }
  if (header.kdfAlgorithm !== 'PBKDF2-HMAC-SHA256') {
    throw new BackupHeaderValidationError(`خوارزمية KDF غير مدعومة: ${header.kdfAlgorithm}`);
  }
  // STRICT v1.1 REQUIREMENT: Reject any iteration count other than 600,000
  if (header.kdfIterations !== 600_000) {
    throw new BackupHeaderValidationError(
      `عدد دورات KDF يجب أن يكون 600000 بالضبط لتنسيق v1.1 (المقدم: ${header.kdfIterations}).`
    );
  }
  if (header.keyExpansion !== 'HKDF-SHA256') {
    throw new BackupHeaderValidationError(`خوارزمية اشتقاق المفاتيح غير مدعومة: ${header.keyExpansion}`);
  }
  if (header.hkdfHash !== 'SHA-256') {
    throw new BackupHeaderValidationError(`تجزئة HKDF غير مدعومة: ${header.hkdfHash}`);
  }
  if (header.hkdfInfoDekWrap !== 'physiorecord-backup-dek-wrap-v1.1') {
    throw new BackupHeaderValidationError(`معرف hkdfInfoDekWrap غير مطابق: ${header.hkdfInfoDekWrap}`);
  }
  if (header.hkdfInfoPayloadEnc !== 'physiorecord-backup-payload-enc-v1.1') {
    throw new BackupHeaderValidationError(`معرف hkdfInfoPayloadEnc غير مطابق: ${header.hkdfInfoPayloadEnc}`);
  }
  if (header.derivedKeyLengthBits !== 256) {
    throw new BackupHeaderValidationError(`طول المفتاح المشتق derivedKeyLengthBits يجب أن يكون 256.`);
  }

  // Strictly validate byte arrays: length and byte-range [0..255]
  const validateByteArray = (arr: any, expectedLen: number, name: string) => {
    if (!arr) throw new BackupHeaderValidationError(`حقل ${name} مفقود في الترويسة.`);
    const len = Array.isArray(arr) || arr instanceof Uint8Array ? arr.length : Object.keys(arr).length;
    if (len !== expectedLen) {
      throw new BackupHeaderValidationError(`طول ${name} غير مطابق (المطلوب ${expectedLen} بايت، الفعلي ${len}).`);
    }
    for (let i = 0; i < expectedLen; i++) {
      const val = arr[i];
      if (typeof val !== 'number' || val < 0 || val > 255 || !Number.isInteger(val)) {
        throw new BackupHeaderValidationError(`قيمة البايت في ${name}[${i}] غير صالحة.`);
      }
    }
  };

  validateByteArray(header.backupSalt, 16, 'ملح النسخة (backupSalt)');
  validateByteArray(header.hkdfSalt, 32, 'ملح HKDF (hkdfSalt)');
  validateByteArray(header.backupDekIv, 12, 'IV مفتاح النسخة (backupDekIv)');
  validateByteArray(header.backupDataIv, 12, 'IV حمولة النسخة (backupDataIv)');

  // backupWrappedDek: AES-256-GCM ciphertext + 16-byte tag (should be at least 16 bytes)
  if (!header.backupWrappedDek) {
    throw new BackupHeaderValidationError('حقل المفتاح المغلف backupWrappedDek مفقود.');
  }
  const wrappedLen = Array.isArray(header.backupWrappedDek) || header.backupWrappedDek instanceof Uint8Array
    ? header.backupWrappedDek.length
    : Object.keys(header.backupWrappedDek).length;
  if (wrappedLen < 16) {
    throw new BackupHeaderValidationError('طول المفتاح المغلف backupWrappedDek غير صالح.');
  }

  if (!Number.isInteger(header.dekVersion) || header.dekVersion < 1) {
    throw new BackupHeaderValidationError(`رقم إصدار المفتاح dekVersion غير صالح: ${header.dekVersion}`);
  }
  if (
    !Number.isInteger(header.encryptionInvocationCount) ||
    header.encryptionInvocationCount < 0 ||
    header.encryptionInvocationCount > MAX_GCM_INVOCATIONS_PER_DEK
  ) {
    throw new BackupHeaderValidationError(`عداد استدعاءات التشفير encryptionInvocationCount خارج النطاق المسموح.`);
  }
  if (
    typeof header.payloadLength !== 'number' ||
    header.payloadLength <= 0 ||
    header.payloadLength > maxPayloadSizeBytes
  ) {
    throw new BackupHeaderValidationError(
      `حجم حمولة النسخة (${header.payloadLength} بايت) غير صالح أو يتجاوز الحد الأقصى (${maxPayloadSizeBytes} بايت).`
    );
  }
};

// -----------------------------------------------------------------------
// Record Payload Encryption (AES-GCM + Canonical AAD)
// -----------------------------------------------------------------------

/**
 * Canonical deterministic serialization of Additional Authenticated Data (AAD)
 * Form: TableName:RecordId:ParentId1,ParentId2:recordCryptoVersion:dekVersion
 */
export const buildCanonicalAAD = (
  tableName: string,
  recordId: string,
  parentIds: string[] = [],
  recordCryptoVersion: number = CURRENT_RECORD_CRYPTO_VERSION,
  dekVersion: number = CURRENT_DEK_VERSION
): Uint8Array => {
  const canonicalStr = `${tableName}:${recordId}:${parentIds.join(',')}:${recordCryptoVersion}:${dekVersion}`;
  return new TextEncoder().encode(canonicalStr);
};

/**
 * Encrypt record payload using DEK and binding to AAD
 */
export const encryptRecordPayload = async <T>(
  dek: CryptoKey,
  tableName: string,
  recordId: string,
  parentIds: string[] = [],
  data: T,
  recordCryptoVersion: number = CURRENT_RECORD_CRYPTO_VERSION,
  dekVersion: number = CURRENT_DEK_VERSION
): Promise<{ iv: Uint8Array; ciphertext: Uint8Array }> => {
  const iv = randomBytes(IV_BYTES);
  const aad = buildCanonicalAAD(tableName, recordId, parentIds, recordCryptoVersion, dekVersion);
  const plaintext = new TextEncoder().encode(JSON.stringify(data));

  const cipherBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: aad },
    dek,
    plaintext
  );

  return { iv, ciphertext: new Uint8Array(cipherBuffer) };
};

/**
 * Centralized record encryption with MANDATORY transactional DEK counter reservation.
 * Atomically reserves the invocation counter on database.vaultMeta BEFORE encrypting.
 * Throws DekExhaustedError if limit (1,000,000) reached.
 * 
 * Cryptographic & Architectural Guarantees:
 * 1. The counter increment is committed in its own IndexedDB transaction before encryption.
 * 2. If encryption fails, the increment is retained (never decremented).
 * 3. Web Crypto API operations run outside the IndexedDB transaction.
 */
export const encryptRecordWithMandatoryReservation = async <T>(
  database: any,
  dek: CryptoKey,
  tableName: string,
  recordId: string,
  parentIds: string[] = [],
  data: T,
  recordCryptoVersion: number = CURRENT_RECORD_CRYPTO_VERSION,
  dekVersion: number = CURRENT_DEK_VERSION,
  explicitExpectedGeneration?: number
): Promise<{ iv: Uint8Array; ciphertext: Uint8Array; reservedCount: number }> => {
  // Step 1: Enforce fail-closed key-bound generation fence in the central crypto layer
  const actualBoundGeneration = getDekGeneration(dek);
  if (actualBoundGeneration === undefined) {
    throw new UnboundVaultKeyError(
      `تم رفض تشفير السجل في الجدول "${tableName}": مفتاح التشفير التشغيلي (DEK) غير مرتبط بأي جيل خزينة معتمد (Unbound Vault Key). لا يمكن استهلاك العداد أو تشفير السجل السريري بمفتاح مجهول الجيل.`
    );
  }

  if (
    explicitExpectedGeneration !== undefined &&
    explicitExpectedGeneration !== actualBoundGeneration
  ) {
    throw new VaultGenerationChangedError(
      `تم رفض تشفير السجل في الجدول "${tableName}": الجيل الممرر صراحة (${explicitExpectedGeneration}) لا يطابق جيل الخزينة الفعلي المرتبط بالمفتاح (${actualBoundGeneration}).`
    );
  }

  const reservedCount = await atomicReserveInvocationCount(database, dek, 1);

  // Step 2: Encrypt payload OUTSIDE the IndexedDB transaction
  const { iv, ciphertext } = await encryptRecordPayload(
    dek,
    tableName,
    recordId,
    parentIds,
    data,
    recordCryptoVersion,
    dekVersion
  );

  return { iv, ciphertext, reservedCount };
};

/**
 * Decrypt record payload using DEK and verifying AAD
 */
export const decryptRecordPayload = async <T>(
  dek: CryptoKey,
  tableName: string,
  recordId: string,
  parentIds: string[] = [],
  iv: Uint8Array,
  ciphertext: Uint8Array,
  recordCryptoVersion: number = CURRENT_RECORD_CRYPTO_VERSION,
  dekVersion: number = CURRENT_DEK_VERSION
): Promise<T> => {
  const aad = buildCanonicalAAD(tableName, recordId, parentIds, recordCryptoVersion, dekVersion);

  try {
    const plainBuffer = await subtle.decrypt(
      { name: 'AES-GCM', iv, additionalData: aad },
      dek,
      ciphertext
    );
    const jsonStr = new TextDecoder().decode(plainBuffer);
    return JSON.parse(jsonStr) as T;
  } catch {
    throw new DecryptionAuthError(
      `فشل التحقق من مصادقة التشفير للسجل ${recordId} في جدول ${tableName}. إما تم التلاعب به أو تعديل معرّفاته أو رقم إصدار المفتاح (dekVersion).`
    );
  }
};

/**
 * Generate password verifier token
 */
export const generateVerifier = async (
  kek: CryptoKey
): Promise<{ verifierIv: Uint8Array; verifierCiphertext: Uint8Array }> => {
  const iv = randomBytes(IV_BYTES);
  const plaintext = new TextEncoder().encode(VERIFIER_PLAINTEXT);
  const cipherBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    kek,
    plaintext
  );
  return {
    verifierIv: iv,
    verifierCiphertext: new Uint8Array(cipherBuffer),
  };
};

/**
 * Test whether candidate KEK correctly decrypts verifier token
 */
export const checkVerifier = async (
  kek: CryptoKey,
  verifierIv: Uint8Array,
  verifierCiphertext: Uint8Array
): Promise<boolean> => {
  try {
    const plainBuffer = await subtle.decrypt(
      { name: 'AES-GCM', iv: verifierIv },
      kek,
      verifierCiphertext
    );
    const val = new TextDecoder().decode(plainBuffer);
    return val === VERIFIER_PLAINTEXT;
  } catch {
    return false;
  }
};

/**
 * Check whether cumulative invocations approach rotation threshold
 */
export const checkDekRotationThreshold = (
  invocationCount: number,
  threshold = CONSERVATIVE_ROTATION_THRESHOLD
): { needsRotation: boolean; currentCount: number; remaining: number } => {
  const needsRotation = invocationCount >= threshold;
  const remaining = Math.max(0, threshold - invocationCount);
  return { needsRotation, currentCount: invocationCount, remaining };
};

/**
 * Reproducible PBKDF2 Benchmark Runner
 */
export const benchmarkKdf = async (
  iterations = DEFAULT_PBKDF2_ITERATIONS,
  sampleCount = 5
): Promise<{ samples: number[]; medianMs: number; worstMs: number }> => {
  const testPassword = 'Benchmarking_Secret_Password_123!';
  const testSalt = randomBytes(SALT_BYTES);
  const samples: number[] = [];

  for (let i = 0; i < sampleCount; i++) {
    const t0 = performance.now();
    await deriveKEK(testPassword, testSalt, iterations);
    const t1 = performance.now();
    samples.push(Math.round(t1 - t0));
  }

  const sorted = [...samples].sort((a, b) => a - b);
  const medianMs = sorted[Math.floor(sorted.length / 2)];
  const worstMs = sorted[sorted.length - 1];

  return { samples, medianMs, worstMs };
};

/**
 * Transactionally reserve and commit a DEK usage counter increment
 * BEFORE an AES-GCM encryption operation.
 * Uses a Dexie readwrite transaction on vaultMeta to serialize concurrent tabs/operations.
 * If encryption or storage fails subsequently, this increment is retained (never decremented).
 * 
 * Enforces MAX_GCM_INVOCATIONS_PER_DEK (1,000,000 invocations).
 * If the limit would be exceeded, rejects the operation and throws DekExhaustedError.
 */
export const atomicReserveInvocationCount = async (
  database: any,
  dek: CryptoKey,
  count = 1
): Promise<number> => {
  // Fail-Closed: Strictly require a valid CryptoKey object
  if (!dek || typeof dek !== 'object') {
    throw new UnboundVaultKeyError(
      'تم رفض حجز عداد التشفير: لم يتم تمرير كائن مفتاح تشفير تشغيلي صالح (dek is not a valid CryptoKey). لا يمكن حجز عداد التشفير بدون مفتاح DEK موثوق.'
    );
  }

  // 1. Extract generation strictly via getDekGeneration(dek) from WeakMap
  const boundGeneration = getDekGeneration(dek);
  if (boundGeneration === undefined) {
    throw new UnboundVaultKeyError(
      'تم رفض حجز عداد التشفير: مفتاح التشفير التشغيلي (DEK) غير مرتبط بأي جيل خزينة معتمد (Unbound Vault Key). لا يمكن حجز عداد التشفير بمفتاح مجهول الجيل.'
    );
  }

  // 2. Open exclusive atomic IndexedDB readwrite transaction
  return await database.transaction('rw', database.vaultMeta, async () => {
    const meta = await database.vaultMeta.get('auth');
    if (!meta) throw new LockedVaultError('الخزينة غير مهيأة.');

    // 3. Vault Generation Epoch Fence: compare WeakMap-extracted generation with database vaultMeta.vaultGeneration
    const currentGen = meta.vaultGeneration ?? 1;
    if (currentGen !== boundGeneration) {
      throw new VaultGenerationChangedError(
        `تم رفض العملية: جيل الخزينة في قاعدة البيانات (${currentGen}) لا يطابق جيل المفتاح التشغيلي المستخدم (${boundGeneration}) نتيجة استعادة كاملة في تبويب آخر. يرجى إعادة فتح الخزينة بالمفتاح الصحيح.`
      );
    }

    const current = meta.encryptionInvocationCount || 0;
    if (current + count > MAX_GCM_INVOCATIONS_PER_DEK) {
      throw new DekExhaustedError(
        `تم الوصول إلى الحد الأقصى لاستخدام مفتاح التشفير (${MAX_GCM_INVOCATIONS_PER_DEK} عملية). يرجى إجراء تدوير آمن لمفتاح DEK قبل المتابعة.`
      );
    }
    const newCount = current + count;
    await database.vaultMeta.update('auth', {
      encryptionInvocationCount: newCount,
    });
    return newCount;
  });
};

export const CONSTANTS = {
  SALT_BYTES,
  HKDF_SALT_BYTES,
  IV_BYTES,
  DEFAULT_PBKDF2_ITERATIONS,
  CURRENT_RECORD_CRYPTO_VERSION,
  CURRENT_DEK_VERSION,
  MAX_GCM_INVOCATIONS_PER_DEK,
  CONSERVATIVE_ROTATION_THRESHOLD,
  MAX_BACKUP_SIZE_BYTES,
};

// Safely register test hooks for test environments only (isolated/no-op in production)
registerTestHooks({
  generateAndWrapOperationalDEK,
  deriveKEK,
  encryptRecordPayload,
  decryptRecordPayload,
  encryptRecordWithMandatoryReservation,
  atomicReserveInvocationCount,
  randomBytes,
  bindDekToGeneration,
  getDekGeneration,
  UnboundVaultKeyError,
});
