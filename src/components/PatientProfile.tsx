// =======================================================================
// PhysioRecord — Patient Clinical Profile View (v1.1)
// =======================================================================

import React, { useState, useEffect } from 'react';
import type { PatientRecord, EpisodeRecord, PatientDependentRecordsSummary } from '../types/clinical';
import { db } from '../db/db';
import { usePatients } from '../context/PatientContext';
import { useEpisodes } from '../context/EpisodeContext';
import { useLanguage } from '../context/LanguageContext';
import { ArrowLeft } from 'lucide-react';
import { EpisodeModal } from './EpisodeModal';
import { EpisodeDischargeModal } from './EpisodeDischargeModal';
import { EpisodeSessionsView } from './EpisodeSessionsView';
import { CLINICAL_SPECIALTIES, EPISODE_STATUSES } from '../data/terminology';
import { 
  ArrowRight, 
  Edit3, 
  Archive, 
  RotateCcw,
  Trash2, 
  AlertTriangle, 
  ShieldAlert,
  Phone, 
  MapPin, 
  Briefcase, 
  Calendar, 
  Layers, 
  FileText, 
  Activity, 
  Pill, 
  Scissors,
  ShieldCheck,
  Plus,
  PlayCircle,
  PauseCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Sparkles,
  Target,
  FolderOpen
} from 'lucide-react';

interface PatientProfileProps {
  patient: PatientRecord;
  onBack: () => void;
  onEdit: (patient: PatientRecord) => void;
}

export const PatientProfile: React.FC<PatientProfileProps> = ({
  patient,
  onBack,
  onEdit,
}) => {
  const { archivePatient, unarchivePatient, deletePatientPermanently } = usePatients();
  const { bi, isRtl, language } = useLanguage();
  const isEn = language === 'en';
  const {
    episodes,
    loadingEpisodes,
    loadEpisodesForPatient,
    createEpisode,
    updateEpisode,
    setEpisodeStatus,
    closeEpisode,
    archiveEpisode,
    unarchiveEpisode,
  } = useEpisodes();

  const [showPermanentDeleteModal, setShowPermanentDeleteModal] = useState(false);
  const [confirmNameInput, setConfirmNameInput] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [dependentAudit, setDependentAudit] = useState<PatientDependentRecordsSummary | null>(null);

  useEffect(() => {
    if (showPermanentDeleteModal && patient.id) {
      db.auditPatientDependentRecords(patient.id).then(setDependentAudit).catch(console.error);
    }
  }, [showPermanentDeleteModal, patient.id]);

  // Episodes UI State
  const [isEpisodeModalOpen, setIsEpisodeModalOpen] = useState(false);
  const [episodeToEdit, setEpisodeToEdit] = useState<EpisodeRecord | null>(null);
  const [episodeToDischarge, setEpisodeToDischarge] = useState<EpisodeRecord | null>(null);
  const [episodeTabFilter, setEpisodeTabFilter] = useState<'all' | 'active' | 'completed' | 'on_hold' | 'archived'>('active');
  const [expandedEpisodeId, setExpandedEpisodeId] = useState<string | null>(null);

  useEffect(() => {
    if (patient.id) {
      loadEpisodesForPatient(patient.id);
    }
  }, [patient.id, loadEpisodesForPatient]);

  const p = patient.data;
  const isArchived = Boolean(patient.isArchived);
  const hasRedFlags = Boolean(p.redFlags && p.redFlags.trim().length > 0);
  const targetConfirmName = p.fullNameAr || p.fullName;

  const handleSaveEpisode = async (record: EpisodeRecord) => {
    if (episodeToEdit) {
      await updateEpisode(episodeToEdit.id, record.data);
    } else {
      await createEpisode(patient.id, record.data);
    }
    setIsEpisodeModalOpen(false);
    setEpisodeToEdit(null);
  };

  const handleConfirmDischarge = async (dischargeInfo: {
    endDate: string;
    dischargeSummary: string;
    dischargeCriteriaSummary?: string;
  }) => {
    if (episodeToDischarge) {
      await closeEpisode(episodeToDischarge.id, dischargeInfo);
      setEpisodeToDischarge(null);
    }
  };

  const activeEpisodes = episodes.filter(e => e.status === 'active');
  const onHoldEpisodes = episodes.filter(e => e.status === 'on_hold');
  const completedEpisodes = episodes.filter(e => e.status === 'completed');
  const archivedEpisodes = episodes.filter(e => e.status === 'archived');

  const filteredEpisodes = episodes.filter(e => {
    if (episodeTabFilter === 'all') return true;
    return e.status === episodeTabFilter;
  });

  const handleArchiveToggle = async () => {
    if (isArchived) {
      await unarchivePatient(patient.id);
    } else {
      await archivePatient(patient.id);
      onBack();
    }
  };

  const handlePermanentDelete = async () => {
    if (confirmNameInput.trim() !== targetConfirmName.trim()) {
      return;
    }
    setDeleting(true);
    try {
      await deletePatientPermanently(patient.id);
      onBack();
    } catch (err) {
      console.error('Failed to permanently delete patient:', err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8" dir={isRtl ? 'rtl' : 'ltr'}>
      
      {/* Top Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 transition-colors shadow-sm"
        >
          {isRtl ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
          <span>{bi('العودة لدليل المرضى', 'Back to Patients')}</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Edit Profile */}
          <button
            type="button"
            onClick={() => onEdit(patient)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 transition-all shadow-sm"
          >
            <Edit3 className="w-4 h-4 text-primary-600" />
            <span>{bi('تعديل الملف السريري', 'Edit Profile')}</span>
          </button>

          {/* Soft-Archive Toggle Button (Default safe action) */}
          <button
            type="button"
            onClick={handleArchiveToggle}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-medium border transition-all ${
              isArchived
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                : 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100'
            }`}
          >
            {isArchived ? (
              <>
                <RotateCcw className="w-4 h-4" />
                <span>{bi('استعادة من الأرشيف', 'Restore from Archive')}</span>
              </>
            ) : (
              <>
                <Archive className="w-4 h-4" />
                <span>{bi('أرشفة المريض', 'Archive Patient')}</span>
              </>
            )}
          </button>

          {/* Permanent Deletion Button (Only available if archived) */}
          {isArchived && (
            <button
              type="button"
              onClick={() => setShowPermanentDeleteModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium text-rose-600 hover:bg-rose-50 border border-rose-200 transition-all"
            >
              <Trash2 className="w-4 h-4" />
              <span>{bi('إتلاف مادي نهائي', 'Permanent Delete')}</span>
            </button>
          )}
        </div>
      </div>

      {/* Archive Status Notice */}
      {isArchived && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-center justify-between text-amber-900 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <Archive className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <span>
              {bi('ملف مؤرشف: هذا المريض في سجل الأرشيف. كافة بياناته وجلساته السابقة محفوظة ومحمية، لكنه لا يظهر في قائمة المرضى النشطين.', 'Archived File: This patient is in the archive. All historical records are securely preserved.')}
            </span>
          </div>
        </div>
      )}

      {/* Permanent Deletion Safeguard Modal with Patient Hard Deletion Safety Gate */}
      {showPermanentDeleteModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-2xl border border-rose-200">
            <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-1">
              {bi('مراجعة وصمام أمان الحذف المادي النهائي للسجل', 'Permanent Deletion Safety Gate Review')}
            </h3>
            <p className="text-xs text-rose-700 leading-relaxed mb-4">
              هذا الإجراء مخصص للإتلاف المادي الكامل. وفقاً لسياسة الاحتفاظ السريري، لا يُسمح بإتلاف السجلات إلا بعد إثبات وجود نسخة احتياطية خارجية ناجحة ومتحقق منها.
            </p>

            {/* Audit of Dependent Records */}
            <div className="mb-4 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 space-y-2">
              <div className="font-bold text-slate-800 mb-1">السجلات السريرية التابعة المرتبطة بهذا المريض:</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-500">حلقات الرعاية: </span>
                  <span className="font-bold text-slate-900">{dependentAudit?.episodesCount ?? '...'}</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-500">الجلسات العلاجية: </span>
                  <span className="font-bold text-slate-900">{dependentAudit?.sessionsCount ?? '...'}</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-500">ملاحظات SOAP: </span>
                  <span className="font-bold text-slate-900">{dependentAudit?.soapNotesCount ?? '...'}</span>
                </div>
                <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                  <span className="text-slate-500">الملاحق السريرية: </span>
                  <span className="font-bold text-slate-900">{dependentAudit?.clinicalAddendaCount ?? '...'}</span>
                </div>
              </div>
            </div>

            {/* Safety Gate Alert Notice */}
            <div className="mb-4 p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-xs text-amber-950 space-y-1">
              <div className="font-bold flex items-center gap-1.5 text-amber-900">
                <ShieldAlert className="w-4 h-4 text-amber-700 flex-shrink-0" />
                <span>{bi('صمام أمان الحذف النهائي نشط', 'Permanent Deletion Safety Gate Active')}</span>
              </div>
              <p className="leading-relaxed">
                وفقاً لسياسة الأمان السريري، لا يُسمح بالحذف النهائي إلا بوجود إثبات تحقق من نسخة احتياطية خارجية ناجحة.
                تم تعطيل الحذف النهائي مؤقتاً لعدم توفر إثبات النسخة الخارجية في هذه الجلسة. أرشفة ملف المريض هي الإجراء السريري المعتمد لحفظ السجل وتجميده.
              </p>
            </div>

            <p className="text-xs text-slate-600 mb-2">
              اسم المريض المراد حمايته: <strong className="font-bold select-all text-slate-900">{targetConfirmName}</strong>
            </p>
            <input
              type="text"
              value={confirmNameInput}
              onChange={(e) => setConfirmNameInput(e.target.value)}
              placeholder="اكتب اسم المريض هنا..."
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-xl mb-4 focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handlePermanentDelete}
                disabled={true}
                className="flex-1 py-2.5 bg-slate-300 text-slate-500 rounded-xl text-xs font-bold cursor-not-allowed transition-all"
                title="الحذف النهائي معطل عبر صمام الأمان (Safety Gate Active) لحماية السجلات السريرية"
              >
                {deleting ? bi('جاري التحقق...', 'Verifying...') : bi('الحذف النهائي معطل عبر صمام الأمان', 'Permanent Deletion Disabled (Safety Gate)')}
              </button>
              <button
                type="button"
                onClick={() => { setShowPermanentDeleteModal(false); setConfirmNameInput(''); }}
                className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-200"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile Header Banner */}
      <div className="bg-white rounded-xl p-6 sm:p-8 border border-slate-200 shadow-sm mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          
          <div>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">
                {p.fullNameAr || p.fullName}
              </h1>
              {p.fullNameAr && p.fullName !== p.fullNameAr && (
                <span className="text-sm text-slate-400 font-mono" dir="ltr">
                  ({p.fullName})
                </span>
              )}
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                p.gender === 'male' ? 'bg-sky-50 text-sky-700 border border-sky-200' : 'bg-pink-50 text-pink-700 border border-pink-200'
              }`}>
                {p.gender === 'male' ? bi('ذكر', 'Male') : bi('أنثى', 'Female')}
              </span>
            </div>

            {/* Quick Metadata Pill Badges */}
            <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs sm:text-sm text-slate-500 mt-3">
              {p.age !== undefined && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>{bi('العمر:', 'Age:')} <strong className="text-slate-800">{p.age} {bi('سنة', 'yrs')}</strong></span>
                  {p.dateOfBirth && <span className="text-slate-400">({p.dateOfBirth})</span>}
                </div>
              )}

              {p.dominantHand && (
                <div className="flex items-center gap-1.5">
                  <Activity className="w-4 h-4 text-slate-400" />
                  <span>{bi('اليد المهيمنة:', 'Dominant Hand:')} <strong className="text-slate-800">{p.dominantHand === 'right' ? bi('اليمنى', 'Right') : p.dominantHand === 'left' ? bi('اليسرى', 'Left') : bi('كلتاهما', 'Ambidextrous')}</strong></span>
                </div>
              )}

              {p.phoneNumber && (
                <div className="flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-slate-400" />
                  <span dir="ltr">{p.phoneNumber}</span>
                </div>
              )}

              {p.occupation && (
                <div className="flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-slate-400" />
                  <span>{p.occupation}</span>
                </div>
              )}

              {p.address && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span>{p.address}</span>
                </div>
              )}
            </div>
          </div>

          <div className="text-left md:border-r md:pr-6 border-slate-100 flex flex-col justify-center">
            <span className="text-xs text-slate-400">{bi('رقم هوية السجل المشفر (UUID):', 'Encrypted Record ID (UUID):')}</span>
            <code className="text-xs font-mono text-slate-600 bg-slate-50 px-2 py-1 rounded-md select-all mt-1">
              {patient.id}
            </code>
            <span className="text-xs text-emerald-600 flex items-center gap-1 mt-1 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{bi('مُشفَّر بـ AES-256-GCM (تشفير حمولة السجل)', 'Encrypted with AES-256-GCM')}</span>
            </span>
            <span className="text-xs text-slate-400 mt-1 leading-tight">
              {bi('حمولة السجل بالكامل مُشفَّرة — الحقول الفردية غير مُشفَّرة باستقلالية', 'Full payload encryption at rest')}
            </span>
          </div>

        </div>
      </div>

      {/* Red Flags Alert Box (If present) */}
      {hasRedFlags && (
        <div className="mb-6 p-5 bg-rose-50 border-2 border-rose-300 rounded-xl shadow-sm">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-rose-900 mb-1">
                {bi('تنبيه سريري هام: علامات حمراء ومحاذير حرجة', 'Important Clinical Alert: Red Flags')}
              </h3>
              <p className="text-sm text-rose-800 leading-relaxed font-medium">
                {p.redFlags}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Clinical Data Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        
        {/* Left Column: Medical History & Diagnoses */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Medical History Card */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4 text-slate-900 font-bold text-base border-b border-slate-100 pb-3">
              <FileText className="w-5 h-5 text-primary-600" />
              <span>{bi('التاريخ المرضي وطبيعة الإصابة', 'Medical History & Presentation')}</span>
            </div>
            {p.medicalHistory ? (
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
                {p.medicalHistory}
              </p>
            ) : (
              <p className="text-xs text-slate-400 italic">لم يتم تدوين تاريخ مرضي حتى الآن.</p>
            )}
          </div>

          {/* Surgeries & Medications */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-3 text-slate-900 font-bold text-sm">
                <Scissors className="w-4 h-4 text-amber-600" />
                <span>{bi('العمليات الجراحية السابقة', 'Previous Surgeries')}</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                {p.previousSurgeries || 'لا يوجد جراحات مسجلة.'}
              </p>
            </div>

            <div className="bg-white rounded-xl p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-3 text-slate-900 font-bold text-sm">
                <Pill className="w-4 h-4 text-emerald-600" />
                <span>{bi('الأدوية الحالية المستمرة', 'Current Medications')}</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                {p.currentMedications || 'لا توجد أدوية مسجلة.'}
              </p>
            </div>

          </div>

          {/* Precautions & Psychosocial */}
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm">
            <div className="flex items-center gap-2 mb-4 text-slate-900 font-bold text-base border-b border-slate-100 pb-3">
              <Activity className="w-5 h-5 text-primary-600" />
              <span>{bi('محاذير العلاج والعوامل النفسية والاجتماعية', 'Precautions & Psychosocial Factors')}</span>
            </div>

            <div className="space-y-4">
              {p.precautions && (
                <div>
                  <h4 className="text-xs font-bold text-slate-700 mb-1">المحاذير السريرية:</h4>
                  <p className="text-xs sm:text-sm text-slate-600 bg-amber-50/70 p-3 rounded-xl border border-amber-200/60 leading-relaxed">
                    {p.precautions}
                  </p>
                </div>
              )}

              {p.psychosocialFactors && (
                <div>
                  <h4 className="text-xs font-bold text-slate-700 mb-1">العوامل النفسية الاجتماعية (Yellow Flags):</h4>
                  <p className="text-xs sm:text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
                    {p.psychosocialFactors}
                  </p>
                </div>
              )}

              {p.generalNotes && (
                <div>
                  <h4 className="text-xs font-bold text-slate-700 mb-1">ملاحظات عامة:</h4>
                  <p className="text-xs sm:text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100 leading-relaxed">
                    {p.generalNotes}
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Column: Quick Clinical Alerts & Episodes */}
        <div className="space-y-6">
          
          <div className="bg-white rounded-xl p-6 border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900 text-sm border-b border-slate-100 pb-2">
              {bi('التنبيهات السريرية السريعة', 'Clinical Alerts')}
            </h3>

            <div>
              <span className="text-xs font-semibold text-slate-500 block mb-1">{bi('الحساسية المعروفة:', 'Known Allergies:')}</span>
              <span className="inline-block px-3 py-1 bg-slate-100 text-slate-800 rounded-lg text-xs font-medium">
                {p.allergies || 'لا توجد حساسية مسجلة (NKDA)'}
              </span>
            </div>

            <div>
              <span className="text-xs font-semibold text-slate-500 block mb-1">{bi('الأمراض المصاحبة:', 'Comorbidities:')}</span>
              <span className="inline-block px-3 py-1 bg-slate-100 text-slate-800 rounded-lg text-xs font-medium">
                {p.comorbidities || 'لا توجد أمراض مزمنة مصاحبة'}
              </span>
            </div>
          </div>

          {/* Quick Episodes Summary Card */}
          <div className="bg-gradient-to-br from-primary-50 to-teal-50 rounded-xl p-6 border border-primary-200/80 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-primary-900 font-bold text-sm">
                <Layers className="w-4 h-4 text-primary-600" />
                <span>{bi('حلقات الرعاية النشطة', 'Active Episodes')}</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-600 text-white">
                {activeEpisodes.length}
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              {activeEpisodes.length > 0
                ? `توجد ${activeEpisodes.length} حلقة علاجية جارية لهذا المريض.`
                : 'لا توجد حلقة علاجية نشطة حالياً. يمكنك بدء حلقة جديدة وتحديد أهدافها السريرية.'}
            </p>

            <button
              type="button"
              onClick={() => {
                setEpisodeToEdit(null);
                setIsEpisodeModalOpen(true);
              }}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{bi('بدء حلقة رعاية جديدة', 'Start New Episode')}</span>
            </button>
          </div>

        </div>

      </div>

      {/* ======================================================================= */}
      {/* Major Section: Episodes of Care (حلقات الرعاية السريرية)              */}
      {/* ======================================================================= */}
      <section className="bg-white rounded-xl p-6 sm:p-8 border border-slate-200 shadow-sm mb-8">
        
        {/* Section Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-700 flex items-center justify-center">
                <Layers className="w-5 h-5 text-primary-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  {bi('حلقات الرعاية السريرية', 'Episodes of Care')}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  دورات العلاج الطبيعي والتأهيل المؤرخة، الأهداف المعتمدة، وسجل المتابعة
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              setEpisodeToEdit(null);
              setIsEpisodeModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 shadow-sm hover:shadow transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{bi('بدء حلقة رعاية جديدة', 'Start New Episode')}</span>
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 py-4 overflow-x-auto border-b border-slate-100">
          <button
            type="button"
            onClick={() => setEpisodeTabFilter('active')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              episodeTabFilter === 'active'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>{bi('النشطة', 'Active')}</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${episodeTabFilter === 'active' ? 'bg-white/20' : 'bg-slate-200'}`}>
              {activeEpisodes.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setEpisodeTabFilter('on_hold')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              episodeTabFilter === 'on_hold'
                ? 'bg-amber-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>{bi('المعلقة', 'On Hold')}</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${episodeTabFilter === 'on_hold' ? 'bg-white/20' : 'bg-slate-200'}`}>
              {onHoldEpisodes.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setEpisodeTabFilter('completed')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              episodeTabFilter === 'completed'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>{bi('المكتملة', 'Completed')}</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${episodeTabFilter === 'completed' ? 'bg-white/20' : 'bg-slate-200'}`}>
              {completedEpisodes.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setEpisodeTabFilter('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              episodeTabFilter === 'all'
                ? 'bg-primary-700 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>{bi('الكل', 'All')}</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${episodeTabFilter === 'all' ? 'bg-white/20' : 'bg-slate-200'}`}>
              {episodes.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setEpisodeTabFilter('archived')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              episodeTabFilter === 'archived'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <span>{bi('الأرشيف', 'Archived')}</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${episodeTabFilter === 'archived' ? 'bg-white/20' : 'bg-slate-200'}`}>
              {archivedEpisodes.length}
            </span>
          </button>
        </div>

        {/* Episodes List */}
        <div className="pt-6">
          {loadingEpisodes ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              جاري فك تشفير حلقات الرعاية التابعة للمريض...
            </div>
          ) : filteredEpisodes.length === 0 ? (
            <div className="py-12 px-4 text-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50/50">
              <FolderOpen className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <h4 className="text-sm font-bold text-slate-700 mb-1">
                لا توجد حلقات رعاية في هذا التصنيف
              </h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mb-4">
                ابدأ حلقة رعاية جديدة لتوثيق تشخيص المريض وتحديد أهدافه العلاجية وربط جلسات العلاج الطبيعي بها.
              </p>
              <button
                type="button"
                onClick={() => {
                  setEpisodeToEdit(null);
                  setIsEpisodeModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-primary-600 hover:bg-primary-700 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>بدء أول حلقة رعاية</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredEpisodes.map((ep) => {
                const ed = ep.data;
                const specialtyInfo = CLINICAL_SPECIALTIES[ep.primarySpecialty] || CLINICAL_SPECIALTIES.general;
                const statusInfo = EPISODE_STATUSES[ep.status] || EPISODE_STATUSES.active;
                const isExpanded = expandedEpisodeId === ep.id;

                return (
                  <div
                    key={ep.id}
                    className="border border-slate-200 hover:border-slate-300 rounded-xl p-5 bg-white transition-all shadow-xs"
                  >
                    {/* Top Row: Title, Badges & Dates */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                          <h4 className="text-base font-bold text-slate-900">{ed.title}</h4>
                          
                          {/* Status Badge */}
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${statusInfo.badgeClass}`}>
                            <span>{isEn ? statusInfo.en : statusInfo.ar}</span>
                          </span>

                          {/* Specialty Badge */}
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${specialtyInfo.badgeClass}`}>
                            <span>{isEn ? specialtyInfo.en : specialtyInfo.ar}</span>
                          </span>

                          {ed.isOngoingLegacyEpisode && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              <Sparkles className="w-3 h-3 text-amber-600" />
                              <span>حلقة مستمرة منقولة</span>
                            </span>
                          )}
                        </div>

                        {/* Dates row */}
                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>تاريخ البدء: <strong className="text-slate-700">{ep.startDate || '—'}</strong></span>
                          </span>
                          {ep.endDate && (
                            <span className="flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
                              <span>تاريخ التخريج: <strong className="text-slate-700">{ep.endDate}</strong></span>
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>المنطقة التشريحية: <strong className="text-slate-700">{ed.affectedBodyRegion}</strong></span>
                          </span>
                        </div>
                      </div>

                      {/* Expand / Collapse toggle */}
                      <button
                        type="button"
                        onClick={() => setExpandedEpisodeId(isExpanded ? null : ep.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 transition-colors self-start sm:self-center"
                      >
                        <span>{isExpanded ? bi('إخفاء التفاصيل', 'Hide Details') : bi('عرض التفاصيل السريرية', 'Show Details')}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    {/* Compact Diagnosis & Impression */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs bg-slate-50/70 p-3.5 rounded-xl border border-slate-100 mb-3">
                      <div>
                        <span className="font-bold text-slate-700 block mb-0.5">{bi('التشخيص الطبي الأولي:', 'Primary Medical Diagnosis:')}</span>
                        <p className="text-slate-600 leading-relaxed">{ed.medicalDiagnosis}</p>
                      </div>
                      <div>
                        <span className="font-bold text-slate-700 block mb-0.5">{bi('الانطباع السريري:', 'Clinical Impression:')}</span>
                        <p className="text-slate-600 leading-relaxed">{ed.clinicalImpression}</p>
                      </div>
                    </div>

                    {/* Expanded Section */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-slate-100 space-y-4 animate-in fade-in duration-150">
                        
                        {/* Goals Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Short-Term */}
                          <div className="bg-emerald-50/50 p-3.5 rounded-xl border border-emerald-100">
                            <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5 mb-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{bi('الأهداف قصيرة المدى:', 'Short-Term Goals:')}</span>
                            </span>
                            {ed.rehabilitationGoals?.shortTerm?.length > 0 ? (
                              <ul className="list-disc list-inside space-y-1 text-xs text-slate-700">
                                {ed.rehabilitationGoals.shortTerm.map((g, i) => (
                                  <li key={i}>{g}</li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-xs text-slate-400 italic">لا توجد أهداف محددة.</span>
                            )}
                          </div>

                          {/* Long-Term */}
                          <div className="bg-primary-50/50 p-3.5 rounded-xl border border-primary-100">
                            <span className="text-xs font-bold text-primary-900 flex items-center gap-1.5 mb-2">
                              <Target className="w-3.5 h-3.5 text-primary-600" />
                              <span>{bi('الأهداف طويلة المدى والتخريج:', 'Long-Term Goals:')}</span>
                            </span>
                            {ed.rehabilitationGoals?.longTerm?.length > 0 ? (
                              <ul className="list-disc list-inside space-y-1 text-xs text-slate-700">
                                {ed.rehabilitationGoals.longTerm.map((g, i) => (
                                  <li key={i}>{g}</li>
                                ))}
                              </ul>
                            ) : (
                              <span className="text-xs text-slate-400 italic">لا توجد أهداف محددة.</span>
                            )}
                          </div>
                        </div>

                        {/* Discharge Summary (If completed) */}
                        {ed.dischargeSummary && (
                          <div className="bg-blue-50/80 p-4 rounded-xl border border-blue-200">
                            <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5 mb-1.5">
                              <FileText className="w-4 h-4 text-blue-600" />
                              <span>{bi('ملخص الخروج والنتائج السريرية:', 'Discharge Summary:')}</span>
                            </span>
                            <p className="text-xs text-blue-950 leading-relaxed whitespace-pre-line font-medium">
                              {ed.dischargeSummary}
                            </p>
                            {ed.dischargeCriteriaSummary && (
                              <p className="text-[11px] text-blue-800 mt-2 pt-2 border-t border-blue-200/60">
                                <strong>المعايير المحققة:</strong> {ed.dischargeCriteriaSummary}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Clinical Sessions & SOAP Notes Timeline */}
                        <EpisodeSessionsView episode={ep} patient={patient} />

                        {/* Action Buttons Row */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
                          <div className="flex items-center gap-2">
                            {/* Edit Episode */}
                            <button
                              type="button"
                              onClick={() => {
                                setEpisodeToEdit(ep);
                                setIsEpisodeModalOpen(true);
                              }}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>{bi('تعديل الحلقة', 'Edit Episode')}</span>
                            </button>

                            {/* Discharge / Close (if active or on hold) */}
                            {ep.status !== 'completed' && ep.status !== 'archived' && (
                              <button
                                type="button"
                                onClick={() => setEpisodeToDischarge(ep)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition-colors"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>{bi('إغلاق وتخريج', 'Discharge')}</span>
                              </button>
                            )}

                            {/* Put on Hold or Resume */}
                            {ep.status === 'active' && (
                              <button
                                type="button"
                                onClick={() => setEpisodeStatus(ep.id, 'on_hold')}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 transition-colors"
                              >
                                <PauseCircle className="w-3.5 h-3.5" />
                                <span>{bi('تعليق مؤقت', 'Hold')}</span>
                              </button>
                            )}

                            {ep.status === 'on_hold' && (
                              <button
                                type="button"
                                onClick={() => setEpisodeStatus(ep.id, 'active')}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors"
                              >
                                <PlayCircle className="w-3.5 h-3.5" />
                                <span>{bi('استئناف الخطة', 'Resume')}</span>
                              </button>
                            )}

                            {ep.status === 'completed' && (
                              <button
                                type="button"
                                onClick={() => setEpisodeStatus(ep.id, 'active')}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-colors"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>{bi('إعادة فتح الحلقة', 'Reopen Episode')}</span>
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-2">
                            {/* Archive / Unarchive */}
                            {ep.status !== 'archived' ? (
                              <button
                                type="button"
                                onClick={() => archiveEpisode(ep.id)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 transition-colors"
                              >
                                <Archive className="w-3.5 h-3.5" />
                                <span>{bi('أرشفة الحلقة', 'Archive Episode')}</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => unarchiveEpisode(ep.id)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-primary-700 bg-primary-50 hover:bg-primary-100 transition-colors"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>{bi('استعادة من الأرشيف', 'Restore from Archive')}</span>
                              </button>
                            )}
                          </div>
                        </div>

                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}
        </div>

      </section>

      {/* Episode Creation & Edit Modal */}
      <EpisodeModal
        isOpen={isEpisodeModalOpen}
        onClose={() => {
          setIsEpisodeModalOpen(false);
          setEpisodeToEdit(null);
        }}
        patient={patient}
        episodeToEdit={episodeToEdit}
        onSaved={handleSaveEpisode}
      />

      {/* Episode Discharge Modal */}
      {episodeToDischarge && (
        <EpisodeDischargeModal
          isOpen={Boolean(episodeToDischarge)}
          onClose={() => setEpisodeToDischarge(null)}
          episode={episodeToDischarge}
          onConfirmDischarge={handleConfirmDischarge}
        />
      )}

    </div>
  );
};
