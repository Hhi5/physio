// =======================================================================
// PhysioRecord — Structured Treatment Session & Exercise Flowsheet (Phase 6 & 9)
// Includes Carry-Forward Exercise Flowsheet, Manual Therapy, Physical Agents,
// Pre/Post Pain NPRS, and SHA-256 Sign & Lock Finalization
// =======================================================================

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useVault } from '../../context/VaultContext';
import { SoapService } from '../../services/soapService';
import { SessionService } from '../../services/sessionService';
import {
  ClinicOperationsService,
  PT_EXERCISE_CATALOG,
  ROLE_PERMISSIONS,
} from '../../services/clinicOperationsService';
import type {
  SessionRecord,
  SoapNoteRecord,
  SoapNoteData,
} from '../../types/clinical';
import type {
  SessionFlowsheetData,
  FlowsheetExerciseEntry,
  ManualTherapyFlowsheetEntry,
  PhysicalAgentFlowsheetEntry,
} from '../../types/clinicManagement';
import {
  ArrowLeft,
  ArrowRight,
  Save,
  CheckCircle2,
  Layers,
  Copy,
  Plus,
  Trash2,
  Lock,
  Dumbbell,
  Zap,
  Hand,
} from 'lucide-react';

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
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isLocked, setIsLocked] = useState(session.data.status === 'finalized');

  // Daily Treatment SOAP Fields
  const [prePainNrs, setPrePainNrs] = useState<number>(5);
  const [postPainNrs, setPostPainNrs] = useState<number>(3);
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [symptomChanges, setSymptomChanges] = useState('');
  const [interventionsSummary, setInterventionsSummary] = useState('');
  const [clinicalObservations, setClinicalObservations] = useState('');
  const [clinicalImpression, setClinicalImpression] = useState('');
  const [progressStatus, setProgressStatus] = useState<
    'improved' | 'unchanged' | 'regressed' | 'plateau'
  >('improved');
  const [patientTolerance, setPatientTolerance] = useState<
    'well_tolerated' | 'moderate_fatigue' | 'poorly_tolerated'
  >('well_tolerated');
  const [nextSessionPlan, setNextSessionPlan] = useState('');
  const [homeInstructions, setHomeInstructions] = useState('');

  // Structured Exercise & Modality Flowsheet State
  const [exercises, setExercises] = useState<FlowsheetExerciseEntry[]>([]);
  const [manualTherapy, setManualTherapy] = useState<ManualTherapyFlowsheetEntry[]>([]);
  const [physicalAgents, setPhysicalAgents] = useState<PhysicalAgentFlowsheetEntry[]>([]);
  const [selectedCatalogExId, setSelectedCatalogExId] = useState<string>(
    PT_EXERCISE_CATALOG[0].id
  );

  const activeStaff = ClinicOperationsService.getActiveStaff();
  const perms = ROLE_PERMISSIONS[activeStaff.role];

  useEffect(() => {
    async function loadSoapAndFlowsheet() {
      if (!dek || !session.id) return;
      setIsLoading(true);
      try {
        const existing = await SoapService.getSoapNoteBySession(session.id, dek);
        if (existing) {
          setSoapRecord(existing);
          const d = existing.data;
          setChiefComplaint(d.subjective?.chiefComplaint || '');
          setSymptomChanges(d.subjective?.symptomChangesSinceLastSession || '');
          setPrePainNrs(d.subjective?.painNrsScore ?? 5);
          setInterventionsSummary(d.objective?.dailyInterventionsSummary || '');
          setClinicalObservations(d.objective?.clinicalObservations || '');
          setClinicalImpression(d.assessment?.clinicalImpressionCurrent || '');
          setProgressStatus(d.assessment?.progressStatus || 'improved');
          setPatientTolerance(d.assessment?.patientTolerance || 'well_tolerated');
          setNextSessionPlan(d.plan?.nextSessionPlan || '');
          setHomeInstructions(d.plan?.homeInstructions || '');
          if (d.isFinalized) setIsLocked(true);
        }

        const storedFlow = ClinicOperationsService.getSessionFlowsheet(session.id);
        if (storedFlow) {
          setPrePainNrs(storedFlow.preSessionPainNrs);
          setPostPainNrs(storedFlow.postSessionPainNrs);
          setExercises(storedFlow.exercises || []);
          setManualTherapy(storedFlow.manualTherapy || []);
          setPhysicalAgents(storedFlow.physicalAgents || []);
        }
      } catch (err) {
        console.error('Failed to load session note:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadSoapAndFlowsheet();
  }, [session.id, dek]);

  const handleCarryForwardPreviousFlowsheet = () => {
    if (isLocked) return;
    const prev = ClinicOperationsService.getLatestEpisodeFlowsheet(session.episodeId);
    if (prev) {
      setExercises(
        prev.exercises.map((e) => ({
          ...e,
          id: `flow_ex_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        }))
      );
      setManualTherapy(
        prev.manualTherapy.map((m) => ({
          ...m,
          id: `flow_mt_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        }))
      );
      setPhysicalAgents(
        prev.physicalAgents.map((p) => ({
          ...p,
          id: `flow_pa_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
        }))
      );
    }
  };

  const handleAddExerciseFromCatalog = () => {
    if (isLocked) return;
    const cat = PT_EXERCISE_CATALOG.find((e) => e.id === selectedCatalogExId);
    if (!cat) return;
    const entry: FlowsheetExerciseEntry = {
      id: `flow_ex_${Date.now()}`,
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
    setExercises([...exercises, entry]);
  };

  const handleAddManualTherapy = () => {
    if (isLocked) return;
    const entry: ManualTherapyFlowsheetEntry = {
      id: `flow_mt_${Date.now()}`,
      techniqueAr: 'تحريك مفصلي تذبذبي (Maitland Mobilization)',
      techniqueEn: 'Maitland Joint Mobilization',
      targetJointOrTissue: episodeTitle,
      gradeOrIntensity: 'Grade III',
      durationMinutes: 10,
    };
    setManualTherapy([...manualTherapy, entry]);
  };

  const handleAddPhysicalAgent = (
    modality: PhysicalAgentFlowsheetEntry['modality'],
    modalityAr: string,
    defaultParams: string
  ) => {
    if (isLocked) return;
    const entry: PhysicalAgentFlowsheetEntry = {
      id: `flow_pa_${Date.now()}`,
      modality,
      modalityAr,
      site: episodeTitle,
      parameters: defaultParams,
      durationMinutes: 15,
    };
    setPhysicalAgents([...physicalAgents, entry]);
  };

  const compileFlowsheetSummaryText = () => {
    const exLines = exercises.map(
      (e) =>
        `${isAr ? e.nameAr : e.nameEn} (${e.sets}×${e.reps}${
          e.holdSeconds ? ` × ${e.holdSeconds}s` : ''
        } @ ${e.loadOrBand})`
    );
    const mtLines = manualTherapy.map(
      (m) => `${isAr ? m.techniqueAr : m.techniqueEn} [${m.gradeOrIntensity}, ${m.durationMinutes}m]`
    );
    const paLines = physicalAgents.map(
      (p) => `${p.modality} (${p.parameters}, ${p.durationMinutes}m)`
    );
    return [...exLines, ...mtLines, ...paLines, interventionsSummary]
      .filter(Boolean)
      .join(' • ');
  };

  const handleSaveSession = async (finalizeAndLock = false) => {
    if (!dek) return;
    setIsSaving(true);
    try {
      const flowsheetPayload: SessionFlowsheetData = {
        preSessionPainNrs: prePainNrs,
        postSessionPainNrs: postPainNrs,
        exercises,
        manualTherapy,
        physicalAgents,
      };
      ClinicOperationsService.saveSessionFlowsheet(
        session.id,
        session.episodeId,
        flowsheetPayload
      );

      const compiledSummary = compileFlowsheetSummaryText();

      const soapPayload: SoapNoteData = {
        subjective: {
          chiefComplaint:
            chiefComplaint || (isAr ? 'متابعة علاجية مستمرة' : 'Routine follow-up session'),
          symptomChangesSinceLastSession: symptomChanges,
          painNrsScore: prePainNrs,
          painVasCurrent: prePainNrs,
        },
        objective: {
          ...(soapRecord?.data.objective || {}),
          dailyInterventionsSummary: compiledSummary,
          clinicalObservations,
        },
        assessment: {
          clinicalImpressionCurrent:
            clinicalImpression ||
            (isAr
              ? `انخفاض الألم من ${prePainNrs}/10 إلى ${postPainNrs}/10 بعد الجلسة`
              : `Pain decreased from ${prePainNrs}/10 to ${postPainNrs}/10 post-session`),
          progressStatus,
          patientTolerance,
        },
        plan: {
          nextSessionPlan:
            nextSessionPlan ||
            (isAr ? 'الاستمرار في التدرج الحركي وخطة التأهيل' : 'Continue progressive rehab plan'),
          homeInstructions,
        },
        isFinalized: finalizeAndLock,
        finalizedAt: finalizeAndLock ? new Date().toISOString() : undefined,
        finalizedBy: finalizeAndLock ? activeStaff.nameEn : undefined,
      };

      if (soapRecord) {
        const updated = await SoapService.updateSoapNote(soapRecord.id, soapPayload, dek);
        setSoapRecord(updated);
      } else {
        const created = await SoapService.createSoapNote(
          patientId,
          session.episodeId,
          session.id,
          soapPayload,
          dek
        );
        setSoapRecord(created);
      }

      if (finalizeAndLock) {
        await SessionService.updateSession(
          session.id,
          {
            ...session.data,
            status: 'finalized',
            finalizedAt: new Date().toISOString(),
            finalizedBy: activeStaff.nameEn,
          },
          dek
        );
        setIsLocked(true);
        ClinicOperationsService.appendAuditLog({
          actionType: 'session_finalized',
          entityType: 'session',
          entityId: session.id,
          summaryAr: `اعتماد وقفل الجلسة #${session.data.sessionNumber} للمريض ${patientName}`,
          summaryEn: `Signed and locked Session #${session.data.sessionNumber} for ${patientName}`,
        });
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      onSessionUpdated();
    } catch (err) {
      console.error('Failed to save treatment session:', err);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {isAr ? 'جاري فك تشفير بيانات الجلسة وجدول التمارين...' : 'Decrypting session & flowsheet...'}
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
            onClick={onBack}
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer shrink-0"
          >
            {isRtl ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          </button>

          <div>
            <div className="flex items-center gap-2 text-xs tabular-nums">
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
            onClick={onOpenMasterChart}
            className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Layers className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>{isAr ? 'السجل العام والمقارنة' : 'Episode Chart'}</span>
          </button>

          {!isLocked && (
            <>
              <button
                type="button"
                onClick={() => handleSaveSession(false)}
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
                  onClick={() => handleSaveSession(true)}
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

      {/* Main Session & Flowsheet Canvas */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-5 max-w-5xl mx-auto w-full">
        {/* Pre & Post Session Pain NPRS Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold tabular-nums">
              <span className="text-slate-800 dark:text-slate-200">
                {isAr ? 'شدة الألم قبل الجلسة (Pre-Session NPRS):' : 'Pre-Session Pain (NPRS 0–10):'}
              </span>
              <span className="font-mono text-sm font-extrabold text-amber-600 dark:text-amber-400">
                {prePainNrs} / 10
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              disabled={isLocked}
              value={prePainNrs}
              onChange={(e) => setPrePainNrs(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold tabular-nums">
              <span className="text-slate-800 dark:text-slate-200">
                {isAr ? 'شدة الألم بعد انتهاء الجلسة (Post-Session NPRS):' : 'Post-Session Pain (NPRS 0–10):'}
              </span>
              <span className="font-mono text-sm font-extrabold text-emerald-600 dark:text-emerald-400">
                {postPainNrs} / 10
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="10"
              disabled={isLocked}
              value={postPainNrs}
              onChange={(e) => setPostPainNrs(Number(e.target.value))}
              className="w-full accent-emerald-600 cursor-pointer"
            />
          </div>
        </div>

        {/* Structured Exercise & Modality Flowsheet (Prompt EMR Style) */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Dumbbell className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isAr
                  ? 'جدول التمارين العلاجية المنفذة في الجلسة (Session Exercise Flowsheet)'
                  : 'Therapeutic Exercise Flowsheet (Sets × Reps × Hold × Load)'}
              </h3>
            </div>

            {!isLocked && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleCarryForwardPreviousFlowsheet}
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

          {exercises.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-4">
              {isAr
                ? 'أدرج التمارين المنفذة اليوم أو انقر على "نسخ تمارين الجلسة السابقة" لتوثيق التدرج في الأوزان والتكرارات.'
                : 'Add exercises from catalog or copy previous session flowsheet.'}
            </p>
          ) : (
            <div className="overflow-x-auto -mx-2 px-2">
              <table className="w-full min-w-[640px] text-start text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                    <th className="py-2.5 px-3 text-start">{isAr ? 'التمرين العلاجي' : 'Exercise'}</th>
                    <th className="py-2.5 px-3 text-center w-20">{isAr ? 'جولات (Sets)' : 'Sets'}</th>
                    <th className="py-2.5 px-3 text-center w-20">{isAr ? 'تكرار (Reps)' : 'Reps'}</th>
                    <th className="py-2.5 px-3 text-center w-24">{isAr ? 'ثبات (Hold s)' : 'Hold (s)'}</th>
                    <th className="py-2.5 px-3 text-start w-40">{isAr ? 'المقاومة / الوزن' : 'Load / Band'}</th>
                    <th className="py-2.5 px-3 text-start w-36">{isAr ? 'الاستجابة' : 'Response'}</th>
                    <th className="py-2.5 px-2 text-end w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
                  {exercises.map((ex, idx) => (
                    <tr key={ex.id}>
                      <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                        {isAr ? ex.nameAr : ex.nameEn}
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          disabled={isLocked}
                          value={ex.sets}
                          onChange={(e) => {
                            const next = [...exercises];
                            next[idx] = { ...ex, sets: Number(e.target.value) };
                            setExercises(next);
                          }}
                          className="w-16 px-2 py-1 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-center"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          disabled={isLocked}
                          value={ex.reps}
                          onChange={(e) => {
                            const next = [...exercises];
                            next[idx] = { ...ex, reps: Number(e.target.value) };
                            setExercises(next);
                          }}
                          className="w-16 px-2 py-1 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-center"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="number"
                          disabled={isLocked}
                          value={ex.holdSeconds}
                          onChange={(e) => {
                            const next = [...exercises];
                            next[idx] = { ...ex, holdSeconds: Number(e.target.value) };
                            setExercises(next);
                          }}
                          className="w-16 px-2 py-1 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono text-center"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <input
                          type="text"
                          disabled={isLocked}
                          value={ex.loadOrBand}
                          onChange={(e) => {
                            const next = [...exercises];
                            next[idx] = { ...ex, loadOrBand: e.target.value };
                            setExercises(next);
                          }}
                          className="w-full px-2 py-1 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 font-mono"
                        />
                      </td>
                      <td className="py-2.5 px-3">
                        <select
                          disabled={isLocked}
                          value={ex.rpeOrPainResponse}
                          onChange={(e) => {
                            const next = [...exercises];
                            next[idx] = { ...ex, rpeOrPainResponse: e.target.value as any };
                            setExercises(next);
                          }}
                          className="w-full px-2 py-1 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                        >
                          <option value="pain_free">{isAr ? 'دون ألم' : 'Pain-free'}</option>
                          <option value="mild_discomfort">{isAr ? 'شد خفيف مقبول' : 'Mild discomfort'}</option>
                          <option value="painful_modified">{isAr ? 'مؤلم - تم التعديل' : 'Modified'}</option>
                        </select>
                      </td>
                      <td className="py-2.5 px-2 text-end">
                        {!isLocked && (
                          <button
                            type="button"
                            onClick={() =>
                              setExercises(exercises.filter((item) => item.id !== ex.id))
                            }
                            className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
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

            {manualTherapy.map((mt, idx) => (
              <div
                key={mt.id}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
              >
                <input
                  type="text"
                  disabled={isLocked}
                  value={isAr ? mt.techniqueAr : mt.techniqueEn}
                  onChange={(e) => {
                    const next = [...manualTherapy];
                    next[idx] = { ...mt, techniqueAr: e.target.value, techniqueEn: e.target.value };
                    setManualTherapy(next);
                  }}
                  className="flex-1 bg-transparent font-semibold text-slate-900 dark:text-white"
                />
                <select
                  disabled={isLocked}
                  value={mt.gradeOrIntensity}
                  onChange={(e) => {
                    const next = [...manualTherapy];
                    next[idx] = { ...mt, gradeOrIntensity: e.target.value as any };
                    setManualTherapy(next);
                  }}
                  className="px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono"
                >
                  <option value="Grade I">Grade I</option>
                  <option value="Grade II">Grade II</option>
                  <option value="Grade III">Grade III</option>
                  <option value="Grade IV">Grade IV</option>
                  <option value="MWM">Mulligan MWM</option>
                  <option value="Soft Tissue">Myofascial</option>
                </select>
                {!isLocked && (
                  <button
                    type="button"
                    onClick={() =>
                      setManualTherapy(manualTherapy.filter((m) => m.id !== mt.id))
                    }
                    className="text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Physical Agents / Electrotherapy Box */}
          <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                <Zap className="w-4 h-4 text-amber-500" />
                <span>{isAr ? 'الأجهزة والوسائل الفيزيائية (Physical Agents)' : 'Physical Modalities'}</span>
              </div>
            </div>

            {!isLocked && (
              <div className="flex flex-wrap gap-1.5">
                {[
                  { mod: 'TENS' as const, ar: 'TENS مسكن', params: '100Hz, 150µs, 15m' },
                  { mod: 'Ultrasound' as const, ar: 'أمواج فوق صوتية US', params: '1MHz, 1.2 W/cm², 8m' },
                  { mod: 'NMES' as const, ar: 'تحفيز عضلي NMES', params: '50Hz, 10s/30s, 15m' },
                  { mod: 'DryNeedling' as const, ar: 'إبر جافة (Dry Needling)', params: 'Trigger Points' },
                  { mod: 'Cryotherapy' as const, ar: 'كمادات باردة Cryo', params: '15 mins' },
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

            {physicalAgents.map((pa, idx) => (
              <div
                key={pa.id}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
              >
                <span className="font-bold text-teal-700 dark:text-teal-400">
                  {isAr ? pa.modalityAr : pa.modality}
                </span>
                <input
                  type="text"
                  disabled={isLocked}
                  value={pa.parameters}
                  onChange={(e) => {
                    const next = [...physicalAgents];
                    next[idx] = { ...pa, parameters: e.target.value };
                    setPhysicalAgents(next);
                  }}
                  className="flex-1 px-2 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-mono text-[11px]"
                />
                {!isLocked && (
                  <button
                    type="button"
                    onClick={() =>
                      setPhysicalAgents(physicalAgents.filter((p) => p.id !== pa.id))
                    }
                    className="text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Subjective Changes & Assessment/Plan */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-800 dark:text-white block mb-1">
                {isAr ? 'ملاحظات المريض وتغير الأعراض منذ الجلسة السابقة:' : 'Subjective Changes:'}
              </label>
              <textarea
                rows={2}
                disabled={isLocked}
                value={symptomChanges}
                onChange={(e) => setSymptomChanges(e.target.value)}
                placeholder={isAr ? 'تحسن في مدى الحركة، التزام جيد بالبرنامج المنزلي...' : 'Improved mobility, good HEP compliance...'}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-800 dark:text-white block mb-1">
                {isAr ? 'خطة الجلسة القادمة والتعديلات المقترحة:' : 'Next Session Plan:'}
              </label>
              <textarea
                rows={2}
                disabled={isLocked}
                value={nextSessionPlan}
                onChange={(e) => setNextSessionPlan(e.target.value)}
                placeholder={isAr ? 'زيادة المقاومة المطاطية، إدخال تمارين التوازن...' : 'Progress resistance band, introduce balance drills...'}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
