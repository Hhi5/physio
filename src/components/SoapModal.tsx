// =======================================================================
// PhysioRecord — SOAP Clinical Documentation Modal (Phase 2C — v2.0)
// 1:1 Session-to-SOAP Documentation, 4-Axis Clinical Workflow & Immutability
// shadcn/ui Clinical Standard: Clean Typography, Neutral Palette, Zero AI Slop
// =======================================================================

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  FileEdit, 
  Lock, 
  ShieldCheck, 
  Calendar, 
  Sliders, 
  Compass,
  Dumbbell,
  Zap,
  ClipboardList
} from 'lucide-react';
import { 
  SESSION_TYPES, 
  type SessionRecord, 
  type SoapNoteRecord, 
  type SoapNoteData, 
  type SoapObjectiveData,
  type PatientRecord,
  type EpisodeRecord,
  type ObjectiveAssessmentStatus,
  type PatientBodyChartData,
  type RomAssessmentBatteryData,
  type MmtAssessmentBatteryData,
  type NeuroScreeningBatteryData,
} from '../types/clinical';
import { useLanguage } from '../context/LanguageContext';
import { PatientBodyChart } from './toolkit/PatientBodyChart';
import { RomMmtAssessmentPanel } from './toolkit/RomMmtAssessmentPanel';
import { NeuroScreeningPanel } from './toolkit/NeuroScreeningPanel';

interface SoapModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: SessionRecord;
  episode: EpisodeRecord;
  patient: PatientRecord;
  existingSoap: SoapNoteRecord | null;
  onSaveSoap: (data: SoapNoteData) => Promise<SoapNoteRecord>;
  onFinalizeSession: (sessionId: string, therapistName: string) => Promise<void>;
  onOpenAddendumModal?: () => void;
}

export const SoapModal: React.FC<SoapModalProps> = ({
  isOpen,
  onClose,
  session,
  episode,
  patient,
  existingSoap,
  onSaveSoap,
  onFinalizeSession,
  onOpenAddendumModal,
}) => {
  const { isRtl, bi } = useLanguage();

  // Active Main Tab
  const [activeTab, setActiveTab] = useState<'subjective' | 'objective' | 'assessment' | 'plan' | 'preview'>('subjective');

  // Sub-Tab inside Objective (O)
  const [objectiveSubTab, setObjectiveSubTab] = useState<'general' | 'rom' | 'mmt' | 'neuro'>('general');

  // Form Submission & Finalization state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
  const [therapistSignature, setTherapistSignature] = useState(session.data.therapistName || 'د. المعالج الطبيعي');

  // Subjective (S) State
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [symptomChangesSinceLastSession, setSymptomChangesSinceLastSession] = useState('');
  const [painNrsScore, setPainNrsScore] = useState<number>(4);
  const [painScoreAtRest, setPainScoreAtRest] = useState<number | undefined>(undefined);
  const [painScoreWithMovement, setPainScoreWithMovement] = useState<number | undefined>(undefined);
  const [painScoreBestLast24h, setPainScoreBestLast24h] = useState<number | undefined>(undefined);
  const [painScoreWorstLast24h, setPainScoreWorstLast24h] = useState<number | undefined>(undefined);
  const [painContextNotes, setPainContextNotes] = useState('');
  const [painLocationDescription, setPainLocationDescription] = useState('');
  const [bodyChart, setBodyChart] = useState<PatientBodyChartData | undefined>(undefined);
  const [homeExerciseCompliance, setHomeExerciseCompliance] = useState<'full' | 'partial' | 'non_compliant' | 'not_prescribed'>('full');
  const [homeExerciseComplianceNotes, setHomeExerciseComplianceNotes] = useState('');
  const [responseToPreviousTreatment, setResponseToPreviousTreatment] = useState('');

  // Objective (O) State
  const [objectiveStatus, setObjectiveStatus] = useState<ObjectiveAssessmentStatus>('assessed');
  const [notAssessedReason, setNotAssessedReason] = useState('');
  const [objectiveFindings, setObjectiveFindings] = useState('');
  const [clinicalObservations, setClinicalObservations] = useState('');
  const [functionalOrPreliminaryMeasurements, setFunctionalOrPreliminaryMeasurements] = useState('');
  const [romBattery, setRomBattery] = useState<RomAssessmentBatteryData | undefined>(undefined);
  const [mmtBattery, setMmtBattery] = useState<MmtAssessmentBatteryData | undefined>(undefined);
  const [neuroScreening, setNeuroScreening] = useState<NeuroScreeningBatteryData | undefined>(undefined);
  const [dailyInterventionsSummary, setDailyInterventionsSummary] = useState('');

  // Assessment (A) State
  const [clinicalImpressionCurrent, setClinicalImpressionCurrent] = useState('');
  const [progressStatus, setProgressStatus] = useState<'improved' | 'unchanged' | 'regressed' | 'plateau'>('improved');
  const [patientTolerance, setPatientTolerance] = useState<'well_tolerated' | 'moderate_fatigue' | 'poorly_tolerated'>('well_tolerated');
  const [factorsImpactingProgress, setFactorsImpactingProgress] = useState('');

  // Plan (P) State
  const [nextSessionPlan, setNextSessionPlan] = useState('');
  const [proposedModifications, setProposedModifications] = useState('');
  const [homeInstructions, setHomeInstructions] = useState('');
  const [nextAppointmentDate, setNextAppointmentDate] = useState('');

  useEffect(() => {
    if (existingSoap) {
      const d = existingSoap.data;
      const s = d.subjective || ({} as any);
      const o = d.objective || ({} as any);
      const a = d.assessment || ({} as any);
      const p = d.plan || ({} as any);

      setChiefComplaint(s.chiefComplaint || '');
      setSymptomChangesSinceLastSession(s.symptomChangesSinceLastSession || '');
      const nrs = s.painNrsScore ?? s.painVasCurrent ?? s.painAssessment?.score ?? 4;
      setPainNrsScore(nrs);
      setPainScoreAtRest(s.painAssessment?.scoreAtRest);
      setPainScoreWithMovement(s.painAssessment?.scoreWithMovement);
      setPainScoreBestLast24h(s.painAssessment?.scoreBestLast24h ?? s.painVasBestLast24h);
      setPainScoreWorstLast24h(s.painAssessment?.scoreWorstLast24h ?? s.painVasWorstLast24h);
      setPainContextNotes(s.painAssessment?.contextNotes || '');
      setPainLocationDescription(s.painLocationDescription || '');
      setBodyChart(s.bodyChart);
      setHomeExerciseCompliance(s.homeExerciseCompliance || 'full');
      setHomeExerciseComplianceNotes(s.homeExerciseComplianceNotes || '');
      setResponseToPreviousTreatment(s.responseToPreviousTreatment || '');

      const objStat: ObjectiveAssessmentStatus = o.status || (o.isWithinNormalLimits ? 'normal_findings' : (o.notAssessedReason ? 'not_assessed' : 'assessed'));
      setObjectiveStatus(objStat);
      setNotAssessedReason(o.notAssessedReason || '');
      setObjectiveFindings(o.objectiveFindings || '');
      setClinicalObservations(o.clinicalObservations || '');
      setFunctionalOrPreliminaryMeasurements(o.functionalOrPreliminaryMeasurements || '');
      setRomBattery(o.romBattery);
      setMmtBattery(o.mmtBattery);
      setNeuroScreening(o.neuroScreening);
      setDailyInterventionsSummary(o.dailyInterventionsSummary || '');

      setClinicalImpressionCurrent(a.clinicalImpressionCurrent || '');
      setProgressStatus(a.progressStatus || 'improved');
      setPatientTolerance(a.patientTolerance || 'well_tolerated');
      setFactorsImpactingProgress(a.factorsImpactingProgress || '');

      setNextSessionPlan(p.nextSessionPlan || '');
      setProposedModifications(p.proposedModifications || '');
      setHomeInstructions(p.homeInstructions || '');
      setNextAppointmentDate(p.nextAppointmentDate || '');
    } else {
      // Clean defaults for fresh note
      setChiefComplaint(bi(
        `ألم في منطقة ${episode.data.affectedBodyRegion || 'العضو المصاب'}، وصعوبة في الحركة الوظيفية.`,
        `Pain in ${episode.data.affectedBodyRegion || 'affected area'} with functional mobility limitations.`
      ));
      setSymptomChangesSinceLastSession('');
      setPainNrsScore(4);
      setBodyChart(undefined);
      setRomBattery(undefined);
      setMmtBattery(undefined);
      setNeuroScreening(undefined);
      setObjectiveStatus('assessed');
      setClinicalImpressionCurrent('');
      setNextSessionPlan('');
    }
    setError(null);
    setSuccessNotice(null);
  }, [existingSoap, episode, session, isOpen]);

  if (!isOpen) return null;

  const isFinalized = session.status === 'finalized' || existingSoap?.data.isFinalized === true;
  const sessionTypeInfo = SESSION_TYPES[session.sessionType] || SESSION_TYPES.follow_up;

  // Build Payload
  const constructPayload = (): SoapNoteData => {
    const objectiveData: SoapObjectiveData = {
      status: objectiveStatus,
      notAssessedReason: objectiveStatus === 'not_assessed' ? notAssessedReason.trim() : undefined,
      isWithinNormalLimits: objectiveStatus === 'normal_findings',
      clinicalObservations: clinicalObservations.trim() || undefined,
      objectiveFindings: objectiveFindings.trim() || undefined,
      functionalOrPreliminaryMeasurements: functionalOrPreliminaryMeasurements.trim() || undefined,
      romBattery,
      mmtBattery,
      neuroScreening,
      dailyInterventionsSummary: dailyInterventionsSummary.trim() || undefined,
    };

    return {
      subjective: {
        chiefComplaint: chiefComplaint.trim(),
        symptomChangesSinceLastSession: symptomChangesSinceLastSession.trim() || undefined,
        painNrsScore,
        painAssessment: {
          scale: 'NRS_0_10',
          score: painNrsScore,
          range: '0-10',
          unit: 'points',
          assessedAt: session.sessionDate,
          scoreAtRest: painScoreAtRest,
          scoreWithMovement: painScoreWithMovement,
          scoreBestLast24h: painScoreBestLast24h,
          scoreWorstLast24h: painScoreWorstLast24h,
          contextNotes: painContextNotes.trim() || undefined,
        },
        painLocationDescription: painLocationDescription.trim() || undefined,
        bodyChart,
        homeExerciseCompliance,
        homeExerciseComplianceNotes: homeExerciseComplianceNotes.trim() || undefined,
        responseToPreviousTreatment: responseToPreviousTreatment.trim() || undefined,
      },
      objective: objectiveData,
      assessment: {
        clinicalImpressionCurrent: clinicalImpressionCurrent.trim(),
        progressStatus,
        patientTolerance,
        factorsImpactingProgress: factorsImpactingProgress.trim() || undefined,
      },
      plan: {
        nextSessionPlan: nextSessionPlan.trim(),
        proposedModifications: proposedModifications.trim() || undefined,
        homeInstructions: homeInstructions.trim() || undefined,
        nextAppointmentDate: nextAppointmentDate || undefined,
      },
    };
  };

  const handleSaveDraft = async () => {
    if (isFinalized) return;
    setSubmitting(true);
    setError(null);
    setSuccessNotice(null);

    try {
      const payload = constructPayload();
      await onSaveSoap(payload);
      setSuccessNotice(bi('تم حفظ مسودة ملاحظات SOAP وتشفيرها بنجاح.', 'SOAP draft saved and encrypted successfully.'));
      setTimeout(() => setSuccessNotice(null), 3000);
    } catch (err: any) {
      setError(err?.message || bi('فشل حفظ الملاحظة.', 'Failed to save note.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenFinalizeModal = () => {
    if (!chiefComplaint.trim()) {
      setError(bi('شكوى المريض الحالية إلزامية لاعتماد الجلسة.', 'Chief complaint is mandatory to finalize.'));
      setActiveTab('subjective');
      return;
    }

    const hasObj = Boolean(
      objectiveFindings.trim() ||
      clinicalObservations.trim() ||
      functionalOrPreliminaryMeasurements.trim() ||
      dailyInterventionsSummary.trim() ||
      (romBattery?.entries && romBattery.entries.length > 0) ||
      (mmtBattery?.entries && mmtBattery.entries.length > 0) ||
      (neuroScreening && (
        (neuroScreening.myotomes && neuroScreening.myotomes.length > 0) ||
        (neuroScreening.dermatomes && neuroScreening.dermatomes.length > 0) ||
        (neuroScreening.reflexes && neuroScreening.reflexes.length > 0)
      )) ||
      objectiveStatus === 'normal_findings'
    );

    if (!hasObj && objectiveStatus !== 'not_assessed') {
      setError(bi('يجب تسجيل الفحص الموضوعي أو اختيار سبب عدم الفحص.', 'Objective examination findings or justification is required.'));
      setActiveTab('objective');
      return;
    }

    if (objectiveStatus === 'not_assessed' && !notAssessedReason.trim()) {
      setError(bi('سبب عدم إجراء الفحص الموضوعي إلزامي للاعتماد.', 'Reason for not assessing is required.'));
      setActiveTab('objective');
      return;
    }

    if (!clinicalImpressionCurrent.trim()) {
      setError(bi('الانطباع والتحليل السريري إلزامي لاعتماد الجلسة.', 'Clinical impression is mandatory to finalize.'));
      setActiveTab('assessment');
      return;
    }

    if (!nextSessionPlan.trim()) {
      setError(bi('خطة الجلسة القادمة إلزامية لاعتماد الجلسة.', 'Next session plan is mandatory to finalize.'));
      setActiveTab('plan');
      return;
    }

    setError(null);
    setShowFinalizeConfirm(true);
  };

  const handleConfirmFinalize = async () => {
    if (!therapistSignature.trim()) {
      setError(bi('اسم المعالج الطبيعي المعتمد إلزامي.', 'Therapist name is required.'));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const payload = constructPayload();
      await onSaveSoap(payload);
      await onFinalizeSession(session.id, therapistSignature.trim());
      setShowFinalizeConfirm(false);
      onClose();
    } catch (err: any) {
      setError(err?.message || bi('فشل اعتماد الجلسة.', 'Failed to finalize session.'));
      setShowFinalizeConfirm(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 overflow-y-auto" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-5xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header Bar */}
        <div className="px-5 py-4 bg-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
              #{session.sessionNumber}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  {bi(`توثيق الجلسة السريرية #${session.sessionNumber}`, `Clinical Session Documentation #${session.sessionNumber}`)}
                </h3>
                <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${
                  isFinalized
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-amber-50 text-amber-800 border-amber-300'
                }`}>
                  {isFinalized ? bi('معتمدة', 'Finalized') : bi('مسودة', 'Draft')}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                {patient.data.fullNameAr || patient.data.fullName} • {bi(sessionTypeInfo.ar, sessionTypeInfo.en)} • {session.sessionDate}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {isFinalized && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>{bi('سجل مشفر ومعتمد', 'Encrypted & Finalized')}</span>
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md hover:bg-slate-100 transition-colors"
              title={bi('إغلاق', 'Close')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 4-Axis Navigation Tabs Bar */}
        <div className="px-5 pt-3 border-b border-slate-200 bg-slate-50 flex-shrink-0 overflow-x-auto">
          <div className="flex items-center gap-1.5">
            {[
              { id: 'subjective', code: 'S', labelAr: 'الذاتي', labelEn: 'Subjective' },
              { id: 'objective', code: 'O', labelAr: 'الموضوعي', labelEn: 'Objective' },
              { id: 'assessment', code: 'A', labelAr: 'التقييم', labelEn: 'Assessment' },
              { id: 'plan', code: 'P', labelAr: 'الخطة', labelEn: 'Plan' },
              { id: 'preview', code: '✓', labelAr: 'معاينة التقرير', labelEn: 'Preview Report' },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-t-lg text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                    isActive
                      ? 'border-primary-600 text-primary-700 bg-white shadow-2xs'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  }`}
                >
                  <span className={`w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center font-mono ${
                    isActive ? 'bg-primary-600 text-white' : 'bg-slate-200 text-slate-700'
                  }`}>
                    {tab.code}
                  </span>
                  <span>{bi(tab.labelAr, tab.labelEn)}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Status Notices */}
        {error && (
          <div className="mx-5 mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successNotice && (
          <div className="mx-5 mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2 text-emerald-800 text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Tab Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          
          {/* ======================================================================= */}
          {/* TAB 1: SUBJECTIVE (S)                                                  */}
          {/* ======================================================================= */}
          {activeTab === 'subjective' && (
            <div className="space-y-4">
              {/* Chief Complaint */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  {bi('شكوى المريض الحالية', 'Chief Complaint')} <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  disabled={isFinalized}
                  placeholder={bi('صف ما يشتكي منه المريض في بداية الجلسة...', 'Describe the patient complaint at session start...')}
                  rows={2}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-primary-500 focus:outline-hidden disabled:bg-slate-50"
                />
              </div>

              {/* Symptom Changes Since Last Session */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  {bi('تغير الأعراض منذ الجلسة السابقة', 'Symptom Changes Since Last Session')}
                </label>
                <textarea
                  value={symptomChangesSinceLastSession}
                  onChange={(e) => setSymptomChangesSinceLastSession(e.target.value)}
                  disabled={isFinalized}
                  placeholder={bi('كيف تطورت الأعراض ومستوى الألم منذ آخر جلسة؟...', 'How have symptoms progressed since the last visit?...')}
                  rows={2}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-primary-500 focus:outline-hidden disabled:bg-slate-50"
                />
              </div>

              {/* Pain Scale (NRS 0–10) */}
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-primary-600" />
                    <span>{bi('مقياس شدة الألم (0–10)', 'Pain Intensity Scale (0–10)')}</span>
                  </label>
                  <span className={`px-2.5 py-0.5 rounded-md text-xs font-mono font-bold ${
                    painNrsScore <= 3
                      ? 'bg-emerald-100 text-emerald-800'
                      : painNrsScore <= 6
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {painNrsScore} / 10
                  </span>
                </div>

                <input
                  type="range"
                  min="0"
                  max="10"
                  step="1"
                  value={painNrsScore}
                  onChange={(e) => setPainNrsScore(Number(e.target.value))}
                  disabled={isFinalized}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 font-medium px-0.5">
                  <span>{bi('0 (لا يوجد ألم)', '0 (No Pain)')}</span>
                  <span>{bi('5 (ألم متوسط)', '5 (Moderate)')}</span>
                  <span>{bi('10 (أقصى ألم ممكن)', '10 (Worst Possible)')}</span>
                </div>

                {/* Pain at Rest & Movement */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      {bi('الألم أثناء الراحة:', 'Pain at Rest (0–10):')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={painScoreAtRest ?? ''}
                      onChange={(e) => setPainScoreAtRest(e.target.value === '' ? undefined : Number(e.target.value))}
                      disabled={isFinalized}
                      placeholder="0 - 10"
                      className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-primary-500 disabled:bg-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      {bi('الألم مع الحركة:', 'Pain with Movement (0–10):')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={painScoreWithMovement ?? ''}
                      onChange={(e) => setPainScoreWithMovement(e.target.value === '' ? undefined : Number(e.target.value))}
                      disabled={isFinalized}
                      placeholder="0 - 10"
                      className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-primary-500 disabled:bg-slate-100"
                    />
                  </div>
                </div>
              </div>

              {/* Patient Body Chart */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                  {bi('مخطط توثيق أعراض المريض السريري', 'Patient Body Chart')}
                </label>
                <PatientBodyChart
                  value={bodyChart}
                  onChange={setBodyChart}
                  readOnly={isFinalized}
                />
              </div>

              {/* Home Exercise Compliance */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-2">
                <label className="block text-xs font-semibold text-slate-800">
                  {bi('الالتزام بالبرنامج المنزلي', 'Home Exercise Compliance')}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[
                    { id: 'full', ar: 'التزام تام', en: 'Full Compliance' },
                    { id: 'partial', ar: 'التزام جزئي', en: 'Partial Compliance' },
                    { id: 'non_compliant', ar: 'غير ملتزم', en: 'Non-compliant' },
                    { id: 'not_prescribed', ar: 'لم يحدد بعد', en: 'Not Prescribed' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => !isFinalized && setHomeExerciseCompliance(item.id as any)}
                      disabled={isFinalized}
                      className={`py-1.5 px-2 rounded-md text-xs font-medium border text-center transition-all ${
                        homeExerciseCompliance === item.id
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {bi(item.ar, item.en)}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={homeExerciseComplianceNotes}
                  onChange={(e) => setHomeExerciseComplianceNotes(e.target.value)}
                  disabled={isFinalized}
                  placeholder={bi('ملاحظات الالتزام بالتمارين...', 'Notes on exercise compliance...')}
                  className="w-full px-2.5 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-primary-500 disabled:bg-slate-100"
                />
              </div>

              {/* Response to Previous Treatment */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  {bi('الاستجابة للعلاج السابق', 'Response to Prior Session')}
                </label>
                <textarea
                  value={responseToPreviousTreatment}
                  onChange={(e) => setResponseToPreviousTreatment(e.target.value)}
                  disabled={isFinalized}
                  placeholder={bi('استجابة المريض بعد الجلسة السابقة وملاحظات التعافي...', 'Patient response following the previous session...')}
                  rows={2}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-primary-500 disabled:bg-slate-50"
                />
              </div>
            </div>
          )}

          {/* ======================================================================= */}
          {/* TAB 2: OBJECTIVE (O) — Clean Structured Sub-Tabs                        */}
          {/* ======================================================================= */}
          {activeTab === 'objective' && (
            <div className="space-y-4">
              
              {/* Objective Sub-Tabs Bar */}
              <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setObjectiveSubTab('general')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    objectiveSubTab === 'general'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ClipboardList className="w-3.5 h-3.5" />
                  <span>{bi('الفحص والمشاهدات والتدخلات', 'General Exam & Interventions')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setObjectiveSubTab('rom')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    objectiveSubTab === 'rom'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Compass className="w-3.5 h-3.5 text-teal-600" />
                  <span>{bi('المدى الحركي', 'Range of Motion (ROM)')}</span>
                  {romBattery?.entries && romBattery.entries.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-teal-100 text-teal-800">
                      {romBattery.entries.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setObjectiveSubTab('mmt')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    objectiveSubTab === 'mmt'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Dumbbell className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{bi('القوة العضلية', 'Muscle Strength (MMT)')}</span>
                  {mmtBattery?.entries && mmtBattery.entries.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-indigo-100 text-indigo-800">
                      {mmtBattery.entries.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setObjectiveSubTab('neuro')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    objectiveSubTab === 'neuro'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5 text-amber-600" />
                  <span>{bi('الفحص العصبي للمريض', 'Neuro Screening')}</span>
                </button>
              </div>

              {/* Sub-Tab 1: General Exam & Interventions */}
              {objectiveSubTab === 'general' && (
                <div className="space-y-4">
                  {/* Objective Status Selector */}
                  <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                    <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                      {bi('حالة الفحص الموضوعي للجلسة:', 'Objective Examination Status:')}
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setObjectiveStatus('assessed')}
                        disabled={isFinalized}
                        className={`p-2.5 rounded-md text-xs font-semibold border transition-all text-center ${
                          objectiveStatus === 'assessed'
                            ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {bi('فحص موضوعي مفصل', 'Detailed Objective Exam')}
                      </button>

                      <button
                        type="button"
                        onClick={() => setObjectiveStatus('normal_findings')}
                        disabled={isFinalized}
                        className={`p-2.5 rounded-md text-xs font-semibold border transition-all text-center ${
                          objectiveStatus === 'normal_findings'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {bi('سليم ضمن الحدود الطبيعية', 'Within Normal Limits')}
                      </button>

                      <button
                        type="button"
                        onClick={() => setObjectiveStatus('not_assessed')}
                        disabled={isFinalized}
                        className={`p-2.5 rounded-md text-xs font-semibold border transition-all text-center ${
                          objectiveStatus === 'not_assessed'
                            ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {bi('لم يُجرَ فحص موضوعي', 'Not Assessed')}
                      </button>
                    </div>
                  </div>

                  {objectiveStatus === 'not_assessed' && (
                    <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 space-y-1">
                      <label className="block text-xs font-bold text-amber-900">
                        {bi('سبب عدم إجراء الفحص الموضوعي (إلزامي للاعتماد):', 'Reason for Not Assessing (Mandatory):')}
                      </label>
                      <input
                        type="text"
                        value={notAssessedReason}
                        onChange={(e) => setNotAssessedReason(e.target.value)}
                        disabled={isFinalized}
                        placeholder={bi('ألم حاد يمنع الحركة، إجهاد شديد، أو جلسة استشارية...', 'Acute pain, extreme fatigue, or consultation visit...')}
                        className="w-full px-3 py-1.5 text-xs border border-amber-300 rounded bg-white focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  )}

                  {objectiveStatus === 'normal_findings' && (
                    <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <span>{bi('تم توثيق نتائج الفحص السريري الموضوعي كسليمة وطبيعية بالكامل.', 'All objective examination findings documented as normal and within acceptable limits.')}</span>
                    </div>
                  )}

                  {objectiveStatus === 'assessed' && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-800 mb-1">
                          {bi('المشاهدات السريرية والفحص العيني', 'Clinical Observations')}
                        </label>
                        <textarea
                          value={clinicalObservations}
                          onChange={(e) => setClinicalObservations(e.target.value)}
                          disabled={isFinalized}
                          placeholder={bi('المشية، القوام، وجود تورم موضعي، لون الجلد، علامات الإجهاد...', 'Gait, posture, localized edema, skin temperature, fatigue signs...')}
                          rows={2}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-primary-500 disabled:bg-slate-50"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-800 mb-1">
                          {bi('نتائج الفحص البدني والجس', 'Physical Examination & Palpation')}
                        </label>
                        <textarea
                          value={objectiveFindings}
                          onChange={(e) => setObjectiveFindings(e.target.value)}
                          disabled={isFinalized}
                          placeholder={bi('نقاط الزناد العضلية، إيلام بالجس، أو ألم مع الحركة...', 'Palpation findings, trigger points, localized tenderness...')}
                          rows={2}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-primary-500 disabled:bg-slate-50"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-800 mb-1">
                          {bi('القياسات الوظيفية والأولية', 'Functional & Preliminary Measurements')}
                        </label>
                        <textarea
                          value={functionalOrPreliminaryMeasurements}
                          onChange={(e) => setFunctionalOrPreliminaryMeasurements(e.target.value)}
                          disabled={isFinalized}
                          placeholder={bi('قياسات إضافية (مثل: اختبار الوقوف، التوازن، أو مسافة المشي)...', 'Additional functional tests (e.g. balance, walking distance)...')}
                          rows={2}
                          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-primary-500 disabled:bg-slate-50"
                        />
                      </div>
                    </>
                  )}

                  {/* Interventions Executed in Session */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-800 mb-1">
                      {bi('التدخلات والعلاجات المنفذة في هذه الجلسة', 'Interventions & Modalities Applied')}
                    </label>
                    <textarea
                      value={dailyInterventionsSummary}
                      onChange={(e) => setDailyInterventionsSummary(e.target.value)}
                      disabled={isFinalized}
                      placeholder={bi('العلاج اليدوي، التمارين العلاجية، الأجهزة والكمادات المستخدمة...', 'Manual therapy, therapeutic exercises, modalities, ice/heat applied...')}
                      rows={2}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-primary-500 disabled:bg-slate-50"
                    />
                  </div>
                </div>
              )}

              {/* Sub-Tab 2: Range of Motion (ROM) */}
              {objectiveSubTab === 'rom' && (
                <div className="space-y-2">
                  <RomMmtAssessmentPanel
                    romBattery={romBattery}
                    mmtBattery={mmtBattery}
                    onChangeRom={setRomBattery}
                    onChangeMmt={setMmtBattery}
                    activeWorkflow="rom"
                    readOnly={isFinalized}
                  />
                </div>
              )}

              {/* Sub-Tab 3: Muscle Strength (MMT) */}
              {objectiveSubTab === 'mmt' && (
                <div className="space-y-2">
                  <RomMmtAssessmentPanel
                    romBattery={romBattery}
                    mmtBattery={mmtBattery}
                    onChangeRom={setRomBattery}
                    onChangeMmt={setMmtBattery}
                    activeWorkflow="mmt"
                    readOnly={isFinalized}
                  />
                </div>
              )}

              {/* Sub-Tab 4: Neuro Screening (Myotomes / Dermatomes / Reflexes) */}
              {objectiveSubTab === 'neuro' && (
                <div className="space-y-2">
                  <NeuroScreeningPanel
                    value={neuroScreening}
                    onChange={setNeuroScreening}
                    readOnly={isFinalized}
                  />
                </div>
              )}

            </div>
          )}

          {/* ======================================================================= */}
          {/* TAB 3: ASSESSMENT (A)                                                  */}
          {/* ======================================================================= */}
          {activeTab === 'assessment' && (
            <div className="space-y-4">
              {/* Clinical Impression */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  {bi('الانطباع والتحليل السريري', 'Clinical Impression & Analysis')} <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={clinicalImpressionCurrent}
                  onChange={(e) => setClinicalImpressionCurrent(e.target.value)}
                  disabled={isFinalized}
                  placeholder={bi('تحليل استجابة المريض السريرية وتفسير التغيرات...', 'Clinical analysis of patient response and functional changes...')}
                  rows={3}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-primary-500 disabled:bg-slate-50"
                />
              </div>

              {/* Progress Trajectory */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <label className="block text-xs font-semibold text-slate-800 mb-2">
                  {bi('مسار وتطور الحالة:', 'Progress Trajectory:')}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[
                    { id: 'improved', ar: 'تحسن سريري', en: 'Improved' },
                    { id: 'unchanged', ar: 'مستقرة دون تغيير', en: 'Unchanged' },
                    { id: 'plateau', ar: 'ثبات مرحلي', en: 'Plateau' },
                    { id: 'regressed', ar: 'تراجع', en: 'Regressed' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => !isFinalized && setProgressStatus(item.id as any)}
                      disabled={isFinalized}
                      className={`py-1.5 px-2 rounded-md text-xs font-medium border text-center transition-all ${
                        progressStatus === item.id
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {bi(item.ar, item.en)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Patient Tolerance */}
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <label className="block text-xs font-semibold text-slate-800 mb-2">
                  {bi('تحمل المريض للتمارين والعلاج:', 'Patient Tolerance:')}
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'well_tolerated', ar: 'تحمل ممتاز', en: 'Well Tolerated' },
                    { id: 'moderate_fatigue', ar: 'إجهاد عضلي متوسط', en: 'Moderate Fatigue' },
                    { id: 'poorly_tolerated', ar: 'تحمل ضعيف / زيادة الألم', en: 'Poorly Tolerated' },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => !isFinalized && setPatientTolerance(item.id as any)}
                      disabled={isFinalized}
                      className={`py-1.5 px-2 rounded-md text-xs font-medium border text-center transition-all ${
                        patientTolerance === item.id
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {bi(item.ar, item.en)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Factors or Barriers */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  {bi('عوامل أو عقبات تعيق التقدم', 'Factors Impacting Progress')}
                </label>
                <textarea
                  value={factorsImpactingProgress}
                  onChange={(e) => setFactorsImpactingProgress(e.target.value)}
                  disabled={isFinalized}
                  placeholder={bi('عوامل بيئية، نوم، التزام، أو قلق حركي...', 'Psychosocial factors, sleep, workload, fear avoidance...')}
                  rows={2}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-primary-500 disabled:bg-slate-50"
                />
              </div>
            </div>
          )}

          {/* ======================================================================= */}
          {/* TAB 4: PLAN (P)                                                         */}
          {/* ======================================================================= */}
          {activeTab === 'plan' && (
            <div className="space-y-4">
              {/* Next Session Plan */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  {bi('خطة الجلسة القادمة', 'Next Session Plan')} <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={nextSessionPlan}
                  onChange={(e) => setNextSessionPlan(e.target.value)}
                  disabled={isFinalized}
                  placeholder={bi('التدخلات والتمارين المخطط تنفيذها في الزيارة القادمة...', 'Interventions and exercises planned for next visit...')}
                  rows={3}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-primary-500 disabled:bg-slate-50"
                />
              </div>

              {/* Proposed Modifications */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  {bi('التعديلات المقترحة على مسار الخطة', 'Proposed Modifications')}
                </label>
                <textarea
                  value={proposedModifications}
                  onChange={(e) => setProposedModifications(e.target.value)}
                  disabled={isFinalized}
                  placeholder={bi('أي تعديل في تكرار الجلسات أو الأهداف المرحلية...', 'Any adjustments to frequency or goals...')}
                  rows={2}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-primary-500 disabled:bg-slate-50"
                />
              </div>

              {/* Home Instructions */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  {bi('التعليمات والتوجيهات المنزلية', 'Home Instructions & Advice')}
                </label>
                <textarea
                  value={homeInstructions}
                  onChange={(e) => setHomeInstructions(e.target.value)}
                  disabled={isFinalized}
                  placeholder={bi('توجيهات الحركة، بيئة العمل، والكمادات ومحاذير الجهد...', 'Ergonomic advice, heat/ice, activity precautions...')}
                  rows={2}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-primary-500 disabled:bg-slate-50"
                />
              </div>

              {/* Next Appointment Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-800 mb-1">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span>{bi('تاريخ الموعد القادم الموصى به', 'Recommended Next Appointment')}</span>
                  </span>
                </label>
                <input
                  type="date"
                  value={nextAppointmentDate}
                  onChange={(e) => setNextAppointmentDate(e.target.value)}
                  disabled={isFinalized}
                  className="w-full sm:w-60 px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-primary-500 disabled:bg-slate-50"
                />
              </div>
            </div>
          )}

          {/* ======================================================================= */}
          {/* TAB 5: PREVIEW (Clean Summary)                                          */}
          {/* ======================================================================= */}
          {activeTab === 'preview' && (
            <div className="space-y-4">
              {/* Header Banner */}
              <div className="p-3.5 bg-slate-900 text-white rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h4 className="font-bold text-xs sm:text-sm">
                    {bi(`ملخص تقرير التوثيق السريري — الجلسة #${session.sessionNumber}`, `Clinical Session Summary — Session #${session.sessionNumber}`)}
                  </h4>
                  <p className="text-[11px] text-slate-300">
                    {bi('التاريخ:', 'Date:')} {session.sessionDate} • {bi('المعالج:', 'Clinician:')} {session.data.therapistName || bi('د. المعالج الطبيعي', 'Physical Therapist')}
                  </p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold self-start sm:self-center ${
                  isFinalized ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/40' : 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                }`}>
                  {isFinalized ? bi('سجل معتمد', 'Finalized') : bi('مسودة قيد التحرير', 'Draft')}
                </span>
              </div>

              {/* Grid 4 Axes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                
                {/* S Block */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-900 text-xs block border-b border-slate-200 pb-1 flex items-center justify-between">
                    <span>{bi('S — أقوال وشكوى المريض', 'Subjective (S)')}</span>
                    <span className="font-mono text-slate-700 font-bold">{bi('شدة الألم:', 'Pain:')} {painNrsScore}/10</span>
                  </span>
                  <div>
                    <strong className="text-slate-700 block">{bi('الشكوى الحالية:', 'Chief Complaint:')}</strong>
                    <p className="text-slate-800 leading-relaxed mt-0.5 whitespace-pre-line">{chiefComplaint || '—'}</p>
                  </div>
                  {symptomChangesSinceLastSession && (
                    <div>
                      <strong className="text-slate-700 block">{bi('تطور الأعراض:', 'Symptom Evolution:')}</strong>
                      <p className="text-slate-600 mt-0.5">{symptomChangesSinceLastSession}</p>
                    </div>
                  )}
                  {bodyChart && (bodyChart.markers.length > 0 || (bodyChart.clinicianSummaryNotes && bodyChart.clinicianSummaryNotes.trim())) && (
                    <div className="pt-2 border-t border-slate-200">
                      <PatientBodyChart value={bodyChart} onChange={() => {}} readOnly={true} compactPreview={true} />
                    </div>
                  )}
                </div>

                {/* O Block */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-900 text-xs block border-b border-slate-200 pb-1 flex items-center justify-between">
                    <span>{bi('O — الفحص والمشاهدات', 'Objective (O)')}</span>
                    <span className="text-[10px] font-semibold text-slate-600">
                      {objectiveStatus === 'normal_findings'
                        ? bi('سليم ضمن الحدود', 'Within Normal Limits')
                        : objectiveStatus === 'not_assessed'
                        ? bi('لم يُجرَ فحص', 'Not Assessed')
                        : bi('فحص مفصل', 'Detailed Exam')}
                    </span>
                  </span>
                  {clinicalObservations && (
                    <div>
                      <strong className="text-slate-700 block">{bi('المشاهدات:', 'Observations:')}</strong>
                      <p className="text-slate-800 mt-0.5">{clinicalObservations}</p>
                    </div>
                  )}
                  {dailyInterventionsSummary && (
                    <div>
                      <strong className="text-slate-700 block">{bi('العلاج المنفذ:', 'Interventions Applied:')}</strong>
                      <p className="text-slate-800 mt-0.5">{dailyInterventionsSummary}</p>
                    </div>
                  )}
                  {/* Compact ROM & MMT */}
                  {((romBattery?.entries && romBattery.entries.length > 0) || (mmtBattery?.entries && mmtBattery.entries.length > 0)) && (
                    <div className="pt-2 border-t border-slate-200">
                      <RomMmtAssessmentPanel romBattery={romBattery} mmtBattery={mmtBattery} compactPreview={true} readOnly={true} />
                    </div>
                  )}
                  {/* Compact Neuro */}
                  {neuroScreening && (
                    <div className="pt-2 border-t border-slate-200">
                      <NeuroScreeningPanel value={neuroScreening} compactPreview={true} readOnly={true} />
                    </div>
                  )}
                </div>

                {/* A Block */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-900 text-xs block border-b border-slate-200 pb-1 flex items-center justify-between">
                    <span>{bi('A — التحليل والتقييم', 'Assessment (A)')}</span>
                    <span className="font-semibold text-slate-700">{progressStatus}</span>
                  </span>
                  <div>
                    <strong className="text-slate-700 block">{bi('الانطباع السريري:', 'Clinical Impression:')}</strong>
                    <p className="text-slate-800 leading-relaxed mt-0.5 whitespace-pre-line">{clinicalImpressionCurrent || '—'}</p>
                  </div>
                  <div>
                    <strong className="text-slate-700 block">{bi('التحمل:', 'Tolerance:')}</strong>
                    <span className="text-slate-600">{patientTolerance}</span>
                  </div>
                </div>

                {/* P Block */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                  <span className="font-bold text-slate-900 text-xs block border-b border-slate-200 pb-1">
                    {bi('P — الخطة العلاجية', 'Plan (P)')}
                  </span>
                  <div>
                    <strong className="text-slate-700 block">{bi('الخطة القادمة:', 'Next Plan:')}</strong>
                    <p className="text-slate-800 leading-relaxed mt-0.5 whitespace-pre-line">{nextSessionPlan || '—'}</p>
                  </div>
                  {homeInstructions && (
                    <div>
                      <strong className="text-slate-700 block">{bi('التعليمات المنزلية:', 'Home Instructions:')}</strong>
                      <p className="text-slate-600 mt-0.5">{homeInstructions}</p>
                    </div>
                  )}
                  {nextAppointmentDate && (
                    <div>
                      <strong className="text-slate-700 block">{bi('الموعد القادم:', 'Next Appointment:')}</strong>
                      <span className="text-slate-800 font-bold">{nextAppointmentDate}</span>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

        </div>

        {/* Modal Bottom Actions Bar */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 transition-colors"
            >
              {bi('إغلاق', 'Close')}
            </button>

            {isFinalized && onOpenAddendumModal && (
              <button
                type="button"
                onClick={onOpenAddendumModal}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 transition-colors"
              >
                <FileEdit className="w-3.5 h-3.5 text-amber-600" />
                <span>{bi('إضافة ملحق سريري', 'Add Addendum')}</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isFinalized && (
              <>
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 shadow-2xs transition-all disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5 text-primary-600" />
                  <span>{submitting ? bi('جاري الحفظ...', 'Saving...') : bi('حفظ كمسودة', 'Save Draft')}</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenFinalizeModal}
                  disabled={submitting}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs hover:shadow transition-all disabled:opacity-50"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>{bi('اعتماد الجلسة نهائياً', 'Finalize Session')}</span>
                </button>
              </>
            )}
          </div>
        </div>

      </div>

      {/* Confirmation Modal for Finalization */}
      {showFinalizeConfirm && (
        <div className="fixed inset-0 z-60 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-5 max-w-md w-full shadow-2xl border border-emerald-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
              <ShieldCheck className="w-5 h-5" />
            </div>

            <h4 className="text-sm font-bold text-slate-900 mb-1">
              {bi('تأكيد الاعتماد السريري وإقرار المعالج', 'Clinician Attestation & Integrity Lock')}
            </h4>
            
            <p className="text-xs text-slate-600 leading-relaxed mb-3">
              {bi(
                'باعتماد هذا السجل، فإنك تقر سريرياً بصحة ودقة البيانات المسجلة. سيتم حساب بصمة سلامة المحتوى (SHA-256 Digest) لتجميد السجل ضد أي تعديل مباشر، وأي تصحيح مستقبلي سيتطلب ملحقاً سريرياً.',
                'By finalizing this record, you clinically attest to the accuracy of the documented findings. A SHA-256 integrity digest will lock the record against direct edits, and subsequent changes will require a clinical addendum.'
              )}
            </p>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {bi('اسم المعالج الطبيعي المعتمد:', 'Attesting Physical Therapist Name:')}
              </label>
              <input
                type="text"
                value={therapistSignature}
                onChange={(e) => setTherapistSignature(e.target.value)}
                placeholder={bi('اكتب اسم المعالج لاعتماد السجل...', 'Enter clinician name...')}
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-emerald-500 focus:outline-hidden"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleConfirmFinalize}
                disabled={submitting || !therapistSignature.trim()}
                className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-semibold transition-all disabled:opacity-50"
              >
                {submitting ? bi('جاري الاعتماد...', 'Finalizing...') : bi('تأكيد إقرار المعالج واعتماد السجل', 'Confirm Attestation & Finalize')}
              </button>
              <button
                type="button"
                onClick={() => setShowFinalizeConfirm(false)}
                className="px-3 py-2 bg-slate-100 text-slate-700 rounded-md text-xs font-medium hover:bg-slate-200"
              >
                {bi('إلغاء', 'Cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
