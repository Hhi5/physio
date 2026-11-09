import { describe, it, expect } from 'vitest';
import {
  deriveKEK,
  generateAndWrapOperationalDEK,
  generateVerifier,
  encryptRecordWithMandatoryReservation,
  randomBytes,
  CONSTANTS,
  CURRENT_DEK_VERSION,
  CURRENT_RECORD_CRYPTO_VERSION,
} from '../../crypto/vault';
import { createInMemoryDatabase } from '../../crypto/__tests__/phase1.characterization.test';
import { EpisodeService } from '../episodeService';
import { SessionService } from '../sessionService';
import { SoapService } from '../soapService';
import {
  CURRENT_SOAP_SCHEMA_VERSION,
  type EncryptedSoapEntity,
  type SoapNoteData,
} from '../../types/clinical';

async function bootstrapTestVaultAndEpisode() {
  const db = createInMemoryDatabase(5);
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

  // Seed patient record
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

  // Create active episode via EpisodeService
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

describe('Phase 1A-i — Unified SOAP + Flowsheet, Atomic Finalization, Immutability & Repair', () => {
  it('stores flowsheet & postSessionPainNrs inside SoapNoteData (v2) and carries forward previous episode flowsheet', async () => {
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

    const soap1 = await SoapService.createSoapNote(
      patientId,
      episodeId,
      session1.id,
      {
        isFinalized: false,
        subjective: {
          chiefComplaint: 'Lower back stiffness and right leg tingling',
          painNrsScore: 7,
          postSessionPainNrs: 4,
        },
        objective: {
          objectiveFindings: 'Reduced lumbar extension',
          flowsheet: {
            exercises: [
              {
                id: 'ex-1',
                exerciseId: 'prone-press-up',
                nameEn: 'Prone Press-Up',
                nameAr: 'ضغط للخلف بوضعية الانبطاح',
                region: 'thoracic_lumbar',
                sets: 3,
                reps: 10,
                holdSeconds: 5,
                loadOrBand: 'Bodyweight',
                rpeOrPainResponse: 'pain_free',
                notes: 'Centralizing pain',
              },
            ],
            manualTherapy: [
              {
                id: 'mt-1',
                techniqueEn: 'Central PA L4-L5 Mobilization',
                techniqueAr: 'تحريك مركزي للفقرات القطنية L4-L5',
                targetJointOrTissue: 'L4-L5',
                gradeOrIntensity: 'Grade III',
                durationMinutes: 8,
                patientResponse: 'Improved extension',
              },
            ],
            physicalAgents: [
              {
                id: 'pa-1',
                modality: 'TENS',
                modalityAr: 'التحفيز الكهربائي عبر الجلد',
                site: 'Lumbar paraspinal',
                parameters: '100Hz, 150us',
                durationMinutes: 15,
              },
            ],
          },
        },
        assessment: {
          clinicalImpressionCurrent: 'Responder to extension bias',
          progressStatus: 'improved',
          patientTolerance: 'well_tolerated',
        },
        plan: {
          nextSessionPlan: 'Add core stabilization',
        },
      },
      dek,
      'soap-1',
      db
    );

    expect(soap1.data.soapSchemaVersion).toBe(CURRENT_SOAP_SCHEMA_VERSION);
    expect(soap1.data.subjective.painNrsScore).toBe(7);
    expect(soap1.data.subjective.postSessionPainNrs).toBe(4);
    expect(soap1.data.objective.flowsheet?.exercises).toHaveLength(1);

    // Carry forward flowsheet to session 2
    const carried = await SoapService.getLatestEpisodeFlowsheet(episodeId, 'sess-2', dek, db);
    expect(carried).not.toBeNull();
    expect(carried?.exercises).toHaveLength(1);
    expect(carried?.exercises[0].nameEn).toBe('Prone Press-Up');
    expect(carried?.manualTherapy).toHaveLength(1);
    expect(carried?.physicalAgents).toHaveLength(1);
  });

  it('loads legacy v1 soapNotes without flowsheet or soapSchemaVersion and defaults soapSchemaVersion to 1', async () => {
    const { db, dek, patientId, episodeId } = await bootstrapTestVaultAndEpisode();

    const legacyV1Data: SoapNoteData = {
      isFinalized: false,
      subjective: {
        chiefComplaint: 'Legacy note complaint',
        painNrsScore: 5,
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
      [patientId, episodeId, 'sess-legacy'],
      legacyV1Data
    );

    const entity: EncryptedSoapEntity = {
      id: 'soap-v1-legacy',
      sessionId: 'sess-legacy',
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

    const loaded = await SoapService.getSoapNoteBySession('sess-legacy', dek, db);
    expect(loaded).not.toBeNull();
    expect(loaded?.data.soapSchemaVersion).toBe(1);
    expect(loaded?.data.objective.flowsheet).toBeUndefined();
    expect(loaded?.data.subjective.postSessionPainNrs).toBeUndefined();
  });

  it('finalizes session and SOAP note atomically in one transaction and enforces service-layer immutability', async () => {
    const { db, dek, patientId, episodeId } = await bootstrapTestVaultAndEpisode();

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

    const finalizedSession = await SessionService.finalizeSession(
      session.id,
      'Dr. Ali Al-Iraqi',
      dek,
      db
    );

    expect(finalizedSession.status).toBe('finalized');
    expect(finalizedSession.data.finalizedBy).toBe('Dr. Ali Al-Iraqi');
    expect(finalizedSession.data.contentIntegrityDigestSha256).toBeTruthy();

    const finalizedSoap = await SoapService.getSoapNoteBySession(session.id, dek, db);
    expect(finalizedSoap?.data.isFinalized).toBe(true);
    expect(finalizedSoap?.data.finalizedBy).toBe('Dr. Ali Al-Iraqi');
    expect(finalizedSoap?.data.contentDigestSha256).toBeTruthy();

    // Service-layer immutability checks:
    await expect(
      SoapService.updateSoapNote(
        soap.id,
        {
          ...finalizedSoap!.data,
          subjective: {
            ...finalizedSoap!.data.subjective,
            chiefComplaint: 'Tampered complaint',
          },
        },
        dek,
        db
      )
    ).rejects.toThrow(/لا يمكن تعديل ملاحظة SOAP معتمدة/);

    await expect(
      SessionService.updateSession(
        session.id,
        { administrativeNotes: 'Tampered summary' },
        dek,
        db
      )
    ).rejects.toThrow(/لا يمكن تعديل جلسة سريرية معتمدة/);

    // Append-only addendum works on finalized SOAP note:
    const addendum = await SoapService.addClinicalAddendum(
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

    expect(addendum.data.reasonForAmendment).toBe('late_entry');
    const addendaList = await SoapService.getAddendaBySession(session.id, dek, db);
    expect(addendaList).toHaveLength(1);
    expect(addendaList[0].data.amendmentText).toContain('visual mirror feedback');
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

    // Simulate legacy bug: session was overwritten as 'finalized' in db.sessions without finalizing soapNote
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

    // Even BEFORE repair runs, SoapService.updateSoapNote must reject because parent session.status === 'finalized'
    await expect(
      SoapService.updateSoapNote(
        soap.id,
        {
          ...soap.data,
          subjective: { ...soap.data.subjective, painNrsScore: 9 },
        },
        dek,
        db
      )
    ).rejects.toThrow(/لا يمكن تعديل ملاحظة SOAP التابعة لجلسة سريرية معتمدة/);

    // Run repair routine
    const firstRepair = await SessionService.repairHalfFinalizedSessions(dek, db);
    expect(firstRepair.repairedCount).toBe(1);
    expect(firstRepair.repairedSessionIds).toEqual([session.id]);

    const repairedSoap = await SoapService.getSoapNoteBySession(session.id, dek, db);
    expect(repairedSoap?.data.isFinalized).toBe(true);
    expect(repairedSoap?.data.finalizedBy).toBe('Dr. Noor');
    expect(repairedSoap?.data.finalizedAt).toBe('2026-04-05T11:00:00.000Z');
    expect(repairedSoap?.data.repairedDuringMigration).toBe(true);
    expect(repairedSoap?.data.repairedAt).toBeTruthy();
    expect(repairedSoap?.data.contentDigestSha256).toBeTruthy();

    // Idempotence: second run repairs nothing
    const secondRepair = await SessionService.repairHalfFinalizedSessions(dek, db);
    expect(secondRepair.repairedCount).toBe(0);
    expect(secondRepair.repairedSessionIds).toEqual([]);
  });
});
