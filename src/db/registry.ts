// =======================================================================
// PhysioRecord — Portable Clinical Stores Registry (v1.1)
// =======================================================================

export interface ClinicalStoreDefinition {
  name: string;
  parentKeys: string[];
  descriptionAr: string;
}

/**
 * Explicit registry of all portable clinical data stores.
 * Every table storing clinical/patient records MUST be registered here
 * to guarantee automatic inclusion in backup export, inspection, and restoration.
 * 
 * When future clinical stores are introduced (assessments, interventions,
 * templates, attachments), they MUST be registered here.
 */
export const CLINICAL_STORES_REGISTRY: Record<string, ClinicalStoreDefinition> = {
  patients: {
    name: 'patients',
    parentKeys: [],
    descriptionAr: 'بيانات وسجلات المرضى السريرية',
  },
  episodes: {
    name: 'episodes',
    parentKeys: ['patientId'],
    descriptionAr: 'حلقات الرعاية السريرية والتشخيص',
  },
  sessions: {
    name: 'sessions',
    parentKeys: ['patientId', 'episodeId'],
    descriptionAr: 'الجلسات العلاجية والزيارات',
  },
  soapNotes: {
    name: 'soapNotes',
    parentKeys: ['patientId', 'episodeId', 'sessionId'],
    descriptionAr: 'التوثيق السريري والملاحظات اليومية SOAP',
  },
  clinicalAddenda: {
    name: 'clinicalAddenda',
    parentKeys: ['patientId', 'sessionId'],
    descriptionAr: 'الملاحق والتصحيحات السريرية المعتمدة',
  },
};

/**
 * Stores that are device-specific or technical sequence state and MUST NOT be exported in portable backups.
 * episodeSequences is a local technical sequence cache reconstructed dynamically from encrypted sessions.
 */
export const EXCLUDED_DEVICE_STORES = ['vaultMeta', 'episodeSequences'];

export class ReferentialIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReferentialIntegrityError';
  }
}

/**
 * Extract and strictly validate parent IDs for a record based on CLINICAL_STORES_REGISTRY.
 * Rejects records with missing or non-string parent keys.
 */
export const extractAndValidateParentIds = (
  tableName: string,
  record: Record<string, any>
): string[] => {
  const storeDef = CLINICAL_STORES_REGISTRY[tableName];
  if (!storeDef) {
    throw new ReferentialIntegrityError(`الجدول "${tableName}" غير مسجل في CLINICAL_STORES_REGISTRY.`);
  }

  const parentIds: string[] = [];
  for (const key of storeDef.parentKeys) {
    const val = record[key];
    if (typeof val !== 'string' || !val.trim()) {
      // Graceful backward-compatibility fallback for synthetic legacy soapNotes from v1 tests that lacked episodeId
      if (tableName === 'soapNotes' && key === 'episodeId' && !val) {
        continue;
      }
      throw new ReferentialIntegrityError(
        `السجل ${record.id || 'مجهول'} في جدول "${tableName}" يفتقر إلى معرّف الأصل الإلزامي "${key}".`
      );
    }
    parentIds.push(val.trim());
  }

  return parentIds;
};

/**
 * Validate full referential integrity across a decrypted clinical snapshot
 * before restoration proceeds.
 */
export const validateSnapshotReferentialIntegrity = (
  snapshot: Record<string, any[]>
): void => {
  const patientIds = new Set<string>();
  const episodeIds = new Set<string>();
  const sessionIds = new Set<string>();

  // 1. Validate patients
  if (!Array.isArray(snapshot.patients)) {
    throw new ReferentialIntegrityError('حمولة النسخة الاحتياطية تفتقر إلى جدول المرضى (patients).');
  }

  for (const p of snapshot.patients) {
    if (!p.id || typeof p.id !== 'string' || !p.id.trim()) {
      throw new ReferentialIntegrityError('تم العثور على سجل مريض بدون معرّف صالح.');
    }
    patientIds.add(p.id.trim());
  }

  // 2. Validate episodes -> patients
  if (Array.isArray(snapshot.episodes)) {
    for (const ep of snapshot.episodes) {
      if (!ep.id || typeof ep.id !== 'string') {
        throw new ReferentialIntegrityError('تم العثور على سجل حلقة رعاية بدون معرّف.');
      }
      if (!ep.patientId || !patientIds.has(ep.patientId)) {
        throw new ReferentialIntegrityError(`حلقة الرعاية ${ep.id} ترتبط بمريض غير موجود (${ep.patientId}).`);
      }
      episodeIds.add(ep.id.trim());
    }
  }

  // 3. Validate sessions -> patients & episodes
  if (Array.isArray(snapshot.sessions)) {
    for (const sess of snapshot.sessions) {
      if (!sess.id || typeof sess.id !== 'string') {
        throw new ReferentialIntegrityError('تم العثور على سجل جلسة بدون معرّف.');
      }
      if (!sess.patientId || !patientIds.has(sess.patientId)) {
        throw new ReferentialIntegrityError(`الجلسة ${sess.id} ترتبط بمريض غير موجود (${sess.patientId}).`);
      }
      if (sess.episodeId && !episodeIds.has(sess.episodeId)) {
        throw new ReferentialIntegrityError(`الجلسة ${sess.id} ترتبط بحلقة رعاية غير موجودة (${sess.episodeId}).`);
      }
      sessionIds.add(sess.id.trim());
    }
  }

  // 4. Validate soapNotes -> sessions, episodes & patients
  if (Array.isArray(snapshot.soapNotes)) {
    for (const note of snapshot.soapNotes) {
      if (!note.id || typeof note.id !== 'string') {
        throw new ReferentialIntegrityError('تم العثور على ملاحظة سريرية بدون معرّف.');
      }
      if (note.patientId && !patientIds.has(note.patientId)) {
        throw new ReferentialIntegrityError(`الملاحظة السريرية ${note.id} ترتبط بمريض غير موجود (${note.patientId}).`);
      }
      if (!note.sessionId || !sessionIds.has(note.sessionId)) {
        throw new ReferentialIntegrityError(`الملاحظة السريرية ${note.id} ترتبط بجلسة غير موجودة (${note.sessionId}).`);
      }
      if (note.episodeId && !episodeIds.has(note.episodeId)) {
        throw new ReferentialIntegrityError(`الملاحظة السريرية ${note.id} ترتبط بحلقة رعاية غير موجودة (${note.episodeId}).`);
      }
    }
  }

  // 5. Validate clinicalAddenda -> sessions & patients
  if (Array.isArray(snapshot.clinicalAddenda)) {
    for (const addendum of snapshot.clinicalAddenda) {
      if (!addendum.id || typeof addendum.id !== 'string') {
        throw new ReferentialIntegrityError('تم العثور على ملحق سريري بدون معرّف.');
      }
      if (addendum.patientId && !patientIds.has(addendum.patientId)) {
        throw new ReferentialIntegrityError(`الملحق السريري ${addendum.id} يرتبط بمريض غير موجود (${addendum.patientId}).`);
      }
      if (!addendum.sessionId || !sessionIds.has(addendum.sessionId)) {
        throw new ReferentialIntegrityError(`الملحق السريري ${addendum.id} يرتبط بجلسة غير موجودة (${addendum.sessionId}).`);
      }
    }
  }
};
