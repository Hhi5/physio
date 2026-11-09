import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  deriveKEK,
  generateAndWrapOperationalDEK,
  unwrapOperationalDEK,
  generateVerifier,
  checkVerifier,
  encryptRecordWithMandatoryReservation,
  decryptRecordPayload,
  computeSessionNumberHmacToken,
  randomBytes,
  CONSTANTS,
  CURRENT_DEK_VERSION,
  CURRENT_RECORD_CRYPTO_VERSION,
} from '../vault';
import {
  exportBackupPackage,
  inspectBackupPreview,
  restoreBackupPackage,
} from '../backup';
import { createInMemoryDatabase } from './testDbHelper';
export { createInMemoryDatabase };

const FIXTURE_PATH = path.resolve(
  __dirname,
  'fixtures',
  'v1_1_vault_and_backup.fixture.json'
);

interface CommittedV11Fixture {
  vaultPassword: string;
  backupPassword: string;
  vaultMeta: {
    id: string;
    salt: number[];
    wrappedDek: number[];
    wrappedDekIv: number[];
    verifierIv: number[];
    verifierCiphertext: number[];
    schemaVersion: number;
    kdfAlgorithm: string;
    kdfIterations: number;
    dekVersion: number;
    encryptionInvocationCount: number;
    vaultGeneration: number;
  };
  encryptedRecords: {
    patient: {
      id: string;
      createdAt: string;
      updatedAt: string;
      isArchived: number;
      recordCryptoVersion: number;
      dekVersion: number;
      iv: number[];
      ciphertext: number[];
    };
    episode: {
      id: string;
      patientId: string;
      createdAt: string;
      updatedAt: string;
      recordCryptoVersion: number;
      dekVersion: number;
      iv: number[];
      ciphertext: number[];
    };
    session: {
      id: string;
      episodeId: string;
      patientId: string;
      createdAt: string;
      updatedAt: string;
      recordCryptoVersion: number;
      dekVersion: number;
      iv: number[];
      ciphertext: number[];
    };
    soapNote: {
      id: string;
      sessionId: string;
      episodeId: string;
      patientId: string;
      createdAt: string;
      updatedAt: string;
      recordCryptoVersion: number;
      dekVersion: number;
      iv: number[];
      ciphertext: number[];
    };
    clinicalAddendum: {
      id: string;
      sessionId: string;
      patientId: string;
      targetId: string;
      createdAt: string;
      recordCryptoVersion: number;
      dekVersion: number;
      iv: number[];
      ciphertext: number[];
    };
  };
  expectedPlaintext: {
    patient: Record<string, unknown>;
    episode: Record<string, unknown>;
    session: Record<string, unknown>;
    soapNote: Record<string, unknown>;
    clinicalAddendum: Record<string, unknown>;
  };
  backupPackageJson: string;
}

describe('Phase 1A Step 1 — Crypto & Backup v1.1 Characterization Tests', () => {
  it('can unlock the committed v1.1 vaultMeta fixture and decrypt all v1.1 clinical entities', async () => {
    expect(fs.existsSync(FIXTURE_PATH)).toBe(true);
    const fixture: CommittedV11Fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));

    // 1. Derive KEK from committed vaultMeta salt & iterations
    const kek = await deriveKEK(
      fixture.vaultPassword,
      new Uint8Array(fixture.vaultMeta.salt),
      fixture.vaultMeta.kdfIterations
    );

    // 2. Verify password verifier
    const valid = await checkVerifier(
      kek,
      new Uint8Array(fixture.vaultMeta.verifierIv),
      new Uint8Array(fixture.vaultMeta.verifierCiphertext)
    );
    expect(valid).toBe(true);

    // 3. Unwrap operational DEK
    const dek = await unwrapOperationalDEK(
      new Uint8Array(fixture.vaultMeta.wrappedDek),
      new Uint8Array(fixture.vaultMeta.wrappedDekIv),
      kek,
      fixture.vaultMeta.vaultGeneration
    );

    // 4. Decrypt all 5 encrypted records and compare against expectedPlaintext
    const { patient, episode, session, soapNote, clinicalAddendum } = fixture.encryptedRecords;

    const decPatient = await decryptRecordPayload(
      dek,
      'patients',
      patient.id,
      [],
      new Uint8Array(patient.iv),
      new Uint8Array(patient.ciphertext),
      patient.recordCryptoVersion,
      patient.dekVersion
    );
    expect(decPatient).toEqual(fixture.expectedPlaintext.patient);

    const decEpisode = await decryptRecordPayload(
      dek,
      'episodes',
      episode.id,
      [episode.patientId],
      new Uint8Array(episode.iv),
      new Uint8Array(episode.ciphertext),
      episode.recordCryptoVersion,
      episode.dekVersion
    );
    expect(decEpisode).toEqual(fixture.expectedPlaintext.episode);

    const decSession = await decryptRecordPayload(
      dek,
      'sessions',
      session.id,
      [session.patientId, session.episodeId],
      new Uint8Array(session.iv),
      new Uint8Array(session.ciphertext),
      session.recordCryptoVersion,
      session.dekVersion
    );
    expect(decSession).toEqual(fixture.expectedPlaintext.session);

    const decSoap = await decryptRecordPayload(
      dek,
      'soapNotes',
      soapNote.id,
      [soapNote.patientId, soapNote.episodeId, soapNote.sessionId],
      new Uint8Array(soapNote.iv),
      new Uint8Array(soapNote.ciphertext),
      soapNote.recordCryptoVersion,
      soapNote.dekVersion
    );
    expect(decSoap).toEqual(fixture.expectedPlaintext.soapNote);

    const decAddendum = await decryptRecordPayload(
      dek,
      'clinicalAddenda',
      clinicalAddendum.id,
      [clinicalAddendum.patientId, clinicalAddendum.sessionId],
      new Uint8Array(clinicalAddendum.iv),
      new Uint8Array(clinicalAddendum.ciphertext),
      clinicalAddendum.recordCryptoVersion,
      clinicalAddendum.dekVersion
    );
    expect(decAddendum).toEqual(fixture.expectedPlaintext.clinicalAddendum);
  }, 30000);

  it('can preview and restore the committed v1.1 .ptbackup fixture into a fresh database', async () => {
    expect(fs.existsSync(FIXTURE_PATH)).toBe(true);
    const fixture: CommittedV11Fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
    const targetDb = createInMemoryDatabase(4);

    // 1. Inspect backup preview
    const preview = await inspectBackupPreview(
      fixture.backupPackageJson,
      fixture.backupPassword,
      targetDb
    );
    expect(preview.restoredPatientCount).toBe(1);
    expect(preview.restoredEpisodeCount).toBe(1);
    expect(preview.restoredSessionCount).toBe(1);
    expect(preview.restoredSoapCount).toBe(1);
    expect(preview.restoredAddendaCount).toBe(1);

    // 2. Restore backup under a new destination vault password
    const newDestinationPassword = 'NewDestinationVaultPass789!';
    const summary = await restoreBackupPackage(
      fixture.backupPackageJson,
      fixture.backupPassword,
      newDestinationPassword,
      targetDb
    );

    expect(summary.patientCount).toBe(1);
    expect(summary.episodeCount).toBe(1);
    expect(summary.sessionCount).toBe(1);
    expect(summary.soapCount).toBe(1);
    expect(summary.addendaCount).toBe(1);
    expect(summary.restoredInvocationCount).toBe(5);

    // 3. Verify destination vaultMeta can be unlocked with newDestinationPassword
    const destMeta = (await targetDb.vaultMeta.get('auth'))!;
    expect(destMeta).toBeDefined();
    expect(destMeta.dekVersion).toBe(2);

    const destKek = await deriveKEK(
      newDestinationPassword,
      destMeta.salt,
      destMeta.kdfIterations
    );
    expect(await checkVerifier(destKek, destMeta.verifierIv, destMeta.verifierCiphertext)).toBe(
      true
    );

    const destDek = await unwrapOperationalDEK(
      destMeta.wrappedDek,
      destMeta.wrappedDekIv,
      destKek,
      destMeta.vaultGeneration
    );

    // 4. Verify restored patient record decrypts under the new destination DEK & dekVersion
    const restoredPatients = await targetDb.table('patients').toArray();
    expect(restoredPatients).toHaveLength(1);
    const rp = restoredPatients[0];
    const decRestoredPatient = await decryptRecordPayload(
      destDek,
      'patients',
      String(rp.id),
      [],
      rp.iv as Uint8Array,
      rp.ciphertext as Uint8Array,
      Number(rp.recordCryptoVersion),
      Number(rp.dekVersion)
    );
    expect(decRestoredPatient).toEqual(fixture.expectedPlaintext.patient);

    // 5. Verify episodeSequences HMAC token was reconstructed for session #1
    const seq = await targetDb.episodeSequences.get('char-ep-001');
    expect(seq).toBeDefined();
    expect(seq?.lastSequenceNumber).toBe(1);
    const expectedToken = await computeSessionNumberHmacToken(destDek, 'char-ep-001', 1);
    expect(seq?.allocatedTokens).toContain(expectedToken);
  }, 30000);

  it('creates a live vault and .ptbackup package and restores it end-to-end', async () => {
    const sourceDb = createInMemoryDatabase(4);
    const sourcePass = 'LiveSourceVaultPass123!';
    const backupPass = 'LiveBackupSecret456!';
    const destPass = 'LiveDestVaultPass789!';

    const salt = randomBytes(CONSTANTS.SALT_BYTES);
    const kek = await deriveKEK(sourcePass, salt, CONSTANTS.DEFAULT_PBKDF2_ITERATIONS);
    const { operationalDek, wrappedDek, wrappedDekIv } =
      await generateAndWrapOperationalDEK(kek, 1);
    const { verifierIv, verifierCiphertext } = await generateVerifier(kek);

    await sourceDb.vaultMeta.put({
      id: 'auth',
      salt,
      wrappedDek,
      wrappedDekIv,
      verifierIv,
      verifierCiphertext,
      schemaVersion: 4,
      kdfAlgorithm: 'PBKDF2-HMAC-SHA256',
      kdfIterations: CONSTANTS.DEFAULT_PBKDF2_ITERATIONS,
      dekVersion: CURRENT_DEK_VERSION,
      encryptionInvocationCount: 0,
      vaultGeneration: 1,
    });

    const patientData = { fullName: 'Live Roundtrip Patient', gender: 'female' };
    const pEnc = await encryptRecordWithMandatoryReservation(
      sourceDb,
      operationalDek,
      'patients',
      'live-pat-1',
      [],
      patientData
    );
    await sourceDb.table('patients').put({
      id: 'live-pat-1',
      createdAt: '2026-11-08T12:00:00.000Z',
      updatedAt: '2026-11-08T12:00:00.000Z',
      isArchived: 0,
      recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
      dekVersion: CURRENT_DEK_VERSION,
      iv: pEnc.iv,
      ciphertext: pEnc.ciphertext,
    });

    const meta = (await sourceDb.vaultMeta.get('auth'))!;
    const backupJson = await exportBackupPackage(sourceDb, meta, kek, backupPass);

    const destDb = createInMemoryDatabase(4);
    const summary = await restoreBackupPackage(backupJson, backupPass, destPass, destDb);
    expect(summary.patientCount).toBe(1);

    const restoredPatients = await destDb.table('patients').toArray();
    const rp = restoredPatients[0];
    const dec = await decryptRecordPayload(
      summary.destinationOperationalDek,
      'patients',
      String(rp.id),
      [],
      rp.iv as Uint8Array,
      rp.ciphertext as Uint8Array,
      Number(rp.recordCryptoVersion),
      Number(rp.dekVersion)
    );
    expect(dec).toEqual(patientData);
  }, 30000);
});
