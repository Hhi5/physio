// =======================================================================
// PhysioRecord — Episode Creation & Editing Modal (Phase 2B.1)
// Bilingual Clinical Terminology, Pre-filling from Patient, and Review
// =======================================================================

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import type { PatientRecord, EpisodeRecord, EpisodeClinicalData, ClinicalSpecialty, OnsetMechanism } from '../types/clinical';
import { CLINICAL_SPECIALTIES, ONSET_MECHANISMS, COMMON_BODY_REGIONS } from '../data/terminology';
import {
  X,
  Layers,
  Save,
  CheckCircle2,
  Sparkles,
  Plus,
  Trash2,
  AlertCircle,
} from 'lucide-react';

interface EpisodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: PatientRecord;
  episodeToEdit?: EpisodeRecord | null;
  onSaved: (episode: EpisodeRecord) => void;
}

export const EpisodeModal: React.FC<EpisodeModalProps> = ({
  isOpen,
  onClose,
  patient,
  episodeToEdit,
  onSaved,
}) => {
  const p = patient.data;
  const isEditing = Boolean(episodeToEdit);
  const { bi, isRtl } = useLanguage();

  // Form State
  const [isOngoingLegacy, setIsOngoingLegacy] = useState(false);
  const [title, setTitle] = useState('');
  const [primarySpecialty, setPrimarySpecialty] = useState<ClinicalSpecialty>('musculoskeletal');
  const [affectedBodyRegion, setAffectedBodyRegion] = useState('');
  const [customBodyRegion, setCustomBodyRegion] = useState('');
  const [onsetDate, setOnsetDate] = useState(new Date().toISOString().split('T')[0]);
  const [onsetMechanism, setOnsetMechanism] = useState<OnsetMechanism>('insidious');
  const [medicalDiagnosis, setMedicalDiagnosis] = useState('');
  const [clinicalImpression, setClinicalImpression] = useState('');
  const [referralSource, setReferralSource] = useState('');
  const [dischargeCriteria, setDischargeCriteria] = useState('');

  // Goals
  const [shortTermGoals, setShortTermGoals] = useState<string[]>([]);
  const [newShortGoal, setNewShortGoal] = useState('');
  const [longTermGoals, setLongTermGoals] = useState<string[]>([]);
  const [newLongGoal, setNewLongGoal] = useState('');

  // Legacy Flags
  const [isDiagnosisConfirmed, setIsDiagnosisConfirmed] = useState(true);
  const [isOnsetDateExact, setIsOnsetDateExact] = useState(true);
  const [areBaselineGoalsFormalized, setAreBaselineGoalsFormalized] = useState(true);

  // Status & Error
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Populate form on open
  useEffect(() => {
    if (!isOpen) return;
    setError(null);

    if (episodeToEdit) {
      const ed = episodeToEdit.data;
      setTitle(ed.title);
      setPrimarySpecialty(episodeToEdit.primarySpecialty);
      setAffectedBodyRegion(ed.affectedBodyRegion);
      setOnsetDate(episodeToEdit.startDate || new Date().toISOString().split('T')[0]);
      setOnsetMechanism(ed.onsetMechanism || 'insidious');
      setMedicalDiagnosis(ed.medicalDiagnosis);
      setClinicalImpression(ed.clinicalImpression);
      setReferralSource(ed.referralSource || '');
      setDischargeCriteria(ed.dischargeCriteriaSummary || '');
      setShortTermGoals(ed.rehabilitationGoals?.shortTerm || []);
      setLongTermGoals(ed.rehabilitationGoals?.longTerm || []);
      setIsOngoingLegacy(Boolean(ed.isOngoingLegacyEpisode));
      setIsDiagnosisConfirmed(ed.knownVsUnknownHistoryFlags?.isDiagnosisConfirmed ?? true);
      setIsOnsetDateExact(ed.knownVsUnknownHistoryFlags?.isOnsetDateExact ?? true);
      setAreBaselineGoalsFormalized(ed.knownVsUnknownHistoryFlags?.areBaselineGoalsFormalized ?? true);
    } else {
      // Pre-fill from patient profile summary for a new Episode
      const defaultTitle = `حلقة رعاية: ${p.fullNameAr || p.fullName}`;
      setTitle(defaultTitle);
      setPrimarySpecialty('musculoskeletal');
      setAffectedBodyRegion(COMMON_BODY_REGIONS[0].en);
      setCustomBodyRegion('');
      setOnsetDate(new Date().toISOString().split('T')[0]);
      setOnsetMechanism('insidious');
      setMedicalDiagnosis(p.medicalHistory || '');
      setClinicalImpression(p.generalNotes || 'فحص أولي وتقييم حركي للحالة.');
      setReferralSource('');
      setDischargeCriteria('تحسن المدى الحركي وزوال الألم واستعادة الوظيفة اليومية بنسبة 80% فأكثر.');
      setShortTermGoals([
        'تقليل حدة الألم بمقدار نقطتين على مقياس VAS خلال أسبوعين.',
        'استعادة المدى الحركي الأولي بنسبة 50% خلال أسبوعين.',
      ]);
      setLongTermGoals([
        'العودة لكامل الأنشطة اليومية والوظيفية دون ألم خلال 6 أسابيع.',
      ]);
      setIsOngoingLegacy(false);
      setIsDiagnosisConfirmed(true);
      setIsOnsetDateExact(true);
      setAreBaselineGoalsFormalized(true);
    }
  }, [isOpen, episodeToEdit, p]);

  if (!isOpen) return null;

  const handleAddShortGoal = () => {
    if (newShortGoal.trim()) {
      setShortTermGoals([...shortTermGoals, newShortGoal.trim()]);
      setNewShortGoal('');
    }
  };

  const handleRemoveShortGoal = (index: number) => {
    setShortTermGoals(shortTermGoals.filter((_, i) => i !== index));
  };

  const handleAddLongGoal = () => {
    if (newLongGoal.trim()) {
      setLongTermGoals([...longTermGoals, newLongGoal.trim()]);
      setNewLongGoal('');
    }
  };

  const handleRemoveLongGoal = (index: number) => {
    setLongTermGoals(longTermGoals.filter((_, i) => i !== index));
  };

  const finalBodyRegion = affectedBodyRegion === 'custom' ? customBodyRegion : affectedBodyRegion;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('يرجى إدخال عنوان واضح لحلقة الرعاية.');
      return;
    }
    if (!medicalDiagnosis.trim()) {
      setError('يرجى كتابة التشخيص الطبي الأولي.');
      return;
    }
    if (!clinicalImpression.trim()) {
      setError('يرجى كتابة الانطباع السريري للعلاج الطبيعي.');
      return;
    }
    if (!finalBodyRegion.trim()) {
      setError('يرجى تحديد المنطقة التشريحية المصابة.');
      return;
    }

    setSaving(true);
    try {
      const payload: EpisodeClinicalData = {
        title: title.trim(),
        status: episodeToEdit?.status || 'active',
        primarySpecialty,
        startDate: onsetDate,
        endDate: episodeToEdit?.endDate,
        referralSource: referralSource.trim() || undefined,
        medicalDiagnosis: medicalDiagnosis.trim(),
        clinicalImpression: clinicalImpression.trim(),
        affectedBodyRegion: finalBodyRegion.trim(),
        onsetMechanism,
        onsetDate,
        rehabilitationGoals: {
          shortTerm: shortTermGoals,
          longTerm: longTermGoals,
        },
        dischargeCriteriaSummary: dischargeCriteria.trim() || undefined,
        isOngoingLegacyEpisode: isOngoingLegacy,
        knownVsUnknownHistoryFlags: isOngoingLegacy
          ? {
              isDiagnosisConfirmed,
              isOnsetDateExact,
              areBaselineGoalsFormalized,
            }
          : undefined,
      };

      // Pass prepared payload to parent callback
      onSaved({
        id: episodeToEdit?.id || '',
        patientId: patient.id,
        status: episodeToEdit?.status || 'active',
        primarySpecialty,
        startDate: onsetDate,
        createdAt: episodeToEdit?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        data: payload,
      });

      onClose();
    } catch (err: any) {
      console.error('Failed to save episode:', err);
      setError(err?.message || 'حدث خطأ أثناء حفظ حلقة الرعاية.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="bg-white rounded-xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-primary-600 to-teal-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <Layers className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">
                {isEditing ? bi('تعديل حلقة الرعاية السريرية', 'Edit Episode of Care') : bi('بدء حلقة رعاية جديدة', 'Start New Episode of Care')}
              </h2>
              <p className="text-xs text-primary-100 mt-0.5">
                {bi('المريض:', 'Patient:')} <span className="font-semibold">{p.fullNameAr || p.fullName}</span> ({p.gender === 'male' ? bi('ذكر', 'Male') : bi('أنثى', 'Female')}، {p.age || '—'} {bi('سنة', 'yrs')})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-3 text-rose-800 text-sm">
              <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* New vs Ongoing Legacy Selection (Only if not editing) */}
          {!isEditing && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <span className="text-xs font-bold text-slate-700 block mb-2">نوع حلقة الرعاية:</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${!isOngoingLegacy ? 'bg-primary-50/70 border-primary-300 ring-2 ring-primary-500/20' : 'bg-white border-slate-200 hover:bg-slate-100/60'}`}>
                  <input
                    type="radio"
                    name="episodeKind"
                    checked={!isOngoingLegacy}
                    onChange={() => setIsOngoingLegacy(false)}
                    className="mt-1 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">حلقة علاجية جديدة (New Episode)</span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">تبدأ اليوم بخطة تقييم وأهداف جديدة بالكامل.</span>
                  </div>
                </label>

                <label className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isOngoingLegacy ? 'bg-amber-50/70 border-amber-300 ring-2 ring-amber-500/20' : 'bg-white border-slate-200 hover:bg-slate-100/60'}`}>
                  <input
                    type="radio"
                    name="episodeKind"
                    checked={isOngoingLegacy}
                    onChange={() => setIsOngoingLegacy(true)}
                    className="mt-1 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">توثيق حلقة قديمة مستمرة (Legacy Ongoing)</span>
                    <span className="text-[11px] text-slate-500 block mt-0.5">انتقال من Phase 1 لحالة كانت قيد العلاج مسبقاً.</span>
                  </div>
                </label>
              </div>

              {/* Legacy ongoing explicit flags */}
              {isOngoingLegacy && (
                <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-2">
                  <span className="text-[11px] font-semibold text-slate-600 block">
                    تأصيل دقة البيانات التاريخية المعروفة (Data Certainty):
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isDiagnosisConfirmed}
                        onChange={(e) => setIsDiagnosisConfirmed(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span>التشخيص مؤكد طبياً</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={isOnsetDateExact}
                        onChange={(e) => setIsOnsetDateExact(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span>تاريخ البدء دقيق</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={areBaselineGoalsFormalized}
                        onChange={(e) => setAreBaselineGoalsFormalized(e.target.checked)}
                        className="rounded text-amber-600 focus:ring-amber-500"
                      />
                      <span>الأهداف المبدئية موثقة</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Episode Title */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              عنوان حلقة الرعاية <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: تأهيل تمزق الرباط الصليبي الأمامي للركبة اليمنى"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Specialty & Body Region */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Primary Specialty */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                التخصص السريري الرئيسي (Primary Specialty) <span className="text-rose-500">*</span>
              </label>
              <select
                value={primarySpecialty}
                onChange={(e) => setPrimarySpecialty(e.target.value as ClinicalSpecialty)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-primary-500 bg-white"
              >
                {Object.values(CLINICAL_SPECIALTIES).map((spec) => (
                  <option key={spec.code} value={spec.code}>
                    {spec.en} — {spec.ar}
                  </option>
                ))}
              </select>
              <span className="text-[11px] text-slate-400 mt-1 block">
                {CLINICAL_SPECIALTIES[primarySpecialty].descriptionAr}
              </span>
            </div>

            {/* Affected Body Region */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                المنطقة التشريحية المصابة (Body Region) <span className="text-rose-500">*</span>
              </label>
              <select
                value={affectedBodyRegion}
                onChange={(e) => setAffectedBodyRegion(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-primary-500 bg-white"
              >
                {COMMON_BODY_REGIONS.map((reg) => (
                  <option key={reg.en} value={reg.en}>
                    {reg.en} — {reg.ar}
                  </option>
                ))}
                <option value="custom">أخرى (كتابة يدوية)...</option>
              </select>
              {affectedBodyRegion === 'custom' && (
                <input
                  type="text"
                  required
                  value={customBodyRegion}
                  onChange={(e) => setCustomBodyRegion(e.target.value)}
                  placeholder="حدد المنطقة التشريحية..."
                  className="mt-2 w-full px-3 py-1.5 rounded-lg border border-slate-300 text-xs"
                />
              )}
            </div>

          </div>

          {/* Dates & Onset Mechanism */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                تاريخ بدء الحلقة / الإصابة <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={onsetDate}
                onChange={(e) => setOnsetDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                آلية الإصابة / البداية (Onset Mechanism)
              </label>
              <select
                value={onsetMechanism}
                onChange={(e) => setOnsetMechanism(e.target.value as OnsetMechanism)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-primary-500 bg-white"
              >
                {Object.values(ONSET_MECHANISMS).map((m) => (
                  <option key={m.code} value={m.code}>
                    {m.en} — {m.ar}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Medical Diagnosis & Clinical Impression */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  التشخيص الطبي الأولي (Medical Diagnosis) <span className="text-rose-500">*</span>
                </label>
                {!isEditing && p.medicalHistory && (
                  <span className="text-[11px] text-teal-700 flex items-center gap-1 font-medium bg-teal-50 px-2 py-0.5 rounded-md">
                    <Sparkles className="w-3 h-3" /> مستقى من ملخص المريض
                  </span>
                )}
              </div>
              <textarea
                required
                rows={2}
                value={medicalDiagnosis}
                onChange={(e) => setMedicalDiagnosis(e.target.value)}
                placeholder="التشخيص الطبي الصادر من الطبيب المحول أو تقارير الأشعة والتحاليل..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                الانطباع والتقييم السريري للعلاج الطبيعي  <span className="text-rose-500">*</span>
              </label>
              <textarea
                required
                rows={2}
                value={clinicalImpression}
                onChange={(e) => setClinicalImpression(e.target.value)}
                placeholder="الانطباع السريري للمعالج: القصور الوظيفي، العجز الحركي، استجابة الأنسجة، ونمط الألم..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Rehabilitation Goals Section */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary-600" />
              <span>الأهداف التأهيلية السريرية (Rehabilitation Goals)</span>
            </h4>

            {/* Short-Term Goals */}
            <div>
              <span className="text-xs font-semibold text-slate-700 block mb-1">
                الأهداف قصيرة المدى (Short-Term Goals — 2 to 4 weeks):
              </span>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newShortGoal}
                  onChange={(e) => setNewShortGoal(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddShortGoal())}
                  placeholder="أضف هدفاً قصير المدى ثم اضغط إضافة..."
                  className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddShortGoal}
                  className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> إضافة
                </button>
              </div>
              <div className="space-y-1.5">
                {shortTermGoals.map((g, idx) => (
                  <div key={idx} className="flex items-center justify-between px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-700">
                    <span>{g}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveShortGoal(idx)}
                      className="text-slate-400 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Long-Term Goals */}
            <div>
              <span className="text-xs font-semibold text-slate-700 block mb-1">
                الأهداف طويلة المدى وتطلعات التخريج (Long-Term Goals — 6 to 12 weeks):
              </span>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={newLongGoal}
                  onChange={(e) => setNewLongGoal(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddLongGoal())}
                  placeholder="أضف هدفاً طويل المدى ثم اضغط إضافة..."
                  className="flex-1 px-3 py-1.5 rounded-xl border border-slate-300 text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddLongGoal}
                  className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl text-xs font-bold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" /> إضافة
                </button>
              </div>
              <div className="space-y-1.5">
                {longTermGoals.map((g, idx) => (
                  <div key={idx} className="flex items-center justify-between px-3 py-1.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-700">
                    <span>{g}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveLongGoal(idx)}
                      className="text-slate-400 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* Referral & Discharge Criteria */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                الجهة أو الطبيب المحول (Referral Source)
              </label>
              <input
                type="text"
                value={referralSource}
                onChange={(e) => setReferralSource(e.target.value)}
                placeholder="د. استشاري العظام / مستشفى الملك فيصل..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                معايير التخريج المبدئية (Discharge Criteria)
              </label>
              <input
                type="text"
                value={dischargeCriteria}
                onChange={(e) => setDischargeCriteria(e.target.value)}
                placeholder="معايير إنهاء الرعاية وتحقيق التعافي..."
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Clinician Review & Confirmation Banner */}
          <div className="p-4 bg-teal-50/80 border border-teal-200 rounded-xl text-xs text-teal-900 leading-relaxed">
            <span className="font-bold block mb-1">إقرار ومراجعة المعالج السريري:</span>
            بالموافقة على الحفظ، أؤكد بصفتي المعالج المسؤول مراجعة صحة التشخيص الطبي والانطباع السريري وأهداف التأهيل، وسيتم تشفير هذه الحلقة محلياً بواسطة AES-256-GCM وربطها بهوية المريض دون إمكانية فك تشفيرها إلا بمفتاح الخزنة.
          </div>

        </form>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 transition-colors"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 rounded-xl text-xs sm:text-sm font-bold text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center gap-2 shadow-sm"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'جاري الحفظ والتشفير...' : isEditing ? 'حفظ التعديلات' : 'اعتماد وبدء حلقة الرعاية'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
