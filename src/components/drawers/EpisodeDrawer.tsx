// =======================================================================
// PhysioRecord — Episode of Care Creation Slide-over Drawer
// =======================================================================

import React, { useState, useEffect } from 'react';
import { Drawer } from '../layout/Drawer';
import { useVault } from '../../context/VaultContext';
import { useLanguage } from '../../context/LanguageContext';
import { EpisodeService } from '../../services/episodeService';
import type { EpisodeClinicalData, EpisodeRecord, ClinicalSpecialty, OnsetMechanism } from '../../types/clinical';
import { CLINICAL_SPECIALTIES, COMMON_BODY_REGIONS } from '../../data/terminology';
import { localDate } from '../../utils/date';
import { Save, Trash2 } from 'lucide-react';

interface EpisodeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  onEpisodeCreated: (episode: EpisodeRecord) => void;
}

export const EpisodeDrawer: React.FC<EpisodeDrawerProps> = ({
  isOpen,
  onClose,
  patientId,
  patientName,
  onEpisodeCreated,
}) => {
  const { dek } = useVault();
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const [title, setTitle] = useState('');
  const [primarySpecialty, setPrimarySpecialty] = useState<ClinicalSpecialty>('musculoskeletal');
  const [affectedBodyRegion, setAffectedBodyRegion] = useState('');
  const [medicalDiagnosis, setMedicalDiagnosis] = useState('');
  const [clinicalImpression, setClinicalImpression] = useState('');
  const [onsetDate, setOnsetDate] = useState(localDate());
  const [onsetMechanism] = useState<OnsetMechanism>('insidious');
  const [shortTermGoals, setShortTermGoals] = useState<string[]>([]);
  const [newGoalInput, setNewGoalInput] = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTitle('');
    setPrimarySpecialty('musculoskeletal');
    setAffectedBodyRegion('');
    setMedicalDiagnosis('');
    setClinicalImpression('');
    setOnsetDate(localDate());
    setShortTermGoals([]);
    setNewGoalInput('');
    setError(null);
  }, [isOpen, patientId]);

  const handleAddGoal = () => {
    if (newGoalInput.trim()) {
      setShortTermGoals([...shortTermGoals, newGoalInput.trim()]);
      setNewGoalInput('');
    }
  };

  const handleRemoveGoal = (index: number) => {
    setShortTermGoals(shortTermGoals.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dek) return;

    if (!title.trim() && !medicalDiagnosis.trim()) {
      setError(isAr ? 'يرجى إدخال عنوان الحالة أو التشخيص الطبي.' : 'Episode title or diagnosis is required.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const payload: EpisodeClinicalData = {
        title: title.trim() || medicalDiagnosis.trim(),
        status: 'active',
        primarySpecialty,
        startDate: onsetDate,
        medicalDiagnosis: medicalDiagnosis.trim() || title.trim(),
        clinicalImpression: clinicalImpression.trim() || (isAr ? 'تقييم أولي للعلاج الطبيعي' : 'Physical therapy initial assessment'),
        affectedBodyRegion: affectedBodyRegion || 'lumbar_spine',
        onsetMechanism,
        onsetDate,
        rehabilitationGoals: {
          shortTerm: shortTermGoals,
          longTerm: [],
        },
      };

      const created = await EpisodeService.createEpisode(patientId, payload, dek);
      onEpisodeCreated(created);
      onClose();
    } catch (err: unknown) {
      console.error('Failed to create episode:', err);
      setError(err instanceof Error ? err.message : 'Error creating episode of care');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={isAr ? 'بدء خطة علاجية جديدة (Episode of Care)' : 'New Episode of Care'}
      subtitle={isAr ? `للمريض: ${patientName}` : `Patient: ${patientName}`}
      footer={
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{isAr ? 'بدء الخطة العلاجية' : 'Create Episode'}</span>
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        {/* Title */}
        <div>
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
            {isAr ? 'عنوان الحالة / خطة التأهيل *' : 'Episode Title *'}
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={isAr ? 'مثال: تأهيل انزلاق غضروفي قطني L4-L5' : 'e.g., L4-L5 Lumbar Disc Herniation Rehab'}
            className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-750 text-slate-900 dark:text-white focus:outline-none focus:border-teal-500"
          />
        </div>

        {/* Specialty & Region */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
              {isAr ? 'التخصص السريري' : 'Clinical Specialty'}
            </label>
            <select
              value={primarySpecialty}
              onChange={(e) => setPrimarySpecialty(e.target.value as ClinicalSpecialty)}
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-750 text-slate-900 dark:text-white"
            >
              {Object.keys(CLINICAL_SPECIALTIES).map((specKey) => (
                <option key={specKey} value={specKey}>
                  {isAr ? CLINICAL_SPECIALTIES[specKey as ClinicalSpecialty].ar : CLINICAL_SPECIALTIES[specKey as ClinicalSpecialty].en}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
              {isAr ? 'المنطقة التشريحية المصابة' : 'Affected Body Region'}
            </label>
            <select
              value={affectedBodyRegion}
              onChange={(e) => setAffectedBodyRegion(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-750 text-slate-900 dark:text-white"
            >
              <option value="">{isAr ? 'اختر المنطقة...' : 'Select region...'}</option>
              {COMMON_BODY_REGIONS.map((r) => (
                <option key={r.en} value={r.en}>
                  {isAr ? r.ar : r.en}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Medical Diagnosis & Clinical Impression */}
        <div>
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
            {isAr ? 'التشخيص الطبي الأولي' : 'Medical Diagnosis'}
          </label>
          <input
            type="text"
            value={medicalDiagnosis}
            onChange={(e) => setMedicalDiagnosis(e.target.value)}
            placeholder={isAr ? 'مثال: اعتلال جذري قطني L5 (Lumbar Radiculopathy)' : 'e.g., L5 Lumbar Radiculopathy'}
            className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-750 text-slate-900 dark:text-white"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
            {isAr ? 'الانطباع السريري للعلاج الطبيعي' : 'PT Clinical Impression'}
          </label>
          <textarea
            rows={2}
            value={clinicalImpression}
            onChange={(e) => setClinicalImpression(e.target.value)}
            placeholder={isAr ? 'تشنج عضلي حامي، نقص مرونة العضلات الخلفية، حساسية عصبية...' : 'Protective muscle spasm, neural mechanosensitivity...'}
            className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-750 text-slate-900 dark:text-white"
          />
        </div>

        {/* Rehab Goals */}
        <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
            {isAr ? 'الأهداف التأهيلية المرحلية (Goals):' : 'Rehabilitation Goals:'}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newGoalInput}
              onChange={(e) => setNewGoalInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddGoal())}
              placeholder={isAr ? 'مثال: تقليل الألم إلى 2/10 والمشي 30 دقيقة...' : 'e.g., Reduce pain to 2/10, walk 30 mins...'}
              className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-750 text-slate-900 dark:text-white"
            />
            <button
              type="button"
              onClick={handleAddGoal}
              className="px-3 py-1.5 rounded-xl bg-teal-50 dark:bg-slate-800 hover:bg-teal-100 dark:hover:bg-slate-700 text-teal-700 dark:text-teal-400 font-bold text-xs cursor-pointer"
            >
              {isAr ? 'إضافة' : 'Add'}
            </button>
          </div>

          {shortTermGoals.length > 0 && (
            <ul className="space-y-1.5 pt-1">
              {shortTermGoals.map((goal, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800"
                >
                  <span className="text-slate-700 dark:text-slate-300">• {goal}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveGoal(idx)}
                    className="text-slate-400 hover:text-rose-500 p-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </form>
    </Drawer>
  );
};
