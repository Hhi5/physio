// =======================================================================
// PhysioRecord — Structured Treatment Session & SOAP Documentation (v2.1)
// Single Source of Truth in Encrypted `db.soapNotes`:
// - No fabricated default clinical documentation
// - Real inputs for all SOAP fields (Subjective, Objective, Flowsheet, Assessment, Plan)
// - Derived-only flowsheet summary (never stored into dailyInterventionsSummary)
// - Debounced draft autosave with concurrency checks & unsaved-changes guard
// - Sign & Lock validation + irreversible confirmation dialog
// - Note on Signer ("Recorded by"): Self-declared active staff label from local app state,
//   NOT a cryptographically authenticated user identity.
// =======================================================================

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useVault } from '../../context/VaultContext';
import {
  SoapService,
  MAX_ADDENDUM_TEXT_LENGTH,
  extractLegacyPainDetail,
} from '../../services/soapService';
import {
  SessionService,
  verifySessionSeal,
  verifySoapSeal,
} from '../../services/sessionService';
import {
  ClinicOperationsService,
  PT_EXERCISE_CATALOG,
  ROLE_PERMISSIONS,
} from '../../services/clinicOperationsService';
import {
  ADDENDUM_REASONS,
  CURRENT_SOAP_SCHEMA_VERSION,
  type SealVerificationStatus,
  type SessionRecord,
  type SoapNoteRecord,
  type SoapNoteData,
  type SoapFlowsheetData,
  type LegacyPainDetail,
  type ClinicalAddendumRecord,
  type AddendumReason,
  type FlowsheetExerciseEntry,
  type ManualTherapyFlowsheetEntry,
  type PhysicalAgentFlowsheetEntry,
} from '../../types/clinical';
import { formatClinicalDate } from '../../utils/date';
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Layers,
  Copy,
  Plus,
  Trash2,
  Lock,
  Dumbbell,
  Zap,
  Hand,
  FilePlus2,
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  CheckCircle2,
} from 'lucide-react';

export type ProgressStatusOption = '' | 'improved' | 'unchanged' | 'regressed' | 'plateau';
export type PatientToleranceOption =
  | ''
  | 'well_tolerated'
  | 'moderate_fatigue'
  | 'poorly_tolerated';

export interface UntouchedDraftFormState {
  prePainNrs: number | undefined;
  prePainNotRecorded: boolean;
  postPainNrs: number | undefined;
  postPainNotRecorded: boolean;
  legacyPainDetail?: LegacyPainDetail;
  legacyDraftReviewed: boolean;
  chiefComplaint: string;
  symptomChanges: string;
  interventionsSummary: string;
  legacyCompiledSummary: string | undefined;
  clinicalObservations: string;
  clinicalImpression: string;
  progressStatus: ProgressStatusOption;
  patientTolerance: PatientToleranceOption;
  nextSessionPlan: string;
  homeInstructions: string;
  exercises: FlowsheetExerciseEntry[];
  manualTherapy: ManualTherapyFlowsheetEntry[];
  physicalAgents: PhysicalAgentFlowsheetEntry[];
}

/**
 * Initial untouched state for a new session draft:
 * - Pain starts undefined ("not recorded"), never 5 or 3.
 * - progressStatus and patientTolerance start unselected ('').
 * - All text fields start empty ('').
 */
export function createUntouchedDraftFormState(): UntouchedDraftFormState {
  return {
    prePainNrs: undefined,
    prePainNotRecorded: false,
    postPainNrs: undefined,
    postPainNotRecorded: false,
    legacyPainDetail: undefined,
    legacyDraftReviewed: false,
    chiefComplaint: '',
    symptomChanges: '',
    interventionsSummary: '',
    legacyCompiledSummary: undefined,
    clinicalObservations: '',
    clinicalImpression: '',
    progressStatus: '',
    patientTolerance: '',
    nextSessionPlan: '',
    homeInstructions: '',
    exercises: [],
    manualTherapy: [],
    physicalAgents: [],
  };
}

/**
 * Pure render/export helper: derives human-readable summary string from structured flowsheet items.
 * NEVER includes therapist free-text `interventionsSummary` and is NEVER stored in `dailyInterventionsSummary`.
 */
export function compileFlowsheetSummaryText(
  flowsheet: SoapFlowsheetData | undefined,
  isAr: boolean
): string {
  if (!flowsheet) return '';
  const exLines = (flowsheet.exercises || []).map(
    (e) =>
      `${isAr ? e.nameAr || e.nameEn : e.nameEn || e.nameAr} (${e.sets}×${e.reps}${
        e.holdSeconds ? ` × ${e.holdSeconds}s` : ''
      } @ ${e.loadOrBand})`
  );
  const mtLines = (flowsheet.manualTherapy || []).map(
    (m) =>
      `${isAr ? m.techniqueAr || m.techniqueEn : m.techniqueEn || m.techniqueAr} [${
        m.targetJointOrTissue ? `${m.targetJointOrTissue}, ` : ''
      }${m.gradeOrIntensity}, ${m.durationMinutes}m]`
  );
  const paLines = (flowsheet.physicalAgents || []).map(
    (p) =>
      `${isAr ? p.modalityAr || p.modality : p.modality} (${
        p.site ? `${p.site}, ` : ''
      }${p.parameters}, ${p.durationMinutes}m)`
  );
  return [...exLines, ...mtLines, ...paLines].filter(Boolean).join(' • ');
}

/**
 * Legacy compile format (pre-1A-i.5) used to detect if a stored `dailyInterventionsSummary`
 * was auto-compiled from the flowsheet so we can keep it read-only and prevent duplication on reload.
 */
function compileLegacyPrePatchSummary(
  flowsheet: SoapFlowsheetData | undefined,
  isAr: boolean
): string {
  if (!flowsheet) return '';
  const exLines = (flowsheet.exercises || []).map(
    (e) =>
      `${isAr ? e.nameAr : e.nameEn} (${e.sets}×${e.reps}${
        e.holdSeconds ? ` × ${e.holdSeconds}s` : ''
      } @ ${e.loadOrBand})`
  );
  const mtLines = (flowsheet.manualTherapy || []).map(
    (m) => `${isAr ? m.techniqueAr : m.techniqueEn} [${m.gradeOrIntensity}, ${m.durationMinutes}m]`
  );
  const paLines = (flowsheet.physicalAgents || []).map(
    (p) => `${p.modality} (${p.parameters}, ${p.durationMinutes}m)`
  );
  return [...exLines, ...mtLines, ...paLines].filter(Boolean).join(' • ');
}

/**
 * Inspects a stored `dailyInterventionsSummary` from an existing note:
 * - If it equals a compiled flowsheet string (current or pre-patch, AR or EN), treats it as a
 *   read-only legacy compiled summary and returns `freeText: ''` so saving never duplicates it.
 * - Otherwise returns it as the therapist's own `freeText`.
 */
export function resolveStoredInterventionsSummary(
  storedSummary: string | undefined,
  existingLegacyCompiled: string | undefined,
  flowsheet: SoapFlowsheetData | undefined
): { freeText: string; legacyCompiledSummary: string | undefined } {
  if (existingLegacyCompiled) {
    return {
      freeText: storedSummary || '',
      legacyCompiledSummary: existingLegacyCompiled,
    };
  }
  const trimmed = (storedSummary || '').trim();
  if (!trimmed) {
    return { freeText: '', legacyCompiledSummary: undefined };
  }

  const candidates = [
    compileFlowsheetSummaryText(flowsheet, true),
    compileFlowsheetSummaryText(flowsheet, false),
    compileLegacyPrePatchSummary(flowsheet, true),
    compileLegacyPrePatchSummary(flowsheet, false),
  ].filter(Boolean);

  for (const compiled of candidates) {
    if (trimmed === compiled) {
      return { freeText: '', legacyCompiledSummary: trimmed };
    }
    if (trimmed.startsWith(`${compiled} • `)) {
      const remainder = trimmed.slice(`${compiled} • `.length).trim();
      return { freeText: remainder, legacyCompiledSummary: compiled };
    }
  }

  return { freeText: storedSummary || '', legacyCompiledSummary: undefined };
}

/**
 * Builds the `SoapNoteData` payload from current form state without fabricating any default values.
 * `dailyInterventionsSummary` stores ONLY the therapist's free text (`state.interventionsSummary`).
 */
export function buildSoapPayloadFromFormState(
  state: UntouchedDraftFormState,
  existingSoap?: SoapNoteRecord | null
): SoapNoteData {
  const flowsheetPayload: SoapFlowsheetData = {
    exercises: state.exercises,
    manualTherapy: state.manualTherapy,
    physicalAgents: state.physicalAgents,
  };

  const preservedLegacyDetail =
    state.legacyPainDetail ?? extractLegacyPainDetail(existingSoap?.data.subjective);

  const subjective: SoapNoteData['subjective'] = {
    ...(existingSoap?.data.subjective || {}),
    chiefComplaint: state.chiefComplaint,
    symptomChangesSinceLastSession: state.symptomChanges,
    painNrsScore: state.prePainNotRecorded ? undefined : state.prePainNrs,
    painNotRecorded: state.prePainNotRecorded || undefined,
    postSessionPainNrs: state.postPainNotRecorded ? undefined : state.postPainNrs,
    postPainNotRecorded: state.postPainNotRecorded || undefined,
  };
  if (preservedLegacyDetail) {
    subjective.legacyPainDetail = preservedLegacyDetail;
  } else {
    delete subjective.legacyPainDetail;
  }
  delete subjective.painVasCurrent;
  delete subjective.painAssessment;
  delete subjective.painVasBestLast24h;
  delete subjective.painVasWorstLast24h;

  const objective: SoapNoteData['objective'] = {
    ...(existingSoap?.data.objective || {}),
    flowsheet: flowsheetPayload,
    dailyInterventionsSummary: state.interventionsSummary,
    clinicalObservations: state.clinicalObservations,
  };
  if (state.legacyCompiledSummary) {
    objective.legacyCompiledSummary = state.legacyCompiledSummary;
  }

  const assessment: SoapNoteData['assessment'] = {
    ...(existingSoap?.data.assessment || {}),
    clinicalImpressionCurrent: state.clinicalImpression,
    progressStatus: state.progressStatus ? state.progressStatus : undefined,
    patientTolerance: state.patientTolerance ? state.patientTolerance : undefined,
  };

  const plan: SoapNoteData['plan'] = {
    ...(existingSoap?.data.plan || {}),
    nextSessionPlan: state.nextSessionPlan,
    homeInstructions: state.homeInstructions,
  };

  // Persist `legacyUnreviewed: true` on the FIRST save of any non-finalized note whose stored schemaVersion < 2,
  // and preserve `legacyUnreviewed: true` across all draft saves until finalized with review confirmation.
  const isLegacyUnreviewedDraft = Boolean(
    existingSoap &&
      !existingSoap.data.isFinalized &&
      !existingSoap.data.legacyReviewedAt &&
      (existingSoap.data.legacyUnreviewed ||
        (existingSoap.data.soapSchemaVersion ?? 1) < CURRENT_SOAP_SCHEMA_VERSION)
  );

  return {
    soapSchemaVersion: CURRENT_SOAP_SCHEMA_VERSION,
    subjective,
    objective,
    assessment,
    plan,
    isFinalized: false,
    ...(isLegacyUnreviewedDraft ? { legacyUnreviewed: true } : {}),
  };
}

/**
 * Validates all mandatory clinical fields before allowing Sign & Lock.
 * Also requires an explicit `state.legacyDraftReviewed === true` confirmation when signing
 * a draft note with `legacyUnreviewed === true` (`requiresLegacyReview === true`).
 */
export function validateSignAndLockState(
  state: UntouchedDraftFormState,
  requiresLegacyReview = false
): {
  valid: boolean;
  missingAr: string[];
  missingEn: string[];
} {
  const missingAr: string[] = [];
  const missingEn: string[] = [];

  if (requiresLegacyReview && !state.legacyDraftReviewed) {
    missingAr.push('تأكيد مراجعة محتوى المسودة القديمة المنشأة بإصدار سابق (I reviewed this)');
    missingEn.push('Explicit confirmation that this legacy draft was reviewed ("I reviewed this")');
  }

  const hasPrePain = state.prePainNrs !== undefined || state.prePainNotRecorded;
  if (!hasPrePain) {
    missingAr.push('شدة الألم قبل الجلسة (أو تحديد "لم يُسجّل")');
    missingEn.push('Pre-session pain score (or mark "Not recorded")');
  }

  const hasPostPain = state.postPainNrs !== undefined || state.postPainNotRecorded;
  if (!hasPostPain) {
    missingAr.push('شدة الألم بعد الجلسة (أو تحديد "لم يُسجّل")');
    missingEn.push('Post-session pain score (or mark "Not recorded")');
  }

  const hasFlowsheetEntry =
    state.exercises.length > 0 ||
    state.manualTherapy.length > 0 ||
    state.physicalAgents.length > 0;
  const hasFreeTextIntervention =
    state.interventionsSummary.trim().length > 0 ||
    state.clinicalObservations.trim().length > 0;

  if (!hasFlowsheetEntry && !hasFreeTextIntervention) {
    missingAr.push('توثيق تدخل علاجي واحد على الأقل (جدول التمارين/الأجهزة أو ملخص التدخلات الحر)');
    missingEn.push('At least one documented intervention (flowsheet entry or free-text summary)');
  }

  if (!state.clinicalImpression.trim()) {
    missingAr.push('الانطباع والتفسير السريري للجلسة (Clinical Impression)');
    missingEn.push('Clinical Impression (Assessment)');
  }

  if (!state.progressStatus) {
    missingAr.push('مسار تقدم الحالة (Progress Status)');
    missingEn.push('Progress Status');
  }

  return {
    valid: missingAr.length === 0,
    missingAr,
    missingEn,
  };
}

interface TreatmentSessionViewProps {
  session: SessionRecord;
  patientId: string;
  patientName: string;
  episodeTitle: string;
  onBack: () => void;
  onSessionUpdated: () => void;
  onOpenMasterChart: () => void;
}

export const TreatmentSessionView: React.FC<TreatmentSessionViewProps> = ({
  session,
  patientId,
  patientName,
  episodeTitle,
  onBack,
  onSessionUpdated,
  onOpenMasterChart,
}) => {
  const { language, isRtl } = useLanguage();
  const isAr = language === 'ar';
  const { dek } = useVault();

  const [soapRecord, setSoapRecord] = useState<SoapNoteRecord | null>(null);
  const [addenda, setAddenda] = useState<ClinicalAddendumRecord[]>([]);
  const [addendaFailedCount, setAddendaFailedCount] = useState(0);
  const [flowsheetFailedCount, setFlowsheetFailedCount] = useState(0);
  const [sealStatus, setSealStatus] = useState<SealVerificationStatus | null>(null);
  const [sealMismatchWarning, setSealMismatchWarning] = useState<string | null>(null);
  const [unsealedNotice, setUnsealedNotice] = useState<string | null>(null);
  const [isLegacyDraftOrigin, setIsLegacyDraftOrigin] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [missingLockFields, setMissingLockFields] = useState<string[]>([]);
  const [showSignConfirmModal, setShowSignConfirmModal] = useState(false);
  const [pendingNavAction, setPendingNavAction] = useState<'back' | 'chart' | null>(null);
  const [isLocked, setIsLocked] = useState(session.data.status === 'finalized');
  const [isDirty, setIsDirty] = useState(false);

  // Monotonic request-id guard so stale concurrent `loadSoapAndAddenda` runs never overwrite newer state
  const loadRequestIdRef = useRef(0);

  // Append-Only Addendum Form State (for finalized sessions)
  const [addendumReason, setAddendumReason] = useState<AddendumReason>('treatment_response_update');
  const [addendumText, setAddendumText] = useState('');
  const [isSavingAddendum, setIsSavingAddendum] = useState(false);
  const [addendumError, setAddendumError] = useState<string | null>(null);

  // Untouched initial SOAP & Flowsheet state (NO fabricated defaults)
  const [formState, setFormState] = useState<UntouchedDraftFormState>(
    createUntouchedDraftFormState
  );

  // Raw string drafts for numeric inputs so clearing an input never coerces "" -> 0
  const [numericDrafts, setNumericDrafts] = useState<Record<string, string>>({});
  // Track which physical agent entries still have unedited template prefill parameters
  const [prefillParameterIds, setPrefillParameterIds] = useState<Record<string, boolean>>({});

  const [selectedCatalogExId, setSelectedCatalogExId] = useState<string>(
    PT_EXERCISE_CATALOG[0].id
  );

  // Self-declared staff label ("Recorded by") — NOT cryptographically authenticated identity
  const activeStaff = ClinicOperationsService.getActiveStaff();
  const perms = ROLE_PERMISSIONS[activeStaff.role];
  const recordedByName = isAr
    ? `${activeStaff.nameAr} (${activeStaff.nameEn})`
    : `${activeStaff.nameEn} (${activeStaff.nameAr})`;

  const updateField = useCallback(
    <K extends keyof UntouchedDraftFormState>(key: K, value: UntouchedDraftFormState[K]) => {
      setFormState((prev) => ({ ...prev, [key]: value }));
      setIsDirty(true);
      setAutosaveStatus('idle');
      setMissingLockFields([]);
    },
    []
  );

  const loadSoapAndAddenda = useCallback(async () => {
    if (!dek || !session.id) return;
    const requestId = ++loadRequestIdRef.current;
    setIsLoading(true);
    setLoadError(null);
    setSaveError(null);
    setSealStatus(null);
    setSealMismatchWarning(null);
    setUnsealedNotice(null);
    try {
      const latestSession = (await SessionService.getSessionById(session.id, dek)) || session;
      if (requestId !== loadRequestIdRef.current) return;

      const existing = await SoapService.getSoapNoteBySession(session.id, dek);
      if (requestId !== loadRequestIdRef.current) return;

      if (existing) {
        setSoapRecord(existing);
        const d = existing.data;
        const flow = d.objective?.flowsheet;
        const { freeText, legacyCompiledSummary } = resolveStoredInterventionsSummary(
          d.objective?.dailyInterventionsSummary,
          d.objective?.legacyCompiledSummary,
          flow
        );

        const locked = Boolean(d.isFinalized || latestSession.data.status === 'finalized');
        setIsLocked(locked);

        // Derive the legacy-draft gate strictly from `d.legacyUnreviewed` (NOT from schemaVersion)
        const legacyDraft = !locked && Boolean(d.legacyUnreviewed);
        setIsLegacyDraftOrigin(legacyDraft);

        setFormState({
          prePainNrs: d.subjective?.painNotRecorded ? undefined : d.subjective?.painNrsScore,
          prePainNotRecorded: Boolean(d.subjective?.painNotRecorded),
          postPainNrs: d.subjective?.postPainNotRecorded
            ? undefined
            : d.subjective?.postSessionPainNrs,
          postPainNotRecorded: Boolean(d.subjective?.postPainNotRecorded),
          legacyPainDetail: extractLegacyPainDetail(d.subjective),
          legacyDraftReviewed: false,
          chiefComplaint: d.subjective?.chiefComplaint || '',
          symptomChanges: d.subjective?.symptomChangesSinceLastSession || '',
          interventionsSummary: freeText,
          legacyCompiledSummary,
          clinicalObservations: d.objective?.clinicalObservations || '',
          clinicalImpression: d.assessment?.clinicalImpressionCurrent || '',
          progressStatus: d.assessment?.progressStatus || '',
          patientTolerance: d.assessment?.patientTolerance || '',
          nextSessionPlan: d.plan?.nextSessionPlan || '',
          homeInstructions: d.plan?.homeInstructions || '',
          exercises: flow?.exercises || [],
          manualTherapy: flow?.manualTherapy || [],
          physicalAgents: flow?.physicalAgents || [],
        });
        setNumericDrafts({});

        if (locked) {
          const soapSealCheck = await verifySoapSeal(d);
          const sessionSealCheck = await verifySessionSeal(latestSession.data, d);
          if (requestId !== loadRequestIdRef.current) return;

          if (soapSealCheck.status === 'mismatch' || sessionSealCheck.status === 'mismatch') {
            setSealStatus('mismatch');
            setSealMismatchWarning(
              isAr
                ? 'تحذير عدم تطابق ختم التكامل الرقمي (Seal Mismatch): المحتوى المخزن للجلسة أو ملاحظة SOAP لا يطابق بصمة الاعتماد الأصلية SHA-256.'
                : 'Integrity Seal Mismatch Warning: Stored session or SOAP note content does not match its SHA-256 finalization seal.'
            );
          } else if (
            soapSealCheck.status === 'unsealed' ||
            sessionSealCheck.status === 'unsealed'
          ) {
            setSealStatus('unsealed');
            setUnsealedNotice(
              isAr
                ? 'سجل قديم بدون ختم تكامل قياسي (Unsealed legacy record): تم اعتماد هذه الملاحظة قبل تطبيق ختم التكامل القياسي v1 أو أثناء إصلاح القفل، يرجى مراجعة محتواها قبل الاعتماد عليها.'
                : 'Unsealed legacy record: This note was finalized before canonical integrity seal v1 (or repaired during migration); please review before relying on it.'
            );
          } else {
            setSealStatus('valid');
          }
        }
      } else {
        setSoapRecord(null);
        setIsLegacyDraftOrigin(false);
        setFormState(createUntouchedDraftFormState());
        setNumericDrafts({});
        const locked = latestSession.data.status === 'finalized';
        setIsLocked(locked);
        if (locked) {
          const sessionSealCheck = await verifySessionSeal(latestSession.data, null);
          if (requestId !== loadRequestIdRef.current) return;

          if (sessionSealCheck.status === 'mismatch') {
            setSealStatus('mismatch');
            setSealMismatchWarning(
              isAr
                ? 'تحذير عدم تطابق ختم التكامل الرقمي (Seal Mismatch): المحتوى المخزن للجلسة لا يطابق بصمة الاعتماد الأصلية SHA-256.'
                : 'Integrity Seal Mismatch Warning: Stored session content does not match its SHA-256 finalization seal.'
            );
          } else if (sessionSealCheck.status === 'unsealed') {
            setSealStatus('unsealed');
            setUnsealedNotice(
              isAr
                ? 'سجل قديم بدون ختم تكامل قياسي (Unsealed legacy record): تم اعتماد هذه الجلسة قبل تطبيق ختم التكامل القياسي v1.'
                : 'Unsealed legacy record: This session was finalized before canonical integrity seal v1.'
            );
          } else {
            setSealStatus('valid');
          }
        }
      }

      const addendaResult = await SoapService.getAddendaBySession(session.id, dek);
      if (requestId !== loadRequestIdRef.current) return;

      setAddenda(addendaResult.records);
      setAddendaFailedCount(addendaResult.failedCount);
      setIsDirty(false);
    } catch (err: unknown) {
      if (requestId !== loadRequestIdRef.current) return;
      const msg =
        err instanceof Error
          ? err.message
          : isAr
            ? 'تعذر تحميل وفك تشفير بيانات الجلسة السريرية.'
            : 'Failed to load and decrypt session clinical data.';
      setLoadError(msg);
      console.error('Failed to load session note:', err);
    } finally {
      if (requestId === loadRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [dek, session.id, isAr]);

  useEffect(() => {
    loadSoapAndAddenda();
  }, [loadSoapAndAddenda]);

  // Browser tab close / refresh guard when dirty
  useEffect(() => {
    if (!isDirty || isLocked) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty, isLocked]);

  // Inline numeric validation for exercise, manual therapy, and physical agent rows
  const numericErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    const checkIntRange = (
      key: string,
      actualVal: number,
      min: number,
      max: number,
      labelAr: string,
      labelEn: string
    ) => {
      const raw = numericDrafts[key] !== undefined ? numericDrafts[key] : String(actualVal);
      if (raw.trim() === '') {
        errs[key] = isAr ? `${labelAr} مطلوب (${min}–${max})` : `${labelEn} required (${min}–${max})`;
        return;
      }
      const parsed = Number(raw);
      if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
        errs[key] = isAr
          ? `${labelAr}: أدخل رقماً صحيحاً بين ${min} و ${max}`
          : `${labelEn}: enter integer ${min}–${max}`;
      }
    };

    for (const ex of formState.exercises) {
      checkIntRange(`${ex.id}_sets`, ex.sets, 1, 20, 'الجولات', 'Sets');
      checkIntRange(`${ex.id}_reps`, ex.reps, 1, 200, 'التكرار', 'Reps');
      checkIntRange(`${ex.id}_hold`, ex.holdSeconds, 0, 600, 'الثبات (ث)', 'Hold (s)');
    }
    for (const mt of formState.manualTherapy) {
      checkIntRange(`${mt.id}_duration`, mt.durationMinutes, 1, 120, 'المدة (د)', 'Duration (m)');
    }
    for (const pa of formState.physicalAgents) {
      checkIntRange(`${pa.id}_duration`, pa.durationMinutes, 1, 120, 'المدة (د)', 'Duration (m)');
    }
    return errs;
  }, [formState.exercises, formState.manualTherapy, formState.physicalAgents, numericDrafts, isAr]);

  const hasNumericErrors = Object.keys(numericErrors).length > 0;

  // Derived flowsheet summary for display/export only (NEVER stored in dailyInterventionsSummary)
  const derivedFlowsheetSummary = useMemo(
    () =>
      compileFlowsheetSummaryText(
        {
          exercises: formState.exercises,
          manualTherapy: formState.manualTherapy,
          physicalAgents: formState.physicalAgents,
        },
        isAr
      ),
    [formState.exercises, formState.manualTherapy, formState.physicalAgents, isAr]
  );

  // Persist draft helper (used by manual Save Draft, debounced Autosave, and pre-Sign save)
  // Pass `notifyParent = false` inside the Sign & Lock flow so `onSessionUpdated()` is only called once after finalize succeeds.
  const persistDraftSoap = useCallback(
    async (isAuto = false, notifyParent = !isAuto): Promise<SoapNoteRecord | null> => {
      if (!dek || isLocked) return null;
      if (hasNumericErrors) {
        if (!isAuto) {
          setSaveError(
            isAr
              ? 'يرجى تصحيح القيم الرقمية غير الصالحة في جدول التمارين أو الأجهزة قبل الحفظ.'
              : 'Please fix invalid numeric values in the flowsheet before saving.'
          );
        }
        return null;
      }

      // Invalidate any stale in-flight loadSoapAndAddenda before writing
      loadRequestIdRef.current++;

      if (isAuto) {
        setAutosaveStatus('saving');
      } else {
        setIsSaving(true);
        setSaveError(null);
      }

      try {
        const soapPayload = buildSoapPayloadFromFormState(formState, soapRecord);
        let savedSoap: SoapNoteRecord;
        if (soapRecord) {
          savedSoap = await SoapService.updateSoapNote(
            soapRecord.id,
            soapPayload,
            dek,
            undefined,
            soapRecord.updatedAt
          );
        } else {
          savedSoap = await SoapService.createSoapNote(
            patientId,
            session.episodeId,
            session.id,
            soapPayload,
            dek
          );
        }
        setSoapRecord(savedSoap);
        setIsLegacyDraftOrigin(Boolean(!savedSoap.data.isFinalized && savedSoap.data.legacyUnreviewed));
        setIsDirty(false);
        if (isAuto) {
          setAutosaveStatus('saved');
        } else if (notifyParent) {
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3000);
          onSessionUpdated();
        }
        return savedSoap;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to save treatment session';
        setSaveError(msg);
        setAutosaveStatus('idle');
        return null;
      } finally {
        if (!isAuto && notifyParent) {
          setIsSaving(false);
        }
      }
    },
    [
      dek,
      isLocked,
      hasNumericErrors,
      isAr,
      formState,
      soapRecord,
      patientId,
      session.episodeId,
      session.id,
      onSessionUpdated,
    ]
  );

  // Debounced draft autosave (only when dirty, unlocked, and no inline numeric errors)
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isDirty || isLocked || isSaving || hasNumericErrors || !dek) return;
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = setTimeout(() => {
      void persistDraftSoap(true, false);
    }, 2500);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [isDirty, isLocked, isSaving, hasNumericErrors, dek, persistDraftSoap]);

  const handleCarryForwardPreviousFlowsheet = async () => {
    if (isLocked || !dek) return;
    setSaveError(null);
    try {
      const result = await SoapService.getLatestEpisodeFlowsheet(
        session.episodeId,
        session.id,
        dek,
        undefined,
        session.sessionNumber,
        session.sessionDate
      );
      setFlowsheetFailedCount(result.failedCount);
      if (result.flowsheet) {
        setFormState((prev) => ({
          ...prev,
          exercises: (result.flowsheet?.exercises || []).map((e) => ({
            ...e,
            id: crypto.randomUUID(),
          })),
          manualTherapy: (result.flowsheet?.manualTherapy || []).map((m) => ({
            ...m,
            id: crypto.randomUUID(),
          })),
          physicalAgents: (result.flowsheet?.physicalAgents || []).map((p) => ({
            ...p,
            id: crypto.randomUUID(),
          })),
        }));
        setNumericDrafts({});
        setIsDirty(true);
      } else {
        setSaveError(
          isAr
            ? 'لا توجد جلسة سابقة في هذه الحلقة تحتوي على جدول تمارين لنسخه.'
            : 'No previous session in this episode has a recorded flowsheet to copy.'
        );
      }
    } catch (err: unknown) {
      setSaveError(
        err instanceof Error ? err.message : 'Failed to carry forward previous flowsheet'
      );
    }
  };

  const handleAddExerciseFromCatalog = () => {
    if (isLocked) return;
    const cat = PT_EXERCISE_CATALOG.find((e) => e.id === selectedCatalogExId);
    if (!cat) return;
    const entry: FlowsheetExerciseEntry = {
      id: crypto.randomUUID(),
      exerciseId: cat.id,
      nameAr: cat.nameAr,
      nameEn: cat.nameEn,
      region: cat.region,
      sets: cat.defaultSets,
      reps: cat.defaultReps,
      holdSeconds: cat.defaultHoldSeconds,
      loadOrBand: cat.defaultLoadOrBand,
      rpeOrPainResponse: 'pain_free',
    };
    updateField('exercises', [...formState.exercises, entry]);
  };

  const handleAddManualTherapy = () => {
    if (isLocked) return;
    const entry: ManualTherapyFlowsheetEntry = {
      id: crypto.randomUUID(),
      techniqueAr: 'تحريك مفصلي تذبذبي (Maitland Mobilization)',
      techniqueEn: 'Maitland Joint Mobilization',
      targetJointOrTissue: episodeTitle,
      gradeOrIntensity: 'Grade III',
      durationMinutes: 10,
    };
    updateField('manualTherapy', [...formState.manualTherapy, entry]);
  };

  const handleAddPhysicalAgent = (
    modality: PhysicalAgentFlowsheetEntry['modality'],
    modalityAr: string,
    defaultParams: string
  ) => {
    if (isLocked) return;
    const id = crypto.randomUUID();
    const entry: PhysicalAgentFlowsheetEntry = {
      id,
      modality,
      modalityAr,
      site: episodeTitle,
      parameters: defaultParams,
      durationMinutes: 15,
    };
    setPrefillParameterIds((prev) => ({ ...prev, [id]: true }));
    updateField('physicalAgents', [...formState.physicalAgents, entry]);
  };

  const requiresLegacyReview = Boolean(
    !isLocked && (soapRecord?.data.legacyUnreviewed || isLegacyDraftOrigin)
  );

  const handleRequestSignAndLock = () => {
    if (isLocked) return;
    setSaveError(null);
    if (hasNumericErrors) {
      setSaveError(
        isAr
          ? 'يرجى تصحيح الأخطاء الرقمية في جدول التمارين أو الأجهزة قبل الاعتماد والقفل.'
          : 'Please fix numeric errors in the flowsheet before signing and locking.'
      );
      return;
    }
    const check = validateSignAndLockState(formState, requiresLegacyReview);
    if (!check.valid) {
      setMissingLockFields(isAr ? check.missingAr : check.missingEn);
      return;
    }
    setMissingLockFields([]);
    setShowSignConfirmModal(true);
  };

  const handleConfirmSignAndLock = async () => {
    if (!dek || isLocked) return;
    setShowSignConfirmModal(false);
    setIsSaving(true);
    setSaveError(null);
    loadRequestIdRef.current++;
    try {
      // Save draft WITHOUT calling onSessionUpdated() before finalizeSession (Finding 3)
      const savedSoap = await persistDraftSoap(false, false);
      if (!savedSoap) {
        setIsSaving(false);
        return;
      }

      // Single finalization path: SessionService.finalizeSession atomically seals & locks both records
      const finalizedSession = await SessionService.finalizeSession(
        session.id,
        activeStaff.nameEn,
        dek,
        undefined,
        session.updatedAt,
        savedSoap.updatedAt,
        Boolean(formState.legacyDraftReviewed)
      );
      const finalizedSoap = await SoapService.getSoapNoteBySession(session.id, dek);
      if (finalizedSoap) {
        setSoapRecord(finalizedSoap);
        const soapSealCheck = await verifySoapSeal(finalizedSoap.data);
        const sessionSealCheck = await verifySessionSeal(
          finalizedSession.data,
          finalizedSoap.data
        );
        if (soapSealCheck.status === 'mismatch' || sessionSealCheck.status === 'mismatch') {
          setSealStatus('mismatch');
          setSealMismatchWarning(
            isAr
              ? 'تحذير عدم تطابق ختم التكامل الرقمي (Seal Mismatch): المحتوى المخزن لا يطابق بصمة الاعتماد SHA-256.'
              : 'Integrity Seal Mismatch Warning: Stored content does not match its SHA-256 finalization seal.'
          );
          setUnsealedNotice(null);
        } else if (
          soapSealCheck.status === 'unsealed' ||
          sessionSealCheck.status === 'unsealed'
        ) {
          setSealStatus('unsealed');
          setSealMismatchWarning(null);
          setUnsealedNotice(
            isAr
              ? 'سجل قديم بدون ختم تكامل قياسي (Unsealed legacy record).'
              : 'Unsealed legacy record.'
          );
        } else {
          setSealStatus('valid');
          setSealMismatchWarning(null);
          setUnsealedNotice(null);
        }
      }
      setIsLegacyDraftOrigin(false);
      setIsLocked(true);
      setIsDirty(false);
      ClinicOperationsService.appendAuditLog({
        actionType: 'session_finalized',
        entityType: 'session',
        entityId: session.id,
        patientId,
        episodeId: session.episodeId,
        summaryAr: `اعتماد وقفل الجلسة #${session.data.sessionNumber} (مسجل بواسطة: ${activeStaff.nameAr})`,
        summaryEn: `Signed and locked Session #${session.data.sessionNumber} (Recorded by: ${activeStaff.nameEn})`,
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      // Call onSessionUpdated() ONCE after finalize succeeds
      onSessionUpdated();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to finalize treatment session';
      setSaveError(msg);
      console.error('Failed to finalize treatment session:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddAddendum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dek || !soapRecord) return;
    setAddendumError(null);
    setIsSavingAddendum(true);
    try {
      const created = await SoapService.addClinicalAddendum(
        session.id,
        'soapNotes',
        soapRecord.id,
        {
          reasonForAmendment: addendumReason,
          amendmentText: addendumText,
          signedByTherapistName: activeStaff.nameEn,
        },
        dek
      );
      setAddenda((prev) => [...prev, created]);
      setAddendumText('');
      ClinicOperationsService.appendAuditLog({
        actionType: 'addendum_signed',
        entityType: 'session',
        entityId: session.id,
        patientId,
        episodeId: session.episodeId,
        summaryAr: `إضافة ملحق سريري للجلسة #${session.data.sessionNumber} (مسجل بواسطة: ${activeStaff.nameAr})`,
        summaryEn: `Appended clinical addendum to Session #${session.data.sessionNumber} (Recorded by: ${activeStaff.nameEn})`,
      });
    } catch (err: unknown) {
      setAddendumError(err instanceof Error ? err.message : 'Failed to append addendum');
    } finally {
      setIsSavingAddendum(false);
    }
  };

  const handleSafeNavigation = (target: 'back' | 'chart') => {
    if (isDirty && !isLocked) {
      setPendingNavAction(target);
      return;
    }
    if (target === 'back') onBack();
    else onOpenMasterChart();
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {isAr
              ? 'جاري فك تشفير بيانات الجلسة وجدول التمارين...'
              : 'Decrypting session & flowsheet...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors">
      {/* Top Session Bar */}
      <div className="px-3 sm:px-6 py-3 sm:py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 sm:gap-4 shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={() => handleSafeNavigation('back')}
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer shrink-0"
          >
            {isRtl ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          </button>

          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums">
              <span className="font-bold text-teal-600 dark:text-teal-400 font-mono">
                {isAr
                  ? `جلسة علاجية #${session.data.sessionNumber}`
                  : `Session #${session.data.sessionNumber}`}
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-700 dark:text-slate-300 font-bold">{patientName}</span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-500 font-mono">{session.data.sessionDate}</span>
              {isLocked && (
                <>
                  <span className="text-slate-400">·</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1">
                    <Lock className="w-3 h-3" />
                    {isAr ? 'معتمدة ومغلقة (Signed & Locked)' : 'Signed & Locked'}
                  </span>
                </>
              )}
              {!isLocked && autosaveStatus === 'saving' && (
                <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                  {isAr ? 'جاري الحفظ التلقائي...' : 'Autosaving draft...'}
                </span>
              )}
              {!isLocked && autosaveStatus === 'saved' && !isDirty && (
                <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {isAr ? 'تم حفظ المسودة تلقائياً' : 'Draft autosaved'}
                </span>
              )}
            </div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
              {episodeTitle}
            </h2>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => handleSafeNavigation('chart')}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Layers className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>{isAr ? 'السجل العام والمقارنة' : 'Episode Chart'}</span>
          </button>

          {!isLocked && (
            <>
              <button
                type="button"
                onClick={() => void persistDraftSoap(false)}
                disabled={isSaving}
                className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                  saveSuccess
                    ? 'bg-emerald-600 text-white'
                    : 'bg-teal-600 hover:bg-teal-500 text-white'
                }`}
              >
                <Save className="w-4 h-4" />
                <span>{isAr ? 'حفظ المسودة' : 'Save Draft'}</span>
              </button>

              {perms.canFinalizeAndLockNotes && (
                <button
                  type="button"
                  onClick={handleRequestSignAndLock}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{isAr ? 'اعتماد وقفل الجلسة (Sign & Lock)' : 'Sign & Lock Note'}</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Unsaved Navigation Guard Banner */}
      {pendingNavAction && (
        <div className="px-4 py-3 bg-amber-50 dark:bg-amber-950/70 border-b border-amber-200 dark:border-amber-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              {isAr
                ? 'لديك تعديلات سريرية غير محفوظة في هذه الجلسة. هل ترغب في حفظ المسودة قبل المغادرة؟'
                : 'You have unsaved clinical changes in this session. Save draft before leaving?'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={async () => {
                const target = pendingNavAction;
                setPendingNavAction(null);
                const saved = await persistDraftSoap(false);
                if (saved) {
                  if (target === 'back') onBack();
                  else onOpenMasterChart();
                }
              }}
              className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white font-bold cursor-pointer"
            >
              {isAr ? 'حفظ المسودة والمغادرة' : 'Save & Leave'}
            </button>
            <button
              type="button"
              onClick={() => {
                const target = pendingNavAction;
                setPendingNavAction(null);
                setIsDirty(false);
                if (target === 'back') onBack();
                else onOpenMasterChart();
              }}
              className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
            >
              {isAr ? 'تجاهل التغييرات والمغادرة' : 'Discard & Leave'}
            </button>
            <button
              type="button"
              onClick={() => setPendingNavAction(null)}
              className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold cursor-pointer"
            >
              {isAr ? 'البقاء في الجلسة' : 'Stay'}
            </button>
          </div>
        </div>
      )}

      {/* Irreversible Sign & Lock Confirmation Dialog */}
      {showSignConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-2.5 text-slate-900 dark:text-white font-bold text-sm">
              <Lock className="w-5 h-5 text-emerald-600 shrink-0" />
              <h3>
                {isAr
                  ? 'تأكيد الاعتماد والقفل النهائي للجلسة (Sign & Lock)'
                  : 'Confirm Permanent Sign & Lock'}
              </h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {isAr
                ? 'هذا الإجراء نهائي ولا يمكن التراجع عنه (Irreversible). بعد قفل الجلسة وملاحظة SOAP بختم التكامل SHA-256، لن يُسمح بتعديل أو حذف البيانات الأصلية، وتكون أي إضافات أو تصحيحات لاحقة عبر الملاحق السريرية (Clinical Addenda) فقط.'
                : 'This action is permanent and irreversible. Once locked with a SHA-256 integrity seal, neither the session nor the SOAP note can be edited or deleted; any later changes can only be appended as Clinical Addenda.'}
            </p>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">
                  {isAr ? 'مسجل بواسطة (Recorded by):' : 'Recorded by:'}
                </span>
                <span className="font-bold text-slate-900 dark:text-white">{recordedByName}</span>
              </div>
              <p className="text-[11px] text-slate-500">
                {isAr
                  ? 'تنبيه: هذا الاسم مُختار ذاتياً من قائمة الكادر المحلي وليس هوية مصادقاً عليها رقمياً.'
                  : 'Note: This is a self-declared local staff selection, not a cryptographically authenticated identity.'}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSignConfirmModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmSignAndLock()}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>
                  {isAr ? 'تأكيد الاعتماد والقفل النهائي' : 'Confirm Sign & Lock'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Session & Flowsheet Canvas */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-5 max-w-5xl mx-auto w-full">
        {/* Load / Decrypt / Validation Warnings */}
        {loadError && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loadError}</span>
            </div>
            <button
              type="button"
              onClick={() => void loadSoapAndAddenda()}
              className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold flex items-center gap-1 cursor-pointer shrink-0"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>{isAr ? 'إعادة المحاولة' : 'Retry'}</span>
            </button>
          </div>
        )}

        {saveError && (
          <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        {missingLockFields.length > 0 && (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-2">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                {isAr
                  ? 'لا يمكن اعتماد وقفل الجلسة قبل استكمال الحقول الإلزامية التالية:'
                  : 'Cannot Sign & Lock session until the following required fields are completed:'}
              </span>
            </div>
            <ul className="list-disc list-inside space-y-1 font-medium">
              {missingLockFields.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        {(addendaFailedCount > 0 || flowsheetFailedCount > 0) && (
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              {isAr
                ? `تحذير سلامة البيانات: تعذر فك تشفير (${addendaFailedCount + flowsheetFailedCount}) سجل مرتبط بهذه الجلسة أو الحلقة.`
                : `Data integrity warning: (${addendaFailedCount + flowsheetFailedCount}) related record(s) failed decryption.`}
            </span>
          </div>
        )}

        {sealStatus === 'mismatch' && sealMismatchWarning && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/70 border-2 border-rose-300 dark:border-rose-700 text-xs text-rose-900 dark:text-rose-200 flex items-center gap-2.5 font-bold">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{sealMismatchWarning}</span>
          </div>
        )}

        {sealStatus === 'unsealed' && unsealedNotice && (
          <div className="p-3.5 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 flex items-center gap-2 font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>{unsealedNotice}</span>
          </div>
        )}

        {soapRecord?.data.legacyReviewedAt ? (
          <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-200 flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>
              {isAr
                ? `تمت مراجعة هذه المسودة المنشأة بإصدار أقدم بتاريخ ${formatClinicalDate(
                    soapRecord.data.legacyReviewedAt,
                    language,
                    { includeTime: true }
                  )}${
                    soapRecord.data.legacyReviewedBy
                      ? ` (مسجل بواسطة: ${soapRecord.data.legacyReviewedBy})`
                      : ''
                  }.`
                : `Legacy draft reviewed on ${formatClinicalDate(
                    soapRecord.data.legacyReviewedAt,
                    language,
                    { includeTime: true }
                  )}${
                    soapRecord.data.legacyReviewedBy
                      ? ` (Recorded by: ${soapRecord.data.legacyReviewedBy})`
                      : ''
                  }.`}
            </span>
          </div>
        ) : (
          (soapRecord?.data.legacyUnreviewed || isLegacyDraftOrigin) && (
            <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700 text-xs text-amber-900 dark:text-amber-200 space-y-2.5">
              <div className="flex items-center gap-2 font-bold">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  {isAr
                    ? 'تنبيه مراجعة سريرية: تم إنشاء محتوى هذه الملاحظة بواسطة إصدار أقدم من النظام، يرجى مراجعته قبل الاعتماد عليه (Content created by an older version, review before relying on it).'
                    : 'Clinical review notice: Content created by an older version, review before relying on it.'}
                </span>
              </div>

              {requiresLegacyReview && (
                <label className="flex items-center gap-2 pt-1 cursor-pointer select-none font-bold text-amber-950 dark:text-amber-100">
                  <input
                    type="checkbox"
                    checked={formState.legacyDraftReviewed}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setFormState((prev) => ({ ...prev, legacyDraftReviewed: checked }));
                      setMissingLockFields([]);
                    }}
                    className="w-4 h-4 rounded border-amber-400 text-teal-600 focus:ring-teal-500 cursor-pointer"
                  />
                  <span>
                    {isAr
                      ? 'لقد راجعت محتوى هذه المسودة القديمة وأؤكد صحته قبل الاعتماد والقفل (I reviewed this)'
                      : 'I have reviewed this legacy draft and confirm its accuracy before Sign & Lock (I reviewed this)'}
                  </span>
                </label>
              )}
            </div>
          )
        )}

        {soapRecord?.data.repairedDuringMigration && !soapRecord?.data.legacyUnreviewed && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>
              {isAr
                ? 'تم إصلاح ومزامنة قفل الاعتماد لهذه الملاحظة تلقائياً أثناء الترحيل بناءً على حالة اعتماد الجلسة.'
                : 'Finalization lock on this SOAP note was automatically repaired during migration to match the finalized session.'}
            </span>
          </div>
        )}

        {/* 1. SUBJECTIVE AXIS (المحور الذاتي — الألم والشكوى وتغير الأعراض) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2.5">
            {isAr
              ? '1. المحور الذاتي والألم (Subjective — S: Pain, Chief Complaint & Symptom Changes)'
              : '1. Subjective (S): Pre/Post Pain NPRS, Chief Complaint & Symptom Changes'}
          </h3>

          {/* Pre & Post Session Pain NPRS (Starts in "Not recorded" state; no default 5 or 3) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Pre-Session Pain */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold tabular-nums">
                <span className="text-slate-800 dark:text-slate-200">
                  {isAr ? 'شدة الألم قبل الجلسة (Pre-Session NPRS):' : 'Pre-Session Pain (NPRS 0–10):'}
                </span>
                <span className="font-mono text-xs font-extrabold text-amber-600 dark:text-amber-400">
                  {formState.prePainNotRecorded
                    ? isAr
                      ? 'لم يُسجّل (Not recorded)'
                      : 'Not recorded'
                    : formState.prePainNrs !== undefined
                      ? `${formState.prePainNrs} / 10`
                      : isAr
                        ? 'غير محدد بعد'
                        : 'Unselected'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => {
                  const selected = !formState.prePainNotRecorded && formState.prePainNrs === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      disabled={isLocked}
                      onClick={() => {
                        setFormState((prev) => ({
                          ...prev,
                          prePainNrs: val,
                          prePainNotRecorded: false,
                        }));
                        setIsDirty(true);
                        setMissingLockFields([]);
                      }}
                      className={`w-7 h-7 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer ${
                        selected
                          ? 'bg-amber-500 text-white border-amber-600'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-amber-400'
                      }`}
                    >
                      {val}
                    </button>
                  );
                })}
                <button
                  type="button"
                  disabled={isLocked}
                  onClick={() => {
                    setFormState((prev) => ({
                      ...prev,
                      prePainNrs: undefined,
                      prePainNotRecorded: !prev.prePainNotRecorded,
                    }));
                    setIsDirty(true);
                    setMissingLockFields([]);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                    formState.prePainNotRecorded
                      ? 'bg-slate-800 text-white border-slate-900 dark:bg-slate-200 dark:text-slate-900'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {isAr ? 'لم يُسجّل' : 'Not recorded'}
                </button>
              </div>
            </div>

            {/* Post-Session Pain */}
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold tabular-nums">
                <span className="text-slate-800 dark:text-slate-200">
                  {isAr
                    ? 'شدة الألم بعد انتهاء الجلسة (Post-Session NPRS):'
                    : 'Post-Session Pain (NPRS 0–10):'}
                </span>
                <span className="font-mono text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                  {formState.postPainNotRecorded
                    ? isAr
                      ? 'لم يُسجّل (Not recorded)'
                      : 'Not recorded'
                    : formState.postPainNrs !== undefined
                      ? `${formState.postPainNrs} / 10`
                      : isAr
                        ? 'غير محدد بعد'
                        : 'Unselected'}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => {
                  const selected = !formState.postPainNotRecorded && formState.postPainNrs === val;
                  return (
                    <button
                      key={val}
                      type="button"
                      disabled={isLocked}
                      onClick={() => {
                        setFormState((prev) => ({
                          ...prev,
                          postPainNrs: val,
                          postPainNotRecorded: false,
                        }));
                        setIsDirty(true);
                        setMissingLockFields([]);
                      }}
                      className={`w-7 h-7 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer ${
                        selected
                          ? 'bg-emerald-600 text-white border-emerald-700'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:border-emerald-400'
                      }`}
                    >
                      {val}
                    </button>
                  );
                })}
                <button
                  type="button"
                  disabled={isLocked}
                  onClick={() => {
                    setFormState((prev) => ({
                      ...prev,
                      postPainNrs: undefined,
                      postPainNotRecorded: !prev.postPainNotRecorded,
                    }));
                    setIsDirty(true);
                    setMissingLockFields([]);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer ${
                    formState.postPainNotRecorded
                      ? 'bg-slate-800 text-white border-slate-900 dark:bg-slate-200 dark:text-slate-900'
                      : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800'
                  }`}
                >
                  {isAr ? 'لم يُسجّل' : 'Not recorded'}
                </button>
              </div>
            </div>
          </div>

          {formState.legacyPainDetail && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 flex flex-wrap items-center gap-3">
              <span className="font-bold text-slate-500">
                {isAr
                  ? 'تفاصيل الألم المحفوظة من سجل سابق (قراءة فقط):'
                  : 'Preserved Legacy Pain Details (Read-Only):'}
              </span>
              {formState.legacyPainDetail.scoreAtRest !== undefined && (
                <span className="font-mono">
                  {isAr ? 'أثناء الراحة:' : 'At Rest:'}{' '}
                  {formState.legacyPainDetail.scoreAtRest}/10
                </span>
              )}
              {formState.legacyPainDetail.scoreWithMovement !== undefined && (
                <span className="font-mono">
                  {isAr ? 'مع الحركة:' : 'With Movement:'}{' '}
                  {formState.legacyPainDetail.scoreWithMovement}/10
                </span>
              )}
              {formState.legacyPainDetail.scoreBestLast24h !== undefined && (
                <span className="font-mono">
                  {isAr ? 'أفضل (24س):' : 'Best (24h):'}{' '}
                  {formState.legacyPainDetail.scoreBestLast24h}/10
                </span>
              )}
              {formState.legacyPainDetail.scoreWorstLast24h !== undefined && (
                <span className="font-mono">
                  {isAr ? 'أسوأ (24س):' : 'Worst (24h):'}{' '}
                  {formState.legacyPainDetail.scoreWorstLast24h}/10
                </span>
              )}
              {formState.legacyPainDetail.contextNotes && (
                <span>
                  {isAr ? 'ملاحظات السياق:' : 'Context:'}{' '}
                  {formState.legacyPainDetail.contextNotes}
                </span>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-800 dark:text-white block mb-1">
                {isAr
                  ? 'الشكوى الحالية للمريض اليوم (Chief Complaint):'
                  : 'Chief Complaint (Subjective):'}
              </label>
              <textarea
                rows={2}
                disabled={isLocked}
                value={formState.chiefComplaint}
                onChange={(e) => updateField('chiefComplaint', e.target.value)}
                placeholder={
                  isAr
                    ? 'اكتب شكوى المريض في بداية هذه الجلسة...'
                    : 'Enter patient chief complaint for today...'
                }
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-800 dark:text-white block mb-1">
                {isAr
                  ? 'تغير الأعراض منذ الجلسة السابقة (Symptom Changes):'
                  : 'Symptom Changes Since Last Session:'}
              </label>
              <textarea
                rows={2}
                disabled={isLocked}
                value={formState.symptomChanges}
                onChange={(e) => updateField('symptomChanges', e.target.value)}
                placeholder={
                  isAr
                    ? 'تحسن أو تراجع الأعراض، النوم، الالتزام بالتمارين...'
                    : 'Symptom changes, sleep quality, HEP compliance...'
                }
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* 2. OBJECTIVE AXIS — Structured Exercise Flowsheet */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isAr
                  ? '2. جدول التمارين العلاجية المنفذة (Session Exercise Flowsheet)'
                  : '2. Therapeutic Exercise Flowsheet (Sets × Reps × Hold × Load)'}
              </h3>
            </div>

            {!isLocked && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleCarryForwardPreviousFlowsheet()}
                  className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                  <span>{isAr ? 'نسخ تمارين الجلسة السابقة' : 'Copy Previous Flowsheet'}</span>
                </button>

                <select
                  value={selectedCatalogExId}
                  onChange={(e) => setSelectedCatalogExId(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white max-w-[220px]"
                >
                  {PT_EXERCISE_CATALOG.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {isAr ? ex.nameAr : ex.nameEn}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={handleAddExerciseFromCatalog}
                  className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAr ? 'إدراج تمرين' : 'Add Exercise'}</span>
                </button>
              </div>
            )}
          </div>

          {formState.exercises.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">
              {isAr
                ? 'أدرج التمارين المنفذة اليوم أو انقر على "نسخ تمارين الجلسة السابقة" لتوثيق التدرج في الأوزان والتكرارات.'
                : 'Add exercises from catalog or copy previous session flowsheet.'}
            </p>
          ) : (
            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full min-w-[660px] text-start text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                    <th className="py-2.5 px-3 text-start">{isAr ? 'التمرين العلاجي' : 'Exercise'}</th>
                    <th className="py-2.5 px-3 text-center w-24">
                      {isAr ? 'جولات (1–20)' : 'Sets (1–20)'}
                    </th>
                    <th className="py-2.5 px-3 text-center w-24">
                      {isAr ? 'تكرار (1–200)' : 'Reps (1–200)'}
                    </th>
                    <th className="py-2.5 px-3 text-center w-28">
                      {isAr ? 'ثبات ث (0–600)' : 'Hold s (0–600)'}
                    </th>
                    <th className="py-2.5 px-3 text-start w-40">
                      {isAr ? 'المقاومة / الوزن' : 'Load / Band'}
                    </th>
                    <th className="py-2.5 px-3 text-start w-36">
                      {isAr ? 'الاستجابة' : 'Response'}
                    </th>
                    <th className="py-2.5 px-2 text-end w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                  {formState.exercises.map((ex, idx) => {
                    const setsKey = `${ex.id}_sets`;
                    const repsKey = `${ex.id}_reps`;
                    const holdKey = `${ex.id}_hold`;
                    return (
                      <tr key={ex.id}>
                        <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white align-top">
                          {isAr ? ex.nameAr : ex.nameEn}
                        </td>
                        <td className="py-2.5 px-3 align-top">
                          <input
                            type="number"
                            min={1}
                            max={20}
                            disabled={isLocked}
                            value={
                              numericDrafts[setsKey] !== undefined
                                ? numericDrafts[setsKey]
                                : String(ex.sets)
                            }
                            onChange={(e) => {
                              const raw = e.target.value;
                              setNumericDrafts((prev) => ({ ...prev, [setsKey]: raw }));
                              const parsed = Number(raw);
                              if (
                                raw.trim() !== '' &&
                                Number.isInteger(parsed) &&
                                parsed >= 1 &&
                                parsed <= 20
                              ) {
                                const next = [...formState.exercises];
                                next[idx] = { ...ex, sets: parsed };
                                updateField('exercises', next);
                              } else {
                                setIsDirty(true);
                              }
                            }}
                            className={`w-18 px-2 py-1 rounded bg-slate-50 dark:bg-slate-950 border font-mono text-center ${
                              numericErrors[setsKey]
                                ? 'border-rose-500 text-rose-600'
                                : 'border-slate-200 dark:border-slate-800'
                            }`}
                          />
                          {numericErrors[setsKey] && (
                            <p className="text-[10px] text-rose-600 mt-0.5">
                              {numericErrors[setsKey]}
                            </p>
                          )}
                        </td>
                        <td className="py-2.5 px-3 align-top">
                          <input
                            type="number"
                            min={1}
                            max={200}
                            disabled={isLocked}
                            value={
                              numericDrafts[repsKey] !== undefined
                                ? numericDrafts[repsKey]
                                : String(ex.reps)
                            }
                            onChange={(e) => {
                              const raw = e.target.value;
                              setNumericDrafts((prev) => ({ ...prev, [repsKey]: raw }));
                              const parsed = Number(raw);
                              if (
                                raw.trim() !== '' &&
                                Number.isInteger(parsed) &&
                                parsed >= 1 &&
                                parsed <= 200
                              ) {
                                const next = [...formState.exercises];
                                next[idx] = { ...ex, reps: parsed };
                                updateField('exercises', next);
                              } else {
                                setIsDirty(true);
                              }
                            }}
                            className={`w-18 px-2 py-1 rounded bg-slate-50 dark:bg-slate-950 border font-mono text-center ${
                              numericErrors[repsKey]
                                ? 'border-rose-500 text-rose-600'
                                : 'border-slate-200 dark:border-slate-800'
                            }`}
                          />
                          {numericErrors[repsKey] && (
                            <p className="text-[10px] text-rose-600 mt-0.5">
                              {numericErrors[repsKey]}
                            </p>
                          )}
                        </td>
                        <td className="py-2.5 px-3 align-top">
                          <input
                            type="number"
                            min={0}
                            max={600}
                            disabled={isLocked}
                            value={
                              numericDrafts[holdKey] !== undefined
                                ? numericDrafts[holdKey]
                                : String(ex.holdSeconds)
                            }
                            onChange={(e) => {
                              const raw = e.target.value;
                              setNumericDrafts((prev) => ({ ...prev, [holdKey]: raw }));
                              const parsed = Number(raw);
                              if (
                                raw.trim() !== '' &&
                                Number.isInteger(parsed) &&
                                parsed >= 0 &&
                                parsed <= 600
                              ) {
                                const next = [...formState.exercises];
                                next[idx] = { ...ex, holdSeconds: parsed };
                                updateField('exercises', next);
                              } else {
                                setIsDirty(true);
                              }
                            }}
                            className={`w-18 px-2 py-1 rounded bg-slate-50 dark:bg-slate-950 border font-mono text-center ${
                              numericErrors[holdKey]
                                ? 'border-rose-500 text-rose-600'
                                : 'border-slate-200 dark:border-slate-800'
                            }`}
                          />
                          {numericErrors[holdKey] && (
                            <p className="text-[10px] text-rose-600 mt-0.5">
                              {numericErrors[holdKey]}
                            </p>
                          )}
                        </td>
                        <td className="py-2.5 px-3 align-top">
                          <input
                            type="text"
                            disabled={isLocked}
                            value={ex.loadOrBand}
                            onChange={(e) => {
                              const next = [...formState.exercises];
                              next[idx] = { ...ex, loadOrBand: e.target.value };
                              updateField('exercises', next);
                            }}
                            className="w-full px-2 py-1 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono"
                          />
                        </td>
                        <td className="py-2.5 px-3 align-top">
                          <select
                            disabled={isLocked}
                            value={ex.rpeOrPainResponse}
                            onChange={(e) => {
                              const next = [...formState.exercises];
                              next[idx] = {
                                ...ex,
                                rpeOrPainResponse:
                                  e.target.value as FlowsheetExerciseEntry['rpeOrPainResponse'],
                              };
                              updateField('exercises', next);
                            }}
                            className="w-full px-2 py-1 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                          >
                            <option value="pain_free">{isAr ? 'دون ألم' : 'Pain-free'}</option>
                            <option value="mild_discomfort">
                              {isAr ? 'شد خفيف مقبول' : 'Mild discomfort'}
                            </option>
                            <option value="painful_modified">
                              {isAr ? 'مؤلم - تم التعديل' : 'Modified'}
                            </option>
                          </select>
                        </td>
                        <td className="py-2.5 px-2 text-end align-top">
                          {!isLocked && (
                            <button
                              type="button"
                              onClick={() =>
                                updateField(
                                  'exercises',
                                  formState.exercises.filter((item) => item.id !== ex.id)
                                )
                              }
                              className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Manual Therapy & Physical Agents / Modalities Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Manual Therapy Box */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                <Hand className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>{isAr ? 'العلاج اليدوي (Manual Therapy)' : 'Manual Therapy'}</span>
              </div>
              {!isLocked && (
                <button
                  type="button"
                  onClick={handleAddManualTherapy}
                  className="text-xs font-bold text-teal-600 dark:text-teal-400 cursor-pointer"
                >
                  {isAr ? '+ إضافة تقنية يدوية' : '+ Add Technique'}
                </button>
              )}
            </div>

            {formState.manualTherapy.map((mt, idx) => {
              const durKey = `${mt.id}_duration`;
              return (
                <div
                  key={mt.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      disabled={isLocked}
                      placeholder={isAr ? 'اسم التقنية اليدوية' : 'Manual therapy technique'}
                      value={isAr ? mt.techniqueAr : mt.techniqueEn}
                      onChange={(e) => {
                        const next = [...formState.manualTherapy];
                        // Edit ONLY the active language while preserving the other language
                        next[idx] = isAr
                          ? { ...mt, techniqueAr: e.target.value }
                          : { ...mt, techniqueEn: e.target.value };
                        updateField('manualTherapy', next);
                      }}
                      className="flex-1 px-2.5 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-semibold text-slate-900 dark:text-white"
                    />
                    {!isLocked && (
                      <button
                        type="button"
                        onClick={() =>
                          updateField(
                            'manualTherapy',
                            formState.manualTherapy.filter((m) => m.id !== mt.id)
                          )
                        }
                        className="text-slate-400 hover:text-rose-600 cursor-pointer p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">
                        {isAr ? 'المفصل / النسيج المستهدف' : 'Target Joint/Tissue'}
                      </label>
                      <input
                        type="text"
                        disabled={isLocked}
                        value={mt.targetJointOrTissue}
                        onChange={(e) => {
                          const next = [...formState.manualTherapy];
                          next[idx] = { ...mt, targetJointOrTissue: e.target.value };
                          updateField('manualTherapy', next);
                        }}
                        className="w-full px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">
                        {isAr ? 'الدرجة / الشدة' : 'Grade'}
                      </label>
                      <select
                        disabled={isLocked}
                        value={mt.gradeOrIntensity}
                        onChange={(e) => {
                          const next = [...formState.manualTherapy];
                          next[idx] = {
                            ...mt,
                            gradeOrIntensity:
                              e.target.value as ManualTherapyFlowsheetEntry['gradeOrIntensity'],
                          };
                          updateField('manualTherapy', next);
                        }}
                        className="w-full px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono"
                      >
                        <option value="Grade I">Grade I</option>
                        <option value="Grade II">Grade II</option>
                        <option value="Grade III">Grade III</option>
                        <option value="Grade IV">Grade IV</option>
                        <option value="MWM">Mulligan MWM</option>
                        <option value="Soft Tissue">Myofascial</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">
                        {isAr ? 'المدة (دقيقة 1–120)' : 'Duration (m)'}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        disabled={isLocked}
                        value={
                          numericDrafts[durKey] !== undefined
                            ? numericDrafts[durKey]
                            : String(mt.durationMinutes)
                        }
                        onChange={(e) => {
                          const raw = e.target.value;
                          setNumericDrafts((prev) => ({ ...prev, [durKey]: raw }));
                          const parsed = Number(raw);
                          if (
                            raw.trim() !== '' &&
                            Number.isInteger(parsed) &&
                            parsed >= 1 &&
                            parsed <= 120
                          ) {
                            const next = [...formState.manualTherapy];
                            next[idx] = { ...mt, durationMinutes: parsed };
                            updateField('manualTherapy', next);
                          } else {
                            setIsDirty(true);
                          }
                        }}
                        className={`w-full px-2 py-1 rounded bg-white dark:bg-slate-900 border font-mono text-center ${
                          numericErrors[durKey]
                            ? 'border-rose-500 text-rose-600'
                            : 'border-slate-200 dark:border-slate-800'
                        }`}
                      />
                      {numericErrors[durKey] && (
                        <p className="text-[10px] text-rose-600 mt-0.5">
                          {numericErrors[durKey]}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Physical Agents / Electrotherapy Box */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>
                  {isAr ? 'الأجهزة والوسائل الفيزيائية (Physical Agents)' : 'Physical Modalities'}
                </span>
              </div>
            </div>

            {!isLocked && (
              <div className="flex flex-wrap gap-1.5">
                {[
                  { mod: 'TENS' as const, ar: 'TENS مسكن', params: '100Hz, 150µs' },
                  { mod: 'Ultrasound' as const, ar: 'أمواج فوق صوتية US', params: '1MHz, 1.2 W/cm²' },
                  { mod: 'NMES' as const, ar: 'تحفيز عضلي NMES', params: '50Hz, 10s/30s' },
                  { mod: 'DryNeedling' as const, ar: 'إبر جافة (Dry Needling)', params: 'Trigger Points' },
                  { mod: 'Cryotherapy' as const, ar: 'كمادات باردة Cryo', params: 'Cold pack' },
                ].map((btn) => (
                  <button
                    key={btn.mod}
                    type="button"
                    onClick={() => handleAddPhysicalAgent(btn.mod, btn.ar, btn.params)}
                    className="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-teal-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[11px] font-semibold text-slate-700 dark:text-slate-300 cursor-pointer"
                  >
                    + {isAr ? btn.ar : btn.mod}
                  </button>
                ))}
              </div>
            )}

            {formState.physicalAgents.map((pa, idx) => {
              const durKey = `${pa.id}_duration`;
              const isDefaultPrefill = Boolean(prefillParameterIds[pa.id]);
              return (
                <div
                  key={pa.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-teal-700 dark:text-teal-400">
                      {isAr ? pa.modalityAr : pa.modality}
                    </span>
                    <div className="flex items-center gap-2">
                      {isDefaultPrefill && (
                        <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 text-[10px] font-bold">
                          {isAr ? 'افتراضي — يرجى التحقق (default - verify)' : 'default - verify'}
                        </span>
                      )}
                      {!isLocked && (
                        <button
                          type="button"
                          onClick={() =>
                            updateField(
                              'physicalAgents',
                              formState.physicalAgents.filter((p) => p.id !== pa.id)
                            )
                          }
                          className="text-slate-400 hover:text-rose-600 cursor-pointer p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">
                        {isAr ? 'المنطقة المستهدفة (Site)' : 'Target Site'}
                      </label>
                      <input
                        type="text"
                        disabled={isLocked}
                        value={pa.site}
                        onChange={(e) => {
                          const next = [...formState.physicalAgents];
                          next[idx] = { ...pa, site: e.target.value };
                          updateField('physicalAgents', next);
                        }}
                        className="w-full px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">
                        {isAr ? 'المعاملات (Parameters)' : 'Parameters'}
                      </label>
                      <input
                        type="text"
                        disabled={isLocked}
                        value={pa.parameters}
                        onChange={(e) => {
                          setPrefillParameterIds((prev) => ({ ...prev, [pa.id]: false }));
                          const next = [...formState.physicalAgents];
                          next[idx] = { ...pa, parameters: e.target.value };
                          updateField('physicalAgents', next);
                        }}
                        className="w-full px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[11px]"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-500 block mb-0.5">
                        {isAr ? 'المدة (دقيقة 1–120)' : 'Duration (m)'}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={120}
                        disabled={isLocked}
                        value={
                          numericDrafts[durKey] !== undefined
                            ? numericDrafts[durKey]
                            : String(pa.durationMinutes)
                        }
                        onChange={(e) => {
                          const raw = e.target.value;
                          setNumericDrafts((prev) => ({ ...prev, [durKey]: raw }));
                          const parsed = Number(raw);
                          if (
                            raw.trim() !== '' &&
                            Number.isInteger(parsed) &&
                            parsed >= 1 &&
                            parsed <= 120
                          ) {
                            const next = [...formState.physicalAgents];
                            next[idx] = { ...pa, durationMinutes: parsed };
                            updateField('physicalAgents', next);
                          } else {
                            setIsDirty(true);
                          }
                        }}
                        className={`w-full px-2 py-1 rounded bg-white dark:bg-slate-900 border font-mono text-center ${
                          numericErrors[durKey]
                            ? 'border-rose-500 text-rose-600'
                            : 'border-slate-200 dark:border-slate-800'
                        }`}
                      />
                      {numericErrors[durKey] && (
                        <p className="text-[10px] text-rose-600 mt-0.5">
                          {numericErrors[durKey]}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. OBJECTIVE FREE-TEXT & DERIVED FLOWSHEET SUMMARY */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2.5">
            {isAr
              ? '3. الملاحظات الموضوعية وملخص التدخلات الحر (Objective — O: Observations & Free-Text Interventions)'
              : '3. Objective (O): Clinical Observations & Therapist Free-Text Interventions'}
          </h3>

          {derivedFlowsheetSummary && (
            <div className="p-3 rounded-xl bg-teal-50/60 dark:bg-teal-950/30 border border-teal-200 dark:border-teal-800 text-xs space-y-1">
              <span className="font-bold text-teal-800 dark:text-teal-300 block">
                {isAr
                  ? 'ملخص جدول التمارين والأجهزة المشتق تلقائياً (للعرض والتصدير فقط — لا يُخزّن كمدخل نصي مكرر):'
                  : 'Derived Flowsheet Summary (Render/Export Preview Only — never duplicated into free-text):'}
              </span>
              <p className="text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                {derivedFlowsheetSummary}
              </p>
            </div>
          )}

          {formState.legacyCompiledSummary && (
            <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
              <span className="font-bold text-slate-600 dark:text-slate-400 block">
                {isAr
                  ? 'ملخص مجمع سابق محفوظ من إصدار أقدم (للقراءة فقط):'
                  : 'Legacy Stored Compiled Summary (Read-Only):'}
              </span>
              <p className="text-slate-700 dark:text-slate-300 font-mono text-[11px]">
                {formState.legacyCompiledSummary}
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-800 dark:text-white block mb-1">
                {isAr
                  ? 'ملخص التدخلات الحر للمعالج (Interventions Summary — Free Text Only):'
                  : 'Therapist Free-Text Interventions Summary:'}
              </label>
              <textarea
                rows={2}
                disabled={isLocked}
                value={formState.interventionsSummary}
                onChange={(e) => updateField('interventionsSummary', e.target.value)}
                placeholder={
                  isAr
                    ? 'اكتب أي تدخلات إضافية أو تفاصيل علاجية حرة نفذها المعالج...'
                    : 'Enter therapist free-text intervention details...'
                }
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-800 dark:text-white block mb-1">
                {isAr
                  ? 'المشاهدات والفحص السريري الموضوعي (Clinical Observations):'
                  : 'Clinical Observations (Objective):'}
              </label>
              <textarea
                rows={2}
                disabled={isLocked}
                value={formState.clinicalObservations}
                onChange={(e) => updateField('clinicalObservations', e.target.value)}
                placeholder={
                  isAr
                    ? 'ملاحظات القوام، المشية، التورم، الجس، أو المدى الحركي...'
                    : 'Posture, gait, edema, palpation, or ROM observations...'
                }
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* 4. ASSESSMENT & PLAN AXES (التقييم والانطباع السريري والخطة القادمة) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2.5">
            {isAr
              ? '4. التقييم السريري والخطة العلاجية (Assessment — A & Plan — P)'
              : '4. Assessment (A) & Plan (P)'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="text-xs font-bold text-slate-800 dark:text-white block mb-1">
                {isAr
                  ? 'مسار تقدم الحالة (Progress Status) *:'
                  : 'Progress Status *:'}
              </label>
              <select
                disabled={isLocked}
                value={formState.progressStatus}
                onChange={(e) =>
                  updateField('progressStatus', e.target.value as ProgressStatusOption)
                }
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              >
                <option value="">
                  {isAr ? '— اختر مسار تقدم الحالة —' : '— Select progress status —'}
                </option>
                <option value="improved">{isAr ? 'تحسن ملحوظ (Improved)' : 'Improved'}</option>
                <option value="unchanged">
                  {isAr ? 'دون تغيير (Unchanged)' : 'Unchanged'}
                </option>
                <option value="plateau">
                  {isAr ? 'استقرار / ثبات مرحلي (Plateau)' : 'Plateau'}
                </option>
                <option value="regressed">
                  {isAr ? 'تراجع في الأعراض (Regressed)' : 'Regressed'}
                </option>
              </select>
            </div>

            <div className="md:col-span-1">
              <label className="text-xs font-bold text-slate-800 dark:text-white block mb-1">
                {isAr
                  ? 'تحمّل المريض للجلسة (Patient Tolerance):'
                  : 'Patient Tolerance:'}
              </label>
              <select
                disabled={isLocked}
                value={formState.patientTolerance}
                onChange={(e) =>
                  updateField('patientTolerance', e.target.value as PatientToleranceOption)
                }
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              >
                <option value="">
                  {isAr ? '— اختر تحمّل المريض —' : '— Select patient tolerance —'}
                </option>
                <option value="well_tolerated">
                  {isAr ? 'تحمّل ممتاز / جيد (Well Tolerated)' : 'Well tolerated'}
                </option>
                <option value="moderate_fatigue">
                  {isAr ? 'إجهاد متوسط (Moderate Fatigue)' : 'Moderate fatigue'}
                </option>
                <option value="poorly_tolerated">
                  {isAr ? 'ضعف تحمّل / ألم (Poorly Tolerated)' : 'Poorly tolerated'}
                </option>
              </select>
            </div>

            <div className="md:col-span-1">
              <label className="text-xs font-bold text-slate-800 dark:text-white block mb-1">
                {isAr ? 'مسجل بواسطة (Recorded by):' : 'Recorded by:'}
              </label>
              <input
                type="text"
                readOnly
                value={recordedByName}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 cursor-not-allowed"
              />
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {isAr
                  ? 'اسم مصرّح به ذاتياً من الكادر المحلي (ليس هوية مصادقاً عليها رقمياً)'
                  : 'Self-declared staff label (not authenticated identity)'}
              </span>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-800 dark:text-white block mb-1">
              {isAr
                ? 'الانطباع والتفسير السريري للجلسة (Clinical Impression — Assessment) *:'
                : 'Clinical Impression (Assessment) *:'}
            </label>
            <textarea
              rows={2}
              disabled={isLocked}
              value={formState.clinicalImpression}
              onChange={(e) => updateField('clinicalImpression', e.target.value)}
              placeholder={
                isAr
                  ? 'اكتب التفسير السريري لاستجابة المريض في هذه الجلسة...'
                  : 'Enter clinical reasoning and impression of patient response...'
              }
              className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-800 dark:text-white block mb-1">
                {isAr
                  ? 'خطة الجلسة القادمة والتعديلات المقترحة (Next Session Plan):'
                  : 'Next Session Plan:'}
              </label>
              <textarea
                rows={2}
                disabled={isLocked}
                value={formState.nextSessionPlan}
                onChange={(e) => updateField('nextSessionPlan', e.target.value)}
                placeholder={
                  isAr
                    ? 'خطة التدرج أو التعديل للجلسة القادمة...'
                    : 'Plan or progression for next session...'
                }
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-800 dark:text-white block mb-1">
                {isAr
                  ? 'التعليمات والبرنامج المنزلي (Home Instructions / HEP):'
                  : 'Home Instructions (HEP):'}
              </label>
              <textarea
                rows={2}
                disabled={isLocked}
                value={formState.homeInstructions}
                onChange={(e) => updateField('homeInstructions', e.target.value)}
                placeholder={
                  isAr
                    ? 'تعليمات التمارين المنزلية أو الوقاية اليومية...'
                    : 'Home exercise instructions or daily precautions...'
                }
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Append-Only Clinical Addenda Section (shown for finalized sessions) */}
        {isLocked && (
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <FilePlus2 className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {isAr
                    ? 'الملاحق والتصحيحات السريرية (Append-Only Clinical Addenda)'
                    : 'Clinical Addenda (Append-Only Post-Finalization Amendments)'}
                </h3>
              </div>
              <span className="text-[11px] font-mono text-slate-500">
                {addenda.length} {isAr ? 'ملحق' : 'addenda'}
              </span>
            </div>

            {addendaFailedCount > 0 && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  {isAr
                    ? `تنبيه: تعذر فك تشفير (${addendaFailedCount}) ملحق سريري مرتبط بهذه الجلسة.`
                    : `Warning: (${addendaFailedCount}) clinical addendum record(s) failed decryption.`}
                </span>
              </div>
            )}

            {addenda.length > 0 && (
              <div className="space-y-2.5">
                {addenda.map((item) => {
                  const reasonInfo = ADDENDUM_REASONS[item.data.reasonForAmendment];
                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-1.5 text-xs"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span className="font-bold text-teal-700 dark:text-teal-400">
                          {isAr ? reasonInfo?.ar : reasonInfo?.en}
                        </span>
                        <span className="font-mono">
                          {isAr ? 'مسجل بواسطة: ' : 'Recorded by: '}
                          {item.data.signedByTherapistName} ·{' '}
                          {formatClinicalDate(item.createdAt, language, { includeTime: true })}
                        </span>
                      </div>
                      <p className="text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                        {item.data.amendmentText}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}

            {soapRecord && (
              <form onSubmit={handleAddAddendum} className="space-y-3 pt-2">
                {addendumError && (
                  <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
                    {addendumError}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      {isAr ? 'سبب الملحق السريري:' : 'Reason for Addendum:'}
                    </label>
                    <select
                      value={addendumReason}
                      onChange={(e) => setAddendumReason(e.target.value as AddendumReason)}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                    >
                      {(Object.keys(ADDENDUM_REASONS) as AddendumReason[]).map((key) => (
                        <option key={key} value={key}>
                          {isAr ? ADDENDUM_REASONS[key].ar : ADDENDUM_REASONS[key].en}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                      {isAr
                        ? 'مسجل بواسطة (Recorded by — قراءة فقط):'
                        : 'Recorded by (Read-Only Active Staff):'}
                    </label>
                    <input
                      type="text"
                      value={recordedByName}
                      readOnly
                      className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 cursor-not-allowed"
                    />
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      {isAr
                        ? 'اسم مصرّح به ذاتياً من اختيار الكادر المحلي وليس هوية مصادقاً عليها رقمياً.'
                        : 'Self-declared name from active staff selection, not authenticated identity.'}
                    </span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                      {isAr
                        ? 'نص الإضافة أو التصحيح السريري (لا يعدل النص الأصلي بل يُلحق به):'
                        : 'Addendum Text (appended immutably):'}
                    </label>
                    <span className="text-[10px] font-mono text-slate-400">
                      {addendumText.length} / {MAX_ADDENDUM_TEXT_LENGTH}
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    maxLength={MAX_ADDENDUM_TEXT_LENGTH}
                    value={addendumText}
                    onChange={(e) => setAddendumText(e.target.value)}
                    required
                    placeholder={
                      isAr
                        ? 'اكتب تفاصيل الإضافة أو التوضيح السريري هنا...'
                        : 'Enter clinical addendum details...'
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSavingAddendum || !addendumText.trim()}
                    className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>
                      {isAr ? 'إدراج الملحق السريري' : 'Append Clinical Addendum'}
                    </span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
