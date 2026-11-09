// =======================================================================
// PhysioRecord — Clinical Domain Types & Database Entities (v1.1 / v5)
// =======================================================================

import type {
  OrthopedicSpecialTestItem,
  GaitPostureData,
  FunctionalScaleEntry,
} from './clinicalWidgets';

export type Gender = 'male' | 'female' | 'other';
export type DominantHand = 'right' | 'left' | 'ambidextrous';

export type EpisodeStatus = 'active' | 'completed' | 'on_hold' | 'archived';


export type SessionType = 
  | 'initial_evaluation'
  | 'follow_up'
  | 're_evaluation'
  | 'discharge_summary';

export type SessionStatus = 'draft' | 'finalized' | 'cancelled';

export type AttendanceStatus =
  | 'attended'
  | 'cancelled_patient'
  | 'cancelled_clinic'
  | 'no_show';

export type AddendumReason =
  | 'typographical_correction'
  | 'late_entry'
  | 'diagnostic_clarification'
  | 'adverse_event_late_documentation'
  | 'treatment_response_update';

export interface TerminologyInfo {
  en: string;
  ar: string;
  badgeClass?: string;
  descriptionAr?: string;
}

export const SESSION_TYPES: Record<SessionType, TerminologyInfo> = {
  initial_evaluation: {
    en: 'Initial Evaluation',
    ar: 'التقييم الأولي والشامل',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    descriptionAr: 'الفحص والتقييم السريري الشامل ووضع الخطة العلاجية',
  },
  follow_up: {
    en: 'Follow-up Session',
    ar: 'جلسة متابعة علاجية',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    descriptionAr: 'جلسة علاجية مستمرة وتنفيذ التدخلات والتمارين',
  },
  re_evaluation: {
    en: 'Re-evaluation',
    ar: 'إعادة تقييم سريري مرحلي',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
    descriptionAr: 'قياس التقدم ومراجعة الأهداف وتعديل مسار الخطة',
  },
  discharge_summary: {
    en: 'Discharge Session',
    ar: 'جلسة التخريج والإنهاء',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    descriptionAr: 'التقييم الختامي عند استيفاء الأهداف أو انتهاء دورة الرعاية',
  },
};

export const SESSION_STATUSES: Record<SessionStatus, TerminologyInfo> = {
  draft: {
    en: 'Draft',
    ar: 'مسودة قيد التحرير',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    descriptionAr: 'جلسة قيد الإعداد قابلة للتعديل والتوثيق',
  },
  finalized: {
    en: 'Finalized',
    ar: 'معتمدة ومغلقة',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    descriptionAr: 'جلسة معتمدة نهائياً غير قابلة للتعديل إلا بملحق تصحيحي',
  },
  cancelled: {
    en: 'Cancelled',
    ar: 'ملغاة',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
    descriptionAr: 'جلسة ملغاة مع توثيق سبب الإلغاء',
  },
};

export const ATTENDANCE_STATUSES: Record<AttendanceStatus, TerminologyInfo> = {
  attended: {
    en: 'Attended',
    ar: 'حضر وتلقى العلاج',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  cancelled_patient: {
    en: 'Cancelled by Patient',
    ar: 'ألغيت من قبل المريض',
    badgeClass: 'bg-slate-50 text-slate-700 border-slate-200',
  },
  cancelled_clinic: {
    en: 'Cancelled by Clinic',
    ar: 'ألغيت من قبل العيادة',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  no_show: {
    en: 'No Show',
    ar: 'تخلف عن الحضور دون إشعار',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
  },
};

export const ADDENDUM_REASONS: Record<AddendumReason, TerminologyInfo> = {
  typographical_correction: {
    en: 'Typographical Correction',
    ar: 'تصحيح إملائي أو لغوي',
  },
  late_entry: {
    en: 'Late Entry',
    ar: 'توثيق متأخر لمعلومات سابقة',
  },
  diagnostic_clarification: {
    en: 'Diagnostic Clarification',
    ar: 'توضيح تشخيصي سريري',
  },
  adverse_event_late_documentation: {
    en: 'Adverse Event Late Documentation',
    ar: 'توثيق طارئ لعارض جانبي',
  },
  treatment_response_update: {
    en: 'Treatment Response Update',
    ar: 'تحديث استجابة المريض للعلاج',
  },
};

export type AssessmentCategory = 
  | 'rom'
  | 'mmt'
  | 'special_tests'
  | 'neurological'
  | 'cardiopulmonary'
  | 'functional'
  | 'outcome_measure'
  | 'custom';

// -----------------------------------------------------------------------
// Decrypted Clinical Patient (In-Memory representation)
// -----------------------------------------------------------------------
export interface PatientDocumentAttachment {
  id: string;
  title: string;
  category: 'referral' | 'imaging_mri_xray' | 'lab_report' | 'consent' | 'other';
  dateAdded: string;
  summaryNotes?: string;
  fileName?: string;
}

export interface PatientClinicalData {
  fullName: string;
  fullNameAr?: string;
  dateOfBirth?: string; // YYYY-MM-DD
  age?: number;
  gender: Gender;
  phoneNumber?: string;
  address?: string;
  occupation?: string;
  dominantHand?: DominantHand;

  // Referral & Emergency Contact (Phase 4 Patient Profile Hub)
  referringPhysician?: string;
  referringClinic?: string;
  emergencyContactName?: string;
  emergencyContactRelation?: string;
  emergencyContactPhone?: string;
  
  // Medical & Clinical History
  medicalHistory?: string;
  previousSurgeries?: string;
  currentMedications?: string;
  allergies?: string;
  comorbidities?: string;
  precautions?: string;
  contraindications?: string;
  redFlags?: string;
  psychosocialFactors?: string;
  generalNotes?: string;
  attachments?: PatientDocumentAttachment[];

  profileSummaryUpdatedAt?: string; // ISO 8601 timestamp of last profile edit
}

export interface PatientRecord {
  id: string; // UUID v4
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
  isArchived: number; // 0 = active, 1 = archived
  data: PatientClinicalData; // Decrypted when in memory
}

// Stored in Dexie DB (Encrypted at rest with DEK + AAD)
export interface EncryptedPatientEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  isArchived: number; // 0 or 1 for indexing
  recordCryptoVersion: number; // Immutable per-record encryption format (e.g. 1)
  dekVersion: number; // Version of DEK used to encrypt this record (e.g. 1)
  iv: Uint8Array; // 12-byte random AES-GCM IV
  ciphertext: Uint8Array;
}

export type ClinicalSpecialty =
  | 'musculoskeletal'
  | 'neurological'
  | 'cardiopulmonary'
  | 'pediatric'
  | 'sports'
  | 'general'
  | 'geriatric';

export type OnsetMechanism =
  | 'traumatic'
  | 'insidious'
  | 'post_surgical'
  | 'congenital';

export interface StructuredRehabGoal {
  id: string;
  horizon: 'short_term' | 'long_term';
  description: string;
  targetMetric?: string; // e.g. 'Shoulder Flexion AROM >= 165°' or 'NPRS <= 2/10'
  targetWeeks?: number;
  progressPercent: number; // 0 - 100
  status: 'in_progress' | 'achieved' | 'modified';
}

// -----------------------------------------------------------------------
// Episode of Care
// -----------------------------------------------------------------------
export interface EpisodeClinicalData {
  title: string;
  status?: EpisodeStatus; // Enclosed 100% within encrypted payload (defaults to 'active')
  primarySpecialty: ClinicalSpecialty; // Enclosed 100% within encrypted payload
  startDate?: string; // Enclosed 100% within encrypted payload (defaults to onsetDate or today)
  endDate?: string; // Enclosed 100% within encrypted payload
  referralSource?: string;
  referringDoctor?: string;
  medicalDiagnosis: string;
  icd10Code?: string;
  clinicalImpression: string;
  affectedBodyRegion: string;
  onsetMechanism?: OnsetMechanism;
  onsetDate?: string;

  // Phase 5 Structured Initial Evaluation Subjective & Plan of Care
  chiefComplaint?: string;
  historyOfPresentIllness?: string;
  aggravatingFactors?: string;
  relievingFactors?: string;
  functionalLimitations?: string;
  patientGoals?: string;
  treatmentFrequency?: string; // e.g., '3 sessions / week'
  plannedDurationWeeks?: number; // e.g., 6
  episodePrecautions?: string;

  rehabilitationGoals: {
    shortTerm: string[];
    longTerm: string[];
  };
  structuredGoals?: StructuredRehabGoal[];
  dischargeCriteriaSummary?: string;
  dischargeSummary?: string;
  dischargeReason?: 'goals_met' | 'plateau' | 'medical_referral' | 'self_discharge';
  dischargeFinalOutcomeNote?: string;
  statusNotes?: string;
  isOngoingLegacyEpisode?: boolean;
  knownVsUnknownHistoryFlags?: {
    isDiagnosisConfirmed: boolean;
    isOnsetDateExact: boolean;
    areBaselineGoalsFormalized: boolean;
  };
}

export interface EpisodeRecord {
  id: string;
  patientId: string;
  status: EpisodeStatus;
  primarySpecialty: ClinicalSpecialty;
  startDate: string; // ISO 8601
  endDate?: string;
  createdAt: string;
  updatedAt: string;
  data: EpisodeClinicalData;
}

export interface EncryptedEpisodeEntity {
  id: string;
  patientId: string;
  createdAt: string;
  updatedAt: string;
  recordCryptoVersion: number;
  dekVersion: number;
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

// -----------------------------------------------------------------------
// Clinical Error Classes
// -----------------------------------------------------------------------
export class CannotDeleteFinalizedRecordError extends Error {
  constructor(message = 'لا يمكن حذف سجل سريري معتمد نهائياً. يجب الحفاظ على السجلات السريرية التاريخية.') {
    super(message);
    this.name = 'CannotDeleteFinalizedRecordError';
  }
}

export class PatientHardDeletionBlockedError extends Error {
  constructor(message = 'الحذف المادي النهائي للمريض معطل ومحظور وفق سياسة الأمان والاحتفاظ السريري.') {
    super(message);
    this.name = 'PatientHardDeletionBlockedError';
  }
}

export class VaultGenerationChangedError extends Error {
  constructor(
    message = 'تم تغيير جيل الخزينة (Vault Generation Changed) بواسطة عملية استعادة كاملة أثناء العملية. تم إلغاء العملية لحماية اتساق التشفير وقاعدة البيانات.'
  ) {
    super(message);
    this.name = 'VaultGenerationChangedError';
  }
}

export class UnboundVaultKeyError extends Error {
  constructor(
    message = 'تم رفض العملية السريرية: مفتاح التشفير التشغيلي (DEK) غير مرتبط بأي جيل خزينة معتمد (Unbound Vault Key). لا يمكن تنفيذ التشفير أو حجز الأرقام التسلسلية بمفتاح مجهول الجيل.'
  ) {
    super(message);
    this.name = 'UnboundVaultKeyError';
  }
}

export class StaleTabOverwriteError extends Error {
  constructor(
    message = 'تم تعديل هذا السجل في تبويب آخر (Changed in another tab). يرجى إعادة تحميل الجلسة لتجنب الكتابة فوق التعديلات الأحدث.'
  ) {
    super(message);
    this.name = 'StaleTabOverwriteError';
  }
}

export interface PatientDependentRecordsSummary {
  patientId: string;
  episodesCount: number;
  sessionsCount: number;
  soapNotesCount: number;
  clinicalAddendaCount: number;
  appointmentsCount: number;
  waitingListCount: number;
  invoicesCount: number;
  paymentsCount: number;
  episodeClinicalCount: number;
}

export const CURRENT_SEAL_VERSION = 1;

export type SealVerificationStatus = 'valid' | 'unsealed' | 'mismatch';

export interface SealVerificationResult {
  status: SealVerificationStatus;
  expected?: string;
  actual?: string;
}

/**
 * Amendment D Feature Flag (default: false):
 * Freezes the legacy SoapModal ROM/MMT/BodyChart/Neuro write path so only ONE writer
 * (`MasterPatientChart` -> `ActiveExamCanvas` -> `episodeClinical`) exists for ROM/MMT/Body Chart,
 * while preserving any existing ROM/MMT/BodyChart inside `db.soapNotes` rows untouched.
 */
export const ENABLE_LEGACY_SOAP_MODAL_ROM_MMT_BODYCHART_WRITES = false;

// -----------------------------------------------------------------------
// Clinical Session (Phase 2B.2)
// -----------------------------------------------------------------------
export interface SessionClinicalData {
  sessionNumber: number; // sequential 1-based index within episode
  sessionDate: string; // YYYY-MM-DD (Actual clinical date)
  sessionTime?: string; // HH:mm
  sessionDurationMinutes?: number; // duration in minutes (e.g. 45)
  sessionType: SessionType;
  status: SessionStatus;
  attendanceStatus: AttendanceStatus;
  cancellationReason?: string;
  administrativeNotes?: string;
  therapistName?: string;
  finalizedAt?: string; // ISO 8601
  finalizedBy?: string;
  attestationByTherapistName?: string; // Clinician Attestation (إقرار ومصادقة المعالج السريري)
  attestationTimestamp?: string;
  sealVersion?: number; // 1 = canonical sorted-key SHA-256 integrity seal
  contentIntegrityDigestSha256?: string; // SHA-256 cryptographic content match digest (does not constitute an independent PKI digital signature)
}

export interface SessionRecord {
  id: string;
  episodeId: string;
  patientId: string;
  sessionNumber: number;
  sessionDate: string;
  sessionType: SessionType;
  status: SessionStatus;
  attendanceStatus: AttendanceStatus;
  createdAt: string;
  updatedAt: string;
  data: SessionClinicalData;
}

// -----------------------------------------------------------------------
// Technical Sequence Metadata (Cross-Tab Atomic Session Numbering)
// -----------------------------------------------------------------------
// Stored in Dexie DB 'episodeSequences' table as technical metadata to serialize
// and guarantee atomic session numbering across multiple concurrent browser tabs.
// 
// PRIVACY MODEL & OPERATIONAL METADATA DISCLOSURE:
// - `allocatedTokens`: Keyed HMAC Tokens (derived via HKDF-SHA-256 with domain separation
//   from the master DEK), strictly NOT reversible encrypted ciphertext. They provide a one-way
//   opaque reservation set. An attacker without the DEK cannot invert them to learn session numbers.
// - `lastSequenceNumber`: Disclosed as an unencrypted technical Operational Counter. It reveals
//   the highest monotonic session sequence number reserved so far within this episode, enabling
//   O(1) auto-incrementing across browser tabs without sequential candidate guessing attacks.
// - `allocatedTokens.length`: Disclosed Operational Metadata. The count of elements in
//   allocatedTokens directly reveals the current total number of active reservations for this episode.
// - METADATA DISCLOSURE POLICY: We do NOT make false claims that all metadata is concealed.
//   While actual clinical session numbers and data never exist in plaintext in IndexedDB,
//   the monotonic sequence ceiling (lastSequenceNumber) and the total allocation count
//   (allocatedTokens.length) are visible operational metadata in IndexedDB.
export interface EpisodeSequenceEntity {
  episodeId: string; // Primary key '&episodeId'
  lastSequenceNumber: number; // Highest allocated session sequence counter (Operational Metadata)
  allocatedTokens: string[]; // Keyed HMAC-SHA-256 reservation tokens (one-way, non-reversible)
  updatedAt: string;
}

// Stored in Dexie DB (Encrypted at rest with DEK + AAD: sessions:id:patientId,episodeId:1:dekVersion)
// No Plaintext Clinical Payload — Technical Metadata Remains Visible
// Clinical attributes (sessionType, sessionDate, status, etc.) are 100% inside ciphertext;
// technical metadata (id, episodeId, patientId, createdAt, updatedAt) remains visible for indexing.
export interface EncryptedSessionEntity {
  id: string;
  episodeId: string;
  patientId: string;
  createdAt: string;
  updatedAt: string;
  recordCryptoVersion: number;
  dekVersion: number;
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

// -----------------------------------------------------------------------
// SOAP Clinical Documentation (Phase 2B.2: 1:1 with ClinicalSession)
// -----------------------------------------------------------------------

export interface PainAssessmentNRS {
  scale: 'NRS_0_10';
  score: number; // 0 - 10
  range: '0-10';
  unit: 'points';
  assessedAt: string; // YYYY-MM-DD or ISO 8601
  scoreAtRest?: number; // 0 - 10
  scoreWithMovement?: number; // 0 - 10
  scoreBestLast24h?: number; // 0 - 10
  scoreWorstLast24h?: number; // 0 - 10
  contextNotes?: string;
}

export const PAIN_SCALES = {
  NRS: {
    id: 'NRS_0_10' as const,
    en: 'Pain Numeric Rating Scale (NRS 0–10)',
    ar: 'مقياس الألم الرقمي (NRS 0–10)',
    range: '0–10',
    unit: 'points',
    descriptionAr: 'مقياس عددي من 0 إلى 10 (0: لا يوجد ألم، 10: أقصى ألم ممكن) لتقييم شدة الألم ذاتياً أثناء الراحة والحركة.',
    descriptionEn: '11-point numeric rating scale (0–10) assessing self-reported pain intensity at rest and during activity.',
  },
};

// =======================================================================
// Phase 2C — Milestone 2: Patient Body Chart (Encrypted Clinical Mapping)
// =======================================================================

export type BodySymptomType =
  | 'pain_sharp'
  | 'pain_dull'
  | 'numbness'
  | 'tingling'
  | 'burning'
  | 'stiffness';

export type BodyChartView = 'anterior' | 'posterior';

export interface BodyChartMarker {
  markerId: string; // UUID v4
  symptomType: BodySymptomType;
  view: BodyChartView;
  xPercent: number; // 0.0 - 100.0% relative to SVG viewBox width
  yPercent: number; // 0.0 - 100.0% relative to SVG viewBox height
  anatomicalRegionCode: string; // e.g. 'low_back_lumbar', 'shoulder_right_anterior'
  anatomicalRegionLabelAr?: string;
  anatomicalRegionLabelEn?: string;
  severityNrs?: number; // 0 - 10
  description?: string; // تفاصيل إضافية يكتبها المعالج لهذه النقطة
  createdAt: string; // ISO 8601
}

export interface PatientBodyChartData {
  chartVersion: '1.0.0';
  markers: BodyChartMarker[];
  clinicianSummaryNotes?: string;
  lastUpdatedAt: string; // ISO 8601
}

export const BODY_SYMPTOM_TYPES: Record<
  BodySymptomType,
  {
    id: BodySymptomType;
    ar: string;
    en: string;
    colorHex: string;
    badgeClass: string;
    symbolLabel: string;
  }
> = {
  pain_sharp: {
    id: 'pain_sharp',
    ar: 'ألم حاد / طاعن',
    en: 'Sharp / Lancinating Pain',
    colorHex: '#EF4444',
    badgeClass: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800',
    symbolLabel: '▲',
  },
  pain_dull: {
    id: 'pain_dull',
    ar: 'ألم كليل / عميق',
    en: 'Dull / Aching Pain',
    colorHex: '#DC2626',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
    symbolLabel: '●',
  },
  numbness: {
    id: 'numbness',
    ar: 'خدر / نقص إحساس',
    en: 'Numbness / Hypoesthesia',
    colorHex: '#3B82F6',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
    symbolLabel: '■',
  },
  tingling: {
    id: 'tingling',
    ar: 'وخز وتنميل عصبي',
    en: 'Tingling / Paresthesia',
    colorHex: '#F59E0B',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    symbolLabel: '◆',
  },
  burning: {
    id: 'burning',
    ar: 'ألم حارق',
    en: 'Burning / Dysesthesia',
    colorHex: '#F97316',
    badgeClass: 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800',
    symbolLabel: '★',
  },
  stiffness: {
    id: 'stiffness',
    ar: 'تيبّس وشد عضلي',
    en: 'Stiffness / Tightness',
    colorHex: '#8B5CF6',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
    symbolLabel: '⬟',
  },
};

export type ExerciseAnatomicalRegion =
  | 'cervical'
  | 'shoulder'
  | 'elbow_wrist'
  | 'thoracic_lumbar'
  | 'hip_pelvis'
  | 'knee'
  | 'ankle_foot'
  | 'neuro_balance';

export interface FlowsheetExerciseEntry {
  id: string;
  exerciseId?: string;
  nameAr: string;
  nameEn: string;
  region: ExerciseAnatomicalRegion;
  sets: number;
  reps: number;
  holdSeconds: number;
  loadOrBand: string; // e.g. 'Yellow Band', '3 kg', 'Bodyweight'
  rpeOrPainResponse: 'pain_free' | 'mild_discomfort' | 'painful_modified';
  notes?: string;
}

export interface ManualTherapyFlowsheetEntry {
  id: string;
  techniqueAr: string;
  techniqueEn: string;
  targetJointOrTissue: string;
  gradeOrIntensity: 'Grade I' | 'Grade II' | 'Grade III' | 'Grade IV' | 'MWM' | 'Soft Tissue';
  durationMinutes: number;
  patientResponse?: string;
}

export interface PhysicalAgentFlowsheetEntry {
  id: string;
  modality:
    | 'TENS'
    | 'IFC'
    | 'Ultrasound'
    | 'NMES'
    | 'Laser'
    | 'Cryotherapy'
    | 'HotPack'
    | 'DryNeedling'
    | 'Shockwave'
    | 'Traction';
  modalityAr: string;
  site: string;
  parameters: string;
  durationMinutes: number;
}

/**
 * Unified SOAP Objective Flowsheet (embedded inside SoapObjectiveData.flowsheet).
 * Note: Pre-session pain lives exclusively in `subjective.painNrsScore`, and
 * post-session pain lives in `subjective.postSessionPainNrs` (no duplicate pain fields here).
 */
export interface SoapFlowsheetData {
  exercises: FlowsheetExerciseEntry[];
  manualTherapy: ManualTherapyFlowsheetEntry[];
  physicalAgents: PhysicalAgentFlowsheetEntry[];
}

export interface LegacyPainDetail {
  scoreAtRest?: number;
  scoreWithMovement?: number;
  scoreBestLast24h?: number;
  scoreWorstLast24h?: number;
  contextNotes?: string;
  assessedAt?: string;
}

export interface SoapSubjectiveData {
  chiefComplaint?: string; // شكوى المريض الحالية
  symptomChangesSinceLastSession?: string; // تغير الأعراض منذ الجلسة السابقة
  painNrsScore?: number; // 0 - 10 Pre-Session Numeric Rating Scale (NRS) — Single source of truth for pre-session pain (undefined when not recorded)
  painNotRecorded?: boolean; // Explicitly marked "not recorded" (لم يُسجّل) for pre-session pain
  postSessionPainNrs?: number; // 0 - 10 Post-Session Numeric Rating Scale (NRS) (undefined when not recorded)
  postPainNotRecorded?: boolean; // Explicitly marked "not recorded" (لم يُسجّل) for post-session pain
  painLocationDescription?: string; // موضع الألم وطبيعته حسب وصف المريض
  bodyChart?: PatientBodyChartData; // مخطط رسم وتوثيق أعراض المريض السريري المشفر (Milestone 2)
  homeExerciseCompliance?: 'full' | 'partial' | 'non_compliant' | 'not_prescribed'; // الالتزام بالتمارين المنزلية
  homeExerciseComplianceNotes?: string;
  responseToPreviousTreatment?: string; // استجابة المريض للعلاج السابق
  /** Read-only preserved legacy pain sub-fields (scoreAtRest, scoreWithMovement, 24h best/worst, contextNotes) */
  legacyPainDetail?: LegacyPainDetail;
  /** @deprecated Legacy read-only field — do not write in v2 */
  painAssessment?: PainAssessmentNRS;
  /** @deprecated Legacy read-only field — do not write in v2 */
  painVasCurrent?: number;
  /** @deprecated Legacy read-only field — do not write in v2 */
  painVasBestLast24h?: number;
  /** @deprecated Legacy read-only field — do not write in v2 */
  painVasWorstLast24h?: number;
}

// =======================================================================
// Phase 2C — Milestone 3: ROM & MMT Clinical Assessment Batteries
// =======================================================================

export type RomMovementType = 'AROM' | 'PROM' | 'AAROM';
export type BodyLaterality = 'right' | 'left' | 'bilateral' | 'midline';

export type RomEndFeel =
  | 'normal_capsular_firm'
  | 'normal_bone_to_bone'
  | 'normal_soft_tissue_approximation'
  | 'abnormal_empty_pain'
  | 'abnormal_muscle_spasm'
  | 'abnormal_springy_block'
  | 'abnormal_capsular_early';

export type ClinicalNonTestableReason =
  | 'severe_acute_pain'
  | 'surgical_or_post_op_precaution'
  | 'fracture_or_joint_instability'
  | 'cast_or_splint_immobilized'
  | 'severe_spasticity'
  | 'patient_refused_or_fatigued';

export type MmtGradeValue =
  | '0'
  | '1'
  | '2-' | '2' | '2+'
  | '3-' | '3' | '3+'
  | '4-' | '4' | '4+'
  | '5';

export type MmtGravityCondition = 'against_gravity' | 'gravity_eliminated';

export interface RomMeasurementEntry {
  entryId: string; // UUID v4
  jointId: string; // e.g. 'shoulder', 'knee', 'cervical_spine'
  jointNameAr: string;
  jointNameEn: string;
  movementId: string; // e.g. 'flexion', 'extension', 'abduction'
  movementNameAr: string;
  movementNameEn: string;
  movementType: RomMovementType; // 'AROM' | 'PROM' | 'AAROM'
  laterality: BodyLaterality; // 'right' | 'left' | 'bilateral' | 'midline'
  isTested: boolean;
  measuredAngleDegrees: number | null; // null when isTested === false
  referenceUninvolvedAngleDegrees?: number | null; // optional contralateral reference angle
  endFeel?: RomEndFeel;
  painNrsScore?: number; // 0 - 10
  reasonNotTested?: ClinicalNonTestableReason;
  clinicalNotes?: string;
}

export interface RomAssessmentBatteryData {
  batteryVersion: '1.0.0';
  entries: RomMeasurementEntry[];
  updatedAt: string;
}

export interface MmtMeasurementEntry {
  entryId: string; // UUID v4
  muscleGroupId: string; // e.g. 'shoulder_abductors', 'knee_extensors', 'ankle_dorsiflexors'
  muscleNameAr: string;
  muscleNameEn: string;
  actionNameAr: string;
  actionNameEn: string;
  laterality: BodyLaterality;
  gravityCondition: MmtGravityCondition;
  isTested: boolean;
  gradeValue: MmtGradeValue | null; // null when isTested === false
  painNrsScore?: number; // 0 - 10
  substitutionObserved?: boolean;
  reasonNotTested?: ClinicalNonTestableReason;
  clinicalNotes?: string;
}

export interface MmtAssessmentBatteryData {
  batteryVersion: '1.0.0';
  entries: MmtMeasurementEntry[];
  updatedAt: string;
}

// -----------------------------------------------------------------------
// Neurological Screening Domain Types (Patient-Specific Screening in Session)
// -----------------------------------------------------------------------
export type SensoryFindingStatus =
  | 'intact'          // طبيعي (Normal / Intact)
  | 'hypoesthesia'    // نقص حس / خدر (Decreased / Reduced)
  | 'hyperesthesia'   // فرط حس (Increased / Hypersensitive)
  | 'anesthesia'      // انعدام حس (Absent)
  | 'paresthesia'     // وخز وتنميل (Tingling / Pins & Needles)
  | 'not_tested';

export type ReflexGradeValue = '0' | '1+' | '2+' | '3+' | '4+' | 'not_tested';

export interface DermatomeSensoryEntry {
  rootLevel: string; // 'C2' .. 'S4'
  rightStatus: SensoryFindingStatus;
  leftStatus: SensoryFindingStatus;
  notes?: string;
}

export interface MyotomeMotorEntry {
  rootLevel: string; // 'C5', 'C6', 'C7', 'C8', 'T1', 'L2', 'L3', 'L4', 'L5', 'S1'
  movementLabelEn: string;
  movementLabelAr: string;
  rightGrade: MmtGradeValue | 'NT' | null;
  leftGrade: MmtGradeValue | 'NT' | null;
  notes?: string;
}

export interface DtrAssessmentEntry {
  reflexId: 'biceps' | 'brachioradialis' | 'triceps' | 'patellar' | 'achilles';
  reflexLabelEn: string;
  reflexLabelAr: string;
  rootLevel: string;
  rightGrade: ReflexGradeValue | null;
  leftGrade: ReflexGradeValue | null;
  notes?: string;
}

export interface NeuroScreeningBatteryData {
  batteryVersion: '1.0.0';
  dermatomes: DermatomeSensoryEntry[];
  myotomes: MyotomeMotorEntry[];
  reflexes: DtrAssessmentEntry[];
  clinicalNotes?: string;
  updatedAt: string;
}

export type ObjectiveAssessmentStatus = 'assessed' | 'normal_findings' | 'not_assessed';

export interface SoapObjectiveData {
  status?: ObjectiveAssessmentStatus; // 'assessed' | 'normal_findings' | 'not_assessed'
  objectiveFindings?: string; // نتائج الفحص والملاحظات الموضوعية
  clinicalObservations?: string; // المشاهدات السريرية (المشية، القوام، التورم)
  observationPosture?: string;
  palpationFindings?: string;
  circumferenceEdemaNotes?: string;
  functionalOrPreliminaryMeasurements?: string; // قياسات أولية/وظيفية عامة قبل وحدات ROM/MMT
  romBattery?: RomAssessmentBatteryData; // بطارية قياس المدى الحركي (Milestone 3)
  mmtBattery?: MmtAssessmentBatteryData; // بطارية الفحص العضلي اليدوي (Milestone 3)
  neuroScreening?: NeuroScreeningBatteryData; // الفحص العصبي السريري (Myotomes / Dermatomes / Reflexes)
  specialTests?: OrthopedicSpecialTestItem[]; // الفحوصات الاستفزازية الخاصة
  gaitPosture?: GaitPostureData; // تحليل المشية والتوازن
  functionalScales?: FunctionalScaleEntry; // المقاييس الوظيفية المعتمدة (ODI / QuickDASH / LEFS / NDI)
  customWidgetsData?: Record<string, Record<string, unknown>>; // بيانات الوحدات السريرية المخصصة
  flowsheet?: SoapFlowsheetData; // جدول التمارين والعلاج اليدوي والوسائل الفيزيائية للجلسة (Single Source of Truth)
  dailyInterventionsSummary?: string; // ملخص التدخلات الحر المكتوب بواسطة المعالج فقط (Free-text only; never stores compiled flowsheet)
  legacyCompiledSummary?: string; // Read-only preserved compiled summary from legacy notes
  isWithinNormalLimits?: boolean; // نتائج الفحص طبيعية بالكامل ضمن الحدود المقبولة
  notAssessedReason?: string; // سبب عدم إجراء فحص موضوعي (إلزامي إذا تم اختيار not_assessed)
}

export interface SoapAssessmentData {
  clinicalImpressionCurrent?: string; // التفسير السريري الحالي (Mandatory for finalize)
  progressStatus?: 'improved' | 'unchanged' | 'regressed' | 'plateau'; // تقدم أو تراجع الحالة (starts unselected in draft; mandatory for finalize)
  patientTolerance?: 'well_tolerated' | 'moderate_fatigue' | 'poorly_tolerated'; // استجابة المريض وتحمله (starts unselected in draft)
  factorsImpactingProgress?: string; // المشكلات أو العوامل التي تتطلب اهتماماً سريرياً
}

export interface SoapPlanData {
  nextSessionPlan?: string; // الخطة للجلسة القادمة
  proposedModifications?: string; // التعديلات العلاجية المقترحة
  homeInstructions?: string; // التعليمات والمتابعة المنزلية
  nextAppointmentDate?: string; // تاريخ الموعد القادم
}

export type NullableClear<T> = {
  [K in keyof T]?: T[K] | null | undefined;
};

export interface SoapNoteUpdateInput {
  soapSchemaVersion?: number;
  subjective?: NullableClear<SoapSubjectiveData>;
  objective?: NullableClear<SoapObjectiveData>;
  assessment?: NullableClear<SoapAssessmentData>;
  plan?: NullableClear<SoapPlanData>;
  isFinalized?: boolean;
  legacyUnreviewed?: boolean;
}

export const CURRENT_SOAP_SCHEMA_VERSION = 2;

export interface SoapNoteData {
  soapSchemaVersion?: number; // 1 = legacy SOAP, 2 = unified SOAP with embedded flowsheet & postSessionPainNrs
  subjective: SoapSubjectiveData;
  objective: SoapObjectiveData;
  assessment: SoapAssessmentData;
  plan: SoapPlanData;
  isFinalized?: boolean;
  finalizedAt?: string;
  finalizedBy?: string;
  sealVersion?: number; // 1 = canonical sorted-key SHA-256 integrity seal
  contentDigestSha256?: string;
  repairedDuringMigration?: boolean; // Honest marker when half-finalized note was repaired from finalized session
  repairedAt?: string;
  legacyUnreviewed?: boolean; // True when created by schema < 2 or repaired from pre-1A-i.5 note until explicitly reviewed and signed
  legacyReviewedAt?: string; // ISO 8601 timestamp when clinician confirmed review of legacy draft at Sign & Lock
  legacyReviewedBy?: string; // Self-declared clinician label who confirmed review of legacy draft at Sign & Lock
}

export interface SoapNoteRecord {
  id: string;
  sessionId: string;
  episodeId: string;
  patientId: string;
  createdAt: string;
  updatedAt: string;
  data: SoapNoteData;
}

// Stored in Dexie DB (Encrypted at rest with DEK + AAD: soapNotes:id:patientId,episodeId,sessionId:1:dekVersion)
// 1:1 unique constraint on sessionId
export interface EncryptedSoapEntity {
  id: string;
  sessionId: string;
  episodeId: string;
  patientId: string;
  createdAt: string;
  updatedAt: string;
  recordCryptoVersion: number;
  dekVersion: number;
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

// -----------------------------------------------------------------------
// Clinical Addendum (Phase 2B.2: Post-finalization Amendments)
// -----------------------------------------------------------------------
export interface ClinicalAddendumData {
  targetTable: 'sessions' | 'soapNotes';
  targetId: string;
  reasonForAmendment: AddendumReason;
  amendmentText: string;
  signedByTherapistName: string;
  parentIntegrityHashAtTimeOfAddendum?: string;
  createdAt: string;
}

export interface ClinicalAddendumRecord {
  id: string;
  sessionId: string;
  patientId: string;
  targetId: string;
  createdAt: string;
  data: ClinicalAddendumData;
}

export interface EncryptedClinicalAddendumEntity {
  id: string;
  sessionId: string;
  patientId: string;
  targetId: string;
  createdAt: string;
  recordCryptoVersion: number;
  dekVersion: number;
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

// -----------------------------------------------------------------------
// Vault Metadata (Envelope Encryption v1.1)
// -----------------------------------------------------------------------
export interface VaultMetaEntity {
  id: string; // 'auth'
  salt: Uint8Array; // 16 bytes for Vault KEK derivation
  wrappedDek: Uint8Array; // Raw DEK encrypted by Vault KEK
  wrappedDekIv: Uint8Array; // 12-byte IV for wrappedDek
  verifierIv: Uint8Array; // 12-byte IV for verifier
  verifierCiphertext: Uint8Array; // Encrypted verifier token
  schemaVersion: number; // Dexie schema version (independent of recordCryptoVersion)
  kdfAlgorithm: string; // 'PBKDF2-HMAC-SHA256'
  kdfIterations: number; // 600,000
  dekVersion: number; // Version of the active operational DEK
  encryptionInvocationCount: number; // Aggregate key-usage limit under current DEK (not a mathematical guarantee of random IV uniqueness)
  vaultGeneration?: number; // Technical generation/epoch counter to fence out concurrent stale writes across full restore
}

// -----------------------------------------------------------------------
// Backup Package (.ptbackup v1.1)
// -----------------------------------------------------------------------
export interface BackupHeader {
  magic: string; // 'PHYSIORECORD_BACKUP_V1.1'
  exportDateUtc: string; // ISO 8601 UTC
  clinicTimezone: string; // 'Asia/Baghdad'
  schemaVersion: number;
  kdfAlgorithm: string; // 'PBKDF2-HMAC-SHA256'
  kdfIterations: number; // 600,000
  keyExpansion: string; // 'HKDF-SHA256'
  hkdfHash: string; // 'SHA-256'
  hkdfSalt: Uint8Array; // 32 bytes dedicated cryptographically random HKDF salt
  hkdfInfoDekWrap: string; // 'physiorecord-backup-dek-wrap-v1.1'
  hkdfInfoPayloadEnc: string; // 'physiorecord-backup-payload-enc-v1.1'
  derivedKeyLengthBits: number; // 256
  backupSalt: Uint8Array; // 16 bytes PBKDF2 salt
  backupWrappedDek: Uint8Array; // Raw DEK wrapped by Backup DEK Wrap Key
  backupDekIv: Uint8Array; // 12 bytes
  backupDataIv: Uint8Array; // 12 bytes
  dekVersion: number; // e.g. 1
  encryptionInvocationCount: number; // Recorded aggregate invocation count from source
  maxBackupSizeBytes: number; // Enforced maximum backup size limit (25 MB)
  payloadLength?: number;
}

// -----------------------------------------------------------------------
// Dexie v5 Encrypted Entities for Clinic Operations & Workspace Stores
// (AES-256-GCM encrypted with per-record 12-byte IV & canonical entity-bound AAD)
// -----------------------------------------------------------------------

export interface EncryptedAppointmentEntity {
  id: string;
  patientId: string;
  createdAt: string;
  updatedAt: string;
  recordCryptoVersion: number;
  dekVersion: number;
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

export interface EncryptedWaitingListEntity {
  id: string;
  patientId?: string;
  createdAt: string;
  updatedAt: string;
  recordCryptoVersion: number;
  dekVersion: number;
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

export interface EncryptedInvoiceEntity {
  id: string;
  patientId: string;
  episodeId?: string;
  createdAt: string;
  updatedAt: string;
  recordCryptoVersion: number;
  dekVersion: number;
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

export interface EncryptedPaymentEntity {
  id: string;
  invoiceId: string;
  patientId: string;
  createdAt: string;
  updatedAt: string;
  recordCryptoVersion: number;
  dekVersion: number;
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

export interface EncryptedExpenseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  recordCryptoVersion: number;
  dekVersion: number;
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

export interface EncryptedAuditLogEntity {
  id: string;
  patientId?: string;
  episodeId?: string;
  createdAt: string;
  recordCryptoVersion: number;
  dekVersion: number;
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

export interface EncryptedStaffStateEntity {
  id: string; // e.g. 'active_staff'
  updatedAt: string;
  recordCryptoVersion: number;
  dekVersion: number;
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

export interface EncryptedEpisodeClinicalEntity {
  id: string; // matches episodeId
  episodeId: string;
  patientId: string;
  createdAt: string;
  updatedAt: string;
  recordCryptoVersion: number;
  dekVersion: number;
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

export interface EncryptedCustomWidgetEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
  recordCryptoVersion: number;
  dekVersion: number;
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

export interface EncryptedMigrationReportEntity {
  id: string;
  createdAt: string;
  recordCryptoVersion: number;
  dekVersion: number;
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

export interface MigrationPainConflictRecord {
  sessionId: string;
  soapId: string;
  soapPainNrsScore: number;
  flowsheetPreSessionPainNrs: number;
  resolution: 'flowsheet_won' | 'skipped_finalized_sealed';
}

export interface MigrationOrphanFlowsheetRecord {
  key: string;
  sessionId: string;
  reason: string;
}

export interface MigrationCorruptKeyRecord {
  key: string;
  errorReason: string;
}

export interface MigrationReportPayload {
  id: string;
  createdAt: string;
  vaultGeneration: number;
  dryRun: boolean;
  migratedKeys: string[];
  skippedAlreadyCompletedKeys: string[];
  skippedNonClinicalKeys: string[];
  countsByTable: Record<string, number>;
  painConflicts: MigrationPainConflictRecord[];
  orphanFlowsheets: MigrationOrphanFlowsheetRecord[];
  corruptKeys: MigrationCorruptKeyRecord[];
}

/**
 * Non-PHI technical state record tracking resumable/idempotent localStorage-to-Dexie v5 migration
 * and post-unlock half-finalized session repair.
 */
export interface MigrationStateEntity {
  id: string; // 'localStorage_v5_migration' | 'half_finalized_soap_repair_v1'
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  vaultGeneration?: number;
  completedKeyHashes: string[];
  failedKeyCount: number;
  repairedSoapNotesCount: number;
  conflictCount: number;
  orphanFlowsheetCount: number;
  updatedAt: string;
}

