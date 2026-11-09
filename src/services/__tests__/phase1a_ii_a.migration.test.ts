import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryDatabase } from '../../crypto/__tests__/testDbHelper';
import {
  deriveKEK,
  generateAndWrapOperationalDEK,
  generateVerifier,
  bindDekToGeneration,
  encryptRecordWithMandatoryReservation,
  decryptRecordPayload,
  CONSTANTS,
  CURRENT_DEK_VERSION,
  CURRENT_RECORD_CRYPTO_VERSION,
  randomBytes,
} from '../../crypto/vault';
import {
  isTestEnvironment,
  registerTestHooks,
} from '../../utils/testHooks';
import {
  ClinicOperationsService,
  setEpisodeClinicalMutationTestHook,
} from '../clinicOperationsService';
import {
  SessionService,
  canonicalizeForSeal,
} from '../sessionService';
import { SoapService } from '../soapService';
import { EpisodeService } from '../episodeService';
import {
  LocalStorageMigrationService,
  LOCALSTORAGE_MIGRATION_STATE_ID,
} from '../localStorageMigrationService';
import {
  StaleTabOverwriteError,
  type MigrationReportPayload,
} from '../../types/clinical';
import type {
  EpisodeScopedClinicalStore,
  ClinicalAssessmentSnapshot,
} from '../../types/clinicManagement';

// ---------------------------------------------------------------------------
// In-memory localStorage mock for Node/Vitest environment
// ---------------------------------------------------------------------------
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

async function setupTestVaultAndPatient(
  testDb: ReturnType<typeof createInMemoryDatabase>,
  patientId = 'pat-test-1'
) {
  const salt = randomBytes(CONSTANTS.SALT_BYTES);
  const kek = await deriveKEK('TestVaultPass#2026', salt, 1000);
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
    kdfIterations: 1000,
    dekVersion: CURRENT_DEK_VERSION,
    encryptionInvocationCount: 0,
    vaultGeneration: gen,
  });

  const pEnc = await encryptRecordWithMandatoryReservation(
    testDb,
    operationalDek,
    'patients',
    patientId,
    [],
    { fullName: 'فاطمة حسن العراقي', gender: 'female' }
  );
  await testDb.patients.put({
    id: patientId,
    createdAt: '2026-04-01T08:00:00.000Z',
    updatedAt: '2026-04-01T08:00:00.000Z',
    isArchived: 0,
    recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
    dekVersion: CURRENT_DEK_VERSION,
    iv: pEnc.iv,
    ciphertext: pEnc.ciphertext,
  });

  return { dek: operationalDek, kek, gen, patientId };
}

describe('Follow-Up Items A-F & Phase 1A-ii-a Non-Destructive Migration Engine', () => {
  let mockStorage: MockLocalStorage;

  beforeEach(() => {
    mockStorage = new MockLocalStorage();
    Object.defineProperty(globalThis, 'localStorage', {
      value: mockStorage,
      configurable: true,
      writable: true,
    });
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'localStorage', {
        value: mockStorage,
        configurable: true,
        writable: true,
      });
    }
    setEpisodeClinicalMutationTestHook(null);
  });

  // =========================================================================
  // ITEM A: db.ts v5 -> v6 schema upgrade & cascade deletion
  // =========================================================================
  describe('Item A: Dexie version(5) preservation and version(6) upgrade', () => {
    it('opens a database created at v5 WITHOUT waitingList.patientId index, upgrades to v6, and runs auditPatientDependentRecords + deletePatientPermanently', async () => {
      const dbV5 = createInMemoryDatabase(5);
      const { dek, patientId } = await setupTestVaultAndPatient(dbV5, 'pat-v5-upgrade');

      // Verify v5 waitingList does NOT have patientId index
      expect(dbV5.getDeclaredIndexesForStore('waitingList')).toEqual([
        'id',
        'createdAt',
        'updatedAt',
      ]);
      expect(dbV5.getDeclaredIndexesForStore('auditLogs')).toEqual([
        'id',
        'createdAt',
      ]);

      // Querying waitingList.where('patientId') on v5 throws SchemaError because v5 lacked that index
      expect(() => dbV5.waitingList.where('patientId')).toThrow(/SchemaError/);

      // Create episode, session, soapNote, and v5 rows while at v5
      const episode = await EpisodeService.createEpisode(
        patientId,
        {
          title: 'تأهيل الركبة',
          primarySpecialty: 'musculoskeletal',
          medicalDiagnosis: 'ACL reconstruction',
          clinicalImpression: 'Post-op ACL rehab',
          affectedBodyRegion: 'Right Knee',
          rehabilitationGoals: {
            shortTerm: ['Restore extension'],
            longTerm: ['Return to sport'],
          },
        },
        dek,
        'ep-v5-1',
        dbV5
      );

      const nowIso = new Date().toISOString();
      const dummyIv = randomBytes(12);
      const dummyCipher = randomBytes(32);

      await dbV5.waitingList.put({
        id: 'wait-v5-1',
        patientId,
        createdAt: nowIso,
        updatedAt: nowIso,
        recordCryptoVersion: 1,
        dekVersion: 1,
        iv: dummyIv,
        ciphertext: dummyCipher,
      });
      await dbV5.appointments.put({
        id: 'appt-v5-1',
        patientId,
        createdAt: nowIso,
        updatedAt: nowIso,
        recordCryptoVersion: 1,
        dekVersion: 1,
        iv: dummyIv,
        ciphertext: dummyCipher,
      });

      // Now upgrade database in-place from v5 to v6
      dbV5.upgradeToVersion(6);
      expect(dbV5.verno).toBe(6);
      expect(dbV5.getDeclaredIndexesForStore('waitingList')).toContain('patientId');
      expect(dbV5.getDeclaredIndexesForStore('auditLogs')).toEqual([
        'id',
        'patientId',
        'episodeId',
        'createdAt',
      ]);

      // Run auditPatientDependentRecords and deletePatientPermanently on the upgraded v6 DB
      const auditBefore = await dbV5.auditPatientDependentRecords(patientId);
      expect(auditBefore.episodesCount).toBe(1);
      expect(auditBefore.waitingListCount).toBe(1);
      expect(auditBefore.appointmentsCount).toBe(1);

      await dbV5.deletePatientPermanently(patientId, {
        verifiedBackupString: 'valid-test-backup',
        bypassForTest: true,
      });

      const auditAfter = await dbV5.auditPatientDependentRecords(patientId);
      expect(auditAfter).toEqual({
        patientId,
        episodesCount: 0,
        sessionsCount: 0,
        soapNotesCount: 0,
        clinicalAddendaCount: 0,
        appointmentsCount: 0,
        waitingListCount: 0,
        invoicesCount: 0,
        paymentsCount: 0,
        episodeClinicalCount: 0,
      });
      expect(await dbV5.patients.get(patientId)).toBeUndefined();
      expect(await dbV5.episodes.get(episode.id)).toBeUndefined();
      expect(await dbV5.waitingList.get('wait-v5-1')).toBeUndefined();
      expect(await dbV5.appointments.get('appt-v5-1')).toBeUndefined();
    });
  });

  // =========================================================================
  // ITEM B: Append-only snapshots in both localStorage & encrypted Dexie paths
  // =========================================================================
  describe('Item B: Append-only snapshots on encrypted db.episodeClinical & localStorage paths', () => {
    const sampleSnapshot1: ClinicalAssessmentSnapshot = {
      id: 'snap-1',
      episodeId: 'ep-100',
      snapshotType: 'initial_evaluation',
      recordedDate: '2026-03-01',
      recordedBy: 'Dr. Sara',
      labelAr: 'التقييم الأولي',
      labelEn: 'Initial Evaluation',
      painNrsRest: 4,
      painNrsActivity: 7,
      romSummary: [
        {
          jointMovementKey: 'knee_flexion_right',
          labelAr: 'الركبة - ثني (يمين)',
          labelEn: 'Knee Flexion (right)',
          laterality: 'right',
          aromDegrees: 95,
          normalDegrees: 135,
        },
      ],
      mmtSummary: [
        {
          muscleKey: 'quadriceps_right',
          labelAr: 'العضلة الرباعية (يمين)',
          labelEn: 'Quadriceps (right)',
          laterality: 'right',
          grade: '3+',
        },
      ],
      specialTestsPositiveCount: 1,
      clinicalImpressionNote: 'Baseline post-op stiffness',
    };

    const sampleSnapshot2: ClinicalAssessmentSnapshot = {
      ...sampleSnapshot1,
      id: 'snap-2',
      snapshotType: 're_evaluation',
      recordedDate: '2026-03-15',
      labelAr: 'إعادة التقييم #2',
      labelEn: 'Re-evaluation #2',
      painNrsRest: 2,
      painNrsActivity: 4,
    };

    const createSampleEpisodeStore = (
      episodeId: string,
      patientId: string,
      snapshots: ClinicalAssessmentSnapshot[]
    ): EpisodeScopedClinicalStore => ({
      episodeId,
      patientId,
      activeWidgetIds: ['body_chart', 'rom', 'mmt'],
      chiefComplaint: 'ألم وتيبس الركبة',
      historyOfPresentIllness: '',
      mechanismOfInjury: '',
      painAtRestNrs: 4,
      painOnActivityNrs: 7,
      painWorst24hNrs: 8,
      painNature: '',
      aggravatingFactors: '',
      relievingFactors: '',
      functionalLimitations: '',
      patientPersonalGoals: '',
      observationPosture: '',
      palpationFindings: '',
      circumferenceEdemaNotes: '',
      treatmentFrequency: '3x / Week',
      plannedDurationWeeks: 6,
      clinicalImpression: 'تحسن تدريجي',
      objective: {},
      specialTests: [],
      customWidgetsData: {},
      snapshots,
      hepProgram: [],
      updatedAt: new Date().toISOString(),
    });

    it('enforces append-only snapshots on encrypted db.episodeClinical when localStorage key does NOT exist', async () => {
      const testDb = createInMemoryDatabase(6);
      const { dek } = await setupTestVaultAndPatient(testDb, 'pat-100');

      // Confirm localStorage does NOT have the episode key
      expect(mockStorage.getItem('physiorecord_episode_clinical_v2_ep-100')).toBeNull();

      // 1. Initial save with 1 snapshot into encrypted db.episodeClinical
      const initialStore = createSampleEpisodeStore('ep-100', 'pat-100', [sampleSnapshot1]);
      await ClinicOperationsService.saveEpisodeClinicalStoreEncrypted(
        initialStore,
        dek,
        testDb
      );

      // Confirm localStorage is STILL empty while Dexie has the encrypted record
      expect(mockStorage.getItem('physiorecord_episode_clinical_v2_ep-100')).toBeNull();
      const loaded1 = await ClinicOperationsService.getEpisodeClinicalStoreEncrypted(
        'ep-100',
        'pat-100',
        dek,
        testDb
      );
      expect(loaded1.snapshots).toHaveLength(1);

      // 2. Appending a second snapshot succeeds
      await ClinicOperationsService.saveEpisodeClinicalStoreEncrypted(
        {
          ...loaded1,
          snapshots: [sampleSnapshot1, sampleSnapshot2],
        },
        dek,
        testDb
      );
      const loaded2 = await ClinicOperationsService.getEpisodeClinicalStoreEncrypted(
        'ep-100',
        'pat-100',
        dek,
        testDb
      );
      expect(loaded2.snapshots).toHaveLength(2);

      // 3. Attempting to delete an existing snapshot is rejected
      await expect(
        ClinicOperationsService.saveEpisodeClinicalStoreEncrypted(
          {
            ...loaded2,
            snapshots: [sampleSnapshot1],
          },
          dek,
          testDb
        )
      ).rejects.toThrow(/Append-only Snapshots/);

      // 4. Attempting to reorder existing snapshots is rejected
      await expect(
        ClinicOperationsService.saveEpisodeClinicalStoreEncrypted(
          {
            ...loaded2,
            snapshots: [sampleSnapshot2, sampleSnapshot1],
          },
          dek,
          testDb
        )
      ).rejects.toThrow(/Append-only Snapshots/);

      // 5. Attempting to mutate a field inside an existing snapshot is rejected
      const mutatedSnap1: ClinicalAssessmentSnapshot = {
        ...sampleSnapshot1,
        painNrsRest: 0,
      };
      await expect(
        ClinicOperationsService.saveEpisodeClinicalStoreEncrypted(
          {
            ...loaded2,
            snapshots: [mutatedSnap1, sampleSnapshot2],
          },
          dek,
          testDb
        )
      ).rejects.toThrow(/Append-only Snapshots/);

      // 6. Concurrent modification between read and rw transaction is rejected via updatedAt/iv check
      setEpisodeClinicalMutationTestHook(async ({ episodeId }) => {
        const existingRow = await testDb.episodeClinical.get(episodeId);
        if (existingRow) {
          await testDb.episodeClinical.put({
            ...existingRow,
            updatedAt: '2099-01-01T00:00:00.000Z',
          });
        }
      });

      await expect(
        ClinicOperationsService.saveEpisodeClinicalStoreEncrypted(
          {
            ...loaded2,
            snapshots: [
              sampleSnapshot1,
              sampleSnapshot2,
              { ...sampleSnapshot2, id: 'snap-3', labelEn: 'Snapshot #3' },
            ],
          },
          dek,
          testDb
        )
      ).rejects.toThrow(StaleTabOverwriteError);
    });

    it('enforces append-only snapshots on the localStorage write path', () => {
      const store1 = createSampleEpisodeStore('ep-local-1', 'pat-100', [sampleSnapshot1]);
      ClinicOperationsService.saveEpisodeClinicalStore(store1);

      // Mutation of existing snapshot in localStorage throws Append-only Snapshots error
      expect(() =>
        ClinicOperationsService.saveEpisodeClinicalStore({
          ...store1,
          snapshots: [{ ...sampleSnapshot1, labelEn: 'Tampered' }],
        })
      ).toThrow(/Append-only Snapshots/);
    });
  });

  // =========================================================================
  // ITEM C: testHooks.ts strict environment gating
  // =========================================================================
  describe('Item C: testHooks.ts environment gating and db stripping', () => {
    it('returns true ONLY when MODE === "test" or (DEV && VITE_ENABLE_TEST_HOOKS === "true") and never exposes db outside test mode', () => {
      expect(isTestEnvironment({ MODE: 'test', DEV: false })).toBe(true);
      expect(isTestEnvironment({ MODE: 'development', DEV: true })).toBe(false);
      expect(
        isTestEnvironment({ MODE: 'development', DEV: true, VITE_ENABLE_TEST_HOOKS: 'false' })
      ).toBe(false);
      expect(
        isTestEnvironment({ MODE: 'development', DEV: true, VITE_ENABLE_TEST_HOOKS: 'true' })
      ).toBe(true);
      expect(
        isTestEnvironment({ MODE: 'production', DEV: false, VITE_ENABLE_TEST_HOOKS: 'true' })
      ).toBe(false);

      // Verify registerTestHooks strips db when MODE !== 'test' even if VITE_ENABLE_TEST_HOOKS === 'true'
      const mockWin = (globalThis as unknown as { window?: Record<string, unknown> }).window || {};
      Object.defineProperty(globalThis, 'window', {
        value: mockWin,
        configurable: true,
        writable: true,
      });
      delete mockWin.__physioRecordTestHooks;
      registerTestHooks(
        { db: { secret: true }, customHook: 'allowed' },
        { MODE: 'development', DEV: true, VITE_ENABLE_TEST_HOOKS: 'true' }
      );
      const hooksObj = mockWin.__physioRecordTestHooks as Record<string, unknown> | undefined;
      expect(hooksObj?.customHook).toBe('allowed');
      expect(hooksObj?.db).toBeUndefined();
    });
  });

  // =========================================================================
  // ITEM D: Audit logs store patientId/episodeId without patient names
  // =========================================================================
  describe('Item D: Audit logs omit patient names and store patientId / episodeId references', () => {
    it('stores patientId/episodeId and name-free summaries when appending audit logs', () => {
      const entry = ClinicOperationsService.appendAuditLog({
        actionType: 'session_finalized',
        entityType: 'session',
        entityId: 'sess-900',
        patientId: 'pat-900',
        episodeId: 'ep-900',
        summaryAr: 'توقيع واعتماد جلسة علاجية نهائية رقم #3',
        summaryEn: 'Finalized and locked treatment session #3',
      });

      expect(entry.patientId).toBe('pat-900');
      expect(entry.episodeId).toBe('ep-900');
      const logs = ClinicOperationsService.getAuditLogs();
      expect(logs[0].patientId).toBe('pat-900');
      expect(logs[0].episodeId).toBe('ep-900');
    });
  });

  // =========================================================================
  // ITEM G: Phase 1A-ii-a Non-Destructive Migration Engine
  // =========================================================================
  describe('Item G (Phase 1A-ii-a): Non-destructive localStorage -> Dexie migration engine', () => {
    it('supports dry-run mode without writing to Dexie or deleting localStorage keys', async () => {
      const testDb = createInMemoryDatabase(6);
      const { dek } = await setupTestVaultAndPatient(testDb, 'pat-dry');

      mockStorage.setItem(
        'physiorecord_appointments_v2',
        JSON.stringify([
          {
            id: 'appt-1',
            patientId: 'pat-dry',
            patientName: 'أحمد العراقي',
            patientPhone: '07701112222',
            date: '2026-03-01',
            startTime: '10:00',
            durationMinutes: 45,
            therapistName: 'د. زيد',
            visitType: 'follow_up',
            status: 'scheduled',
          },
        ])
      );
      mockStorage.setItem(
        'physiorecord_episode_clinical_v2_ep-1',
        JSON.stringify({
          episodeId: 'ep-1',
          patientId: 'pat-dry',
          activeWidgetIds: ['rom'],
          chiefComplaint: '',
          historyOfPresentIllness: '',
          mechanismOfInjury: '',
          painAtRestNrs: 2,
          painOnActivityNrs: 5,
          painWorst24hNrs: 6,
          painNature: '',
          aggravatingFactors: '',
          relievingFactors: '',
          functionalLimitations: '',
          patientPersonalGoals: '',
          observationPosture: '',
          palpationFindings: '',
          circumferenceEdemaNotes: '',
          treatmentFrequency: '2x / Week',
          plannedDurationWeeks: 4,
          clinicalImpression: '',
          objective: {},
          specialTests: [],
          customWidgetsData: {},
          snapshots: [],
          hepProgram: [],
          updatedAt: '2026-03-01T10:00:00.000Z',
        })
      );

      const dryResult = await LocalStorageMigrationService.runMigration(dek, testDb, {
        dryRun: true,
        storage: mockStorage,
      });

      expect(dryResult.status).toBe('dry_run');
      expect(dryResult.report.dryRun).toBe(true);
      expect(dryResult.report.migratedKeys).toHaveLength(2);
      expect(dryResult.report.countsByTable.appointments).toBe(1);
      expect(dryResult.report.countsByTable.episodeClinical).toBe(1);

      // Nothing written to Dexie in dry-run mode
      expect(await testDb.appointments.count()).toBe(0);
      expect(await testDb.episodeClinical.count()).toBe(0);
      expect(await testDb.migrationState.get(LOCALSTORAGE_MIGRATION_STATE_ID)).toBeUndefined();
      // localStorage keys untouched
      expect(mockStorage.getItem('physiorecord_appointments_v2')).not.toBeNull();
    });

    it('migrates all clinical keys, resolves pre-session pain conflicts in favor of localStorage flowsheet, scrubs patient names from audit logs, verifies by decrypt + deep-equal, and deletes ZERO localStorage keys', async () => {
      const testDb = createInMemoryDatabase(6);
      const { dek, patientId } = await setupTestVaultAndPatient(testDb, 'pat-mig-1');

      const episode = await EpisodeService.createEpisode(
        patientId,
        {
          title: 'آلام أسفل الظهر',
          primarySpecialty: 'musculoskeletal',
          medicalDiagnosis: 'Lumbar Radiculopathy',
          clinicalImpression: 'L4-L5 disc',
          affectedBodyRegion: 'Lumbar Spine',
          rehabilitationGoals: {
            shortTerm: ['تخفيف الألم'],
            longTerm: ['العودة للعمل'],
          },
        },
        dek,
        'ep-mig-1',
        testDb
      );

      const session = await SessionService.createSession(
        patientId,
        episode.id,
        {
          sessionDate: '2026-02-10',
          sessionType: 'initial_evaluation',
          attendanceStatus: 'attended',
        },
        dek,
        'sess-mig-1',
        testDb
      );

      const existingSoap = await SoapService.createSoapNote(
        patientId,
        episode.id,
        session.id,
        {
          isFinalized: false,
          subjective: {
            chiefComplaint: 'ألم أسفل الظهر',
            painNrsScore: 4, // differs from localStorage flowsheet (8)
          },
          objective: {
            clinicalObservations: 'تشنج عضلي',
          },
          assessment: {
            clinicalImpressionCurrent: 'تحسن مبدئي',
            progressStatus: 'improved',
          },
          plan: {
            nextSessionPlan: 'متابعة',
          },
        },
        dek,
        'soap-mig-1',
        testDb
      );

      // Seed localStorage flowsheet with preSessionPainNrs = 8 (conflict with 4) and postSessionPainNrs = 3
      mockStorage.setItem(
        `physiorecord_session_flowsheet_v2_${session.id}`,
        JSON.stringify({
          sessionId: session.id,
          episodeId: episode.id,
          patientId,
          preSessionPainNrs: 8,
          postSessionPainNrs: 3,
          exercises: [
            {
              id: 'ex-row-1',
              exerciseId: 'ex_lumb_mckenzie',
              nameAr: 'تمرين مكنزي',
              nameEn: 'McKenzie Press-Up',
              setsCompleted: 3,
              repsCompleted: 10,
              holdSeconds: 2,
              loadOrResistance: 'Bodyweight',
              patientResponse: 'well_tolerated',
            },
          ],
          manualTherapy: [],
          physicalAgents: [],
          updatedAt: '2026-02-10T10:00:00.000Z',
        })
      );

      // Seed audit log containing patient name in summary
      mockStorage.setItem(
        'physiorecord_audit_logs_v2',
        JSON.stringify([
          {
            id: 'audit-legacy-1',
            timestamp: '2026-02-10T10:05:00.000Z',
            actorName: 'د. حيدر',
            actorRole: 'admin',
            actionType: 'patient_deleted',
            entityType: 'patient',
            entityId: patientId,
            summaryAr: 'حذف ملف المريض فاطمة حسن العراقي نهائياً',
            summaryEn: 'Deleted patient فاطمة حسن العراقي permanently',
          },
        ])
      );

      const result = await LocalStorageMigrationService.runMigration(dek, testDb, {
        storage: mockStorage,
      });

      expect(result.status).toBe('completed');
      expect(result.report.corruptKeys).toHaveLength(0);
      expect(result.report.painConflicts).toHaveLength(1);
      expect(result.report.painConflicts[0]).toMatchObject({
        sessionId: session.id,
        soapId: existingSoap.id,
        soapPainNrsScore: 4,
        flowsheetPreSessionPainNrs: 8,
        resolution: 'flowsheet_won',
      });

      // Verify SOAP note in Dexie now has subjective.painNrsScore = 8, subjective.postSessionPainNrs = 3,
      // and objective.flowsheet WITHOUT preSessionPainNrs
      const mergedSoap = await SoapService.getSoapNoteBySession(session.id, dek, testDb);
      expect(mergedSoap).not.toBeNull();
      expect(mergedSoap?.data.subjective?.painNrsScore).toBe(8);
      expect(mergedSoap?.data.subjective?.postSessionPainNrs).toBe(3);
      expect(mergedSoap?.data.objective?.flowsheet?.exercises).toHaveLength(1);
      expect(
        'preSessionPainNrs' in (mergedSoap?.data.objective?.flowsheet ?? {})
      ).toBe(false);

      // Verify audit log in Dexie has patientId and scrubbed summaries (no 'فاطمة حسن العراقي')
      const encAudit = await testDb.auditLogs.get('audit-legacy-1');
      expect(encAudit).toBeDefined();
      expect(encAudit?.patientId).toBe(patientId);
      const decAudit = await decryptRecordPayload<{
        summaryAr: string;
        summaryEn: string;
        patientId?: string;
      }>(
        dek,
        'auditLogs',
        'audit-legacy-1',
        [],
        encAudit!.iv,
        encAudit!.ciphertext,
        encAudit!.recordCryptoVersion,
        encAudit!.dekVersion
      );
      expect(decAudit.summaryAr).not.toContain('فاطمة حسن العراقي');
      expect(decAudit.summaryEn).not.toContain('فاطمة حسن العراقي');

      // Verify encrypted migration report in db.migrationReports
      const encReport = await testDb.migrationReports.get(result.report.id);
      expect(encReport).toBeDefined();
      const decReport = await decryptRecordPayload<MigrationReportPayload>(
        dek,
        'migrationReports',
        result.report.id,
        [],
        encReport!.iv,
        encReport!.ciphertext,
        encReport!.recordCryptoVersion,
        encReport!.dekVersion
      );
      expect(canonicalizeForSeal(decReport.painConflicts)).toBe(
        canonicalizeForSeal(result.report.painConflicts)
      );

      // Verify ZERO localStorage keys were deleted
      expect(mockStorage.getItem(`physiorecord_session_flowsheet_v2_${session.id}`)).not.toBeNull();
      expect(mockStorage.getItem('physiorecord_audit_logs_v2')).not.toBeNull();
    });

    it('is idempotent on subsequent runs (skips already-completed key hashes without re-encrypting)', async () => {
      const testDb = createInMemoryDatabase(6);
      const { dek } = await setupTestVaultAndPatient(testDb, 'pat-idem');

      mockStorage.setItem(
        'physiorecord_expenses_iqd_v2',
        JSON.stringify([
          {
            id: 'exp-1',
            date: '2026-02-01',
            category: 'medical_consumables',
            titleAr: 'مستلزمات علاج طبيعي',
            titleEn: 'PT Consumables',
            amountIQD: 50000,
            paidBy: 'الإدارة',
          },
        ])
      );

      const firstRun = await LocalStorageMigrationService.runMigration(dek, testDb, {
        storage: mockStorage,
      });
      expect(firstRun.status).toBe('completed');
      expect(firstRun.report.migratedKeys).toHaveLength(1);

      const rowAfterFirst = await testDb.expenses.get('exp-1');
      expect(rowAfterFirst).toBeDefined();

      const secondRun = await LocalStorageMigrationService.runMigration(dek, testDb, {
        storage: mockStorage,
      });
      expect(secondRun.status).toBe('completed');
      expect(secondRun.alreadyCompleted).toBe(true);
      expect(secondRun.report.migratedKeys).toHaveLength(0);
      expect(secondRun.report.skippedAlreadyCompletedKeys).toHaveLength(1);

      const rowAfterSecond = await testDb.expenses.get('exp-1');
      // IV and ciphertext remain identical because the key hash was already completed
      expect(Array.from(rowAfterSecond!.iv)).toEqual(Array.from(rowAfterFirst!.iv));
    });

    it('resumes cleanly after an interrupted migration without re-migrating completed keys', async () => {
      const testDb = createInMemoryDatabase(6);
      const { dek } = await setupTestVaultAndPatient(testDb, 'pat-resume');

      mockStorage.setItem(
        'physiorecord_appointments_v2',
        JSON.stringify([
          {
            id: 'appt-r1',
            patientId: 'pat-resume',
            patientName: 'مريض 1',
            patientPhone: '0770',
            date: '2026-03-01',
            startTime: '09:00',
            durationMinutes: 30,
            therapistName: 'د. 1',
            visitType: 'follow_up',
            status: 'scheduled',
          },
        ])
      );
      mockStorage.setItem(
        'physiorecord_expenses_iqd_v2',
        JSON.stringify([
          {
            id: 'exp-r1',
            date: '2026-03-01',
            category: 'rent_utilities',
            titleAr: 'إيجار',
            titleEn: 'Rent',
            amountIQD: 250000,
            paidBy: 'الإدارة',
          },
        ])
      );
      mockStorage.setItem(
        'physiorecord_custom_widgets',
        JSON.stringify([
          {
            id: 'wid-r1',
            titleAr: 'أداة مخصصة',
            titleEn: 'Custom Widget',
            type: 'checklist',
            scope: 'global',
            createdAt: '2026-03-01T00:00:00.000Z',
          },
        ])
      );

      // Run 1: interrupt after 2 keys
      const interruptedRun = await LocalStorageMigrationService.runMigration(dek, testDb, {
        storage: mockStorage,
        interruptAfterKeys: 2,
      });
      expect(interruptedRun.status).toBe('interrupted');
      expect(interruptedRun.report.migratedKeys).toHaveLength(2);

      const stateAfterInterrupt = await testDb.migrationState.get(LOCALSTORAGE_MIGRATION_STATE_ID);
      expect(stateAfterInterrupt?.status).toBe('in_progress');
      expect(stateAfterInterrupt?.completedKeyHashes).toHaveLength(2);

      // Run 2: resume without interruption
      const resumedRun = await LocalStorageMigrationService.runMigration(dek, testDb, {
        storage: mockStorage,
      });
      expect(resumedRun.status).toBe('completed');
      expect(resumedRun.report.skippedAlreadyCompletedKeys).toHaveLength(2);
      expect(resumedRun.report.migratedKeys).toHaveLength(1);

      const stateAfterResume = await testDb.migrationState.get(LOCALSTORAGE_MIGRATION_STATE_ID);
      expect(stateAfterResume?.status).toBe('completed');
      expect(stateAfterResume?.completedKeyHashes).toHaveLength(3);
    });

    it('serializes two tabs running migration concurrently without duplicate writes or race corruption', async () => {
      const testDb = createInMemoryDatabase(6);
      const { dek } = await setupTestVaultAndPatient(testDb, 'pat-conc');

      mockStorage.setItem(
        'physiorecord_invoices_iqd_v2',
        JSON.stringify([
          {
            id: 'inv-conc-1',
            invoiceNumber: 'INV-CONC-1',
            patientId: 'pat-conc',
            patientName: 'مريض التزامن',
            episodeId: 'ep-conc',
            date: '2026-03-01',
            invoiceType: 'rehab_package',
            titleAr: 'حزمة 6 جلسات',
            titleEn: '6-Session Package',
            totalAmountIQD: 150000,
            discountIQD: 0,
            netAmountIQD: 150000,
            paidAmountIQD: 50000,
            balanceDueIQD: 100000,
            status: 'partial',
            packageTotalSessions: 6,
            packageUsedSessions: 1,
            createdBy: 'الاستقبال',
            payments: [
              {
                id: 'pay-conc-1',
                invoiceId: 'inv-conc-1',
                patientId: 'pat-conc',
                date: '2026-03-01',
                amountIQD: 50000,
                method: 'cash_iqd',
                receivedBy: 'الاستقبال',
                receiptNumber: 'RCPT-1',
              },
            ],
          },
        ])
      );
      mockStorage.setItem(
        'physiorecord_waiting_list_v2',
        JSON.stringify([
          {
            id: 'wait-conc-1',
            patientId: 'pat-conc',
            patientName: 'مريض التزامن',
            phone: '0770',
            conditionOrRegion: 'Lumbar',
            preferredTherapist: 'د. سارة',
            preferredDays: 'الأحد',
            preferredTimeWindow: 'morning',
            priority: 'normal',
            addedAt: '2026-03-01',
          },
        ])
      );

      // Launch two concurrent migrations (simulating Tab A and Tab B unlocking simultaneously)
      const [tabA, tabB] = await Promise.all([
        LocalStorageMigrationService.runMigration(dek, testDb, { storage: mockStorage }),
        LocalStorageMigrationService.runMigration(dek, testDb, { storage: mockStorage }),
      ]);

      expect(tabA.status).toBe('completed');
      expect(tabB.status).toBe('completed');
      // Exactly one tab performed the 2 key migrations, and the second tab saw them already completed
      expect(tabA.report.migratedKeys.length + tabB.report.migratedKeys.length).toBe(2);
      expect(await testDb.invoices.count()).toBe(1);
      expect(await testDb.payments.count()).toBe(1);
      expect(await testDb.waitingList.count()).toBe(1);
    });

    it('reports corrupt localStorage keys in report.corruptKeys without deleting them while migrating valid keys', async () => {
      const testDb = createInMemoryDatabase(6);
      const { dek } = await setupTestVaultAndPatient(testDb, 'pat-corrupt');

      const corruptPayload = '{invalid_json_payload: true';
      mockStorage.setItem('physiorecord_invoices_iqd_v2', corruptPayload);
      mockStorage.setItem('physiorecord_active_staff_v2', 'staff_senior_pt');

      const runResult = await LocalStorageMigrationService.runMigration(dek, testDb, {
        storage: mockStorage,
      });

      expect(runResult.status).toBe('partial_with_errors');
      expect(runResult.report.corruptKeys).toHaveLength(1);
      expect(runResult.report.corruptKeys[0].key).toBe('physiorecord_invoices_iqd_v2');
      expect(runResult.report.migratedKeys).toEqual(['physiorecord_active_staff_v2']);

      // Valid key was migrated and verified
      expect(await testDb.staffState.get('active_staff')).toBeDefined();

      // Corrupt key was NOT deleted from localStorage
      expect(mockStorage.getItem('physiorecord_invoices_iqd_v2')).toBe(corruptPayload);
    });
  });
});
