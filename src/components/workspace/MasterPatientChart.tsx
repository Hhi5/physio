// =======================================================================
// PhysioRecord — Master Patient Hub & Episode-Isolated Clinical Chart (Phases 4, 5, 6)
// Central Patient Profile Hub + Strictly Isolated Episode of Care Assessments,
// Longitudinal Comparison Matrix, HEP Prescription & Iraqi IQD Financial Summary
// =======================================================================

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useVault } from '../../context/VaultContext';
import { usePatients } from '../../context/PatientContext';
import {
  ClinicOperationsService,
  formatIQD,
} from '../../services/clinicOperationsService';
import { localDate, computePatientAge } from '../../utils/date';
import type {
  PatientRecord,
  EpisodeRecord,
  SessionRecord,
  PatientClinicalData,
  PatientDocumentAttachment,
} from '../../types/clinical';
import type { EpisodeScopedClinicalStore } from '../../types/clinicManagement';
import { ExamWidgetShelf } from './ExamWidgetShelf';
import { ActiveExamCanvas } from './ActiveExamCanvas';
import { CustomWidgetStudioModal } from './CustomWidgetStudioModal';
import { LongitudinalComparisonView } from './LongitudinalComparisonView';
import { ExerciseLibraryHepView } from '../clinic/ExerciseLibraryHepView';
import { OrganMedicationSchedule } from '../organui/OrganMedicationSchedule';
import { OrganClinicalCharts } from '../organui/OrganClinicalCharts';
import {
  Layers,
  FolderOpen,
  Plus,
  Save,
  CheckCircle2,
  FileText,
  Clock,
  ShieldAlert,
  ArrowRight,
  ArrowLeft,
  TrendingUp,
  Dumbbell,
  Wallet,
  Paperclip,
  Trash2,
  UserCheck,
  Phone,
} from 'lucide-react';

interface MasterPatientChartProps {
  patient: PatientRecord;
  episodes: EpisodeRecord[];
  sessions: SessionRecord[];
  selectedEpisodeId: string | null;
  onSelectEpisode: (epId: string) => void;
  onOpenSession: (sessionId: string) => void;
  onOpenNewSession: () => void;
  onOpenNewEpisode: () => void;
  onBackToDirectory: () => void;
  onPatientUpdated: () => void;
}

export const MasterPatientChart: React.FC<MasterPatientChartProps> = ({
  patient,
  episodes,
  sessions,
  selectedEpisodeId,
  onSelectEpisode,
  onOpenSession,
  onOpenNewSession,
  onOpenNewEpisode,
  onBackToDirectory,
  onPatientUpdated,
}) => {
  const { language, isRtl } = useLanguage();
  const isAr = language === 'ar';
  const { dek } = useVault();
  const { savePatient } = usePatients();

  const [activeTab, setActiveTab] = useState<
    'evaluation' | 'comparison' | 'hep' | 'sessions' | 'profile'
  >('evaluation');
  const [isCustomStudioOpen, setIsCustomStudioOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const activeEpisode =
    episodes.find((e) => e.id === selectedEpisodeId) || episodes[0] || null;
  const effectiveEpisodeId = activeEpisode ? activeEpisode.id : `default_ep_${patient.id}`;

  const episodeSessions = activeEpisode
    ? sessions.filter((s) => s.episodeId === activeEpisode.id)
    : sessions;

  // --- Central Patient Profile State (Patient-Level) ---
  const d = patient.data;
  const [referringPhysician, setReferringPhysician] = useState(d.referringPhysician || '');
  const [referringClinic, setReferringClinic] = useState(d.referringClinic || '');
  const [emergencyContactName, setEmergencyContactName] = useState(d.emergencyContactName || '');
  const [emergencyContactRelation, setEmergencyContactRelation] = useState(
    d.emergencyContactRelation || ''
  );
  const [emergencyContactPhone, setEmergencyContactPhone] = useState(
    d.emergencyContactPhone || ''
  );
  const [medicalHistory, setMedicalHistory] = useState(d.medicalHistory || '');
  const [previousSurgeries, setPreviousSurgeries] = useState(d.previousSurgeries || '');
  const [currentMedications, setCurrentMedications] = useState(d.currentMedications || '');
  const [allergies, setAllergies] = useState(d.allergies || '');
  const [precautions, setPrecautions] = useState(d.precautions || '');
  const [contraindications, setContraindications] = useState(d.contraindications || '');
  const [redFlags, setRedFlags] = useState(d.redFlags || '');
  const [generalNotes, setGeneralNotes] = useState(d.generalNotes || '');
  const [attachments, setAttachments] = useState<PatientDocumentAttachment[]>(
    d.attachments || []
  );
  const [newAttachmentTitle, setNewAttachmentTitle] = useState('');
  const [newAttachmentCategory, setNewAttachmentCategory] =
    useState<PatientDocumentAttachment['category']>('imaging_mri_xray');
  const [newAttachmentSummary, setNewAttachmentSummary] = useState('');

  // --- Strictly Episode-Isolated Clinical Assessment State ---
  const [episodeStore, setEpisodeStore] = useState<EpisodeScopedClinicalStore>(() =>
    ClinicOperationsService.getEpisodeClinicalStore(effectiveEpisodeId, patient.id)
  );

  // Sync Patient-Level Profile when patient changes
  useEffect(() => {
    setReferringPhysician(patient.data.referringPhysician || '');
    setReferringClinic(patient.data.referringClinic || '');
    setEmergencyContactName(patient.data.emergencyContactName || '');
    setEmergencyContactRelation(patient.data.emergencyContactRelation || '');
    setEmergencyContactPhone(patient.data.emergencyContactPhone || '');
    setMedicalHistory(patient.data.medicalHistory || '');
    setPreviousSurgeries(patient.data.previousSurgeries || '');
    setCurrentMedications(patient.data.currentMedications || '');
    setAllergies(patient.data.allergies || '');
    setPrecautions(patient.data.precautions || '');
    setContraindications(patient.data.contraindications || '');
    setRedFlags(patient.data.redFlags || '');
    setGeneralNotes(patient.data.generalNotes || '');
    setAttachments(patient.data.attachments || []);
  }, [patient.id]);

  // Sync Episode-Scoped Store whenever selectedEpisodeId or patient.id changes
  useEffect(() => {
    const loaded = ClinicOperationsService.getEpisodeClinicalStore(
      effectiveEpisodeId,
      patient.id
    );
    setEpisodeStore(loaded);
  }, [effectiveEpisodeId, patient.id]);

  const updateEpisodeField = <K extends keyof EpisodeScopedClinicalStore>(
    field: K,
    val: EpisodeScopedClinicalStore[K]
  ) => {
    setEpisodeStore((prev) => ({
      ...prev,
      [field]: val,
    }));
  };

  const handleSaveMasterAndEpisode = async () => {
    if (!dek) return;
    setIsSaving(true);
    try {
      const updatedClinicalData: PatientClinicalData = {
        ...patient.data,
        referringPhysician,
        referringClinic,
        emergencyContactName,
        emergencyContactRelation,
        emergencyContactPhone,
        medicalHistory,
        previousSurgeries,
        currentMedications,
        allergies,
        precautions,
        contraindications,
        redFlags,
        generalNotes,
        attachments,
        profileSummaryUpdatedAt: new Date().toISOString(),
      };
      await savePatient(updatedClinicalData, patient.id);

      // Save strictly isolated Episode store
      ClinicOperationsService.saveEpisodeClinicalStore(episodeStore);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      onPatientUpdated();
    } catch (err) {
      console.error('Failed to save patient & episode chart:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddAttachment = () => {
    if (!newAttachmentTitle.trim()) return;
    const item: PatientDocumentAttachment = {
      id: `doc_${Date.now()}`,
      title: newAttachmentTitle.trim(),
      category: newAttachmentCategory,
      dateAdded: localDate(),
      summaryNotes: newAttachmentSummary.trim(),
    };
    setAttachments((prev) => [item, ...prev]);
    setNewAttachmentTitle('');
    setNewAttachmentSummary('');
  };

  const handleAddWidget = (widgetId: string) => {
    if (!episodeStore.activeWidgetIds.includes(widgetId)) {
      updateEpisodeField('activeWidgetIds', [...episodeStore.activeWidgetIds, widgetId]);
    }
    setActiveTab('evaluation');
  };

  const handleRemoveWidget = (widgetId: string) => {
    updateEpisodeField(
      'activeWidgetIds',
      episodeStore.activeWidgetIds.filter((id) => id !== widgetId)
    );
  };

  // Iraqi Financial Summary for this Patient
  const financialSummary = ClinicOperationsService.getPatientFinancialSummaryIQD(
    patient.id,
    patient.data.fullName
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors">
      {/* Top Clinical Header Bar */}
      <div className="px-3 sm:px-6 py-3 sm:py-3.5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 sm:gap-4 shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <button
            type="button"
            onClick={onBackToDirectory}
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer shrink-0"
            title={isAr ? 'العودة لدليل المرضى' : 'Back to directory'}
          >
            {isRtl ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 flex items-center justify-center font-bold text-sm">
              {d.fullName ? d.fullName.charAt(0) : 'P'}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <h1 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                  {d.fullName}
                </h1>
                <span>·</span>
                <span className="tabular-nums">
                  {d.gender === 'male' ? (isAr ? 'ذكر' : 'Male') : isAr ? 'أنثى' : 'Female'}{' '}
                  {computePatientAge(d.dateOfBirth, d.age) !== undefined
                    ? `· ${computePatientAge(d.dateOfBirth, d.age)} ${isAr ? 'سنة' : 'yrs'} `
                    : ''}
                  {d.dateOfBirth ? `(${d.dateOfBirth})` : ''}
                </span>
                {financialSummary.totalDebtIQD > 0 && (
                  <>
                    <span>·</span>
                    <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                      {isAr ? 'ذمة متبقية: ' : 'Balance Due: '}
                      {formatIQD(financialSummary.totalDebtIQD, isAr)}
                    </span>
                  </>
                )}
              </div>

              {/* Strict Episode Isolation Switcher Strip */}
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="text-[11px] font-bold text-teal-700 dark:text-teal-400">
                  {isAr ? 'حلقة الرعاية المعزولة (Active Episode):' : 'Active Episode:'}
                </span>
                {episodes.length > 0 ? (
                  <select
                    value={activeEpisode?.id || ''}
                    onChange={(e) => onSelectEpisode(e.target.value)}
                    className="px-2.5 py-0.5 rounded-lg text-xs font-bold bg-teal-50 dark:bg-slate-800 border border-teal-200 dark:border-teal-800 text-teal-900 dark:text-teal-200"
                  >
                    {episodes.map((ep) => (
                      <option key={ep.id} value={ep.id}>
                        {ep.data.title || ep.data.medicalDiagnosis} ({ep.data.startDate || ep.startDate})
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-semibold">
                    {isAr ? 'لا توجد حلقة رعاية مسجلة بعد' : 'No Episode Created Yet'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={onOpenNewEpisode}
                  className="text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
                >
                  {isAr ? '+ حلقة رعاية لإصابة جديدة' : '+ New Episode'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Action Controls: New Session & Save Chart */}
        <div className="flex items-center gap-2.5">
          {activeEpisode && (
            <button
              type="button"
              onClick={onOpenNewSession}
              className="px-3.5 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-teal-700 dark:text-teal-300 font-bold text-xs border border-teal-200 dark:border-teal-800/60 flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>{isAr ? '+ جلسة علاجية جديدة' : '+ New Session'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleSaveMasterAndEpisode}
            disabled={isSaving}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
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
                  ? 'جاري الحفظ...'
                  : 'Saving...'
                : saveSuccess
                ? isAr
                  ? 'تم الحفظ بنجاح!'
                  : 'Saved!'
                : isAr
                ? 'حفظ التقييم والسجل'
                : 'Save Episode & Profile'}
            </span>
          </button>
        </div>
      </div>

      {/* Tabs Navigation (5 Comprehensive Clinical & Operational Sections) */}
      <div className="px-3 sm:px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center gap-1 shrink-0 overflow-x-auto scrollbar-none">
        {(
          [
            {
              id: 'evaluation',
              labelAr: 'التقييم السريري الشامل (Initial Eval & Widgets)',
              labelEn: 'Episode Assessment & Widgets',
              icon: Layers,
              count: episodeStore.activeWidgetIds.length,
            },
            {
              id: 'comparison',
              labelAr: 'المقارنة الطولية والتقدم (Longitudinal Matrix)',
              labelEn: 'Longitudinal Comparison & Charts',
              icon: TrendingUp,
              count: episodeStore.snapshots.length,
            },
            {
              id: 'hep',
              labelAr: 'الخطة والأهداف والبرنامج المنزلي (HEP & Goals)',
              labelEn: 'Goals, Plan of Care & HEP',
              icon: Dumbbell,
              count: episodeStore.hepProgram.length,
            },
            {
              id: 'sessions',
              labelAr: 'سجل الجلسات العلاجية (Treatment Sessions)',
              labelEn: 'Treatment Sessions',
              icon: Clock,
              count: episodeSessions.length,
            },
            {
              id: 'profile',
              labelAr: 'ملف المريض العام والمرفقات والحسابات (IQD)',
              labelEn: 'Patient Hub, Meds & IQD Ledger',
              icon: FileText,
            },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3.5 py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                isSelected
                  ? 'text-teal-700 dark:text-teal-400 border-teal-600 dark:border-teal-500 bg-teal-50/30 dark:bg-slate-850/60'
                  : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{isAr ? tab.labelAr : tab.labelEn}</span>
              {'count' in tab && tab.count !== undefined && (
                <span className="text-[11px] font-mono tabular-nums text-teal-600 dark:text-teal-400">
                  ({tab.count})
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Tab Content Canvas */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-5 sm:space-y-6">
        {/* TAB 1: EPISODE-SCOPED INITIAL EVALUATION & INTERACTIVE WIDGETS */}
        {activeTab === 'evaluation' && (
          <div className="space-y-6 max-w-7xl mx-auto">
            {/* Structured Initial Evaluation Subjective & Objective Intake Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {isAr
                      ? 'التقييم السريري المهيكل لحلقة الرعاية (Subjective & Objective Clinical Intake)'
                      : 'Episode-Scoped Subjective & Objective Clinical Evaluation'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {isAr
                      ? 'هذه البيانات معزولة ومرتبطة بحلقة الرعاية الحالية فقط، وتستخدم كخط أساس للمقارنة المرحلية.'
                      : 'Strictly isolated to the active Episode of Care for longitudinal baseline tracking.'}
                  </p>
                </div>

                {/* Pain NPRS Quick Sliders (Rest / Activity / Worst 24h) */}
                <div className="flex flex-wrap items-center gap-4 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-mono tabular-nums">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500">{isAr ? 'ألم الراحة:' : 'Rest:'}</span>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={episodeStore.painAtRestNrs}
                      onChange={(e) =>
                        updateEpisodeField('painAtRestNrs', Number(e.target.value))
                      }
                      className="w-12 px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-center"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500">{isAr ? 'مع الحركة:' : 'Activity:'}</span>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={episodeStore.painOnActivityNrs}
                      onChange={(e) =>
                        updateEpisodeField('painOnActivityNrs', Number(e.target.value))
                      }
                      className="w-12 px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-center text-rose-600 dark:text-rose-400"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-500">{isAr ? 'أقصى 24س:' : 'Worst 24h:'}</span>
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={episodeStore.painWorst24hNrs}
                      onChange={(e) =>
                        updateEpisodeField('painWorst24hNrs', Number(e.target.value))
                      }
                      className="w-12 px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 font-bold text-center"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {isAr ? 'الشكوى الرئيسية للمريض (Chief Complaint):' : 'Chief Complaint:'}
                  </label>
                  <input
                    type="text"
                    value={episodeStore.chiefComplaint}
                    onChange={(e) => updateEpisodeField('chiefComplaint', e.target.value)}
                    placeholder={
                      isAr
                        ? 'مثال: ألم حاد أسفل الظهر يمتد للساق اليمنى...'
                        : 'e.g., Sharp low back pain radiating to right leg...'
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {isAr ? 'آلية الإصابة وتاريخ الحالة (HPI & MOI):' : 'Mechanism of Injury & HPI:'}
                  </label>
                  <input
                    type="text"
                    value={episodeStore.historyOfPresentIllness}
                    onChange={(e) =>
                      updateEpisodeField('historyOfPresentIllness', e.target.value)
                    }
                    placeholder={
                      isAr
                        ? 'مثال: بدأ بعد رفع جسم ثقيل قبل 3 أسابيع...'
                        : 'e.g., Onset 3 weeks ago after heavy lifting...'
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {isAr ? 'طبيعة الألم وانتشاره (Pain Characteristics):' : 'Pain Quality & Pattern:'}
                  </label>
                  <input
                    type="text"
                    value={episodeStore.painNature}
                    onChange={(e) => updateEpisodeField('painNature', e.target.value)}
                    placeholder={
                      isAr
                        ? 'حارق / جذري / يزداد صباحاً...'
                        : 'Shooting, aching, worse in morning...'
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {isAr ? 'العوامل المهيجة للألم (Aggravating Factors):' : 'Aggravating Factors:'}
                  </label>
                  <input
                    type="text"
                    value={episodeStore.aggravatingFactors}
                    onChange={(e) => updateEpisodeField('aggravatingFactors', e.target.value)}
                    placeholder={
                      isAr
                        ? 'مثال: الجلوس > 20 دقيقة، الانحناء للأمام، صعود الدرج...'
                        : 'e.g., Sitting > 20m, forward flexion, stairs...'
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {isAr ? 'العوامل المخففة للألم (Relieving Factors):' : 'Relieving Factors:'}
                  </label>
                  <input
                    type="text"
                    value={episodeStore.relievingFactors}
                    onChange={(e) => updateEpisodeField('relievingFactors', e.target.value)}
                    placeholder={
                      isAr
                        ? 'مثال: الاستلقاء على الظهر، المشي الخفيف، الكمادات الدافئة...'
                        : 'e.g., Supine lying, gentle walking, heat...'
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {isAr ? 'الجس والملاحظة السريرية (Palpation & Observation):' : 'Observation & Palpation:'}
                  </label>
                  <input
                    type="text"
                    value={episodeStore.palpationFindings}
                    onChange={(e) => updateEpisodeField('palpationFindings', e.target.value)}
                    placeholder={
                      isAr
                        ? 'مثال: إيلام موضعي على L4-L5، تشنج العضلات جانب الفقار...'
                        : 'e.g., Tenderness over L4 spinous process, paraspinal spasm...'
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Collapsible Examination Shelf */}
            <ExamWidgetShelf
              onAddWidget={handleAddWidget}
              onOpenCustomStudio={() => setIsCustomStudioOpen(true)}
              activeWidgetIds={episodeStore.activeWidgetIds}
            />

            {/* Active Examination Canvas Scoped to this Episode */}
            <ActiveExamCanvas
              activeWidgetIds={episodeStore.activeWidgetIds}
              onRemoveWidget={handleRemoveWidget}
              onAddWidget={handleAddWidget}
              bodyChart={episodeStore.bodyChart}
              onBodyChartChange={(val) => updateEpisodeField('bodyChart', val)}
              objective={episodeStore.objective}
              onObjectiveChange={(val) => updateEpisodeField('objective', val)}
              specialTests={episodeStore.specialTests}
              onSpecialTestsChange={(val) => updateEpisodeField('specialTests', val)}
              gaitPosture={episodeStore.gaitPosture}
              onGaitPostureChange={(val) => updateEpisodeField('gaitPosture', val)}
              functionalScales={episodeStore.functionalScales}
              onFunctionalScalesChange={(val) => updateEpisodeField('functionalScales', val)}
              customWidgetsData={episodeStore.customWidgetsData}
              onCustomWidgetsDataChange={(val) => updateEpisodeField('customWidgetsData', val)}
            />
          </div>
        )}

        {/* TAB 2: LONGITUDINAL COMPARISON MATRIX & ORGANUI PROGRESS CHARTS */}
        {activeTab === 'comparison' && (
          <div className="max-w-7xl mx-auto space-y-6">
            <LongitudinalComparisonView
              episodeStore={episodeStore}
              episodeTitle={
                activeEpisode?.data.title ||
                activeEpisode?.data.medicalDiagnosis ||
                (isAr ? 'حلقة الرعاية النشطة' : 'Active Episode')
              }
              onSnapshotAdded={(updatedStore) => setEpisodeStore(updatedStore)}
            />

            <OrganClinicalCharts
              sessions={episodeSessions}
              masterObjective={episodeStore.objective}
            />
          </div>
        )}

        {/* TAB 3: GOALS, PLAN OF CARE, HEP BUILDER & DISCHARGE SUMMARY */}
        {activeTab === 'hep' && (
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Clinical Impression, Plan of Care & Goals Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    {isAr
                      ? 'الانطباع السريري، خطة الرعاية (Plan of Care)، والأهداف التأهيلية'
                      : 'Clinical Impression, Plan of Care & Rehabilitation Goals'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {activeEpisode
                      ? `${activeEpisode.data.title || activeEpisode.data.medicalDiagnosis}`
                      : ''}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {isAr ? 'معدل تكرار الجلسات (Frequency):' : 'Treatment Frequency:'}
                  </label>
                  <input
                    type="text"
                    value={episodeStore.treatmentFrequency}
                    onChange={(e) => updateEpisodeField('treatmentFrequency', e.target.value)}
                    placeholder={isAr ? '3 جلسات أسبوعياً' : '3 sessions / week'}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {isAr ? 'المدة المتوقعة للخطة (بالأسابيع):' : 'Planned Duration (Weeks):'}
                  </label>
                  <input
                    type="number"
                    value={episodeStore.plannedDurationWeeks}
                    onChange={(e) =>
                      updateEpisodeField('plannedDurationWeeks', Number(e.target.value))
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {isAr ? 'أهداف المريض الوظيفية والشخصية:' : 'Patient Functional Goals:'}
                  </label>
                  <input
                    type="text"
                    value={episodeStore.patientPersonalGoals}
                    onChange={(e) =>
                      updateEpisodeField('patientPersonalGoals', e.target.value)
                    }
                    placeholder={
                      isAr
                        ? 'مثال: العودة لممارسة كرة القدم، الصلاة بدون ألم...'
                        : 'e.g., Return to sport, pain-free daily activities...'
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                  {isAr
                    ? 'الانطباع السريري والتشخيص الوظيفي وملخص التخريج (Clinical Impression / Discharge Summary):'
                    : 'Clinical Impression & Discharge Summary:'}
                </label>
                <textarea
                  rows={2}
                  value={episodeStore.clinicalImpression}
                  onChange={(e) => updateEpisodeField('clinicalImpression', e.target.value)}
                  placeholder={
                    isAr
                      ? 'تفسير الفحص السريري، المشكلات الوظيفية المحددة، ومعايير التخريج...'
                      : 'Clinical synthesis, functional deficits, and discharge criteria...'
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Embedded Searchable Exercise Library & HEP Builder for this Episode */}
            <ExerciseLibraryHepView
              embeddedHepProgram={episodeStore.hepProgram}
              onUpdateEmbeddedHep={(updatedHep) =>
                updateEpisodeField('hepProgram', updatedHep)
              }
              patientName={patient.data.fullName}
              episodeTitle={
                activeEpisode?.data.title || activeEpisode?.data.medicalDiagnosis
              }
            />
          </div>
        )}

        {/* TAB 4: TREATMENT SESSIONS LOG */}
        {activeTab === 'sessions' && (
          <div className="max-w-5xl mx-auto space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {isAr
                    ? 'سجل الجلسات العلاجية لحلقة الرعاية الحالية:'
                    : 'Episode Treatment Sessions:'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isAr
                    ? 'افتح أي جلسة لتوثيق جدول التمارين اليومي (Exercise Flowsheet)، العلاج اليدوي، والأجهزة.'
                    : 'Click any session to open its structured Exercise & Modality Flowsheet.'}
                </p>
              </div>

              {activeEpisode && (
                <button
                  type="button"
                  onClick={onOpenNewSession}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isAr ? '+ بدء جلسة علاجية جديدة' : '+ New Treatment Session'}</span>
                </button>
              )}
            </div>

            {episodeSessions.length === 0 ? (
              <div className="p-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-3">
                <Clock className="w-8 h-8 text-slate-400 mx-auto" />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isAr
                    ? 'لا توجد جلسات مسجلة في حلقة الرعاية هذه بعد.'
                    : 'No treatment sessions recorded in this episode yet.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {episodeSessions.map((session) => (
                  <div
                    key={session.id}
                    onClick={() => onOpenSession(session.id)}
                    className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-teal-500 transition-all cursor-pointer space-y-2"
                  >
                    <div className="flex items-center justify-between tabular-nums">
                      <span className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-2">
                        <span className="text-teal-600 dark:text-teal-400 font-mono">
                          #{session.data.sessionNumber}
                        </span>
                        <span>{session.data.sessionDate}</span>
                      </span>
                      <span className="text-[11px] font-bold text-slate-500">
                        {session.data.status === 'finalized'
                          ? isAr
                            ? 'معتمدة ومغلقة'
                            : 'Finalized'
                          : isAr
                          ? 'مسودة'
                          : 'Draft'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 tabular-nums">
                      {session.data.sessionType} · {session.data.sessionDurationMinutes || 45}m
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 5: CENTRAL PATIENT PROFILE HUB, ATTACHMENTS & IRAQI FINANCIAL SUMMARY */}
        {activeTab === 'profile' && (
          <div className="max-w-5xl mx-auto space-y-5">
            {/* Patient Iraqi Financial Summary Strip (IQD) */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  <Wallet className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                  <span>
                    {isAr
                      ? 'الملخص المالي للمريض بالدينار العراقي (Patient Financial Summary - IQD)'
                      : 'Patient Financial Summary (IQD)'}
                  </span>
                </div>
                <span className="text-xs font-mono text-slate-500 tabular-nums">
                  {financialSummary.invoices.length} {isAr ? 'فواتير' : 'invoices'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1 font-mono tabular-nums">
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 block font-sans">
                    {isAr ? 'إجمالي المبالغ المفوترة' : 'Total Billed'}
                  </span>
                  <span className="text-base font-extrabold text-slate-900 dark:text-white">
                    {formatIQD(financialSummary.totalBilledIQD, isAr)}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 block font-sans">
                    {isAr ? 'إجمالي المدفوع نقداً / إلكترونياً' : 'Total Paid'}
                  </span>
                  <span className="text-base font-extrabold text-emerald-600 dark:text-emerald-400">
                    {formatIQD(financialSummary.totalPaidIQD, isAr)}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 block font-sans">
                    {isAr ? 'الرصيد المتبقي بذمة المريض (دين)' : 'Balance Due (Debt)'}
                  </span>
                  <span
                    className={`text-base font-extrabold ${
                      financialSummary.totalDebtIQD > 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {formatIQD(financialSummary.totalDebtIQD, isAr)}
                  </span>
                </div>
              </div>
            </div>

            {/* Referral Physician & Emergency Contact Card */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider">
                <UserCheck className="w-4 h-4" />
                <span>
                  {isAr
                    ? 'الطبيب المحيل وجهات الاتصال للطوارئ (Referral & Emergency Contact)'
                    : 'Referring Physician & Emergency Contact'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {isAr ? 'الطبيب الاستشاري المحيل:' : 'Referring Physician:'}
                  </label>
                  <input
                    type="text"
                    value={referringPhysician}
                    onChange={(e) => setReferringPhysician(e.target.value)}
                    placeholder={isAr ? 'مثال: د. حيدر العبيدي (جراحة عظام)' : 'e.g., Dr. Haider Al-Obaidi'}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {isAr ? 'المستشفى / المركز المحيل:' : 'Referring Hospital / Clinic:'}
                  </label>
                  <input
                    type="text"
                    value={referringClinic}
                    onChange={(e) => setReferringClinic(e.target.value)}
                    placeholder={isAr ? 'مستشفى الكفيل / عيادة الحارثية...' : 'Hospital / Medical Center...'}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {isAr ? 'اسم قريب الطوارئ وصلة القرابة:' : 'Emergency Contact & Relation:'}
                  </label>
                  <input
                    type="text"
                    value={emergencyContactName}
                    onChange={(e) => setEmergencyContactName(e.target.value)}
                    placeholder={isAr ? 'مثال: محمد عبد الله (الأخ)' : 'Name & Relationship'}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                    {isAr ? 'هاتف الطوارئ:' : 'Emergency Phone:'}
                  </label>
                  <input
                    type="text"
                    value={emergencyContactPhone}
                    onChange={(e) => setEmergencyContactPhone(e.target.value)}
                    placeholder="+964 770 000 0000"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-rose-700 dark:text-rose-400 block mb-1">
                    {isAr
                      ? 'موانع الاستعمال والمحاذير الطبية (Contraindications & Precautions):'
                      : 'Contraindications & Precautions:'}
                  </label>
                  <input
                    type="text"
                    value={contraindications}
                    onChange={(e) => setContraindications(e.target.value)}
                    placeholder={
                      isAr
                        ? 'مثال: منظم ضربات قلب (يمنع TENS/Diathermy)، تثبيت فقرات، هشاشة عظام...'
                        : 'e.g., Pacemaker, recent DVT, weight-bearing restriction...'
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Red Flags Alert Box */}
            <div className="p-5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-3">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs uppercase tracking-wider">
                <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>
                  {isAr
                    ? 'العلامات الحمراء السريرية (Clinical Red Flags):'
                    : 'Clinical Safety Alerts (Red Flags):'}
                </span>
              </div>
              <textarea
                rows={2}
                value={redFlags}
                onChange={(e) => setRedFlags(e.target.value)}
                placeholder={
                  isAr
                    ? 'فقدان وزن غير مبرر، ألم ليلي مستمر، أعراض ذيل الفرس (Cauda Equina)...'
                    : 'Unexplained weight loss, night pain, saddle anesthesia...'
                }
                className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-white dark:bg-slate-950 border border-amber-300 dark:border-amber-900/50 text-amber-950 dark:text-amber-200 font-medium"
              />
            </div>

            {/* OrganUI Medication Schedule */}
            <OrganMedicationSchedule
              patientId={patient.id}
              currentMedicationsText={currentMedications}
              onUpdateMedicationsText={(summary) => setCurrentMedications(summary)}
            />

            {/* Medical History & Surgeries */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <h3 className="text-xs font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider">
                {isAr ? 'التاريخ المرضي والعمليات الجراحية والحساسية:' : 'Medical History, Surgeries & Allergies:'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-800 dark:text-white block mb-1">
                    {isAr ? 'الأمراض المزمنة والتاريخ المرضي:' : 'Medical History:'}
                  </label>
                  <textarea
                    rows={3}
                    value={medicalHistory}
                    onChange={(e) => setMedicalHistory(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-800 dark:text-white block mb-1">
                    {isAr ? 'العمليات الجراحية السابقة:' : 'Previous Surgeries:'}
                  </label>
                  <textarea
                    rows={3}
                    value={previousSurgeries}
                    onChange={(e) => setPreviousSurgeries(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Clinical Attachments & Imaging Reports (MRI / X-Ray / Referrals) */}
            <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center gap-2 text-xs font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider">
                <Paperclip className="w-4 h-4" />
                <span>
                  {isAr
                    ? 'المستندات وتقارير الأشعة والرنين والإحالات (Attachments & Imaging Reports)'
                    : 'Clinical Documents, MRI/X-Ray Reports & Referrals'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  value={newAttachmentTitle}
                  onChange={(e) => setNewAttachmentTitle(e.target.value)}
                  placeholder={isAr ? 'عنوان التقرير (مثال: رنين قطني MRI L4-L5)...' : 'Document Title...'}
                  className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
                <select
                  value={newAttachmentCategory}
                  onChange={(e) =>
                    setNewAttachmentCategory(
                      e.target.value as PatientDocumentAttachment['category']
                    )
                  }
                  className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="imaging_mri_xray">{isAr ? 'تقرير رنين / أشعة (MRI/X-Ray)' : 'Imaging (MRI/X-Ray)'}</option>
                  <option value="referral">{isAr ? 'ورقة إحالة طبية (Referral)' : 'Physician Referral'}</option>
                  <option value="lab_report">{isAr ? 'تحاليل مختبرية / تخطيط عصب EMG' : 'Lab / EMG Report'}</option>
                  <option value="consent">{isAr ? 'موافقة علاجية' : 'Consent Form'}</option>
                </select>
                <input
                  type="text"
                  value={newAttachmentSummary}
                  onChange={(e) => setNewAttachmentSummary(e.target.value)}
                  placeholder={isAr ? 'ملخص النتيجة...' : 'Summary findings...'}
                  className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleAddAttachment}
                  className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold cursor-pointer"
                >
                  {isAr ? '+ إرفاق التقرير' : '+ Add Document'}
                </button>
              </div>

              {attachments.length > 0 && (
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {attachments.map((att) => (
                    <div key={att.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {att.title}
                        </span>
                        <span className="text-slate-400 mx-2">·</span>
                        <span className="text-slate-600 dark:text-slate-400">
                          {att.summaryNotes}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-slate-400">{att.dateAdded}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setAttachments(attachments.filter((a) => a.id !== att.id))
                          }
                          className="text-slate-400 hover:text-rose-600 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Custom Widget Studio Modal */}
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
