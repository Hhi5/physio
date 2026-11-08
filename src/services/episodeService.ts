// =======================================================================
// PhysioRecord — Episode of Care Service Layer (v2.0)
// Centralized Envelope Encryption with Mandatory DEK Reservation & Referential Integrity
// =======================================================================

import { db as defaultDb, PhysioRecordDatabase } from '../db/db';
import {
  encryptRecordWithMandatoryReservation,
  decryptRecordPayload,
  CURRENT_RECORD_CRYPTO_VERSION,
  CURRENT_DEK_VERSION,
} from '../crypto/vault';
import { ReferentialIntegrityError } from '../db/registry';
import type {
  EpisodeRecord,
  EpisodeClinicalData,
  EncryptedEpisodeEntity,
  EpisodeStatus,
  ClinicalSpecialty,
} from '../types/clinical';

export class EpisodeService {
  /**
   * Fetch and decrypt all episodes belonging to a specific patient.
   * Enforces referential integrity check: verifies patient existence.
   */
  static async getEpisodesByPatient(
    patientId: string,
    dek: CryptoKey,
    database: PhysioRecordDatabase = defaultDb
  ): Promise<EpisodeRecord[]> {
    if (!patientId || typeof patientId !== 'string') {
      throw new ReferentialIntegrityError('معرّف المريض غير صالح.');
    }

    // Verify patient exists
    const patientExists = await database.patients.get(patientId);
    if (!patientExists) {
      throw new ReferentialIntegrityError(`المريض بالمعرف "${patientId}" غير موجود في قاعدة البيانات.`);
    }

    const encryptedEntities = await database.episodes.where('patientId').equals(patientId).toArray();
    const records: EpisodeRecord[] = [];

    for (const entity of encryptedEntities) {
      try {
        const decryptedData = await decryptRecordPayload<EpisodeClinicalData>(
          dek,
          'episodes',
          entity.id,
          [entity.patientId],
          entity.iv,
          entity.ciphertext,
          entity.recordCryptoVersion || CURRENT_RECORD_CRYPTO_VERSION,
          entity.dekVersion || CURRENT_DEK_VERSION
        );

        const status: EpisodeStatus = decryptedData.status || (entity as any).status || 'active';
        const primarySpecialty: ClinicalSpecialty = decryptedData.primarySpecialty || (entity as any).primarySpecialty || 'general';
        const startDate: string = decryptedData.startDate || decryptedData.onsetDate || (entity as any).startDate || entity.createdAt.split('T')[0];
        const endDate: string | undefined = decryptedData.endDate || (entity as any).endDate;

        records.push({
          id: entity.id,
          patientId: entity.patientId,
          status,
          primarySpecialty,
          startDate,
          endDate,
          createdAt: entity.createdAt,
          updatedAt: entity.updatedAt,
          data: {
            ...decryptedData,
            status,
            primarySpecialty,
            startDate,
            endDate,
          },
        });
      } catch (err) {
        console.error(`Failed to decrypt episode record ${entity.id}:`, err);
      }
    }

    // Sort: newest startDate or createdAt first
    records.sort((a, b) => {
      const timeA = new Date(a.startDate || a.createdAt).getTime();
      const timeB = new Date(b.startDate || b.createdAt).getTime();
      return timeB - timeA;
    });

    return records;
  }

  /**
   * Fetch and decrypt a single episode by ID.
   */
  static async getEpisodeById(
    episodeId: string,
    dek: CryptoKey,
    database: PhysioRecordDatabase = defaultDb
  ): Promise<EpisodeRecord | null> {
    const entity = await database.episodes.get(episodeId);
    if (!entity) return null;

    const decryptedData = await decryptRecordPayload<EpisodeClinicalData>(
      dek,
      'episodes',
      entity.id,
      [entity.patientId],
      entity.iv,
      entity.ciphertext,
      entity.recordCryptoVersion || CURRENT_RECORD_CRYPTO_VERSION,
      entity.dekVersion || CURRENT_DEK_VERSION
    );

    const status: EpisodeStatus = decryptedData.status || (entity as any).status || 'active';
    const primarySpecialty: ClinicalSpecialty = decryptedData.primarySpecialty || (entity as any).primarySpecialty || 'general';
    const startDate: string = decryptedData.startDate || decryptedData.onsetDate || (entity as any).startDate || entity.createdAt.split('T')[0];
    const endDate: string | undefined = decryptedData.endDate || (entity as any).endDate;

    return {
      id: entity.id,
      patientId: entity.patientId,
      status,
      primarySpecialty,
      startDate,
      endDate,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      data: {
        ...decryptedData,
        status,
        primarySpecialty,
        startDate,
        endDate,
      },
    };
  }

  /**
   * Create a new episode for an existing patient.
   * Enforces referential integrity, mandatory DEK counter reservation, and canonical AAD.
   */
  static async createEpisode(
    patientId: string,
    data: EpisodeClinicalData,
    dek: CryptoKey,
    explicitId?: string,
    database: PhysioRecordDatabase = defaultDb
  ): Promise<EpisodeRecord> {
    if (!patientId || typeof patientId !== 'string') {
      throw new ReferentialIntegrityError('معرّف المريض غير صالح.');
    }

    // 1. Verify parent patient existence (Application-level referential integrity)
    const patient = await database.patients.get(patientId);
    if (!patient) {
      throw new ReferentialIntegrityError(`لا يمكن إنشاء حلقة رعاية: المريض بالمعرف "${patientId}" غير موجود.`);
    }

    // 2. Validate mandatory clinical fields
    if (!data.title?.trim()) {
      throw new Error('عنوان حلقة الرعاية إلزامي.');
    }
    if (!data.medicalDiagnosis?.trim()) {
      throw new Error('التشخيص الطبي الأولي إلزامي.');
    }
    if (!data.clinicalImpression?.trim()) {
      throw new Error('الانطباع السريري للعلاج الطبيعي إلزامي.');
    }
    if (!data.primarySpecialty) {
      throw new Error('تحديد التخصص السريري الرئيسي إلزامي.');
    }
    if (!data.affectedBodyRegion?.trim()) {
      throw new Error('المنطقة التشريحية المصابة إلزامية.');
    }

    const id = explicitId || crypto.randomUUID();

    // Check for duplicate ID
    const duplicate = await database.episodes.get(id);
    if (duplicate) {
      throw new Error(`حلقة الرعاية بالمعرف "${id}" موجودة مسبقاً.`);
    }

    // Get active DEK version from vaultMeta
    const meta = await database.vaultMeta.get('auth');
    const activeDekVersion = meta?.dekVersion || CURRENT_DEK_VERSION;

    const now = new Date().toISOString();
    const startDate = data.startDate || data.onsetDate || now.split('T')[0];
    const status: EpisodeStatus = data.status || 'active';
    const primarySpecialty = data.primarySpecialty;

    const fullClinicalData: EpisodeClinicalData = {
      ...data,
      status,
      primarySpecialty,
      startDate,
    };

    // Centralized encryption with MANDATORY invocation counter reservation
    // All clinical metadata (status, specialty, startDate) are sealed 100% inside ciphertext
    const { iv, ciphertext } = await encryptRecordWithMandatoryReservation(
      database,
      dek,
      'episodes',
      id,
      [patientId],
      fullClinicalData,
      CURRENT_RECORD_CRYPTO_VERSION,
      activeDekVersion
    );

    // Entity stored in IndexedDB: strictly random IDs and technical timestamps
    const entity: EncryptedEpisodeEntity = {
      id,
      patientId,
      createdAt: now,
      updatedAt: now,
      recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
      dekVersion: activeDekVersion,
      iv,
      ciphertext,
    };

    // Atomic write to Dexie
    await database.episodes.put(entity);

    return {
      id,
      patientId,
      status,
      primarySpecialty,
      startDate,
      createdAt: now,
      updatedAt: now,
      data: fullClinicalData,
    };
  }

  /**
   * Update an existing episode.
   */
  static async updateEpisode(
    episodeId: string,
    data: EpisodeClinicalData,
    dek: CryptoKey,
    database: PhysioRecordDatabase = defaultDb
  ): Promise<EpisodeRecord> {
    const existing = await this.getEpisodeById(episodeId, dek, database);
    if (!existing) {
      throw new Error(`حلقة الرعاية بالمعرف "${episodeId}" غير موجودة.`);
    }

    if (existing.status === 'archived') {
      throw new Error('لا يمكن تعديل حلقة رعاية مؤرشفة. يرجى إلغاء الأرشفة أولاً.');
    }

    const meta = await database.vaultMeta.get('auth');
    const activeDekVersion = meta?.dekVersion || CURRENT_DEK_VERSION;
    const now = new Date().toISOString();

    const updatedData: EpisodeClinicalData = {
      ...existing.data,
      ...data,
      status: existing.status,
      primarySpecialty: data.primarySpecialty || existing.primarySpecialty,
      startDate: data.startDate || data.onsetDate || existing.startDate,
      endDate: data.endDate || existing.endDate,
    };

    const { iv, ciphertext } = await encryptRecordWithMandatoryReservation(
      database,
      dek,
      'episodes',
      episodeId,
      [existing.patientId],
      updatedData,
      CURRENT_RECORD_CRYPTO_VERSION,
      activeDekVersion
    );

    const updatedEntity: EncryptedEpisodeEntity = {
      id: episodeId,
      patientId: existing.patientId,
      createdAt: existing.createdAt,
      updatedAt: now,
      recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
      dekVersion: activeDekVersion,
      iv,
      ciphertext,
    };

    await database.episodes.put(updatedEntity);

    return {
      id: episodeId,
      patientId: existing.patientId,
      status: updatedData.status || existing.status,
      primarySpecialty: updatedData.primarySpecialty,
      startDate: updatedData.startDate || existing.startDate,
      endDate: updatedData.endDate,
      createdAt: existing.createdAt,
      updatedAt: now,
      data: updatedData,
    };
  }

  /**
   * Change status of an episode (active, on_hold, completed, archived).
   */
  static async setEpisodeStatus(
    episodeId: string,
    newStatus: EpisodeStatus,
    dek: CryptoKey,
    statusNotes?: string,
    database: PhysioRecordDatabase = defaultDb
  ): Promise<EpisodeRecord> {
    const existing = await this.getEpisodeById(episodeId, dek, database);
    if (!existing) {
      throw new Error(`حلقة الرعاية بالمعرف "${episodeId}" غير موجودة.`);
    }

    const now = new Date().toISOString();
    let endDate = existing.endDate;
    if (newStatus === 'completed' && !endDate) {
      endDate = now.split('T')[0];
    } else if (newStatus === 'active') {
      endDate = undefined; // Re-opened
    }

    const updatedData: EpisodeClinicalData = {
      ...existing.data,
      status: newStatus,
      endDate,
      statusNotes: statusNotes || existing.data.statusNotes,
    };

    const meta = await database.vaultMeta.get('auth');
    const activeDekVersion = meta?.dekVersion || CURRENT_DEK_VERSION;

    const { iv, ciphertext } = await encryptRecordWithMandatoryReservation(
      database,
      dek,
      'episodes',
      episodeId,
      [existing.patientId],
      updatedData,
      CURRENT_RECORD_CRYPTO_VERSION,
      activeDekVersion
    );

    const updatedEntity: EncryptedEpisodeEntity = {
      id: episodeId,
      patientId: existing.patientId,
      createdAt: existing.createdAt,
      updatedAt: now,
      recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
      dekVersion: activeDekVersion,
      iv,
      ciphertext,
    };

    await database.episodes.put(updatedEntity);

    return {
      id: episodeId,
      patientId: existing.patientId,
      status: newStatus,
      primarySpecialty: existing.primarySpecialty,
      startDate: existing.startDate,
      endDate,
      createdAt: existing.createdAt,
      updatedAt: now,
      data: updatedData,
    };
  }

  /**
   * Close episode with discharge summary and end date.
   */
  static async closeEpisode(
    episodeId: string,
    dischargeInfo: {
      endDate: string;
      dischargeSummary: string;
      dischargeCriteriaSummary?: string;
    },
    dek: CryptoKey,
    database: PhysioRecordDatabase = defaultDb
  ): Promise<EpisodeRecord> {
    const existing = await this.getEpisodeById(episodeId, dek, database);
    if (!existing) {
      throw new Error(`حلقة الرعاية بالمعرف "${episodeId}" غير موجودة.`);
    }

    if (!dischargeInfo.dischargeSummary?.trim()) {
      throw new Error('ملخص الخروج والنتائج السريرية إلزامي لإغلاق حلقة الرعاية.');
    }

    const now = new Date().toISOString();
    const updatedData: EpisodeClinicalData = {
      ...existing.data,
      status: 'completed',
      endDate: dischargeInfo.endDate || now.split('T')[0],
      dischargeSummary: dischargeInfo.dischargeSummary.trim(),
      dischargeCriteriaSummary: dischargeInfo.dischargeCriteriaSummary?.trim(),
    };

    const meta = await database.vaultMeta.get('auth');
    const activeDekVersion = meta?.dekVersion || CURRENT_DEK_VERSION;

    const { iv, ciphertext } = await encryptRecordWithMandatoryReservation(
      database,
      dek,
      'episodes',
      episodeId,
      [existing.patientId],
      updatedData,
      CURRENT_RECORD_CRYPTO_VERSION,
      activeDekVersion
    );

    const updatedEntity: EncryptedEpisodeEntity = {
      id: episodeId,
      patientId: existing.patientId,
      createdAt: existing.createdAt,
      updatedAt: now,
      recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
      dekVersion: activeDekVersion,
      iv,
      ciphertext,
    };

    await database.episodes.put(updatedEntity);

    return {
      id: episodeId,
      patientId: existing.patientId,
      status: 'completed',
      primarySpecialty: existing.primarySpecialty,
      startDate: existing.startDate,
      endDate: updatedData.endDate,
      createdAt: existing.createdAt,
      updatedAt: now,
      data: updatedData,
    };
  }

  /**
   * Soft-archive episode (Default safe clinical action).
   */
  static async archiveEpisode(
    episodeId: string,
    dek: CryptoKey,
    database: PhysioRecordDatabase = defaultDb
  ): Promise<EpisodeRecord> {
    return this.setEpisodeStatus(episodeId, 'archived', dek, undefined, database);
  }

  /**
   * Unarchive episode back to active state.
   */
  static async unarchiveEpisode(
    episodeId: string,
    dek: CryptoKey,
    database: PhysioRecordDatabase = defaultDb
  ): Promise<EpisodeRecord> {
    return this.setEpisodeStatus(episodeId, 'active', dek, undefined, database);
  }

  /**
   * Safeguarded permanent deletion of an episode.
   * REJECTS deletion if there are child sessions attached to protect historical records.
   */
  static async deleteEpisodeSafeguarded(
    episodeId: string,
    database: PhysioRecordDatabase = defaultDb
  ): Promise<void> {
    const childSessionCount = await database.sessions.where('episodeId').equals(episodeId).count();
    if (childSessionCount > 0) {
      throw new Error(
        `لا يمكن الحذف الدائم: حلقة الرعاية تحتوي على (${childSessionCount}) جلسات علاجية مرتبطة. يرجى أرشفتها بدلاً من ذلك لحفظ السجل التاريخي للمريض.`
      );
    }
    await database.episodes.delete(episodeId);
  }
}
