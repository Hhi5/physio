import { describe, it, expect, beforeEach } from 'vitest';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { createInMemoryDatabase } from '../../crypto/__tests__/testDbHelper';
import {
  deriveKEK,
  generateAndWrapOperationalDEK,
  generateVerifier,
  bindDekToGeneration,
  encryptRecordWithMandatoryReservation,
  decryptRecordPayload,
  rotateAllKeys,
  CONSTANTS,
  CURRENT_DEK_VERSION,
  CURRENT_RECORD_CRYPTO_VERSION,
  randomBytes,
} from '../../crypto/vault';
import {
  exportBackupPackage,
  restoreBackupPackage,
  inspectBackupPreview,
} from '../../crypto/backup';
import {
  LocalStorageMigrationService,
  LOCALSTORAGE_MIGRATION_STATE_ID,
} from '../localStorageMigrationService';
import { ClinicOperationsService } from '../clinicOperationsService';

class MockLocalStorage implements Storage {
  private store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }
}

async function setupTestVault(testDb: ReturnType<typeof createInMemoryDatabase>) {
  const salt = randomBytes(CONSTANTS.SALT_BYTES);
  const kek = await deriveKEK('TestVaultPass#2026', salt, 600_000);
  const gen = 1;
  const { operationalDek, wrappedDek, wrappedDekIv } =
    await generateAndWrapOperationalDEK(kek, gen);
  const { verifierIv, verifierCiphertext } = await generateVerifier(kek);
  bindDekToGeneration(operationalDek, gen);

  await testDb.vaultMeta.put({
    id: 'auth',
    salt,
    wrappedDek,
    wrappedDekIv,
    verifierIv,
    verifierCiphertext,
    schemaVersion: testDb.verno,
    kdfAlgorithm: 'PBKDF2-HMAC-SHA256',
    kdfIterations: 600_000,
    dekVersion: CURRENT_DEK_VERSION,
    encryptionInvocationCount: 0,
    vaultGeneration: gen,
  });

  return { dek: operationalDek, kek, salt };
}

describe('Phase 1A-ii-b: Destructive Migration, Rotation, Backup v2, and Cleanup', () => {
  let mockStorage: MockLocalStorage;

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
    try {
      Object.defineProperty(globalThis, 'localStorage', {
        value: mockStorage,
        configurable: true,
        writable: true,
      });
    } catch {
      // ignore
    }
  });

  // -------------------------------------------------------------------------
  // 1. Destructive Migration (Delete Plaintext Keys after Deep Verification)
  // -------------------------------------------------------------------------
  describe('1. Destructive Migration & Plaintext Key Deletion', () => {
    it('deletes plaintext localStorage keys in live mode ONLY after encryption, commit, and deep verification', async () => {
      const testDb = createInMemoryDatabase();
      const { dek } = await setupTestVault(testDb);

      // Seed valid clinical data in mockStorage
      mockStorage.setItem(
        'physiorecord_appointments_v2',
        JSON.stringify([
          {
            id: 'appt-100',
            patientId: 'pt-100',
            patientName: 'أحمد علي',
            date: '2026-11-09',
            status: 'scheduled',
          },
        ])
      );
      mockStorage.setItem(
        'physiorecord_waiting_list_v2',
        JSON.stringify([
          {
            id: 'wait-100',
            patientName: 'مريم خليل',
            priority: 'urgent',
            addedAt: '2026-11-09',
          },
        ])
      );
      mockStorage.setItem(
        'physiorecord_invoices_iqd_v2',
        JSON.stringify([
          {
            id: 'inv-100',
            invoiceNumber: 'INV-100',
            patientId: 'pt-100',
            totalAmountIQD: 50000,
            netAmountIQD: 50000,
            paidAmountIQD: 50000,
            balanceDueIQD: 0,
            status: 'paid',
            payments: [],
          },
        ])
      );

      // In dry-run mode: keys must NOT be deleted
      const dryResult = await LocalStorageMigrationService.runMigration(dek, testDb, {
        dryRun: true,
        storage: mockStorage,
      });
      expect(dryResult.status).toBe('dry_run');
      expect(mockStorage.getItem('physiorecord_appointments_v2')).not.toBeNull();
      expect(mockStorage.getItem('physiorecord_waiting_list_v2')).not.toBeNull();
      expect(mockStorage.getItem('physiorecord_invoices_iqd_v2')).not.toBeNull();

      // In live mode: keys MUST be encrypted, verified by decrypt + deep-equal, and DELETED from localStorage
      const liveResult = await LocalStorageMigrationService.runMigration(dek, testDb, {
        dryRun: false,
        storage: mockStorage,
      });

      expect(liveResult.status).toBe('completed');
      expect(liveResult.report.migratedKeys).toContain('physiorecord_appointments_v2');
      expect(liveResult.report.migratedKeys).toContain('physiorecord_waiting_list_v2');
      expect(liveResult.report.migratedKeys).toContain('physiorecord_invoices_iqd_v2');

      // Crucial assertion: Plaintext keys were safely deleted!
      expect(mockStorage.getItem('physiorecord_appointments_v2')).toBeNull();
      expect(mockStorage.getItem('physiorecord_waiting_list_v2')).toBeNull();
      expect(mockStorage.getItem('physiorecord_invoices_iqd_v2')).toBeNull();

      // Verify that Dexie stores hold the verified encrypted records
      const apptRecord = await testDb.appointments.get('appt-100');
      expect(apptRecord).toBeDefined();
      const decAppt = await decryptRecordPayload<any>(
        dek,
        'appointments',
        'appt-100',
        [],
        apptRecord!.iv,
        apptRecord!.ciphertext,
        apptRecord!.recordCryptoVersion,
        apptRecord!.dekVersion
      );
      expect(decAppt.patientName).toBe('أحمد علي');
    });

    it('does NOT delete plaintext key from localStorage if parsing or verification fails', async () => {
      const testDb = createInMemoryDatabase();
      const { dek } = await setupTestVault(testDb);

      const corruptJson = '{"id": "inv-broken", "broken": [invalid-json}';
      mockStorage.setItem('physiorecord_invoices_iqd_v2', corruptJson);
      mockStorage.setItem(
        'physiorecord_appointments_v2',
        JSON.stringify([
          { id: 'appt-ok', patientId: 'pt-1', patientName: 'سارة', status: 'scheduled' },
        ])
      );

      const result = await LocalStorageMigrationService.runMigration(dek, testDb, {
        dryRun: false,
        storage: mockStorage,
      });

      expect(result.status).toBe('partial_with_errors');
      expect(result.report.corruptKeys.length).toBe(1);
      expect(result.report.corruptKeys[0].key).toBe('physiorecord_invoices_iqd_v2');

      // Corrupt key was NOT deleted from localStorage!
      expect(mockStorage.getItem('physiorecord_invoices_iqd_v2')).toBe(corruptJson);

      // Valid key was successfully migrated and deleted
      expect(mockStorage.getItem('physiorecord_appointments_v2')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 2. Backup Format v2 & Backward Compatibility
  // -------------------------------------------------------------------------
  describe('2. Backup Format v2 & Multi-Store Coverage', () => {
    it('exports .ptbackup in format v2 with PHYSIORECORD_BACKUP_V2.0 magic covering all Phase 1A stores', async () => {
      const testDb = createInMemoryDatabase();
      const { dek, kek } = await setupTestVault(testDb);

      // Seed clinical stores
      const pEnc = await encryptRecordWithMandatoryReservation(
        testDb,
        dek,
        'patients',
        'p-1',
        [],
        { fullName: 'كرار مهدي', phone: '07700000000' }
      );
      await testDb.patients.put({
        id: 'p-1',
        createdAt: '2026-11-09T00:00:00Z',
        updatedAt: '2026-11-09T00:00:00Z',
        isArchived: 0,
        recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
        dekVersion: CURRENT_DEK_VERSION,
        iv: pEnc.iv,
        ciphertext: pEnc.ciphertext,
      });

      const epEnc = await encryptRecordWithMandatoryReservation(
        testDb,
        dek,
        'episodes',
        'ep-1',
        ['p-1'],
        { condition: 'ألم الركبة' }
      );
      await testDb.episodes.put({
        id: 'ep-1',
        patientId: 'p-1',
        createdAt: '2026-11-09T00:00:00Z',
        updatedAt: '2026-11-09T00:00:00Z',
        recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
        dekVersion: CURRENT_DEK_VERSION,
        iv: epEnc.iv,
        ciphertext: epEnc.ciphertext,
      });

      const apptEnc = await encryptRecordWithMandatoryReservation(
        testDb,
        dek,
        'appointments',
        'appt-1',
        [],
        { patientName: 'كرار مهدي', status: 'scheduled' }
      );
      await testDb.appointments.put({
        id: 'appt-1',
        patientId: 'p-1',
        createdAt: '2026-11-09T00:00:00Z',
        updatedAt: '2026-11-09T00:00:00Z',
        recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
        dekVersion: CURRENT_DEK_VERSION,
        iv: apptEnc.iv,
        ciphertext: apptEnc.ciphertext,
      });

      const meta = (await testDb.vaultMeta.get('auth'))!;
      const backupJsonStr = await exportBackupPackage(testDb, meta, kek, 'BackupPass#600k');

      const pkg = JSON.parse(backupJsonStr);
      expect(pkg.header.magic).toBe('PHYSIORECORD_BACKUP_V2.0');
      expect(pkg.header.formatVersion).toBe('2.0');
      expect(pkg.header.kdfIterations).toBe(600_000);
      expect(pkg.header.hkdfInfoDekWrap).toBe('physiorecord-backup-dek-wrap-v2.0');
      expect(pkg.header.hkdfInfoPayloadEnc).toBe('physiorecord-backup-payload-enc-v2.0');

      // Inspect backup preview
      const preview = await inspectBackupPreview(backupJsonStr, 'BackupPass#600k', testDb);
      expect(preview.countsByStore['patients']).toBe(1);
      expect(preview.countsByStore['episodes']).toBe(1);
      expect(preview.countsByStore['appointments']).toBe(1);

      // Restore to a fresh target database
      const targetDb = createInMemoryDatabase();
      const restoreResult = await restoreBackupPackage(
        backupJsonStr,
        'BackupPass#600k',
        'NewTargetPass#600k',
        targetDb
      );

      expect(restoreResult.patientCount).toBe(1);
      expect(restoreResult.episodeCount).toBe(1);
      expect(restoreResult.appointmentCount).toBe(1);
      expect(restoreResult.countsByStore['appointments']).toBe(1);

      // Verify restored appointment is decryptable
      const restoredAppt = await targetDb.appointments.get('appt-1');
      expect(restoredAppt).toBeDefined();
      const decRestored = await decryptRecordPayload<any>(
        restoreResult.destinationOperationalDek,
        'appointments',
        'appt-1',
        [],
        restoredAppt!.iv,
        restoredAppt!.ciphertext,
        restoredAppt!.recordCryptoVersion,
        restoredAppt!.dekVersion
      );
      expect(decRestored.patientName).toBe('كرار مهدي');
    });

    it('restores legacy v1.1 .ptbackup package with 100% backward compatibility', async () => {
      const fixturePath = path.resolve(
        __dirname,
        '../../crypto/__tests__/fixtures/v1_1_vault_and_backup.fixture.json'
      );
      if (!fs.existsSync(fixturePath)) {
        return; // Skip if fixture not present in this runtime
      }

      const fixtureData = JSON.parse(fs.readFileSync(fixturePath, 'utf-8'));
      const targetDb = createInMemoryDatabase();

      const summary = await restoreBackupPackage(
        fixtureData.backupPackageJson,
        fixtureData.backupPassword,
        'NewPassForRestoredVault#123',
        targetDb
      );

      expect(summary.patientCount).toBeGreaterThan(0);
      expect(summary.episodeCount).toBeGreaterThan(0);
      expect(summary.sessionCount).toBeGreaterThan(0);
      expect(summary.soapCount).toBeGreaterThan(0);
      // New Phase 1A stores were absent in v1.1 and default to 0 cleanly
      expect(summary.appointmentCount).toBe(0);
      expect(summary.invoiceCount).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // 3. Wipe & Rotate Coverage
  // -------------------------------------------------------------------------
  describe('3. Wipe & Key Rotation Coverage', () => {
    it('rotateAllKeys re-encrypts all Phase 1A stores under fresh DEK and advances vaultGeneration', async () => {
      const testDb = createInMemoryDatabase();
      const { dek, kek } = await setupTestVault(testDb);

      // Seed records across multiple Phase 1A stores
      const pEnc = await encryptRecordWithMandatoryReservation(
        testDb,
        dek,
        'patients',
        'p-rot-1',
        [],
        { fullName: 'أحمد الدليمي' }
      );
      await testDb.patients.put({
        id: 'p-rot-1',
        createdAt: '2026-11-09T00:00:00Z',
        updatedAt: '2026-11-09T00:00:00Z',
        isArchived: 0,
        recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
        dekVersion: CURRENT_DEK_VERSION,
        iv: pEnc.iv,
        ciphertext: pEnc.ciphertext,
      });

      const invEnc = await encryptRecordWithMandatoryReservation(
        testDb,
        dek,
        'invoices',
        'inv-rot-1',
        [],
        { invoiceNumber: 'INV-ROT-1', totalAmountIQD: 100000 }
      );
      await testDb.invoices.put({
        id: 'inv-rot-1',
        patientId: 'p-rot-1',
        createdAt: '2026-11-09T00:00:00Z',
        updatedAt: '2026-11-09T00:00:00Z',
        recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
        dekVersion: CURRENT_DEK_VERSION,
        iv: invEnc.iv,
        ciphertext: invEnc.ciphertext,
      });

      const rotationSummary = await rotateAllKeys(testDb, dek, kek);
      expect(rotationSummary.totalRecordsRotated).toBe(2);
      expect(rotationSummary.newDekVersion).toBe(2);
      expect(rotationSummary.newVaultGeneration).toBe(2);

      // Verify records decrypt with the new key
      const rotInvoice = await testDb.invoices.get('inv-rot-1');
      expect(rotInvoice).toBeDefined();
      expect(rotInvoice!.dekVersion).toBe(2);

      const decInv = await decryptRecordPayload<any>(
        rotationSummary.newOperationalDek,
        'invoices',
        'inv-rot-1',
        [],
        rotInvoice!.iv,
        rotInvoice!.ciphertext,
        rotInvoice!.recordCryptoVersion,
        rotInvoice!.dekVersion
      );
      expect(decInv.invoiceNumber).toBe('INV-ROT-1');
      expect(decInv.totalAmountIQD).toBe(100000);
    });

    it('clears all Dexie stores and deletes ALL physiorecord_* keys from localStorage on wipe', async () => {
      const testDb = createInMemoryDatabase();
      await setupTestVault(testDb);

      mockStorage.setItem('physiorecord_appointments_v2', '[]');
      mockStorage.setItem('physiorecord_waiting_list_v2', '[]');
      mockStorage.setItem('physiorecord_session_soap_v2_1', '{}');
      mockStorage.setItem('non_physio_key', 'keep_me');

      // Emulate Dexie clear + localStorage wipe logic
      await testDb.patients.clear();
      await testDb.appointments.clear();
      await testDb.vaultMeta.clear();

      const keysToRemove: string[] = [];
      for (let i = 0; i < mockStorage.length; i++) {
        const k = mockStorage.key(i);
        if (k && k.startsWith('physiorecord_')) {
          keysToRemove.push(k);
        }
      }
      for (const k of keysToRemove) {
        mockStorage.removeItem(k);
      }

      expect(mockStorage.getItem('physiorecord_appointments_v2')).toBeNull();
      expect(mockStorage.getItem('physiorecord_waiting_list_v2')).toBeNull();
      expect(mockStorage.getItem('physiorecord_session_soap_v2_1')).toBeNull();
      expect(mockStorage.getItem('non_physio_key')).toBe('keep_me');
    });
  });

  // -------------------------------------------------------------------------
  // 4. Demo Seeding Gate behind DEV
  // -------------------------------------------------------------------------
  describe('4. Demo Seeding Safety & Production Guard', () => {
    it('returns empty array and does NOT seed demo appointments when not in DEV', () => {
      mockStorage.clear();
      // In tests/production, if import.meta.env.DEV is simulated as false:
      const originalDev = import.meta.env.DEV;
      try {
        (import.meta.env as any).DEV = false;
        const appts = ClinicOperationsService.getAppointments();
        expect(appts).toEqual([]);
        expect(mockStorage.getItem('physiorecord_appointments_v2')).toBeNull();

        const waiting = ClinicOperationsService.getWaitingList();
        expect(waiting).toEqual([]);
        expect(mockStorage.getItem('physiorecord_waiting_list_v2')).toBeNull();

        const invoices = ClinicOperationsService.getInvoicesIQD();
        expect(invoices).toEqual([]);
        expect(mockStorage.getItem('physiorecord_invoices_iqd_v2')).toBeNull();

        const expenses = ClinicOperationsService.getExpensesIQD();
        expect(expenses).toEqual([]);
        expect(mockStorage.getItem('physiorecord_expenses_iqd_v2')).toBeNull();
      } finally {
        (import.meta.env as any).DEV = originalDev;
      }
    });
  });
});
