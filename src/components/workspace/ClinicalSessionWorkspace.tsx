// =======================================================================
// PhysioRecord — Next-Gen Expansive Clinical Session Workspace
// Dedicated full-canvas documentation environment replacing cramped modals
// =======================================================================

import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useVault } from '../../context/VaultContext';
import { SoapService } from '../../services/soapService';
import { SessionService } from '../../services/sessionService';
import type {
  SessionRecord,
  SoapNoteRecord,
  SoapNoteData,
  PatientBodyChartData,
  SoapObjectiveData,
} from '../../types/clinical';
import type {
  OrthopedicSpecialTestItem,
  GaitPostureData,
  FunctionalScaleEntry,
  CustomWidgetDefinition,
} from '../../types/clinicalWidgets';
import { ExamWidgetShelf } from './ExamWidgetShelf';
import { ActiveExamCanvas } from './ActiveExamCanvas';
import { CustomWidgetStudioModal } from './CustomWidgetStudioModal';
import {
  ArrowLeft,
  ArrowRight,
  Save,
  CheckCircle2,
  Clock,
  Printer,
  Sparkles,
  AlertCircle,
  FileText,
  Activity,
  Layers,
  Send,
  Lock,
} from 'lucide-react';

interface ClinicalSessionWorkspaceProps {
  session: SessionRecord;
  patientId: string;
  patientName: string;
  episodeTitle: string;
  onBack: () => void;
  onSessionUpdated: () => void;
}

export const ClinicalSessionWorkspace: React.FC<ClinicalSessionWorkspaceProps> = ({
  session,
  patientId,
  patientName,
  episodeTitle,
  onBack,
  onSessionUpdated,
}) => {
  const { language, isRtl } = useLanguage();
  const isAr = language === 'ar';
  const { dek } = useVault();

  const [activeTab, setActiveTab] = useState<'subjective' | 'objective' | 'assessment' | 'plan' | 'overview'>('objective');
  const [soapRecord, setSoapRecord] = useState<SoapNoteRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isCustomStudioOpen, setIsCustomStudioOpen] = useState(false);

  // SOAP State
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [symptomChanges, setSymptomChanges] = useState('');
  const [painVas, setPainVas] = useState<number>(5);
  const [bodyChart, setBodyChart] = useState<PatientBodyChartData | undefined>(undefined);
  const [objective, setObjective] = useState<SoapObjectiveData>({});
  const [specialTests, setSpecialTests] = useState<OrthopedicSpecialTestItem[]>([]);
  const [gaitPosture, setGaitPosture] = useState<GaitPostureData | undefined>(undefined);
  const [functionalScales, setFunctionalScales] = useState<FunctionalScaleEntry | undefined>(undefined);
  const [customWidgetsData, setCustomWidgetsData] = useState<Record<string, any>>({});
  const [clinicalImpression, setClinicalImpression] = useState('');
  const [progressStatus, setProgressStatus] = useState<'improved' | 'unchanged' | 'regressed' | 'plateau'>('improved');
  const [patientTolerance, setPatientTolerance] = useState<'well_tolerated' | 'moderate_fatigue' | 'poorly_tolerated'>('well_tolerated');
  const [planNextSession, setPlanNextSession] = useState('');
  const [homeInstructions, setHomeInstructions] = useState('');

  // Active Widgets in Objective
  const [activeWidgetIds, setActiveWidgetIds] = useState<string[]>(['body_chart', 'rom']);

  // Load existing SOAP note
  useEffect(() => {
    async function loadSoap() {
      if (!dek || !session.id) return;
      setIsLoading(true);
      try {
        const existing = await SoapService.getSoapNoteBySession(session.id, dek);
        if (existing) {
          setSoapRecord(existing);
          const d = existing.data;
          setChiefComplaint(d.subjective?.chiefComplaint || '');
          setSymptomChanges(d.subjective?.symptomChangesSinceLastSession || '');
          setPainVas(d.subjective?.painNrsScore ?? 5);
          setBodyChart(d.subjective?.bodyChart);
          setObjective(d.objective || {});
          setClinicalImpression(d.assessment?.clinicalImpressionCurrent || '');
          setProgressStatus(d.assessment?.progressStatus || 'improved');
          setPatientTolerance(d.assessment?.patientTolerance || 'well_tolerated');
          setPlanNextSession(d.plan?.nextSessionPlan || '');
          setHomeInstructions(d.plan?.homeInstructions || '');

          // Detect active widgets from loaded data
          const detected = new Set<string>();
          if (d.subjective?.bodyChart?.markers?.length) detected.add('body_chart');
          if (d.objective?.romBattery?.entries?.length) detected.add('rom');
          if (d.objective?.mmtBattery?.entries?.length) detected.add('mmt');
          if (d.objective?.neuroScreening) detected.add('neuro');
          if (detected.size > 0) {
            setActiveWidgetIds(Array.from(detected));
          }
        }
      } catch (err) {
        console.error('Failed to load SOAP note:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadSoap();
  }, [session.id, dek]);

  const handleAddWidget = (widgetId: string) => {
    if (!activeWidgetIds.includes(widgetId)) {
      setActiveWidgetIds((prev) => [...prev, widgetId]);
    }
    setActiveTab('objective');
  };

  const handleRemoveWidget = (widgetId: string) => {
    setActiveWidgetIds((prev) => prev.filter((id) => id !== widgetId));
  };

  const handleSaveSoap = async () => {
    if (!dek) return;
    setIsSaving(true);
    try {
      const soapPayload: SoapNoteData = {
        subjective: {
          chiefComplaint: chiefComplaint || (isAr ? 'متابعة سريرية مستمرة' : 'Routine follow-up'),
          symptomChangesSinceLastSession: symptomChanges,
          painNrsScore: painVas,
          painVasCurrent: painVas,
          bodyChart,
        },
        objective: {
          ...objective,
          objectiveFindings: objective.objectiveFindings || '',
          clinicalObservations: objective.clinicalObservations || '',
        },
        assessment: {
          clinicalImpressionCurrent: clinicalImpression || (isAr ? 'استجابة جيدة للبروتوكول العلاجي' : 'Good response to rehab protocol'),
          progressStatus,
          patientTolerance,
        },
        plan: {
          nextSessionPlan: planNextSession || (isAr ? 'الاستمرار في تمارين التدرج الوظيفي' : 'Continue functional progression'),
          homeInstructions,
        },
        isFinalized: false,
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

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      onSessionUpdated();
    } catch (err: any) {
      console.error('Failed to save SOAP note:', err);
      alert(err.message || 'Error saving session note');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-medium">
            {isAr ? 'جاري فك تشفير وتجهيز مساحة العمل السريرية...' : 'Decrypting clinical workspace...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Top Clinical Ribbon */}
      <div className="px-6 py-3.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-4 shrink-0 shadow-md">
        {/* Breadcrumb & Session Title */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
            title={isAr ? 'العودة لسجل المريض' : 'Back to patient overview'}
          >
            {isRtl ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          </button>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-teal-400 font-mono">
                {isAr ? `جلسة #${session.data.sessionNumber}` : `Session #${session.data.sessionNumber}`}
              </span>
              <span className="text-xs text-slate-600 dark:text-slate-500">•</span>
              <span className="text-xs text-slate-400 font-medium">{patientName}</span>
              <span className="text-xs text-slate-600 dark:text-slate-500">•</span>
              <span className="text-xs text-slate-400 font-medium">{episodeTitle}</span>
            </div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2 mt-0.5">
              <span>{session.data.sessionDate}</span>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                {session.data.sessionType}
              </span>
            </h2>
          </div>
        </div>

        {/* Pain VAS Slider & Save Action */}
        <div className="flex items-center gap-4">
          {/* Pain VAS Metric Pill */}
          <div className="flex items-center gap-2.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <span className="text-xs font-bold text-slate-400">
              {isAr ? 'مؤشر الألم (VAS):' : 'Pain VAS:'}
            </span>
            <input
              type="range"
              min="0"
              max="10"
              value={painVas}
              onChange={(e) => setPainVas(Number(e.target.value))}
              className="w-20 accent-teal-500 cursor-pointer"
            />
            <span
              className={`px-2 py-0.5 rounded-md font-bold font-mono text-xs text-white ${
                painVas >= 7
                  ? 'bg-rose-600'
                  : painVas >= 4
                  ? 'bg-amber-500'
                  : painVas > 0
                  ? 'bg-emerald-600'
                  : 'bg-slate-700'
              }`}
            >
              {painVas}/10
            </span>
          </div>

          {/* Save Status / Button */}
          <button
            type="button"
            onClick={handleSaveSoap}
            disabled={isSaving}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all cursor-pointer ${
              saveSuccess
                ? 'bg-emerald-600 text-white'
                : 'bg-teal-600 hover:bg-teal-500 text-white'
            }`}
          >
            {isSaving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : saveSuccess ? (
              <CheckCircle2 className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>
              {isSaving
                ? isAr
                  ? 'جاري التشفير والحفظ...'
                  : 'Encrypting...'
                : saveSuccess
                ? isAr
                  ? 'تم الحفظ مشفراً!'
                  : 'Saved & Encrypted!'
                : isAr
                ? 'حفظ التوثيق السريري'
                : 'Save Clinical Note'}
            </span>
          </button>
        </div>
      </div>

      {/* Workspace Tabs Navigation */}
      <div className="px-6 border-b border-slate-800 bg-slate-900/90 flex items-center gap-2 shrink-0 overflow-x-auto scrollbar-none">
        {[
          { id: 'objective', labelAr: 'O: الفحص السريري ورف الأدوات', labelEn: 'Objective & Exam Shelf', icon: Activity, count: activeWidgetIds.length },
          { id: 'subjective', labelAr: 'S: شكوى المريض والأعراض', labelEn: 'Subjective Narrative', icon: FileText },
          { id: 'assessment', labelAr: 'A: التقييم والتقدم السريري', labelEn: 'Assessment & Impression', icon: Sparkles },
          { id: 'plan', labelAr: 'P: خطة العلاج والتمارين', labelEn: 'Plan & Next Session', icon: Send },
        ].map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                isSelected
                  ? 'text-teal-400 border-teal-500 bg-slate-850/60'
                  : 'text-slate-400 border-transparent hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{isAr ? tab.labelAr : tab.labelEn}</span>
              {tab.count !== undefined && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-mono bg-teal-950 text-teal-300 border border-teal-800">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Documentation Canvas Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Objective Tab (Default & Core Focus) */}
        {activeTab === 'objective' && (
          <div className="space-y-6 max-w-7xl mx-auto">
            {/* The Examination Palette / Shelf */}
            <ExamWidgetShelf
              onAddWidget={handleAddWidget}
              onOpenCustomStudio={() => setIsCustomStudioOpen(true)}
              activeWidgetIds={activeWidgetIds}
            />

            {/* The Active Examination Canvas (Drop Zone & Cards) */}
            <ActiveExamCanvas
              activeWidgetIds={activeWidgetIds}
              onRemoveWidget={handleRemoveWidget}
              onAddWidget={handleAddWidget}
              bodyChart={bodyChart}
              onBodyChartChange={setBodyChart}
              objective={objective}
              onObjectiveChange={setObjective}
              specialTests={specialTests}
              onSpecialTestsChange={setSpecialTests}
              gaitPosture={gaitPosture}
              onGaitPostureChange={setGaitPosture}
              functionalScales={functionalScales}
              onFunctionalScalesChange={setFunctionalScales}
              customWidgetsData={customWidgetsData}
              onCustomWidgetsDataChange={setCustomWidgetsData}
            />

            {/* General Clinical Observations & Interventions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white block">
                    {isAr ? 'المشاهدات السريرية العامة (Clinical Observations):' : 'General Clinical Observations:'}
                  </label>
                  <span className="text-[10px] text-slate-500 font-semibold">{isAr ? 'كبس سريع' : 'Quick phrases'}</span>
                </div>

                {/* Quick Phrase Chips */}
                <div className="flex flex-wrap gap-1.5 pb-1">
                  {[
                    { ar: 'قوام طبيعي متناظر', en: 'Symmetric posture' },
                    { ar: 'مشية عرجاء مع تفادي التحميل (Antalgic gait)', en: 'Antalgic gait' },
                    { ar: 'تشنج عضلي حامي (Muscle guarding)', en: 'Muscle guarding' },
                    { ar: 'تورم موضعي خفيف دون حرارة', en: 'Mild local swelling' },
                    { ar: 'حساسية عند الجس (Tenderness to palpation)', en: 'Palpation tenderness' },
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        const textToAdd = isAr ? chip.ar : chip.en;
                        setObjective((prev) => ({
                          ...prev,
                          clinicalObservations: prev.clinicalObservations
                            ? `${prev.clinicalObservations} • ${textToAdd}`
                            : textToAdd,
                        }));
                      }}
                      className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-950 hover:bg-teal-950/60 hover:text-teal-300 border border-slate-800 text-slate-300 transition-colors cursor-pointer"
                    >
                      + {isAr ? chip.ar : chip.en}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={3}
                  value={objective.clinicalObservations || ''}
                  onChange={(e) =>
                    setObjective({ ...objective, clinicalObservations: e.target.value })
                  }
                  placeholder={
                    isAr
                      ? 'ملاحظات حول التورم، الحرارة الموضعية، التشنج الحامي، تفادي التحميل على الطرف...'
                      : 'Notes on localized swelling, temperature, muscle guarding, antalgic unloading...'
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-750 text-white placeholder-slate-500 focus:outline-hidden focus:border-teal-500"
                />
              </div>

              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-white block">
                    {isAr ? 'العلاجات والتدخلات المنفذة اليوم (Interventions):' : 'Interventions Performed Today:'}
                  </label>
                  <span className="text-[10px] text-slate-500 font-semibold">{isAr ? 'كبس سريع' : 'Quick phrases'}</span>
                </div>

                {/* Quick Phrase Chips */}
                <div className="flex flex-wrap gap-1.5 pb-1">
                  {[
                    { ar: 'علاج يدوي مفصلي (Joint Mobilization Gr II-III)', en: 'Joint Mobilization Gr II-III' },
                    { ar: 'إطلاق وتدليك اللفافة العضلية (Myofascial release)', en: 'Myofascial release' },
                    { ar: 'تمارين استطالة علاجية فاعلة', en: 'Active therapeutic stretching' },
                    { ar: 'تمارين تقوية متساوية القياس (Isometric strengthening)', en: 'Isometric strengthening' },
                    { ar: 'كمادات باردة 15 دقيقة (Cryotherapy)', en: 'Cryotherapy 15m' },
                    { ar: 'تنبيه كهربائي مسكن (TENS)', en: 'TENS modality' },
                  ].map((chip, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        const textToAdd = isAr ? chip.ar : chip.en;
                        setObjective((prev) => ({
                          ...prev,
                          dailyInterventionsSummary: prev.dailyInterventionsSummary
                            ? `${prev.dailyInterventionsSummary} • ${textToAdd}`
                            : textToAdd,
                        }));
                      }}
                      className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-950 hover:bg-teal-950/60 hover:text-teal-300 border border-slate-800 text-slate-300 transition-colors cursor-pointer"
                    >
                      + {isAr ? chip.ar : chip.en}
                    </button>
                  ))}
                </div>

                <textarea
                  rows={3}
                  value={objective.dailyInterventionsSummary || ''}
                  onChange={(e) =>
                    setObjective({ ...objective, dailyInterventionsSummary: e.target.value })
                  }
                  placeholder={
                    isAr
                      ? 'العلاج اليدوي المفصلي (Mobilization Grade II-III)، التمارين العلاجية، الكمادات، التنبيه...'
                      : 'Manual joint mobilization (Grade II-III), therapeutic exercise, neuromuscular re-ed...'
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-750 text-white placeholder-slate-500 focus:outline-hidden focus:border-teal-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Subjective Tab */}
        {activeTab === 'subjective' && (
          <div className="max-w-4xl mx-auto space-y-5">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div>
                <label className="text-xs font-bold text-white block mb-1">
                  {isAr ? 'الشكوى الرئيسية الحالية للمريض (Chief Complaint):' : 'Patient Chief Complaint:'}
                </label>
                <input
                  type="text"
                  value={chiefComplaint}
                  onChange={(e) => setChiefComplaint(e.target.value)}
                  placeholder={
                    isAr
                      ? 'مثال: ألم أسفل الظهر مع تنميل في الفخذ الأيسر يزداد عند الجلوس الطويل...'
                      : 'e.g., Lower back pain with left thigh paresthesia exacerbated by prolonged sitting...'
                  }
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-750 text-white focus:outline-hidden focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-white block mb-1">
                  {isAr ? 'تطور الأعراض منذ الجلسة السابقة (Symptom Changes):' : 'Symptom Changes Since Last Session:'}
                </label>
                <textarea
                  rows={4}
                  value={symptomChanges}
                  onChange={(e) => setSymptomChanges(e.target.value)}
                  placeholder={
                    isAr
                      ? 'ماذا ذكر المريض عن استجابته للجلسة الماضية؟ هل قلّ الألم؟ هل نام بشكل أفضل؟'
                      : 'Patient report on tolerance of prior session, change in baseline pain, sleep quality...'
                  }
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-750 text-white focus:outline-hidden focus:border-teal-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Assessment Tab */}
        {activeTab === 'assessment' && (
          <div className="max-w-4xl mx-auto space-y-5">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-white block mb-1.5">
                    {isAr ? 'مسار تطور الحالة السريرية (Progress Status):' : 'Clinical Progress Status:'}
                  </label>
                  <select
                    value={progressStatus}
                    onChange={(e) => setProgressStatus(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-750 text-white font-medium"
                  >
                    <option value="improved">{isAr ? 'تحسن ملحوظ (Improved)' : 'Improved'}</option>
                    <option value="unchanged">{isAr ? 'استقرار / دون تغيير (Unchanged)' : 'Unchanged'}</option>
                    <option value="plateau">{isAr ? 'ثبات في الأداء (Plateau)' : 'Plateau'}</option>
                    <option value="regressed">{isAr ? 'تراجع في الأعراض (Regressed)' : 'Regressed'}</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-white block mb-1.5">
                    {isAr ? 'تحمل المريض للجلسة (Tolerance):' : 'Patient Tolerance to Treatment:'}
                  </label>
                  <select
                    value={patientTolerance}
                    onChange={(e) => setPatientTolerance(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-750 text-white font-medium"
                  >
                    <option value="well_tolerated">{isAr ? 'تحمل ممتاز ودون مضاعفات (Well Tolerated)' : 'Well Tolerated'}</option>
                    <option value="moderate_fatigue">{isAr ? 'إجهاد عضلي متوسط (Moderate Fatigue)' : 'Moderate Fatigue'}</option>
                    <option value="poorly_tolerated">{isAr ? 'تحمل ضعيف / ألم حاد (Poorly Tolerated)' : 'Poorly Tolerated'}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-white block mb-1">
                  {isAr ? 'الانطباع السريري للمعالج (Clinical Impression):' : 'Clinician Clinical Impression:'}
                </label>
                <textarea
                  rows={4}
                  value={clinicalImpression}
                  onChange={(e) => setClinicalImpression(e.target.value)}
                  placeholder={
                    isAr
                      ? 'التحليل السريري لاستجابة المريض، تطور المدى الحركي والقوة، والتوافق مع أهداف التأهيل...'
                      : 'Clinical analysis of patient functional trajectory and response to rehabilitation protocol...'
                  }
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-750 text-white focus:outline-hidden focus:border-teal-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Plan Tab */}
        {activeTab === 'plan' && (
          <div className="max-w-4xl mx-auto space-y-5">
            <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <div>
                <label className="text-xs font-bold text-white block mb-1">
                  {isAr ? 'خطة الجلسة القادمة (Next Session Plan):' : 'Next Session Clinical Plan:'}
                </label>
                <textarea
                  rows={3}
                  value={planNextSession}
                  onChange={(e) => setPlanNextSession(e.target.value)}
                  placeholder={
                    isAr
                      ? 'التدرج في تمارين التقوية، زيادة المقاومة، الانتقال لتمارين التوازن الوظيفي...'
                      : 'Progress strengthening exercises, introduce dynamic balance, advance loading...'
                  }
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-750 text-white focus:outline-hidden focus:border-teal-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-white block mb-1">
                  {isAr ? 'التعليمات والتمارين المنزلية (Home Exercise Plan - HEP):' : 'Home Exercise Program (HEP) Instructions:'}
                </label>
                <textarea
                  rows={3}
                  value={homeInstructions}
                  onChange={(e) => setHomeInstructions(e.target.value)}
                  placeholder={
                    isAr
                      ? 'تعليمات الوضعيات المريحة، كمادات الثلج 15 دقيقة، تمارين الإطالة 3 مرات يومياً...'
                      : 'Ergonomic posture advice, cryotherapy 15 min post-activity, active stretching 3x daily...'
                  }
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-slate-950 border border-slate-750 text-white focus:outline-hidden focus:border-teal-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* In-App AI Custom Widget Studio Modal */}
      <CustomWidgetStudioModal
        isOpen={isCustomStudioOpen}
        onClose={() => setIsCustomStudioOpen(false)}
        onWidgetCreated={(newWidget) => {
          handleAddWidget(newWidget.id);
        }}
      />
    </div>
  );
};
