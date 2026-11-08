// =======================================================================
// PhysioRecord — SOAP Clinical Documentation & Addenda Service Layer (v2.0)
// 1:1 Session-to-SOAP Constraint, Immutability Locking, and Canonical AAD
// =======================================================================

import { db as defaultDb, PhysioRecordDatabase } from '../db/db';
import {
  encryptRecordWithMandatoryReservation,
  decryptRecordPayload,
  CURRENT_RECORD_CRYPTO_VERSION,
  CURRENT_DEK_VERSION,
} from '../crypto/vault';
import { ReferentialIntegrityError } from '../db/registry';
import {
  CannotDeleteFinalizedRecordError,
  type SoapNoteRecord,
  type SoapNoteData,
  type EncryptedSoapEntity,
  type ClinicalAddendumRecord,
  type ClinicalAddendumData,
  type EncryptedClinicalAddendumEntity,
  type AddendumReason,
  type SessionClinicalData,
} from '../types/clinical';

export class SoapService {
  /**
   * Fetch and decrypt the unique SOAP Note for a given Clinical Session.
   * Enforces 1:1 relationship check.
   */
  static async getSoapNoteBySession(
    sessionId: string,
    dek: CryptoKey,
    database: PhysioRecordDatabase = defaultDb
  ): Promise<SoapNoteRecord | null> {
    if (!sessionId || typeof sessionId !== 'string') return null;

    const entity = await database.soapNotes.where('sessionId').equals(sessionId).first();
    if (!entity) return null;

    return this.decryptSoapEntity(entity, dek);
  }

  /**
   * Fetch and decrypt a SOAP Note by its primary ID.
   */
  static async getSoapNoteById(
    soapId: string,
    dek: CryptoKey,
    database: PhysioRecordDatabase = defaultDb
  ): Promise<SoapNoteRecord | null> {
    if (!soapId || typeof soapId !== 'string') return null;

    const entity = await database.soapNotes.get(soapId);
    if (!entity) return null;

    return this.decryptSoapEntity(entity, dek);
  }

  /**
   * Decrypt a raw EncryptedSoapEntity from the database.
   */
  private static async decryptSoapEntity(
    entity: EncryptedSoapEntity,
    dek: CryptoKey
  ): Promise<SoapNoteRecord> {
    const parentIds = entity.episodeId
      ? [entity.patientId, entity.episodeId, entity.sessionId]
      : [entity.patientId, entity.sessionId]; // backward-compatibility fallback

    const decryptedData = await decryptRecordPayload<SoapNoteData>(
      dek,
      'soapNotes',
      entity.id,
      parentIds,
      entity.iv,
      entity.ciphertext,
      entity.recordCryptoVersion || CURRENT_RECORD_CRYPTO_VERSION,
      entity.dekVersion || CURRENT_DEK_VERSION
    );

    return {
      id: entity.id,
      sessionId: entity.sessionId,
      episodeId: entity.episodeId,
      patientId: entity.patientId,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      data: decryptedData,
    };
  }

  /**
   * Create a new SOAP note for a Clinical Session.
   * Strictly enforces 1:1 relationship: rejects creation if a SOAP note already exists for this session.
   * Enforces referential integrity: session and parent patient/episode must exist and match.
   */
  static async createSoapNote(
    patientId: string,
    episodeId: string,
    sessionId: string,
    data: SoapNoteData,
    dek: CryptoKey,
    explicitId?: string,
    database: PhysioRecordDatabase = defaultDb
  ): Promise<SoapNoteRecord> {
    if (!patientId || typeof patientId !== 'string') {
      throw new ReferentialIntegrityError('معرّف المريض غير صالح.');
    }
    if (!episodeId || typeof episodeId !== 'string') {
      throw new ReferentialIntegrityError('معرّف حلقة الرعاية غير صالح.');
    }
    if (!sessionId || typeof sessionId !== 'string') {
      throw new ReferentialIntegrityError('معرّف الجلسة غير صالح.');
    }

    // 1. Verify parent session exists
    const session = await database.sessions.get(sessionId);
    if (!session) {
      throw new ReferentialIntegrityError(`لا يمكن إنشاء توثيق SOAP: الجلسة بالمعرف "${sessionId}" غير موجودة.`);
    }

    // 2. Verify referential integrity bindings
    if (session.patientId !== patientId) {
      throw new ReferentialIntegrityError(
        `فشل التحقق من النزاهة المرجعية: الجلسة ترتبط بمريض مختلف (${session.patientId} != ${patientId}).`
      );
    }
    if (session.episodeId !== episodeId) {
      throw new ReferentialIntegrityError(
        `فشل التحقق من النزاهة المرجعية: الجلسة ترتبط بحلقة رعاية مختلفة (${session.episodeId} != ${episodeId}).`
      );
    }

    // 3. STRICT 1:1 ENFORCEMENT: Reject duplicate SOAP note for the same session!
    const existingSoap = await database.soapNotes.where('sessionId').equals(sessionId).first();
    if (existingSoap) {
      throw new Error(
        `توجد ملاحظة SOAP مسجلة مسبقاً للجلسة "${sessionId}". لا يمكن إنشاء أكثر من ملاحظة سريرية واحدة لنفس الجلسة العلاجية.`
      );
    }

    const id = explicitId || crypto.randomUUID();
    const now = new Date().toISOString();

    const score =
      data.subjective?.painNrsScore ??
      data.subjective?.painVasCurrent ??
      data.subjective?.painAssessment?.score ??
      0;

    const painAssessment = data.subjective?.painAssessment || {
      scale: 'NRS_0_10' as const,
      score,
      range: '0-10' as const,
      unit: 'points' as const,
      assessedAt: now.split('T')[0],
      scoreBestLast24h: data.subjective?.painVasBestLast24h,
      scoreWorstLast24h: data.subjective?.painVasWorstLast24h,
    };

    const fullData: SoapNoteData = {
      ...data,
      subjective: {
        ...data.subjective,
        painNrsScore: score,
        painAssessment,
        painVasCurrent: score,
      },
      isFinalized: false,
    };

    // Centralized encryption with MANDATORY invocation counter reservation
    // Canonical AAD: soapNotes:id:patientId,episodeId,sessionId:1:dekVersion
    const meta = await database.vaultMeta.get('auth');
    const activeDekVersion = meta?.dekVersion || CURRENT_DEK_VERSION;

    const { iv, ciphertext } = await encryptRecordWithMandatoryReservation(
      database,
      dek,
      'soapNotes',
      id,
      [patientId, episodeId, sessionId],
      fullData,
      CURRENT_RECORD_CRYPTO_VERSION,
      activeDekVersion
    );

    const entity: EncryptedSoapEntity = {
      id,
      sessionId,
      episodeId,
      patientId,
      createdAt: now,
      updatedAt: now,
      recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
      dekVersion: activeDekVersion,
      iv,
      ciphertext,
    };

    await database.soapNotes.put(entity);

    return {
      id,
      sessionId,
      episodeId,
      patientId,
      createdAt: now,
      updatedAt: now,
      data: fullData,
    };
  }

  /**
   * Update an existing draft SOAP note.
   * Rejects modification if the associated session is finalized.
   */
  static async updateSoapNote(
    soapId: string,
    data: SoapNoteData,
    dek: CryptoKey,
    database: PhysioRecordDatabase = defaultDb
  ): Promise<SoapNoteRecord> {
    const existing = await this.getSoapNoteById(soapId, dek, database);
    if (!existing) {
      throw new Error(`ملاحظة SOAP بالمعرف "${soapId}" غير موجودة.`);
    }

    // IMMUTABILITY RULE: Cannot update finalized note
    if (existing.data.isFinalized) {
      throw new Error(
        'لا يمكن تعديل ملاحظة SOAP معتمدة نهائياً. يسمح النظام بإضافة ملحق سريري (Clinical Addendum) للتصحيح.'
      );
    }

    const meta = await database.vaultMeta.get('auth');
    const activeDekVersion = meta?.dekVersion || CURRENT_DEK_VERSION;
    const now = new Date().toISOString();

    let score = existing.data.subjective?.painNrsScore ?? existing.data.subjective?.painVasCurrent ?? 0;
    if (
      data.subjective?.painVasCurrent !== undefined &&
      data.subjective.painVasCurrent !== existing.data.subjective?.painVasCurrent
    ) {
      score = data.subjective.painVasCurrent;
    } else if (
      data.subjective?.painNrsScore !== undefined &&
      data.subjective.painNrsScore !== existing.data.subjective?.painNrsScore
    ) {
      score = data.subjective.painNrsScore;
    } else if (data.subjective?.painAssessment?.score !== undefined) {
      score = data.subjective.painAssessment.score;
    } else if (data.subjective?.painNrsScore !== undefined) {
      score = data.subjective.painNrsScore;
    } else if (data.subjective?.painVasCurrent !== undefined) {
      score = data.subjective.painVasCurrent;
    }

    const basePainAssessment = data.subjective?.painAssessment || existing.data.subjective?.painAssessment;
    const painAssessment = basePainAssessment
      ? { ...basePainAssessment, score }
      : {
          scale: 'NRS_0_10' as const,
          score,
          range: '0-10' as const,
          unit: 'points' as const,
          assessedAt: now.split('T')[0],
          scoreBestLast24h: data.subjective?.painVasBestLast24h ?? existing.data.subjective?.painVasBestLast24h,
          scoreWorstLast24h: data.subjective?.painVasWorstLast24h ?? existing.data.subjective?.painVasWorstLast24h,
        };

    const updatedData: SoapNoteData = {
      ...existing.data,
      ...data,
      subjective: {
        ...existing.data.subjective,
        ...data.subjective,
        painNrsScore: score,
        painAssessment,
        painVasCurrent: score,
      },
      isFinalized: false,
    };

    const { iv, ciphertext } = await encryptRecordWithMandatoryReservation(
      database,
      dek,
      'soapNotes',
      soapId,
      [existing.patientId, existing.episodeId, existing.sessionId],
      updatedData,
      CURRENT_RECORD_CRYPTO_VERSION,
      activeDekVersion
    );

    const updatedEntity: EncryptedSoapEntity = {
      id: soapId,
      sessionId: existing.sessionId,
      episodeId: existing.episodeId,
      patientId: existing.patientId,
      createdAt: existing.createdAt,
      updatedAt: now,
      recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
      dekVersion: activeDekVersion,
      iv,
      ciphertext,
    };

    await database.soapNotes.put(updatedEntity);

    return {
      id: soapId,
      sessionId: existing.sessionId,
      episodeId: existing.episodeId,
      patientId: existing.patientId,
      createdAt: existing.createdAt,
      updatedAt: now,
      data: updatedData,
    };
  }

  /**
   * Internal finalization helper called during session finalization.
   */
  static async finalizeSoapNote(
    soapId: string,
    therapistName: string,
    dek: CryptoKey,
    database: PhysioRecordDatabase = defaultDb
  ): Promise<SoapNoteRecord> {
    const existing = await this.getSoapNoteById(soapId, dek, database);
    if (!existing) {
      throw new Error(`ملاحظة SOAP بالمعرف "${soapId}" غير موجودة.`);
    }

    const now = new Date().toISOString();
    const meta = await database.vaultMeta.get('auth');
    const activeDekVersion = meta?.dekVersion || CURRENT_DEK_VERSION;

    const finalizedData: SoapNoteData = {
      ...existing.data,
      isFinalized: true,
      finalizedAt: now,
      finalizedBy: therapistName,
    };

    const { iv, ciphertext } = await encryptRecordWithMandatoryReservation(
      database,
      dek,
      'soapNotes',
      soapId,
      [existing.patientId, existing.episodeId, existing.sessionId],
      finalizedData,
      CURRENT_RECORD_CRYPTO_VERSION,
      activeDekVersion
    );

    const updatedEntity: EncryptedSoapEntity = {
      id: soapId,
      sessionId: existing.sessionId,
      episodeId: existing.episodeId,
      patientId: existing.patientId,
      createdAt: existing.createdAt,
      updatedAt: now,
      recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
      dekVersion: activeDekVersion,
      iv,
      ciphertext,
    };

    await database.soapNotes.put(updatedEntity);

    return {
      id: soapId,
      sessionId: existing.sessionId,
      episodeId: existing.episodeId,
      patientId: existing.patientId,
      createdAt: existing.createdAt,
      updatedAt: now,
      data: finalizedData,
    };
  }

  /**
   * Delete an unfinalized draft SOAP note.
   * Strictly rejects deletion if the SOAP note is finalized or its parent session is finalized.
   */
  static async deleteSoapNote(
    soapId: string,
    dek: CryptoKey,
    database: PhysioRecordDatabase = defaultDb
  ): Promise<void> {
    const soap = await this.getSoapNoteById(soapId, dek, database);
    if (!soap) {
      throw new Error(`ملاحظة SOAP بالمعرف "${soapId}" غير موجودة.`);
    }

    if (soap.data.isFinalized) {
      throw new CannotDeleteFinalizedRecordError(
        'لا يمكن حذف ملاحظة SOAP معتمدة نهائياً. يجب الحفاظ على السجلات السريرية المعتمدة وفق سياسة الاحتفاظ.'
      );
    }

    const sessionEntity = await database.sessions.get(soap.sessionId);
    if (sessionEntity) {
      const sessionDecrypted = await decryptRecordPayload<SessionClinicalData>(
        dek,
        'sessions',
        sessionEntity.id,
        [sessionEntity.patientId, sessionEntity.episodeId],
        sessionEntity.iv,
        sessionEntity.ciphertext,
        sessionEntity.recordCryptoVersion || CURRENT_RECORD_CRYPTO_VERSION,
        sessionEntity.dekVersion || CURRENT_DEK_VERSION
      );
      if (sessionDecrypted.status === 'finalized') {
        throw new CannotDeleteFinalizedRecordError(
          'لا يمكن حذف ملاحظة SOAP التابعة لجلسة سريرية معتمدة ومؤرخة.'
        );
      }
    }

    await database.soapNotes.delete(soapId);
  }

  /**
   * Add a Clinical Addendum (correction/amendment) to a finalized session or SOAP note.
   * Preserves the immutable original record and appends a cryptographically authenticated amendment.
   */
  static async addClinicalAddendum(
    sessionId: string,
    targetTable: 'sessions' | 'soapNotes',
    targetId: string,
    data: {
      reasonForAmendment: AddendumReason;
      amendmentText: string;
      signedByTherapistName: string;
    },
    dek: CryptoKey,
    explicitId?: string,
    database: PhysioRecordDatabase = defaultDb
  ): Promise<ClinicalAddendumRecord> {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new ReferentialIntegrityError('معرّف الجلسة غير صالح لإضافة ملحق.');
    }
    if (!targetId || typeof targetId !== 'string') {
      throw new ReferentialIntegrityError('معرّف السجل المستهدف غير صالح لإضافة ملحق.');
    }
    if (!data.amendmentText?.trim()) {
      throw new Error('نص التصحيح أو الإضافة السريرية إلزامي (Amendment Text is required).');
    }
    if (!data.signedByTherapistName?.trim()) {
      throw new Error('اسم وتوقيع المعالج الطبيعي إلزامي لاعتماد الملحق السريري.');
    }

    const session = await database.sessions.get(sessionId);
    if (!session) {
      throw new ReferentialIntegrityError(`الجلسة بالمعرف "${sessionId}" غير موجودة.`);
    }

    // Append-only rule: clinical addenda can ONLY be attached to finalized records
    const sessionDecrypted = await decryptRecordPayload<SessionClinicalData>(
      dek,
      'sessions',
      session.id,
      [session.patientId, session.episodeId],
      session.iv,
      session.ciphertext,
      session.recordCryptoVersion || CURRENT_RECORD_CRYPTO_VERSION,
      session.dekVersion || CURRENT_DEK_VERSION
    );

    if (sessionDecrypted.status !== 'finalized') {
      throw new Error(
        'لا يمكن إضافة ملحق سريري لجلسة مسودة أو غير معتمدة. الملاحق السريرية مخصصة حصرياً للسجلات المعتمدة نهائياً.'
      );
    }

    if (targetTable === 'soapNotes') {
      let soap = await this.getSoapNoteById(targetId, dek, database);
      if (!soap) {
        // Fallback: check if targetId refers to the sessionId
        soap = await this.getSoapNoteBySession(targetId, dek, database);
      }
      if (!soap) {
        throw new ReferentialIntegrityError(`ملاحظة SOAP بالمعرف "${targetId}" غير موجودة.`);
      }
      if (!soap.data.isFinalized) {
        throw new Error(
          'لا يمكن إضافة ملحق سريري لملاحظة SOAP غير معتمدة. الملاحق السريرية مخصصة حصرياً للسجلات المعتمدة نهائياً.'
        );
      }
    }

    const id = explicitId || crypto.randomUUID();
    const now = new Date().toISOString();

    const addendumData: ClinicalAddendumData = {
      targetTable,
      targetId,
      reasonForAmendment: data.reasonForAmendment,
      amendmentText: data.amendmentText.trim(),
      signedByTherapistName: data.signedByTherapistName.trim(),
      createdAt: now,
    };

    const meta = await database.vaultMeta.get('auth');
    const activeDekVersion = meta?.dekVersion || CURRENT_DEK_VERSION;

    // Canonical AAD: clinicalAddenda:id:patientId,sessionId:1:dekVersion
    const { iv, ciphertext } = await encryptRecordWithMandatoryReservation(
      database,
      dek,
      'clinicalAddenda',
      id,
      [session.patientId, sessionId],
      addendumData,
      CURRENT_RECORD_CRYPTO_VERSION,
      activeDekVersion
    );

    const entity: EncryptedClinicalAddendumEntity = {
      id,
      sessionId,
      patientId: session.patientId,
      targetId,
      createdAt: now,
      recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
      dekVersion: activeDekVersion,
      iv,
      ciphertext,
    };

    await database.clinicalAddenda.put(entity);

    return {
      id,
      sessionId,
      patientId: session.patientId,
      targetId,
      createdAt: now,
      data: addendumData,
    };
  }

  /**
   * Fetch and decrypt all Clinical Addenda associated with a given Session.
   */
  static async getAddendaBySession(
    sessionId: string,
    dek: CryptoKey,
    database: PhysioRecordDatabase = defaultDb
  ): Promise<ClinicalAddendumRecord[]> {
    if (!sessionId || typeof sessionId !== 'string') return [];

    const entities = await database.clinicalAddenda.where('sessionId').equals(sessionId).toArray();
    const records: ClinicalAddendumRecord[] = [];

    for (const entity of entities) {
      try {
        const decryptedData = await decryptRecordPayload<ClinicalAddendumData>(
          dek,
          'clinicalAddenda',
          entity.id,
          [entity.patientId, entity.sessionId],
          entity.iv,
          entity.ciphertext,
          entity.recordCryptoVersion || CURRENT_RECORD_CRYPTO_VERSION,
          entity.dekVersion || CURRENT_DEK_VERSION
        );

        records.push({
          id: entity.id,
          sessionId: entity.sessionId,
          patientId: entity.patientId,
          targetId: entity.targetId,
          createdAt: entity.createdAt,
          data: decryptedData,
        });
      } catch (err) {
        console.error(`Failed to decrypt addendum ${entity.id}:`, err);
      }
    }

    records.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return records;
  }

  /**
   * Append-only enforcement: Modifying an existing Clinical Addendum is strictly forbidden.
   */
  static async updateClinicalAddendum(): Promise<never> {
    throw new Error(
      'محظور: الملاحق السريرية (Clinical Addenda) هي سجل تراكمي غير قابل للتعديل (Append-only Ledger).'
    );
  }

  /**
   * Append-only enforcement: Deleting an existing Clinical Addendum is strictly forbidden.
   */
  static async deleteClinicalAddendum(): Promise<never> {
    throw new Error(
      'محظور: الملاحق السريرية (Clinical Addenda) هي سجل تراكمي غير قابل للحذف (Append-only Ledger).'
    );
  }
}
