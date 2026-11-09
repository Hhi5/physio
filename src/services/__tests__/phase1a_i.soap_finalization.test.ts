import { describe, it, expect } from 'vitest';
import {
  deriveKEK,
  generateAndWrapOperationalDEK,
  generateVerifier,
  encryptRecordWithMandatoryReservation,
  decryptRecordPayload,
  randomBytes,
  CONSTANTS,
  CURRENT_DEK_VERSION,
  CURRENT_RECORD_CRYPTO_VERSION,
} from '../../crypto/vault';
import { exportBackupPackage, restoreBackupPackage } from '../../crypto/backup';
import { createInMemoryDatabase } from '../../crypto/__tests__/testDbHelper';
import { EpisodeService } from '../episodeService';
import {
  SessionService,
  setSessionMutationTestHook,
  verifySessionSeal,
  verifySoapSeal,
  canonicalizeForSeal,
  HALF_FINALIZED_REPAIR_STATE_ID,
} from '../sessionService';
import {
  SoapService,
  MAX_ADDENDUM_TEXT_LENGTH,
  setSoapMutationTestHook,
} from '../soapService';
import { ClinicOperationsService } from '../clinicOperationsService';
import {
  createUntouchedDraftFormState,
  buildSoapPayloadFromFormState,
  compileFlowsheetSummaryText,
  resolveStoredInterventionsSummary,
  validateSignAndLockState,
} from '../../components/workspace/TreatmentSessionView';
import {
  CURRENT_SOAP_SCHEMA_VERSION,
  CURRENT_SEAL_VERSION,
  ENABLE_LEGACY_SOAP_MODAL_ROM_MMT_BODYCHART_WRITES,
  StaleTabOverwriteError,
  type AddendumReason,
  type EncryptedSoapEntity,
  type SoapNoteData,
} from '../../types/clinical';

async function bootstrapTestVaultAndEpisode() {
  const db = createInMemoryDatabase(6);
  const salt = randomBytes(CONSTANTS.SALT_BYTES);
  const UseFastTestIterations = 1000;
  const kek = await deriveKEK('CorrectHorse1!', salt, UseFastTestIterations);
  const { operationalDek, wrappedDek, wrappedDekIv } =
    await generateAndWrapOperationalDEK(kek, 1);
  const { verifierIv, verifierCiphertext } = await generateVerifier(kek);

  await db.vaultMeta.put({
    id: 'auth',
    salt,
    wrappedDek,
    wrappedDekIv,
    verifierIv,
    verifierCiphertext,
    schemaVersion: 5,
    kdfAlgorithm: 'PBKDF2-HMAC-SHA256',
    kdfIterations: UseFastTestIterations,
    dekVersion: CURRENT_DEK_VERSION,
    encryptionInvocationCount: 0,
    vaultGeneration: 1,
  });

  const pEnc = await encryptRecordWithMandatoryReservation(
    db,
    operationalDek,
    'patients',
    'pat-1',
    [],
    { fullName: 'Test Patient', gender: 'male' }
  );
  await db.patients.put({
    id: 'pat-1',
    createdAt: '2026-04-01T08:00:00.000Z',
    updatedAt: '2026-04-01T08:00:00.000Z',
    isArchived: 0,
    recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
    dekVersion: CURRENT_DEK_VERSION,
    iv: pEnc.iv,
    ciphertext: pEnc.ciphertext,
  });

  const episode = await EpisodeService.createEpisode(
    'pat-1',
    {
      title: 'Lumbar Radiculopathy Rehab',
      primarySpecialty: 'musculoskeletal',
      medicalDiagnosis: 'L4-L5 disc protrusion',
      clinicalImpression: 'Right L5 radicular pain responding to extension',
      affectedBodyRegion: 'Lumbar Spine',
      onsetDate: '2026-03-20',
      startDate: '2026-04-01',
      status: 'active',
      rehabilitationGoals: {
        shortTerm: ['Centralize pain'],
        longTerm: ['Return to work'],
      },
    },
    operationalDek,
    'ep-1',
    db
  );

  return { db, dek: operationalDek, patientId: 'pat-1', episodeId: episode.id };
}

describe('Phase 1A-i.5 — Unified SOAP + Flowsheet, No Fabricated Defaults, Single Finalize Path, Concurrency & Strict Addenda', () => {
  it('saves no fabricated defaults on an untouched new draft and blocks Sign & Lock until required fields are present', async () => {
    const { db, dek, patientId, episodeId } = await bootstrapTestVaultAndEpisode();

    const session = await SessionService.createSession(
      patientId,
      episodeId,
      {
        sessionDate: '2026-04-10',
        sessionType: 'follow_up',
        attendanceStatus: 'attended',
      },
      dek,
      'sess-untouched',
      db
    );

    const untouchedState = createUntouchedDraftFormState();
    expect(untouchedState.prePainNrs).toBeUndefined();
    expect(untouchedState.postPainNrs).toBeUndefined();
    expect(untouchedState.progressStatus).toBe('');
    expect(untouchedState.patientTolerance).toBe('');
    expect(untouchedState.chiefComplaint).toBe('');
    expect(untouchedState.interventionsSummary).toBe('');
    expect(untouchedState.clinicalImpression).toBe('');
    expect(untouchedState.nextSessionPlan).toBe('');

    // Sign & Lock validation blocks untouched state with clear missing list
    const validation = validateSignAndLockState(untouchedState);
    expect(validation.valid).toBe(false);
    expect(validation.missingEn).toHaveLength(5);

    // Saving untouched draft persists undefined pain and empty strings without fabricating values
    const draftPayload = buildSoapPayloadFromFormState(untouchedState, null);
    const saved = await SoapService.createSoapNote(
      patientId,
      episodeId,
      session.id,
      draftPayload,
      dek,
      'soap-untouched',
      db
    );

    expect(saved.data.subjective.painNrsScore).toBeUndefined();
    expect(saved.data.subjective.postSessionPainNrs).toBeUndefined();
    expect(saved.data.subjective.painVasCurrent).toBeUndefined();
    expect(saved.data.subjective.painAssessment).toBeUndefined();
    expect(saved.data.subjective.chiefComplaint).toBe('');
    expect(saved.data.objective.dailyInterventionsSummary).toBe('');
    expect(saved.data.assessment.clinicalImpressionCurrent).toBe('');
    expect(saved.data.assessment.progressStatus).toBeUndefined();
    expect(saved.data.assessment.patientTolerance).toBeUndefined();
    expect(saved.data.plan.nextSessionPlan).toBe('');

    const reloaded = await SoapService.getSoapNoteBySession(session.id, dek, db);
    expect(reloaded?.data.subjective.painNrsScore).toBeUndefined();
    expect(reloaded?.data.subjective.postSessionPainNrs).toBeUndefined();
    expect(reloaded?.data.assessment.progressStatus).toBeUndefined();

    // Service-level finalizeSession also rejects incomplete draft
    await expect(
      SessionService.finalizeSession(session.id, 'Dr. Zaid', dek, db)
    ).rejects.toThrow(/شدة الألم قبل الجلسة/);
  });

  it('stores flowsheet & postSessionPainNrs inside SoapNoteData (v2) and picks previous session flowsheet by sessionNumber/date (not updatedAt) while reporting failedCount', async () => {
    const { db, dek, patientId, episodeId } = await bootstrapTestVaultAndEpisode();

    const session1 = await SessionService.createSession(
      patientId,
      episodeId,
      {
        sessionDate: '2026-04-10',
        sessionType: 'initial_evaluation',
        attendanceStatus: 'attended',
      },
      dek,
      'sess-1',
      db
    );

    const session2 = await SessionService.createSession(
      patientId,
      episodeId,
      {
        sessionDate: '2026-04-12',
        sessionType: 'follow_up',
        attendanceStatus: 'attended',
      },
      dek,
      'sess-2',
      db
    );

    const session3 = await SessionService.createSession(
      patientId,
      episodeId,
      {
        sessionDate: '2026-04-15',
        sessionType: 'follow_up',
        attendanceStatus: 'attended',
      },
      dek,
      'sess-3',
      db
    );

    const soap1 = await SoapService.createSoapNote(
      patientId,
      episodeId,
      session1.id,
      {
        isFinalized: false,
        subjective: {
          chiefComplaint: 'Session 1 complaint',
          painNrsScore: 7,
          postSessionPainNrs: 5,
        },
        objective: {
          flowsheet: {
            exercises: [
              {
                id: 'ex-s1',
                exerciseId: 'prone-press-up',
                nameEn: 'Session 1 Press-Up',
                nameAr: 'تمرين الجلسة الأولى',
                region: 'thoracic_lumbar',
                sets: 2,
                reps: 8,
                holdSeconds: 3,
                loadOrBand: 'Bodyweight',
                rpeOrPainResponse: 'pain_free',
              },
            ],
            manualTherapy: [],
            physicalAgents: [],
          },
        },
        assessment: {
          clinicalImpressionCurrent: 'Initial eval',
          progressStatus: 'improved',
        },
        plan: {},
      },
      dek,
      'soap-1',
      db
    );

    await SoapService.createSoapNote(
      patientId,
      episodeId,
      session2.id,
      {
        isFinalized: false,
        subjective: {
          chiefComplaint: 'Session 2 complaint',
          painNrsScore: 5,
          postSessionPainNrs: 3,
        },
        objective: {
          flowsheet: {
            exercises: [
              {
                id: 'ex-s2',
                exerciseId: 'bird-dog',
                nameEn: 'Session 2 Bird-Dog',
                nameAr: 'تمرين الجلسة الثانية',
                region: 'thoracic_lumbar',
                sets: 3,
                reps: 12,
                holdSeconds: 5,
                loadOrBand: 'Yellow Band',
                rpeOrPainResponse: 'pain_free',
              },
            ],
            manualTherapy: [],
            physicalAgents: [],
          },
        },
        assessment: {
          clinicalImpressionCurrent: 'Follow up 2',
          progressStatus: 'improved',
        },
        plan: {},
      },
      dek,
      'soap-2',
      db
    );

    // Touch soap1 AFTER soap2 so soap1 has a newer updatedAt timestamp than soap2:
    await SoapService.updateSoapNote(
      soap1.id,
      {
        subjective: {
          ...soap1.data.subjective,
          symptomChangesSinceLastSession: 'Edited later',
        },
      },
      dek,
      db
    );

    // Carry forward into Session #3 MUST pick Session #2 (highest sessionNumber < 3), NOT Session #1!
    const carried = await SoapService.getLatestEpisodeFlowsheet(
      episodeId,
      session3.id,
      dek,
      db,
      session3.sessionNumber,
      session3.sessionDate
    );
    expect(carried.failedCount).toBe(0);
    expect(carried.sourceSessionNumber).toBe(2);
    expect(carried.flowsheet?.exercises[0].nameEn).toBe('Session 2 Bird-Dog');
  });

  it('loads legacy v1 soapNotes (reading legacy painVasCurrent/painAssessment without ?? 0 fallback) and stops writing them in v2', async () => {
    const { db, dek, patientId, episodeId } = await bootstrapTestVaultAndEpisode();

    const sessionLegacy = await SessionService.createSession(
      patientId,
      episodeId,
      {
        sessionDate: '2026-04-01',
        sessionType: 'follow_up',
        attendanceStatus: 'attended',
      },
      dek,
      'sess-legacy',
      db
    );

    const legacyV1Data: SoapNoteData = {
      isFinalized: false,
      subjective: {
        chiefComplaint: 'Legacy note with painVasCurrent only',
        painVasCurrent: 6,
      },
      objective: {
        objectiveFindings: 'Normal gait',
      },
      assessment: {
        clinicalImpressionCurrent: 'Steady progress',
        progressStatus: 'improved',
        patientTolerance: 'well_tolerated',
      },
      plan: {
        nextSessionPlan: 'Continue protocol',
      },
    };

    const { iv, ciphertext } = await encryptRecordWithMandatoryReservation(
      db,
      dek,
      'soapNotes',
      'soap-v1-legacy',
      [patientId, episodeId, sessionLegacy.id],
      legacyV1Data
    );

    const entity: EncryptedSoapEntity = {
      id: 'soap-v1-legacy',
      sessionId: sessionLegacy.id,
      episodeId,
      patientId,
      createdAt: '2026-04-01T10:00:00.000Z',
      updatedAt: '2026-04-01T10:00:00.000Z',
      recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
      dekVersion: CURRENT_DEK_VERSION,
      iv,
      ciphertext,
    };
    await db.soapNotes.put(entity);

    const loaded = await SoapService.getSoapNoteBySession(sessionLegacy.id, dek, db);
    expect(loaded).not.toBeNull();
    expect(loaded?.data.soapSchemaVersion).toBe(1);
    expect(loaded?.data.subjective.painNrsScore).toBe(6);

    // Updating the note to v2 strips painVasCurrent and painAssessment from the raw encrypted payload
    await SoapService.updateSoapNote(
      'soap-v1-legacy',
      {
        subjective: {
          painNrsScore: 4,
          postSessionPainNrs: 2,
        },
      },
      dek,
      db
    );

    const rawUpdated = (await db.soapNotes.get('soap-v1-legacy'))!;
    const rawDecrypted = await decryptRecordPayload<SoapNoteData>(
      dek,
      'soapNotes',
      rawUpdated.id,
      [patientId, episodeId, sessionLegacy.id],
      rawUpdated.iv,
      rawUpdated.ciphertext,
      rawUpdated.recordCryptoVersion,
      rawUpdated.dekVersion
    );
    expect(rawDecrypted.soapSchemaVersion).toBe(CURRENT_SOAP_SCHEMA_VERSION);
    expect(rawDecrypted.subjective.painNrsScore).toBe(4);
    expect(rawDecrypted.subjective.postSessionPainNrs).toBe(2);
    expect(rawDecrypted.subjective.painVasCurrent).toBeUndefined();
    expect(rawDecrypted.subjective.painAssessment).toBeUndefined();
  });

  it('prevents interventionsSummary duplication after reload and keeps legacy compiled summary read-only', async () => {
    const { db, dek, patientId, episodeId } = await bootstrapTestVaultAndEpisode();

    const session = await SessionService.createSession(
      patientId,
      episodeId,
      {
        sessionDate: '2026-04-11',
        sessionType: 'follow_up',
        attendanceStatus: 'attended',
      },
      dek,
      'sess-summary',
      db
    );

    const state = createUntouchedDraftFormState();
    state.exercises = [
      {
        id: 'ex-1',
        exerciseId: 'bridging',
        nameAr: 'رفع الحوض (Bridging)',
        nameEn: 'Supine Glute Bridge',
        region: 'thoracic_lumbar',
        sets: 3,
        reps: 10,
        holdSeconds: 5,
        loadOrBand: 'Bodyweight',
        rpeOrPainResponse: 'pain_free',
      },
    ];
    state.interventionsSummary = 'Patient cued for neutral spine alignment.';

    // Save 1
    const payload1 = buildSoapPayloadFromFormState(state, null);
    expect(payload1.objective.dailyInterventionsSummary).toBe(
      'Patient cued for neutral spine alignment.'
    );
    const saved1 = await SoapService.createSoapNote(
      patientId,
      episodeId,
      session.id,
      payload1,
      dek,
      'soap-summary',
      db
    );

    // Simulate reload + Save 2
    const loaded1 = (await SoapService.getSoapNoteBySession(session.id, dek, db))!;
    const resolved = resolveStoredInterventionsSummary(
      loaded1.data.objective.dailyInterventionsSummary,
      loaded1.data.objective.legacyCompiledSummary,
      loaded1.data.objective.flowsheet
    );
    expect(resolved.freeText).toBe('Patient cued for neutral spine alignment.');
    expect(resolved.legacyCompiledSummary).toBeUndefined();

    state.interventionsSummary = resolved.freeText;
    const payload2 = buildSoapPayloadFromFormState(state, saved1);
    const saved2 = await SoapService.updateSoapNote(saved1.id, payload2, dek, db);
    expect(saved2.data.objective.dailyInterventionsSummary).toBe(
      'Patient cued for neutral spine alignment.'
    );

    // Also verify legacy note whose stored dailyInterventionsSummary equalled the compiled string
    const legacyCompiledStr = compileFlowsheetSummaryText(state.exercises.length ? {
      exercises: state.exercises,
      manualTherapy: [],
      physicalAgents: [],
    } : undefined, false);
    const legacyResolved = resolveStoredInterventionsSummary(
      legacyCompiledStr,
      undefined,
      {
        exercises: state.exercises,
        manualTherapy: [],
        physicalAgents: [],
      }
    );
    expect(legacyResolved.freeText).toBe('');
    expect(legacyResolved.legacyCompiledSummary).toBe(legacyCompiledStr);
  });

  it('enforces single finalization path, finalize idempotency (second call does not alter finalizedAt/finalizedBy), and strict addendum validation', async () => {
    const { db, dek, patientId, episodeId } = await bootstrapTestVaultAndEpisode();

    // Confirm SoapService.finalizeSoapNote is removed from public API
    expect('finalizeSoapNote' in SoapService).toBe(false);

    const session = await SessionService.createSession(
      patientId,
      episodeId,
      {
        sessionDate: '2026-04-12',
        sessionType: 'follow_up',
        attendanceStatus: 'attended',
      },
      dek,
      'sess-finalize',
      db
    );

    const otherSession = await SessionService.createSession(
      patientId,
      episodeId,
      {
        sessionDate: '2026-04-13',
        sessionType: 'follow_up',
        attendanceStatus: 'attended',
      },
      dek,
      'sess-other',
      db
    );

    const soap = await SoapService.createSoapNote(
      patientId,
      episodeId,
      session.id,
      {
        isFinalized: false,
        subjective: {
          chiefComplaint: 'Knee feels stronger',
          painNrsScore: 3,
          postSessionPainNrs: 2,
        },
        objective: {
          flowsheet: {
            exercises: [
              {
                id: 'ex-knee',
                exerciseId: 'mini-squat',
                nameEn: 'Mini Squat',
                nameAr: 'قرفصاء جزئية',
                region: 'knee',
                sets: 3,
                reps: 12,
                holdSeconds: 2,
                loadOrBand: 'Bodyweight',
                rpeOrPainResponse: 'pain_free',
              },
            ],
            manualTherapy: [],
            physicalAgents: [],
          },
        },
        assessment: {
          clinicalImpressionCurrent: 'Good quad recruitment',
          progressStatus: 'improved',
          patientTolerance: 'well_tolerated',
        },
        plan: {
          nextSessionPlan: 'Step-downs next visit',
        },
      },
      dek,
      'soap-finalize',
      db
    );

    const otherSoap = await SoapService.createSoapNote(
      patientId,
      episodeId,
      otherSession.id,
      {
        isFinalized: false,
        subjective: { painNrsScore: 4, postSessionPainNrs: 3 },
        objective: { dailyInterventionsSummary: 'Gait training' },
        assessment: { clinicalImpressionCurrent: 'Stable', progressStatus: 'unchanged' },
        plan: {},
      },
      dek,
      'soap-other',
      db
    );

    const finalizedSession = await SessionService.finalizeSession(
      session.id,
      'Dr. Ali Al-Iraqi',
      dek,
      db
    );
    await SessionService.finalizeSession(otherSession.id, 'Dr. Ali Al-Iraqi', dek, db);

    const firstFinalizedAt = finalizedSession.data.finalizedAt;
    const firstFinalizedBy = finalizedSession.data.finalizedBy;
    const finalizedSoap = (await SoapService.getSoapNoteBySession(session.id, dek, db))!;
    const firstSoapFinalizedAt = finalizedSoap.data.finalizedAt;
    const firstSoapFinalizedBy = finalizedSoap.data.finalizedBy;

    // Finalizing a second time MUST reject and MUST NOT mutate finalizedAt or finalizedBy
    await expect(
      SessionService.finalizeSession(session.id, 'Dr. Different Signer', dek, db)
    ).rejects.toThrow(/معتمدة مسبقاً/);

    const afterSecondAttemptSession = (await SessionService.getSessionById(session.id, dek, db))!;
    const afterSecondAttemptSoap = (await SoapService.getSoapNoteBySession(session.id, dek, db))!;
    expect(afterSecondAttemptSession.data.finalizedAt).toBe(firstFinalizedAt);
    expect(afterSecondAttemptSession.data.finalizedBy).toBe(firstFinalizedBy);
    expect(afterSecondAttemptSoap.data.finalizedAt).toBe(firstSoapFinalizedAt);
    expect(afterSecondAttemptSoap.data.finalizedBy).toBe(firstSoapFinalizedBy);

    // Addendum rejections (Requirement 7):
    // 1. Rejects cross-session soap target (soap belongs to otherSession, not session)
    await expect(
      SoapService.addClinicalAddendum(
        session.id,
        'soapNotes',
        otherSoap.id,
        {
          reasonForAmendment: 'late_entry',
          amendmentText: 'Cross-session attempt',
          signedByTherapistName: 'Dr. Ali Al-Iraqi',
        },
        dek,
        undefined,
        db
      )
    ).rejects.toThrow(/تنتمي لجلسة أخرى/);

    // 2. Rejects passing sessionId as targetId when targetTable === 'soapNotes' (no sessionId fallback)
    await expect(
      SoapService.addClinicalAddendum(
        session.id,
        'soapNotes',
        session.id,
        {
          reasonForAmendment: 'late_entry',
          amendmentText: 'SessionId instead of SoapId attempt',
          signedByTherapistName: 'Dr. Ali Al-Iraqi',
        },
        dek,
        undefined,
        db
      )
    ).rejects.toThrow(/غير موجودة/);

    // 3. Rejects mismatched targetId when targetTable === 'sessions'
    await expect(
      SoapService.addClinicalAddendum(
        session.id,
        'sessions',
        otherSession.id,
        {
          reasonForAmendment: 'late_entry',
          amendmentText: 'Mismatched session targetId',
          signedByTherapistName: 'Dr. Ali Al-Iraqi',
        },
        dek,
        undefined,
        db
      )
    ).rejects.toThrow(/لا يطابق معرّف الجلسة/);

    // 4. Rejects invalid reasonForAmendment
    await expect(
      SoapService.addClinicalAddendum(
        session.id,
        'soapNotes',
        soap.id,
        {
          reasonForAmendment: 'not_a_valid_reason' as AddendumReason,
          amendmentText: 'Invalid reason',
          signedByTherapistName: 'Dr. Ali Al-Iraqi',
        },
        dek,
        undefined,
        db
      )
    ).rejects.toThrow(/سبب الملحق السريري غير صالح/);

    // 5. Rejects text exceeding 5000 chars
    await expect(
      SoapService.addClinicalAddendum(
        session.id,
        'soapNotes',
        soap.id,
        {
          reasonForAmendment: 'late_entry',
          amendmentText: 'x'.repeat(MAX_ADDENDUM_TEXT_LENGTH + 1),
          signedByTherapistName: 'Dr. Ali Al-Iraqi',
        },
        dek,
        undefined,
        db
      )
    ).rejects.toThrow(/يتجاوز الحد الأقصى/);

    // Valid addendum stores real soap.id as targetId and getAddendaBySession returns { records, failedCount }
    const validAddendum = await SoapService.addClinicalAddendum(
      session.id,
      'soapNotes',
      soap.id,
      {
        reasonForAmendment: 'late_entry',
        amendmentText: 'Patient responded well to visual mirror feedback during squats.',
        signedByTherapistName: 'Dr. Ali Al-Iraqi',
      },
      dek,
      'addendum-1',
      db
    );
    expect(validAddendum.targetId).toBe(soap.id);

    const addendaRes = await SoapService.getAddendaBySession(session.id, dek, db);
    expect(addendaRes.failedCount).toBe(0);
    expect(addendaRes.records).toHaveLength(1);
  });

  it('rejects stale-tab overwrites (StaleTabOverwriteError) and allows clearing optional sections in updateSoapNote', async () => {
    const { db, dek, patientId, episodeId } = await bootstrapTestVaultAndEpisode();

    const session = await SessionService.createSession(
      patientId,
      episodeId,
      {
        sessionDate: '2026-04-14',
        sessionType: 'follow_up',
        attendanceStatus: 'attended',
      },
      dek,
      'sess-concurrency',
      db
    );

    const created = await SoapService.createSoapNote(
      patientId,
      episodeId,
      session.id,
      {
        isFinalized: false,
        subjective: {
          chiefComplaint: 'Initial complaint',
          painNrsScore: 6,
          postSessionPainNrs: 4,
        },
        objective: {
          clinicalObservations: 'Mild swelling',
          flowsheet: {
            exercises: [
              {
                id: 'ex-clear',
                nameAr: 'تمرين',
                nameEn: 'Exercise',
                region: 'knee',
                sets: 3,
                reps: 10,
                holdSeconds: 0,
                loadOrBand: '2kg',
                rpeOrPainResponse: 'pain_free',
              },
            ],
            manualTherapy: [],
            physicalAgents: [],
          },
        },
        assessment: {
          clinicalImpressionCurrent: 'Initial impression',
          progressStatus: 'improved',
        },
        plan: {
          homeInstructions: 'Ice 15m',
        },
      },
      dek,
      'soap-concurrency',
      db
    );

    const staleTimestamp = '2020-01-01T00:00:00.000Z';

    // Stale tab attempting to overwrite gets StaleTabOverwriteError ("Changed in another tab")
    await expect(
      SoapService.updateSoapNote(
        created.id,
        { subjective: { chiefComplaint: 'Stale tab overwrite' } },
        dek,
        db,
        staleTimestamp
      )
    ).rejects.toThrow(StaleTabOverwriteError);

    // Stale tab attempting to finalize gets StaleTabOverwriteError
    await expect(
      SessionService.finalizeSession(
        session.id,
        'Dr. Zaid',
        dek,
        db,
        session.updatedAt,
        staleTimestamp
      )
    ).rejects.toThrow(StaleTabOverwriteError);

    // Clearing optional sections via explicit null / undefined in updateSoapNote (Requirement 10)
    const afterClear = await SoapService.updateSoapNote(
      created.id,
      {
        subjective: {
          painNrsScore: null,
        },
        objective: {
          flowsheet: null,
          clinicalObservations: null,
        },
        plan: {
          homeInstructions: null,
        },
      },
      dek,
      db,
      created.updatedAt
    );

    expect(afterClear.data.subjective.painNrsScore).toBeUndefined();
    expect(afterClear.data.objective.flowsheet).toBeUndefined();
    expect(afterClear.data.objective.clinicalObservations).toBeUndefined();
    expect(afterClear.data.plan.homeInstructions).toBeUndefined();
  });

  it('blocks SoapService.updateSoapNote and SessionService.updateSession even on half-finalized records, and repairs them idempotently', async () => {
    const { db, dek, patientId, episodeId } = await bootstrapTestVaultAndEpisode();

    const session = await SessionService.createSession(
      patientId,
      episodeId,
      {
        sessionDate: '2026-04-05',
        sessionType: 'follow_up',
        attendanceStatus: 'attended',
      },
      dek,
      'sess-half',
      db
    );

    const soap = await SoapService.createSoapNote(
      patientId,
      episodeId,
      session.id,
      {
        isFinalized: false,
        subjective: {
          chiefComplaint: 'Shoulder ache',
          painNrsScore: 4,
        },
        objective: {
          objectiveFindings: 'Mild guarding at 120 deg flexion',
        },
        assessment: {
          clinicalImpressionCurrent: 'Improving capsular mobility',
          progressStatus: 'improved',
          patientTolerance: 'well_tolerated',
        },
        plan: {
          nextSessionPlan: 'Progress ER',
        },
      },
      dek,
      'soap-half',
      db
    );

    const halfFinalizedSessionPayload = {
      ...session.data,
      status: 'finalized' as const,
      finalizedAt: '2026-04-05T11:00:00.000Z',
      finalizedBy: 'Dr. Noor',
    };
    const { iv: sessIv, ciphertext: sessCipher } = await encryptRecordWithMandatoryReservation(
      db,
      dek,
      'sessions',
      session.id,
      [patientId, episodeId],
      halfFinalizedSessionPayload
    );
    await db.sessions.put({
      id: session.id,
      episodeId,
      patientId,
      createdAt: session.createdAt,
      updatedAt: '2026-04-05T11:00:00.000Z',
      recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
      dekVersion: CURRENT_DEK_VERSION,
      iv: sessIv,
      ciphertext: sessCipher,
    });

    await expect(
      SoapService.updateSoapNote(
        soap.id,
        {
          subjective: { ...soap.data.subjective, painNrsScore: 9 },
        },
        dek,
        db
      )
    ).rejects.toThrow(/لا يمكن تعديل ملاحظة SOAP التابعة لجلسة سريرية معتمدة/);

    const firstRepair = await SessionService.repairHalfFinalizedSessions(dek, db);
    expect(firstRepair.repairedCount).toBe(1);
    expect(firstRepair.skippedCount).toBe(0);
    expect(firstRepair.repairedSessionIds).toEqual([session.id]);

    const repairedSoap = await SoapService.getSoapNoteBySession(session.id, dek, db);
    expect(repairedSoap?.data.isFinalized).toBe(true);
    expect(repairedSoap?.data.finalizedBy).toBe('Dr. Noor');
    expect(repairedSoap?.data.finalizedAt).toBe('2026-04-05T11:00:00.000Z');
    expect(repairedSoap?.data.repairedDuringMigration).toBe(true);
    expect(repairedSoap?.data.legacyUnreviewed).toBe(true);
    expect(repairedSoap?.data.repairedAt).toBeTruthy();
    // Finding 3c & Item 4: Pre-1A-i.5 notes may contain auto-generated values — do NOT silently seal them ('unsealed')
    expect(repairedSoap?.data.contentDigestSha256).toBeUndefined();
    expect(repairedSoap?.data.sealVersion).toBeUndefined();
    expect((await verifySoapSeal(repairedSoap!.data)).status).toBe('unsealed');

    // Clean run recorded completion flag in migrationState so subsequent unlock does not re-decrypt all sessions
    const repairState = await db.migrationState.get(HALF_FINALIZED_REPAIR_STATE_ID);
    expect(repairState?.status).toBe('completed');
    expect(repairState?.repairedSoapNotesCount).toBe(1);

    const secondRepair = await SessionService.repairHalfFinalizedSessions(dek, db);
    expect(secondRepair.repairedCount).toBe(0);
    expect(secondRepair.skippedCount).toBe(0);
    expect(secondRepair.alreadyCompleted).toBe(true);
    expect(secondRepair.repairedSessionIds).toEqual([]);
  });

  it('rejects check-then-put / delete races when a finalizeSession lands between read/encrypt and write (Finding 1)', async () => {
    const { db, dek, patientId, episodeId } = await bootstrapTestVaultAndEpisode();

    async function createDraftSessionWithCompleteSoap(suffix: string) {
      const s = await SessionService.createSession(
        patientId,
        episodeId,
        {
          sessionDate: '2026-04-18',
          sessionType: 'follow_up',
          attendanceStatus: 'attended',
        },
        dek,
        `sess-race-${suffix}`,
        db
      );
      const n = await SoapService.createSoapNote(
        patientId,
        episodeId,
        s.id,
        {
          isFinalized: false,
          subjective: {
            chiefComplaint: 'Pre-finalize draft',
            painNrsScore: 5,
            postSessionPainNrs: 3,
          },
          objective: {
            dailyInterventionsSummary: 'Lumbar stabilization exercises',
          },
          assessment: {
            clinicalImpressionCurrent: 'Good core activation',
            progressStatus: 'improved',
          },
          plan: {
            nextSessionPlan: 'Progress planks',
          },
        },
        dek,
        `soap-race-${suffix}`,
        db
      );
      return { session: s, soap: n };
    }

    try {
      // 1. SessionService.updateSession race with concurrent finalizeSession
      const pair1 = await createDraftSessionWithCompleteSoap('update-sess');
      setSessionMutationTestHook(async (op, ctx) => {
        if (op === 'updateSession' && ctx.sessionId === pair1.session.id) {
          setSessionMutationTestHook(null);
          await SessionService.finalizeSession(pair1.session.id, 'Dr. Concurrent', dek, db);
        }
      });
      await expect(
        SessionService.updateSession(
          pair1.session.id,
          { administrativeNotes: 'Late draft edit that must not un-finalize' },
          dek,
          db
        )
      ).rejects.toThrow(StaleTabOverwriteError);
      const after1 = (await SessionService.getSessionById(pair1.session.id, dek, db))!;
      expect(after1.status).toBe('finalized');

      // 2. SessionService.cancelSession race with concurrent finalizeSession
      const pair2 = await createDraftSessionWithCompleteSoap('cancel-sess');
      setSessionMutationTestHook(async (op, ctx) => {
        if (op === 'cancelSession' && ctx.sessionId === pair2.session.id) {
          setSessionMutationTestHook(null);
          await SessionService.finalizeSession(pair2.session.id, 'Dr. Concurrent', dek, db);
        }
      });
      await expect(
        SessionService.cancelSession(
          pair2.session.id,
          'Patient left early',
          'cancelled_patient',
          dek,
          db
        )
      ).rejects.toThrow(StaleTabOverwriteError);
      const after2 = (await SessionService.getSessionById(pair2.session.id, dek, db))!;
      expect(after2.status).toBe('finalized');

      // 3. SessionService.deleteSession race with concurrent finalizeSession
      const pair3 = await createDraftSessionWithCompleteSoap('delete-sess');
      setSessionMutationTestHook(async (op, ctx) => {
        if (op === 'deleteSession' && ctx.sessionId === pair3.session.id) {
          setSessionMutationTestHook(null);
          await SessionService.finalizeSession(pair3.session.id, 'Dr. Concurrent', dek, db);
        }
      });
      await expect(
        SessionService.deleteSession(pair3.session.id, dek, db)
      ).rejects.toThrow(StaleTabOverwriteError);
      const after3 = await SessionService.getSessionById(pair3.session.id, dek, db);
      expect(after3).not.toBeNull();
      expect(after3?.status).toBe('finalized');

      // 4. SoapService.updateSoapNote race with concurrent finalizeSession
      const pair4 = await createDraftSessionWithCompleteSoap('update-soap');
      setSoapMutationTestHook(async (op, ctx) => {
        if (op === 'updateSoapNote' && ctx.soapId === pair4.soap.id) {
          setSoapMutationTestHook(null);
          await SessionService.finalizeSession(pair4.session.id, 'Dr. Concurrent', dek, db);
        }
      });
      await expect(
        SoapService.updateSoapNote(
          pair4.soap.id,
          { subjective: { chiefComplaint: 'Overwrite attempt after finalize' } },
          dek,
          db
        )
      ).rejects.toThrow(StaleTabOverwriteError);
      const after4 = (await SoapService.getSoapNoteBySession(pair4.session.id, dek, db))!;
      expect(after4.data.isFinalized).toBe(true);
      expect(after4.data.subjective.chiefComplaint).toBe('Pre-finalize draft');

      // 5. SoapService.deleteSoapNote race with concurrent finalizeSession
      const pair5 = await createDraftSessionWithCompleteSoap('delete-soap');
      setSoapMutationTestHook(async (op, ctx) => {
        if (op === 'deleteSoapNote' && ctx.soapId === pair5.soap.id) {
          setSoapMutationTestHook(null);
          await SessionService.finalizeSession(pair5.session.id, 'Dr. Concurrent', dek, db);
        }
      });
      await expect(
        SoapService.deleteSoapNote(pair5.soap.id, dek, db)
      ).rejects.toThrow(StaleTabOverwriteError);
      const after5 = await SoapService.getSoapNoteBySession(pair5.session.id, dek, db);
      expect(after5).not.toBeNull();
      expect(after5?.data.isFinalized).toBe(true);
    } finally {
      setSessionMutationTestHook(null);
      setSoapMutationTestHook(null);
    }
  });

  it('verifies canonical session & SOAP integrity seals and detects single-field tampering (Finding 2)', async () => {
    const { db, dek, patientId, episodeId } = await bootstrapTestVaultAndEpisode();

    // Canonical serializer is independent of key insertion order
    const canonicalA = canonicalizeForSeal({ b: 2, a: { y: 'yes', x: 'no' } });
    const canonicalB = canonicalizeForSeal({ a: { x: 'no', y: 'yes' }, b: 2 });
    expect(canonicalA).toBe(canonicalB);

    const session = await SessionService.createSession(
      patientId,
      episodeId,
      {
        sessionDate: '2026-04-19',
        sessionType: 'follow_up',
        attendanceStatus: 'attended',
      },
      dek,
      'sess-seal',
      db
    );

    await SoapService.createSoapNote(
      patientId,
      episodeId,
      session.id,
      {
        isFinalized: false,
        subjective: {
          chiefComplaint: 'Ankle stability improving',
          painNrsScore: 3,
          postSessionPainNrs: 1,
        },
        objective: {
          dailyInterventionsSummary: 'Single-leg balance on foam pad 3x45s',
        },
        assessment: {
          clinicalImpressionCurrent: 'Ready for dynamic hop progression',
          progressStatus: 'improved',
          patientTolerance: 'well_tolerated',
        },
        plan: {
          nextSessionPlan: 'Lateral hops',
        },
      },
      dek,
      'soap-seal',
      db
    );

    const finalizedSession = await SessionService.finalizeSession(
      session.id,
      'Dr. Karar',
      dek,
      db
    );
    const finalizedSoap = (await SoapService.getSoapNoteBySession(session.id, dek, db))!;

    // Untampered finalized records have sealVersion === 1 and return status: 'valid'
    expect(finalizedSoap.data.sealVersion).toBe(CURRENT_SEAL_VERSION);
    expect(finalizedSession.data.sealVersion).toBe(CURRENT_SEAL_VERSION);

    const validSoapCheck = await verifySoapSeal(finalizedSoap.data);
    expect(validSoapCheck.status).toBe('valid');

    const validSessionCheck = await verifySessionSeal(
      finalizedSession.data,
      finalizedSoap.data
    );
    expect(validSessionCheck.status).toBe('valid');

    // Legacy finalized records without sealVersion (e.g. finalized before canonical seal v1) return 'unsealed', NEVER 'mismatch'
    const legacyFinalizedSoapWithoutVersion: SoapNoteData = {
      ...finalizedSoap.data,
      sealVersion: undefined,
      contentDigestSha256: 'non-canonical-legacy-digest-hex',
    };
    expect((await verifySoapSeal(legacyFinalizedSoapWithoutVersion)).status).toBe('unsealed');
    expect(
      (await verifySessionSeal(finalizedSession.data, legacyFinalizedSoapWithoutVersion)).status
    ).toBe('unsealed');

    const legacyFinalizedSessionWithoutVersion = {
      ...finalizedSession.data,
      sealVersion: undefined,
      contentIntegrityDigestSha256: 'non-canonical-legacy-session-digest',
    };
    expect(
      (await verifySessionSeal(legacyFinalizedSessionWithoutVersion, finalizedSoap.data)).status
    ).toBe('unsealed');

    // Tamper 1 field in SOAP note (e.g. postSessionPainNrs 1 -> 0) -> both verifySoapSeal and verifySessionSeal return 'mismatch'
    const tamperedSoap: SoapNoteData = {
      ...finalizedSoap.data,
      subjective: {
        ...finalizedSoap.data.subjective,
        postSessionPainNrs: 0,
      },
    };
    expect((await verifySoapSeal(tamperedSoap)).status).toBe('mismatch');
    expect((await verifySessionSeal(finalizedSession.data, tamperedSoap)).status).toBe('mismatch');

    // Tamper 1 field in SessionClinicalData (e.g. finalizedBy) -> verifySessionSeal returns 'mismatch'
    const tamperedSession = {
      ...finalizedSession.data,
      finalizedBy: 'Dr. Attacker',
    };
    expect((await verifySessionSeal(tamperedSession, finalizedSoap.data)).status).toBe('mismatch');
  });

  it('preserves legacy pain sub-fields (scoreAtRest, scoreWithMovement, 24h best/worst, contextNotes) in legacyPainDetail across loads and saves (Finding 4)', async () => {
    const { db, dek, patientId, episodeId } = await bootstrapTestVaultAndEpisode();

    const session = await SessionService.createSession(
      patientId,
      episodeId,
      {
        sessionDate: '2026-04-02',
        sessionType: 'initial_evaluation',
        attendanceStatus: 'attended',
      },
      dek,
      'sess-legacy-pain-detail',
      db
    );

    const legacyV1WithSubfields: SoapNoteData = {
      isFinalized: false,
      subjective: {
        chiefComplaint: 'Deep anterior knee pain',
        painAssessment: {
          scale: 'NRS_0_10',
          score: 6,
          range: '0-10',
          unit: 'points',
          assessedAt: '2026-04-02',
          scoreAtRest: 2,
          scoreWithMovement: 7,
          scoreBestLast24h: 1,
          scoreWorstLast24h: 8,
          contextNotes: 'Aggravated by descending stairs',
        },
      },
      objective: {
        objectiveFindings: 'Patellar tap negative',
      },
      assessment: {
        clinicalImpressionCurrent: 'Patellofemoral pain syndrome',
        progressStatus: 'improved',
      },
      plan: {},
    };

    const { iv, ciphertext } = await encryptRecordWithMandatoryReservation(
      db,
      dek,
      'soapNotes',
      'soap-legacy-detail',
      [patientId, episodeId, session.id],
      legacyV1WithSubfields
    );
    await db.soapNotes.put({
      id: 'soap-legacy-detail',
      sessionId: session.id,
      episodeId,
      patientId,
      createdAt: '2026-04-02T09:00:00.000Z',
      updatedAt: '2026-04-02T09:00:00.000Z',
      recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
      dekVersion: CURRENT_DEK_VERSION,
      iv,
      ciphertext,
    });

    // 1. Load legacy draft -> legacyPainDetail is populated
    const loaded = (await SoapService.getSoapNoteBySession(session.id, dek, db))!;
    expect(loaded.data.subjective.painNrsScore).toBe(6);
    expect(loaded.data.subjective.legacyPainDetail).toEqual({
      scoreAtRest: 2,
      scoreWithMovement: 7,
      scoreBestLast24h: 1,
      scoreWorstLast24h: 8,
      contextNotes: 'Aggravated by descending stairs',
      assessedAt: '2026-04-02',
    });

    // 2. Save via TreatmentSessionView's buildSoapPayloadFromFormState + SoapService.updateSoapNote
    const formState = createUntouchedDraftFormState();
    formState.prePainNrs = 5;
    formState.postPainNrs = 3;
    formState.legacyPainDetail = loaded.data.subjective.legacyPainDetail;
    formState.chiefComplaint = 'Deep anterior knee pain (updated)';
    formState.interventionsSummary = 'Isometric quad sets';
    formState.clinicalImpression = 'Patellofemoral pain syndrome';
    formState.progressStatus = 'improved';

    const v2Payload = buildSoapPayloadFromFormState(formState, loaded);
    await SoapService.updateSoapNote(loaded.id, v2Payload, dek, db, loaded.updatedAt);

    // 3. Reload from DB and confirm legacyPainDetail was preserved while painAssessment was removed
    const reloaded = (await SoapService.getSoapNoteBySession(session.id, dek, db))!;
    expect(reloaded.data.soapSchemaVersion).toBe(CURRENT_SOAP_SCHEMA_VERSION);
    expect(reloaded.data.subjective.painNrsScore).toBe(5);
    expect(reloaded.data.subjective.postSessionPainNrs).toBe(3);
    expect(reloaded.data.subjective.painAssessment).toBeUndefined();
    expect(reloaded.data.subjective.legacyPainDetail).toEqual({
      scoreAtRest: 2,
      scoreWithMovement: 7,
      scoreBestLast24h: 1,
      scoreWorstLast24h: 8,
      contextNotes: 'Aggravated by descending stairs',
      assessedAt: '2026-04-02',
    });
  });

  it('commits valid notes and skips stale ones without rolling back the batch in repairHalfFinalizedSessions (Item 2 Addendum)', async () => {
    const { db, dek, patientId, episodeId } = await bootstrapTestVaultAndEpisode();

    async function makeHalfFinalizedPair(suffix: string) {
      const s = await SessionService.createSession(
        patientId,
        episodeId,
        {
          sessionDate: '2026-04-20',
          sessionType: 'follow_up',
          attendanceStatus: 'attended',
        },
        dek,
        `sess-partial-${suffix}`,
        db
      );
      const n = await SoapService.createSoapNote(
        patientId,
        episodeId,
        s.id,
        {
          isFinalized: false,
          subjective: { chiefComplaint: `Note ${suffix}`, painNrsScore: 4 },
          objective: { objectiveFindings: 'Guarding' },
          assessment: { clinicalImpressionCurrent: 'Stable', progressStatus: 'improved' },
          plan: {},
        },
        dek,
        `soap-partial-${suffix}`,
        db
      );
      const finalizedSessionPayload = {
        ...s.data,
        status: 'finalized' as const,
        finalizedAt: '2026-04-20T12:00:00.000Z',
        finalizedBy: 'Dr. Sara',
      };
      const { iv, ciphertext } = await encryptRecordWithMandatoryReservation(
        db,
        dek,
        'sessions',
        s.id,
        [patientId, episodeId],
        finalizedSessionPayload
      );
      await db.sessions.put({
        id: s.id,
        episodeId,
        patientId,
        createdAt: s.createdAt,
        updatedAt: '2026-04-20T12:00:00.000Z',
        recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
        dekVersion: CURRENT_DEK_VERSION,
        iv,
        ciphertext,
      });
      return { session: s, soap: n };
    }

    const pairValid = await makeHalfFinalizedPair('valid');
    const pairStale = await makeHalfFinalizedPair('stale');

    // Simulate concurrent tab modifying pairStale's SOAP note right as the repair transaction opens
    const originalTx = db.transaction.bind(db);
    let injectedStaleChange = false;
    db.transaction = (async (mode: 'rw', tables: unknown, scope: () => Promise<unknown>) => {
      if (!injectedStaleChange && Array.isArray(tables) && tables.length === 3) {
        injectedStaleChange = true;
        await db.soapNotes.update(pairStale.soap.id, {
          updatedAt: '2026-04-20T12:05:00.000Z',
        });
      }
      return (
        originalTx as (mode: 'rw', tables: unknown, scope: () => Promise<unknown>) => Promise<unknown>
      )(mode, tables, scope);
    }) as typeof db.transaction;

    const firstRun = await SessionService.repairHalfFinalizedSessions(dek, db);
    expect(firstRun.repairedCount).toBe(1);
    expect(firstRun.skippedCount).toBe(1);
    expect(firstRun.repairedSessionIds).toEqual([pairValid.session.id]);
    expect(firstRun.skippedSessionIds).toEqual([pairStale.session.id]);

    // Valid note WAS committed despite the stale note in the same batch!
    const validAfterFirst = await SoapService.getSoapNoteBySession(pairValid.session.id, dek, db);
    expect(validAfterFirst?.data.isFinalized).toBe(true);
    const staleAfterFirst = await SoapService.getSoapNoteBySession(pairStale.session.id, dek, db);
    expect(staleAfterFirst?.data.isFinalized).toBe(false);

    // Because 1 note was skipped, migrationState status is 'pending' (NOT 'completed')
    const stateAfterFirst = await db.migrationState.get(HALF_FINALIZED_REPAIR_STATE_ID);
    expect(stateAfterFirst?.status).toBe('pending');

    // Next unlock run repairs the remaining skipped note and transitions migrationState to 'completed'
    const secondRun = await SessionService.repairHalfFinalizedSessions(dek, db);
    expect(secondRun.repairedCount).toBe(1);
    expect(secondRun.skippedCount).toBe(0);
    expect(secondRun.repairedSessionIds).toEqual([pairStale.session.id]);

    const staleAfterSecond = await SoapService.getSoapNoteBySession(pairStale.session.id, dek, db);
    expect(staleAfterSecond?.data.isFinalized).toBe(true);

    const stateAfterSecond = await db.migrationState.get(HALF_FINALIZED_REPAIR_STATE_ID);
    expect(stateAfterSecond?.status).toBe('completed');
    expect(stateAfterSecond?.repairedSoapNotesCount).toBe(2);
  });

  it('requires explicit legacyDraftReviewed confirmation before Sign & Lock on legacy v1 draft SOAP notes (Item 3)', () => {
    const state = createUntouchedDraftFormState();
    state.prePainNrs = 5;
    state.postPainNrs = 3;
    state.interventionsSummary = 'Cervical retraction exercises';
    state.clinicalImpression = 'Improving radicular symptoms';
    state.progressStatus = 'improved';

    // Standard v2 draft passes without legacyDraftReviewed
    const v2Check = validateSignAndLockState(state, false);
    expect(v2Check.valid).toBe(true);

    // Legacy v1 draft fails until legacyDraftReviewed is ticked
    const legacyUnchecked = validateSignAndLockState(state, true);
    expect(legacyUnchecked.valid).toBe(false);
    expect(legacyUnchecked.missingEn).toContain(
      'Explicit confirmation that this legacy draft was reviewed ("I reviewed this")'
    );

    state.legacyDraftReviewed = true;
    const legacyChecked = validateSignAndLockState(state, true);
    expect(legacyChecked.valid).toBe(true);
  });

  it('covers all v5 patient-linked tables in auditPatientDependentRecords, deleteEpisodeCascade, and deletePatientPermanently (Item 1)', async () => {
    const { db, dek, patientId, episodeId } = await bootstrapTestVaultAndEpisode();

    // Create a second episode so we can test deleteEpisodeCascade on episode 1 and deletePatientPermanently on the patient
    const episode2 = await EpisodeService.createEpisode(
      patientId,
      {
        title: 'Right Ankle Sprain',
        primarySpecialty: 'sports',
        medicalDiagnosis: 'Grade II ATFL Sprain',
        clinicalImpression: 'Lateral ankle instability',
        affectedBodyRegion: 'Right Ankle',
        rehabilitationGoals: { shortTerm: ['Reduce swelling'], longTerm: ['Return to sport'] },
      },
      dek,
      'ep-test-2',
      db
    );

    const s1 = await SessionService.createSession(
      patientId,
      episodeId,
      { sessionDate: '2026-04-21', sessionType: 'follow_up', attendanceStatus: 'attended' },
      dek,
      'sess-ep1',
      db
    );
    await SoapService.createSoapNote(
      patientId,
      episodeId,
      s1.id,
      {
        isFinalized: false,
        subjective: { chiefComplaint: 'Ep1 note' },
        objective: {},
        assessment: {},
        plan: {},
      },
      dek,
      'soap-ep1',
      db
    );

    const s2 = await SessionService.createSession(
      patientId,
      episode2.id,
      { sessionDate: '2026-04-22', sessionType: 'follow_up', attendanceStatus: 'attended' },
      dek,
      'sess-ep2',
      db
    );
    await SoapService.createSoapNote(
      patientId,
      episode2.id,
      s2.id,
      {
        isFinalized: false,
        subjective: { chiefComplaint: 'Ep2 note' },
        objective: {},
        assessment: {},
        plan: {},
      },
      dek,
      'soap-ep2',
      db
    );

    const dummyIv = randomBytes(12);
    const dummyCipher = randomBytes(32);
    const now = '2026-04-22T10:00:00.000Z';

    // Populate v5 tables for this patient
    await db.appointments.put({
      id: 'appt-1',
      patientId,
      createdAt: now,
      updatedAt: now,
      recordCryptoVersion: 1,
      dekVersion: 1,
      iv: dummyIv,
      ciphertext: dummyCipher,
    });
    await db.waitingList.put({
      id: 'wait-1',
      patientId,
      createdAt: now,
      updatedAt: now,
      recordCryptoVersion: 1,
      dekVersion: 1,
      iv: dummyIv,
      ciphertext: dummyCipher,
    });
    await db.invoices.put({
      id: 'inv-ep1',
      patientId,
      episodeId,
      createdAt: now,
      updatedAt: now,
      recordCryptoVersion: 1,
      dekVersion: 1,
      iv: dummyIv,
      ciphertext: dummyCipher,
    });
    await db.invoices.put({
      id: 'inv-ep2',
      patientId,
      episodeId: episode2.id,
      createdAt: now,
      updatedAt: now,
      recordCryptoVersion: 1,
      dekVersion: 1,
      iv: dummyIv,
      ciphertext: dummyCipher,
    });
    await db.payments.put({
      id: 'pay-ep1',
      invoiceId: 'inv-ep1',
      patientId,
      createdAt: now,
      updatedAt: now,
      recordCryptoVersion: 1,
      dekVersion: 1,
      iv: dummyIv,
      ciphertext: dummyCipher,
    });
    await db.payments.put({
      id: 'pay-ep2',
      invoiceId: 'inv-ep2',
      patientId,
      createdAt: now,
      updatedAt: now,
      recordCryptoVersion: 1,
      dekVersion: 1,
      iv: dummyIv,
      ciphertext: dummyCipher,
    });
    await db.episodeClinical.put({
      id: episodeId,
      episodeId,
      patientId,
      createdAt: now,
      updatedAt: now,
      recordCryptoVersion: 1,
      dekVersion: 1,
      iv: dummyIv,
      ciphertext: dummyCipher,
    });
    await db.episodeClinical.put({
      id: episode2.id,
      episodeId: episode2.id,
      patientId,
      createdAt: now,
      updatedAt: now,
      recordCryptoVersion: 1,
      dekVersion: 1,
      iv: dummyIv,
      ciphertext: dummyCipher,
    });

    // 1. Audit dependent records across all v5 tables
    const auditBefore = await db.auditPatientDependentRecords(patientId);
    expect(auditBefore).toEqual({
      patientId,
      episodesCount: 2,
      sessionsCount: 2,
      soapNotesCount: 2,
      clinicalAddendaCount: 0,
      appointmentsCount: 1,
      waitingListCount: 1,
      invoicesCount: 2,
      paymentsCount: 2,
      episodeClinicalCount: 2,
    });

    // 2. Cascade delete episode 1 -> cleans up episode1's sessions, soapNotes, episodeSequences, episodeClinical, invoices, and payments
    await db.deleteEpisodeCascade(episodeId);
    expect(await db.episodes.get(episodeId)).toBeUndefined();
    expect(await db.sessions.where('episodeId').equals(episodeId).count()).toBe(0);
    expect(await db.soapNotes.where('episodeId').equals(episodeId).count()).toBe(0);
    expect(await db.episodeSequences.get(episodeId)).toBeUndefined();
    expect(await db.episodeClinical.where('episodeId').equals(episodeId).count()).toBe(0);
    expect(await db.invoices.get('inv-ep1')).toBeUndefined();
    expect(await db.payments.get('pay-ep1')).toBeUndefined();

    // 3. Delete patient permanently -> zero patient-linked rows survive in any v5 table
    await db.deletePatientPermanently(patientId, {
      verifiedBackupString: '{"header":{"magic":"PHYSIORECORD_BACKUP_V1.1"}}',
      bypassForTest: true,
    });

    const auditAfter = await db.auditPatientDependentRecords(patientId);
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
    expect(await db.patients.get(patientId)).toBeUndefined();
    expect(await db.episodeSequences.get(episode2.id)).toBeUndefined();
  });

  it('enforces append-only snapshots in ClinicOperationsService.saveEpisodeClinicalStore and freezes legacy SoapModal ROM/MMT/BodyChart writes by default (Amendment D)', () => {
    expect(ENABLE_LEGACY_SOAP_MODAL_ROM_MMT_BODYCHART_WRITES).toBe(false);

    const storageMap = new Map<string, string>();
    const prevLocalStorage = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (k: string) => storageMap.get(k) ?? null,
        setItem: (k: string, v: string) => storageMap.set(k, v),
        removeItem: (k: string) => storageMap.delete(k),
      },
      configurable: true,
      writable: true,
    });

    try {
      const epId = 'ep-append-only-snap';
      const ptId = 'pt-append-only-snap';
      const snap1 = ClinicOperationsService.recordEpisodeSnapshot(
        epId,
        ptId,
        'initial_evaluation',
        'تقييم أولي',
        'Initial Baseline'
      );
      const snap2 = ClinicOperationsService.recordEpisodeSnapshot(
        epId,
        ptId,
        're_evaluation',
        'إعادة تقييم 1',
        'Re-eval 1'
      );

      const loaded = ClinicOperationsService.getEpisodeClinicalStore(epId, ptId);
      expect(loaded.snapshots).toHaveLength(2);

      // 1. Deleting an existing snapshot must throw
      expect(() =>
        ClinicOperationsService.saveEpisodeClinicalStore({
          ...loaded,
          snapshots: [snap1],
        })
      ).toThrow(/Append-only Snapshots/);

      // 2. Mutating an existing snapshot must throw
      expect(() =>
        ClinicOperationsService.saveEpisodeClinicalStore({
          ...loaded,
          snapshots: [
            { ...snap1, labelEn: 'Tampered Baseline Label' },
            snap2,
          ],
        })
      ).toThrow(/Append-only Snapshots/);

      // 3. Reordering existing snapshots must throw
      expect(() =>
        ClinicOperationsService.saveEpisodeClinicalStore({
          ...loaded,
          snapshots: [snap2, snap1],
        })
      ).toThrow(/Append-only Snapshots/);

      // 4. Appending a new snapshot while keeping existing snapshots intact succeeds
      const snap3 = ClinicOperationsService.recordEpisodeSnapshot(
        epId,
        ptId,
        'discharge',
        'تقييم التخريج',
        'Discharge'
      );
      const afterAppend = ClinicOperationsService.getEpisodeClinicalStore(epId, ptId);
      expect(afterAppend.snapshots.map((s) => s.id)).toEqual([snap1.id, snap2.id, snap3.id]);
    } finally {
      Object.defineProperty(globalThis, 'localStorage', {
        value: prevLocalStorage,
        configurable: true,
        writable: true,
      });
    }
  });

  it('persists legacyUnreviewed across autosave + reload, rejects service-level finalize without legacyReviewConfirmed, requires post-pain on legacy notes, and stores + seals legacyReviewedAt/By when confirmed (Findings 1 & 4)', async () => {
    const { db, dek, patientId, episodeId } = await bootstrapTestVaultAndEpisode();

    const session = await SessionService.createSession(
      patientId,
      episodeId,
      {
        sessionDate: '2026-04-23',
        sessionType: 'follow_up',
        attendanceStatus: 'attended',
      },
      dek,
      'sess-legacy-autosave-gate',
      db
    );

    // 1. Store a legacy v1 draft note (schemaVersion < 2, no post-session pain yet)
    const legacyV1Draft: SoapNoteData = {
      isFinalized: false,
      subjective: {
        chiefComplaint: 'Auto-generated legacy complaint',
        painNrsScore: 5,
      },
      objective: {
        dailyInterventionsSummary: 'Auto-generated legacy interventions',
      },
      assessment: {
        clinicalImpressionCurrent: 'Auto-generated legacy impression',
        progressStatus: 'improved',
      },
      plan: {
        nextSessionPlan: 'Continue plan',
      },
    };

    const { iv, ciphertext } = await encryptRecordWithMandatoryReservation(
      db,
      dek,
      'soapNotes',
      'soap-legacy-autosave-gate',
      [patientId, episodeId, session.id],
      legacyV1Draft
    );
    await db.soapNotes.put({
      id: 'soap-legacy-autosave-gate',
      sessionId: session.id,
      episodeId,
      patientId,
      createdAt: '2026-04-23T09:00:00.000Z',
      updatedAt: '2026-04-23T09:00:00.000Z',
      recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
      dekVersion: CURRENT_DEK_VERSION,
      iv,
      ciphertext,
    });

    // Finding 4 check: Even before saving as v2 (while soapSchemaVersion === 1), finalizeSession MUST reject missing post-session pain
    await expect(
      SessionService.finalizeSession(
        session.id,
        'Dr. Reviewer',
        dek,
        db,
        undefined,
        undefined,
        true
      )
    ).rejects.toThrow(/شدة الألم بعد الجلسة/);

    // 2. Load the legacy v1 draft -> decryptSoapEntity normalizes legacyUnreviewed: true
    const loadedV1 = (await SoapService.getSoapNoteBySession(session.id, dek, db))!;
    expect(loadedV1.data.soapSchemaVersion).toBe(1);
    expect(loadedV1.data.legacyUnreviewed).toBe(true);

    // 3. Edit the legacy draft in TreatmentSessionView and trigger an autosave (which stamps soapSchemaVersion = CURRENT_SOAP_SCHEMA_VERSION = 2)
    const formState = createUntouchedDraftFormState();
    formState.chiefComplaint = 'Edited complaint before review confirmation';
    formState.prePainNrs = 5;
    formState.postPainNrs = 3;
    formState.interventionsSummary = 'Manual therapy and core stabilization';
    formState.clinicalImpression = 'Clinician updated impression';
    formState.progressStatus = 'improved';

    const autosavePayload = buildSoapPayloadFromFormState(formState, loadedV1);
    expect(autosavePayload.soapSchemaVersion).toBe(CURRENT_SOAP_SCHEMA_VERSION);
    expect(autosavePayload.legacyUnreviewed).toBe(true);

    const afterAutosave = await SoapService.updateSoapNote(
      loadedV1.id,
      autosavePayload,
      dek,
      db,
      loadedV1.updatedAt
    );
    expect(afterAutosave.data.soapSchemaVersion).toBe(CURRENT_SOAP_SCHEMA_VERSION);
    expect(afterAutosave.data.legacyUnreviewed).toBe(true);

    // 4. Reload from DB and perform a SECOND autosave -> legacyUnreviewed is still true and gate is still enforced!
    const reloadedAfterFirstAutosave = (await SoapService.getSoapNoteBySession(
      session.id,
      dek,
      db
    ))!;
    expect(reloadedAfterFirstAutosave.data.soapSchemaVersion).toBe(CURRENT_SOAP_SCHEMA_VERSION);
    expect(reloadedAfterFirstAutosave.data.legacyUnreviewed).toBe(true);

    // Gate derived from Boolean(reloaded.data.legacyUnreviewed) blocks UI Sign & Lock when legacyDraftReviewed is false
    const gateCheck = validateSignAndLockState(
      formState,
      Boolean(reloadedAfterFirstAutosave.data.legacyUnreviewed)
    );
    expect(gateCheck.valid).toBe(false);

    // Second autosave via SoapService.updateSoapNote directly (even if caller omits legacyUnreviewed in update input) preserves legacyUnreviewed: true
    const afterSecondAutosave = await SoapService.updateSoapNote(
      reloadedAfterFirstAutosave.id,
      {
        subjective: {
          ...reloadedAfterFirstAutosave.data.subjective,
          chiefComplaint: 'Second autosave edit',
        },
      },
      dek,
      db,
      reloadedAfterFirstAutosave.updatedAt
    );
    expect(afterSecondAutosave.data.legacyUnreviewed).toBe(true);

    // 5. Service-level enforcement: SessionService.finalizeSession without legacyReviewConfirmed is rejected!
    await expect(
      SessionService.finalizeSession(session.id, 'Dr. Reviewer', dek, db)
    ).rejects.toThrow(/legacyReviewConfirmed is required/);

    // 6. Service-level finalize WITH legacyReviewConfirmed = true succeeds, clears legacyUnreviewed, and stores + seals legacyReviewedAt & legacyReviewedBy
    const finalizedSession = await SessionService.finalizeSession(
      session.id,
      'Dr. Reviewer',
      dek,
      db,
      undefined,
      undefined,
      true
    );
    const finalizedSoap = (await SoapService.getSoapNoteBySession(session.id, dek, db))!;
    expect(finalizedSoap.data.isFinalized).toBe(true);
    expect(finalizedSoap.data.legacyUnreviewed).toBe(false);
    expect(finalizedSoap.data.legacyReviewedBy).toBe('Dr. Reviewer');
    expect(finalizedSoap.data.legacyReviewedAt).toBe(finalizedSession.data.finalizedAt);

    // Verify both cryptographic seals are valid and cover legacyReviewedAt / legacyReviewedBy
    expect((await verifySoapSeal(finalizedSoap.data)).status).toBe('valid');
    expect((await verifySessionSeal(finalizedSession.data, finalizedSoap.data)).status).toBe(
      'valid'
    );

    const tamperedReviewedBy: SoapNoteData = {
      ...finalizedSoap.data,
      legacyReviewedBy: 'Dr. Forged Reviewer',
    };
    expect((await verifySoapSeal(tamperedReviewedBy)).status).toBe('mismatch');
    expect((await verifySessionSeal(finalizedSession.data, tamperedReviewedBy)).status).toBe(
      'mismatch'
    );
  });

  it('resets half_finalized_soap_repair_v1 on full .ptbackup restore so a restored half-finalized session is repaired on unlock (Finding 2)', async () => {
    // 1. Build a source vault containing a v1.1 half-finalized session and export a .ptbackup package
    const sourceDb = createInMemoryDatabase(5);
    const salt = randomBytes(CONSTANTS.SALT_BYTES);
    const fastIter = 1000;
    const sourceKek = await deriveKEK('SourcePass1!', salt, fastIter);
    const { operationalDek: sourceDek, wrappedDek, wrappedDekIv } =
      await generateAndWrapOperationalDEK(sourceKek, 1);
    const { verifierIv, verifierCiphertext } = await generateVerifier(sourceKek);

    await sourceDb.vaultMeta.put({
      id: 'auth',
      salt,
      wrappedDek,
      wrappedDekIv,
      verifierIv,
      verifierCiphertext,
      schemaVersion: 5,
      kdfAlgorithm: 'PBKDF2-HMAC-SHA256',
      kdfIterations: fastIter,
      dekVersion: CURRENT_DEK_VERSION,
      encryptionInvocationCount: 0,
      vaultGeneration: 1,
    });

    const pEnc = await encryptRecordWithMandatoryReservation(
      sourceDb,
      sourceDek,
      'patients',
      'pat-restore-half',
      [],
      { fullName: 'Restored Half-Finalized Patient', gender: 'male' }
    );
    await sourceDb.patients.put({
      id: 'pat-restore-half',
      createdAt: '2026-04-01T08:00:00.000Z',
      updatedAt: '2026-04-01T08:00:00.000Z',
      isArchived: 0,
      recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
      dekVersion: CURRENT_DEK_VERSION,
      iv: pEnc.iv,
      ciphertext: pEnc.ciphertext,
    });

    const ep = await EpisodeService.createEpisode(
      'pat-restore-half',
      {
        title: 'Shoulder Rehab',
        primarySpecialty: 'musculoskeletal',
        medicalDiagnosis: 'Rotator cuff tendinopathy',
        clinicalImpression: 'Subacromial pain',
        affectedBodyRegion: 'Shoulder',
        rehabilitationGoals: { shortTerm: ['Pain < 3'], longTerm: ['Full overhead ROM'] },
      },
      sourceDek,
      'ep-restore-half',
      sourceDb
    );

    const sess = await SessionService.createSession(
      'pat-restore-half',
      ep.id,
      {
        sessionDate: '2026-04-10',
        sessionType: 'follow_up',
        attendanceStatus: 'attended',
      },
      sourceDek,
      'sess-restore-half',
      sourceDb
    );

    await SoapService.createSoapNote(
      'pat-restore-half',
      ep.id,
      sess.id,
      {
        isFinalized: false,
        subjective: { chiefComplaint: 'Half-finalized in backup', painNrsScore: 4 },
        objective: { objectiveFindings: 'Painful arc 90-120' },
        assessment: { clinicalImpressionCurrent: 'Improving', progressStatus: 'improved' },
        plan: { nextSessionPlan: 'Isometrics' },
      },
      sourceDek,
      'soap-restore-half',
      sourceDb
    );

    // Mark session finalized while leaving soapNote.isFinalized = false (pre-1A-i.5 bug state)
    const halfFinalizedSessionPayload = {
      ...sess.data,
      status: 'finalized' as const,
      finalizedAt: '2026-04-10T10:00:00.000Z',
      finalizedBy: 'Dr. Backup',
    };
    const sEnc = await encryptRecordWithMandatoryReservation(
      sourceDb,
      sourceDek,
      'sessions',
      sess.id,
      ['pat-restore-half', ep.id],
      halfFinalizedSessionPayload
    );
    await sourceDb.sessions.put({
      id: sess.id,
      episodeId: ep.id,
      patientId: 'pat-restore-half',
      createdAt: sess.createdAt,
      updatedAt: '2026-04-10T10:00:00.000Z',
      recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
      dekVersion: CURRENT_DEK_VERSION,
      iv: sEnc.iv,
      ciphertext: sEnc.ciphertext,
    });

    const sourceMeta = (await sourceDb.vaultMeta.get('auth'))!;
    const backupJson = await exportBackupPackage(
      sourceDb,
      sourceMeta,
      sourceKek,
      'BackupPass123!'
    );

    // 2. On the target database, complete repairHalfFinalizedSessions first so migrationState is 'completed'
    const { db: targetDb, dek: initialTargetDek } = await bootstrapTestVaultAndEpisode();
    const initialRepair = await SessionService.repairHalfFinalizedSessions(
      initialTargetDek,
      targetDb
    );
    expect(initialRepair.repairedCount).toBe(0);
    const stateBeforeRestore = await targetDb.migrationState.get(HALF_FINALIZED_REPAIR_STATE_ID);
    expect(stateBeforeRestore?.status).toBe('completed');

    // 3. Restore the .ptbackup containing the half-finalized session into targetDb
    const restoreSummary = await restoreBackupPackage(
      backupJson,
      'BackupPass123!',
      'NewTargetPass456!',
      targetDb
    );

    // Confirm restore deleted the stale 'completed' repair flag
    const stateImmediatelyAfterRestore = await targetDb.migrationState.get(
      HALF_FINALIZED_REPAIR_STATE_ID
    );
    expect(stateImmediatelyAfterRestore).toBeUndefined();

    // 4. Unlock / run repairHalfFinalizedSessions with the restored DEK -> it MUST repair the restored half-finalized session!
    const repairAfterRestore = await SessionService.repairHalfFinalizedSessions(
      restoreSummary.destinationOperationalDek,
      targetDb
    );
    expect(Boolean(repairAfterRestore.alreadyCompleted)).toBe(false);
    expect(repairAfterRestore.repairedCount).toBe(1);
    expect(repairAfterRestore.repairedSessionIds).toEqual(['sess-restore-half']);

    const repairedSoap = await SoapService.getSoapNoteBySession(
      'sess-restore-half',
      restoreSummary.destinationOperationalDek,
      targetDb
    );
    expect(repairedSoap?.data.isFinalized).toBe(true);
    expect(repairedSoap?.data.finalizedBy).toBe('Dr. Backup');
    expect(repairedSoap?.data.repairedDuringMigration).toBe(true);
    expect(repairedSoap?.data.legacyUnreviewed).toBe(true);
  }, 30000);
});
