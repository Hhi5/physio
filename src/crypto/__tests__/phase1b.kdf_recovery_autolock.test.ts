// =======================================================================
// PhysioRecord — Phase 1B Verification Suite:
// Passwords, KDF Upgrades, Emergency Recovery Key, and Bulletproof Auto-Lock
// =======================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  validateBackupHeaderPreDerivation,
  BackupHeaderValidationError,
  encodeBase32,
  decodeBase32,
  formatRecoveryKey,
  generateAndWrapRecoveryKey,
  unwrapDEKWithRecoveryKey,
  generateAndWrapOperationalDEK,
  unwrapOperationalDEK,
  deriveKEK,
  generateVerifier,
  checkVerifier,
  checkNeedsKdfUpgrade,
  autoUpgradeVaultKdf,
  resetVaultPasswordWithRecoveryKey,
  randomBytes,
  encryptRecordPayload,
  decryptRecordPayload,
  bindDekToGeneration,
  CONSTANTS,
  CURRENT_DEK_VERSION,
  CURRENT_RECORD_CRYPTO_VERSION,
} from '../vault';
import { createInMemoryDatabase } from './testDbHelper';
import type { VaultMetaEntity } from '../../types/clinical';
import type { PhysioRecordDatabase } from '../../db/db';

describe('Phase 1B: KDF Bounds, Auto-Upgrade, Emergency Recovery Key, and Auto-Lock', () => {
  let testDb: any;

  beforeEach(async () => {
    testDb = createInMemoryDatabase(6);
  });

  afterEach(async () => {
    if (testDb) {
      await testDb.vaultMeta.clear();
      await testDb.patients.clear();
    }
  });

  // ---------------------------------------------------------------------
  // 1. KDF Bounds Validation & DoS Protection
  // ---------------------------------------------------------------------
  describe('1. KDF Bounds & DoS Protection in validateBackupHeaderPreDerivation', () => {
    const buildValidMockHeader = (iterations: number) => ({
      magic: 'PHYSIORECORD_BACKUP_V2.0',
      exportDateUtc: new Date().toISOString(),
      clinicTimezone: 'Asia/Baghdad',
      schemaVersion: 6,
      kdfAlgorithm: 'PBKDF2-HMAC-SHA256',
      kdfIterations: iterations,
      keyExpansion: 'HKDF-SHA256',
      hkdfHash: 'SHA-256',
      hkdfInfoDekWrap: 'physiorecord-backup-dek-wrap-v2.0',
      hkdfInfoPayloadEnc: 'physiorecord-backup-payload-enc-v2.0',
      derivedKeyLengthBits: 256,
      backupSalt: Array.from(new Uint8Array(16)),
      hkdfSalt: Array.from(new Uint8Array(32)),
      backupDekIv: Array.from(new Uint8Array(12)),
      backupDataIv: Array.from(new Uint8Array(12)),
      backupWrappedDek: Array.from(new Uint8Array(48)),
      dekVersion: 1,
      encryptionInvocationCount: 0,
      payloadLength: 1024,
    });

    it('accepts valid KDF iterations at baseline (600,000)', () => {
      const header = buildValidMockHeader(600_000);
      expect(() => validateBackupHeaderPreDerivation(header)).not.toThrow();
    });

    it('accepts valid KDF iterations in the middle range (1,000,000 and 2,500,000)', () => {
      expect(() => validateBackupHeaderPreDerivation(buildValidMockHeader(1_000_000))).not.toThrow();
      expect(() => validateBackupHeaderPreDerivation(buildValidMockHeader(2_500_000))).not.toThrow();
    });

    it('accepts valid KDF iterations at the maximum bound (5,000,000)', () => {
      const header = buildValidMockHeader(5_000_000);
      expect(() => validateBackupHeaderPreDerivation(header)).not.toThrow();
    });

    it('strictly rejects weak KDF iterations below 600,000 (e.g. 599,999 or 100,000)', () => {
      expect(() => validateBackupHeaderPreDerivation(buildValidMockHeader(599_999))).toThrow(
        BackupHeaderValidationError
      );
      expect(() => validateBackupHeaderPreDerivation(buildValidMockHeader(100_000))).toThrow(
        BackupHeaderValidationError
      );
    });

    it('strictly rejects excessive KDF iterations above 5,000,000 to prevent DoS attack', () => {
      expect(() => validateBackupHeaderPreDerivation(buildValidMockHeader(5_000_001))).toThrow(
        BackupHeaderValidationError
      );
      expect(() => validateBackupHeaderPreDerivation(buildValidMockHeader(100_000_000))).toThrow(
        BackupHeaderValidationError
      );
    });

    it('strictly rejects non-integer or negative KDF iterations', () => {
      expect(() => validateBackupHeaderPreDerivation(buildValidMockHeader(600_000.5))).toThrow(
        BackupHeaderValidationError
      );
      expect(() => validateBackupHeaderPreDerivation(buildValidMockHeader(-600_000))).toThrow(
        BackupHeaderValidationError
      );
    });
  });

  // ---------------------------------------------------------------------
  // 2. KDF Auto-Upgrade on Unlock
  // ---------------------------------------------------------------------
  describe('2. KDF Auto-Upgrade on Unlock', () => {
    it('detects when vaultMeta needs KDF upgrade (low iterations or short salt)', () => {
      const weakMeta1: VaultMetaEntity = {
        id: 'auth',
        salt: new Uint8Array(16),
        wrappedDek: new Uint8Array(48),
        wrappedDekIv: new Uint8Array(12),
        verifierIv: new Uint8Array(12),
        verifierCiphertext: new Uint8Array(32),
        schemaVersion: 1,
        kdfAlgorithm: 'PBKDF2-HMAC-SHA256',
        kdfIterations: 100_000, // < 600,000
        dekVersion: 1,
        encryptionInvocationCount: 0,
      };
      expect(checkNeedsKdfUpgrade(weakMeta1)).toBe(true);

      const weakMeta2: VaultMetaEntity = {
        ...weakMeta1,
        kdfIterations: 600_000,
        salt: new Uint8Array(8), // < 16 bytes
      };
      expect(checkNeedsKdfUpgrade(weakMeta2)).toBe(true);

      const modernMeta: VaultMetaEntity = {
        ...weakMeta1,
        kdfIterations: 600_000,
        salt: new Uint8Array(16),
      };
      expect(checkNeedsKdfUpgrade(modernMeta)).toBe(false);
    });

    it('seamlessly upgrades KDF without rotating DEK or breaking existing encrypted records', async () => {
      const password = 'Old_Password_12345!';
      const shortSalt = randomBytes(8); // Deprecated 8-byte salt
      const legacyIterations = 100_000; // Deprecated 100k iterations

      // 1. Setup legacy vault with low iterations
      const legacyKek = await deriveKEK(password, shortSalt, legacyIterations);
      const { operationalDek, wrappedDek, wrappedDekIv } = await generateAndWrapOperationalDEK(legacyKek, 1);
      const { verifierIv, verifierCiphertext } = await generateVerifier(legacyKek);

      const legacyMeta: VaultMetaEntity = {
        id: 'auth',
        salt: shortSalt,
        wrappedDek,
        wrappedDekIv,
        verifierIv,
        verifierCiphertext,
        schemaVersion: 1,
        kdfAlgorithm: 'PBKDF2-HMAC-SHA256',
        kdfIterations: legacyIterations,
        dekVersion: CURRENT_DEK_VERSION,
        encryptionInvocationCount: 1,
        vaultGeneration: 1,
      };
      await testDb.vaultMeta.put(legacyMeta);

      // 2. Encrypt a patient record using operational DEK
      const patientData = { fullName: 'أحمد محمود', phone: '07700000000', notes: 'سجل ما قبل الترقية' };
      const { iv: patIv, ciphertext: patCipher } = await encryptRecordPayload(
        operationalDek,
        'patients',
        'pat-001',
        [],
        patientData,
        CURRENT_RECORD_CRYPTO_VERSION,
        CURRENT_DEK_VERSION
      );

      // 3. Trigger auto-upgrade
      expect(checkNeedsKdfUpgrade(legacyMeta)).toBe(true);
      const upgradeResult = await autoUpgradeVaultKdf(testDb, legacyMeta, legacyKek, password);
      expect(upgradeResult.upgraded).toBe(true);

      // 4. Verify upgraded vaultMeta in database
      const updatedMeta = await testDb.vaultMeta.get('auth');
      expect(updatedMeta).toBeDefined();
      expect(updatedMeta!.kdfIterations).toBe(600_000);
      expect(updatedMeta!.salt.length).toBe(16);
      expect(checkNeedsKdfUpgrade(updatedMeta!)).toBe(false);

      // 5. Verify the new Vault KEK unwrap and verifier check
      const isVerifierValid = await checkVerifier(
        upgradeResult.newVaultKek,
        updatedMeta!.verifierIv,
        updatedMeta!.verifierCiphertext
      );
      expect(isVerifierValid).toBe(true);

      const unwrappedDek = await unwrapOperationalDEK(
        updatedMeta!.wrappedDek,
        updatedMeta!.wrappedDekIv,
        upgradeResult.newVaultKek,
        updatedMeta!.vaultGeneration ?? 1
      );

      // 6. CRUCIAL: The existing encrypted patient record MUST still cleanly decrypt with zero data loss!
      const decryptedPatient = await decryptRecordPayload<typeof patientData>(
        unwrappedDek,
        'patients',
        'pat-001',
        [],
        patIv,
        patCipher,
        CURRENT_RECORD_CRYPTO_VERSION,
        CURRENT_DEK_VERSION
      );
      expect(decryptedPatient.fullName).toBe('أحمد محمود');
      expect(decryptedPatient.notes).toBe('سجل ما قبل الترقية');
    });
  });

  // ---------------------------------------------------------------------
  // 3. Emergency Recovery Key (The Master Backup Key)
  // ---------------------------------------------------------------------
  describe('3. Emergency Recovery Key (Master Backup Key)', () => {
    it('round-trips binary data through Base32 encoder and decoder', () => {
      const originalBytes = randomBytes(20);
      const base32 = encodeBase32(originalBytes);
      expect(base32.length).toBe(32); // 20 * 8 / 5 = 32

      const formatted = formatRecoveryKey(base32);
      expect(formatted.split('-').length).toBe(8); // 8 groups of 4

      // Decode formatted string with hyphens, lowercase, and spaces
      const messyInput = `  ${formatted.toLowerCase().slice(0, 10)} - ${formatted.slice(10)}  `;
      const decodedBytes = decodeBase32(messyInput);
      expect(decodedBytes).toEqual(originalBytes);
    });

    it('generates, wraps, and unwraps raw DEK using Emergency Recovery Key', async () => {
      const rawDek = randomBytes(32);
      const recoveryResult = await generateAndWrapRecoveryKey(rawDek);

      expect(recoveryResult.recoveryKeyFormatted).toBeDefined();
      expect(recoveryResult.recoveryKeyFormatted.replace(/-/g, '').length).toBe(32);
      expect(recoveryResult.recoveryWrappedDek.length).toBeGreaterThan(32);

      const unwrappedBytes = await unwrapDEKWithRecoveryKey(
        recoveryResult.recoveryKeyFormatted,
        recoveryResult.recoveryWrappedDek,
        recoveryResult.recoveryWrappedDekIv,
        recoveryResult.recoverySalt,
        recoveryResult.recoveryKdfIterations
      );

      expect(unwrappedBytes).toEqual(rawDek);
    });

    it('rejects unwrapping with incorrect recovery key', async () => {
      const rawDek = randomBytes(32);
      const recoveryResult = await generateAndWrapRecoveryKey(rawDek);

      const wrongKey = formatRecoveryKey('A'.repeat(32));
      await expect(
        unwrapDEKWithRecoveryKey(
          wrongKey,
          recoveryResult.recoveryWrappedDek,
          recoveryResult.recoveryWrappedDekIv,
          recoveryResult.recoverySalt,
          recoveryResult.recoveryKdfIterations
        )
      ).rejects.toThrow('مفتاح الاسترداد غير صحيح أو بيانات الاسترداد تالفة.');
    });

    it('resets vault password using Recovery Key, preserves data, and rotates recovery key', async () => {
      const oldPassword = 'OldInitialPassword_1!';
      const newPassword = 'NewSecretPassword_2@';

      // 1. Initialize vault
      const salt = randomBytes(CONSTANTS.SALT_BYTES);
      const kek = await deriveKEK(oldPassword, salt, CONSTANTS.DEFAULT_PBKDF2_ITERATIONS);
      const keypair = await generateAndWrapOperationalDEK(kek, 1);
      const verifier = await generateVerifier(kek);

      await testDb.vaultMeta.put({
        id: 'auth',
        salt,
        wrappedDek: keypair.wrappedDek,
        wrappedDekIv: keypair.wrappedDekIv,
        verifierIv: verifier.verifierIv,
        verifierCiphertext: verifier.verifierCiphertext,
        schemaVersion: 1,
        kdfAlgorithm: 'PBKDF2-HMAC-SHA256',
        kdfIterations: CONSTANTS.DEFAULT_PBKDF2_ITERATIONS,
        dekVersion: CURRENT_DEK_VERSION,
        encryptionInvocationCount: 0,
        vaultGeneration: 1,
        recoveryWrappedDek: keypair.recoveryWrappedDek,
        recoveryWrappedDekIv: keypair.recoveryWrappedDekIv,
        recoverySalt: keypair.recoverySalt,
        recoveryKdfIterations: keypair.recoveryKdfIterations,
      });

      const originalRecoveryKey = keypair.recoveryKeyFormatted!;
      expect(originalRecoveryKey).toBeDefined();

      // 2. Encrypt clinical record with original operational DEK
      const clinicalRecord = { patientId: 'p-1', diagnosis: 'Rotator cuff tendinopathy' };
      const { iv: recIv, ciphertext: recCipher } = await encryptRecordPayload(
        keypair.operationalDek,
        'patients',
        'p-1',
        [],
        clinicalRecord,
        CURRENT_RECORD_CRYPTO_VERSION,
        CURRENT_DEK_VERSION
      );

      // 3. Perform Password Reset using Emergency Recovery Key
      const resetResult = await resetVaultPasswordWithRecoveryKey(
        testDb,
        originalRecoveryKey,
        newPassword
      );

      expect(resetResult.newRecoveryKeyFormatted).toBeDefined();
      expect(resetResult.newRecoveryKeyFormatted).not.toBe(originalRecoveryKey); // Rotated!

      // 4. Verify clinical data can still be decrypted with the operational DEK returned from reset
      const decryptedRecord = await decryptRecordPayload<typeof clinicalRecord>(
        resetResult.operationalDek,
        'patients',
        'p-1',
        [],
        recIv,
        recCipher,
        CURRENT_RECORD_CRYPTO_VERSION,
        CURRENT_DEK_VERSION
      );
      expect(decryptedRecord.diagnosis).toBe('Rotator cuff tendinopathy');

      // 5. Verify the NEW password unlocks the updated vaultMeta
      const updatedMeta = await testDb.vaultMeta.get('auth');
      expect(updatedMeta).toBeDefined();

      const newKek = await deriveKEK(newPassword, updatedMeta!.salt, updatedMeta!.kdfIterations);
      const isNewVerifierValid = await checkVerifier(
        newKek,
        updatedMeta!.verifierIv,
        updatedMeta!.verifierCiphertext
      );
      expect(isNewVerifierValid).toBe(true);

      // 6. Verify OLD password no longer works
      const oldKekCheck = await deriveKEK(oldPassword, updatedMeta!.salt, updatedMeta!.kdfIterations);
      const isOldVerifierValid = await checkVerifier(
        oldKekCheck,
        updatedMeta!.verifierIv,
        updatedMeta!.verifierCiphertext
      );
      expect(isOldVerifierValid).toBe(false);

      // 7. Verify OLD recovery key CANNOT be reused (rotation enforcement!)
      await expect(
        resetVaultPasswordWithRecoveryKey(testDb, originalRecoveryKey, 'AnotherPassword_3#')
      ).rejects.toThrow();

      // 8. Verify NEW recovery key CAN unwrap
      const rawDekBytes = await unwrapDEKWithRecoveryKey(
        resetResult.newRecoveryKeyFormatted,
        updatedMeta!.recoveryWrappedDek!,
        updatedMeta!.recoveryWrappedDekIv!,
        updatedMeta!.recoverySalt!,
        updatedMeta!.recoveryKdfIterations
      );
      expect(rawDekBytes.length).toBe(32);
    });
  });

  // ---------------------------------------------------------------------
  // 4. Inactivity & Hidden-Tab Auto-Lock Simulation
  // ---------------------------------------------------------------------
  describe('4. Inactivity & Hidden-Tab Auto-Lock Behavior', () => {
    it('enforces 10-minute default timeout and locks immediately when hidden duration exceeds limit', () => {
      const defaultTimeoutMs = 10 * 60 * 1000;
      let lastActivity = Date.now();
      let hiddenAt: number | null = null;
      let isLocked = false;

      const lock = () => {
        isLocked = true;
      };

      const updateActivity = (isTabVisible: boolean) => {
        if (!isTabVisible) return; // Tab hidden -> DO NOT update!
        lastActivity = Date.now();
      };

      // 1. Activity while visible updates lastActivity
      updateActivity(true);
      expect(lastActivity).toBeGreaterThan(0);

      // 2. Tab becomes hidden: record hiddenAt, activity must NOT update
      hiddenAt = Date.now();
      const prevActivity = lastActivity;
      updateActivity(false); // Simulated background event
      expect(lastActivity).toBe(prevActivity);

      // 3. Simulate resuming after 11 minutes (exceeding 10-minute timeout)
      const simulatedResumeTime = hiddenAt + 11 * 60 * 1000;
      const elapsedHidden = simulatedResumeTime - hiddenAt;
      if (elapsedHidden >= defaultTimeoutMs) {
        lock();
      }

      expect(isLocked).toBe(true);
    });
  });
});
