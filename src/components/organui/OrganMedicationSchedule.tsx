// =======================================================================
// OrganUI Medical Component — Medication Schedule (@organui/medication-schedule)
// Interactive Daily Dosing Timeline, Adherence Status & PT Interaction Alerts
// =======================================================================

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import {
  Pill,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Trash2,
  ShieldAlert,
  Sun,
  Sunset,
  Moon,
} from 'lucide-react';

export interface MedicationScheduleItem {
  id: string;
  name: string;
  dosage: string;
  frequency: 'morning' | 'noon' | 'evening' | 'bedtime' | 'prn';
  timeSlot: string;
  category: 'nsaid' | 'analgesic' | 'muscle_relaxant' | 'anticoagulant' | 'corticosteroid' | 'other';
  status: 'taken' | 'scheduled' | 'missed';
  ptPrecautionAr?: string;
  ptPrecautionEn?: string;
}

interface OrganMedicationScheduleProps {
  patientId: string;
  currentMedicationsText: string;
  onUpdateMedicationsText?: (text: string) => void;
  readOnly?: boolean;
}

const CATEGORY_META: Record<
  MedicationScheduleItem['category'],
  {
    labelAr: string;
    labelEn: string;
    precautionAr: string;
    precautionEn: string;
    badgeClass: string;
  }
> = {
  nsaid: {
    labelAr: 'مضاد التهاب غير ستيرويدي (NSAID)',
    labelEn: 'NSAID Anti-inflammatory',
    precautionAr: 'قد يخفي شدة الألم الحقيقي أثناء التمارين العلاجية التحميلية.',
    precautionEn: 'May mask acute pain response during heavy therapeutic loading.',
    badgeClass: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800',
  },
  muscle_relaxant: {
    labelAr: 'مرخي عضلي (Muscle Relaxant)',
    labelEn: 'Muscle Relaxant',
    precautionAr: 'انتبه للدوار أو نعاس المريض أثناء تمارين التوازن والمشي.',
    precautionEn: 'Monitor for drowsiness/dizziness during balance & gait training.',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
  },
  anticoagulant: {
    labelAr: 'مميع دم (Anticoagulant)',
    labelEn: 'Anticoagulant / Blood Thinner',
    precautionAr: 'تجنب الإبر الجافة العميقة (Dry Needling) أو المساج العنيف لمنع النزف والكدمات.',
    precautionEn: 'Avoid deep dry needling or aggressive soft-tissue mobilization (bruising risk).',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
  },
  analgesic: {
    labelAr: 'مسكن ألم (Analgesic)',
    labelEn: 'Analgesic',
    precautionAr: 'تقييم مستوى الألم قبل ذروة مفعول المسكن للحصول على خط أساس دقيق.',
    precautionEn: 'Assess baseline VAS pain prior to peak analgesic effect.',
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800',
  },
  corticosteroid: {
    labelAr: 'كورتيكوستيرويد (Corticosteroid)',
    labelEn: 'Corticosteroid',
    precautionAr: 'احذر من ضعف الأوتار والأنسجة الضامة عند تطبيق مقاومات عالية.',
    precautionEn: 'Caution with high-load eccentric tendon loading post-steroid use.',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
  },
  other: {
    labelAr: 'دواء عام / مكمل',
    labelEn: 'General Medication',
    precautionAr: 'مراجعة توافق الدواء مع الجهد البدني.',
    precautionEn: 'Standard exercise tolerance monitoring.',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
  },
};

export const OrganMedicationSchedule: React.FC<OrganMedicationScheduleProps> = ({
  patientId,
  currentMedicationsText,
  onUpdateMedicationsText,
  readOnly = false,
}) => {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const storageKey = `physiorecord_organui_meds_${patientId}`;
  const [meds, setMeds] = useState<MedicationScheduleItem[]>([]);
  const [newName, setNewName] = useState('');
  const [newDosage, setNewDosage] = useState('500mg');
  const [newFreq, setNewFreq] = useState<MedicationScheduleItem['frequency']>('morning');
  const [newCategory, setNewCategory] = useState<MedicationScheduleItem['category']>('nsaid');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setMeds(JSON.parse(saved));
        return;
      }
    } catch {
      // ignore
    }

    // Bootstrap from currentMedicationsText if present
    if (currentMedicationsText && currentMedicationsText.trim()) {
      const parts = currentMedicationsText
        .split(/[,،\n]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const initial: MedicationScheduleItem[] = parts.map((part, idx) => {
        const lower = part.toLowerCase();
        let cat: MedicationScheduleItem['category'] = 'other';
        if (lower.includes('ibuprofen') || lower.includes('voltaren') || lower.includes('diclofenac') || lower.includes('celebrex') || lower.includes('مضاد التهاب')) {
          cat = 'nsaid';
        } else if (lower.includes('baclofen') || lower.includes('mydocalm') || lower.includes('مرخي')) {
          cat = 'muscle_relaxant';
        } else if (lower.includes('aspirin') || lower.includes('warfarin') || lower.includes('eliquis') || lower.includes('مميع')) {
          cat = 'anticoagulant';
        } else if (lower.includes('paracetamol') || lower.includes('panadol') || lower.includes('مسكن')) {
          cat = 'analgesic';
        }
        return {
          id: `med_${idx}_${Date.now()}`,
          name: part,
          dosage: '1 tab',
          frequency: idx % 2 === 0 ? 'morning' : 'evening',
          timeSlot: idx % 2 === 0 ? '08:00' : '20:00',
          category: cat,
          status: 'taken',
        };
      });
      setMeds(initial);
    }
  }, [patientId]);

  const persistMeds = (updated: MedicationScheduleItem[]) => {
    setMeds(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {
      // ignore
    }
    if (onUpdateMedicationsText) {
      const summary = updated.map((m) => `${m.name} (${m.dosage})`).join('، ');
      onUpdateMedicationsText(summary);
    }
  };

  const handleAddMedication = () => {
    if (!newName.trim() || readOnly) return;
    const defaultTime =
      newFreq === 'morning'
        ? '08:00'
        : newFreq === 'noon'
        ? '13:00'
        : newFreq === 'evening'
        ? '19:00'
        : newFreq === 'bedtime'
        ? '22:30'
        : 'PRN';

    const item: MedicationScheduleItem = {
      id: `med_${Date.now()}`,
      name: newName.trim(),
      dosage: newDosage.trim() || '1 tab',
      frequency: newFreq,
      timeSlot: defaultTime,
      category: newCategory,
      status: 'scheduled',
    };
    persistMeds([...meds, item]);
    setNewName('');
  };

  const handleToggleStatus = (id: string) => {
    if (readOnly) return;
    const order: MedicationScheduleItem['status'][] = ['scheduled', 'taken', 'missed'];
    const updated = meds.map((m) => {
      if (m.id !== id) return m;
      const next = order[(order.indexOf(m.status) + 1) % order.length];
      return { ...m, status: next };
    });
    persistMeds(updated);
  };

  const handleDelete = (id: string) => {
    if (readOnly) return;
    persistMeds(meds.filter((m) => m.id !== id));
  };

  const activePrecautions = meds.filter((m) => m.category !== 'other');

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-4 shadow-2xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-600 dark:text-teal-400">
            <Pill className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                {isAr ? 'الجدول الدوائي وتنبيهات العلاج الطبيعي' : 'Medication Schedule & PT Interactions'}
              </h3>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                OrganUI
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {isAr
                ? 'متابعة الجرعات اليومية وتأثير الأدوية على الجلسة العلاجية'
                : 'Daily dosing timeline and clinical physical therapy precautions'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono tabular-nums">
          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold">
            {meds.filter((m) => m.status === 'taken').length}/{meds.length} {isAr ? 'تم تناولها' : 'Taken'}
          </span>
        </div>
      </div>

      {/* Add Medication Quick Bar */}
      {!readOnly && (
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={isAr ? 'اسم الدواء (مثال: Diclofenac, Baclofen)...' : 'Medication name (e.g. Ibuprofen)...'}
            className="sm:col-span-4 px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
          />
          <input
            type="text"
            value={newDosage}
            onChange={(e) => setNewDosage(e.target.value)}
            placeholder={isAr ? 'الجرعة (50mg)' : 'Dosage (50mg)'}
            className="sm:col-span-2 px-2.5 py-1.5 text-xs font-mono rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white tabular-nums"
          />
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as MedicationScheduleItem['category'])}
            className="sm:col-span-3 px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
          >
            <option value="nsaid">{isAr ? 'مضاد التهاب (NSAID)' : 'NSAID'}</option>
            <option value="muscle_relaxant">{isAr ? 'مرخي عضلي' : 'Muscle Relaxant'}</option>
            <option value="analgesic">{isAr ? 'مسكن ألم' : 'Analgesic'}</option>
            <option value="anticoagulant">{isAr ? 'مميع دم' : 'Anticoagulant'}</option>
            <option value="corticosteroid">{isAr ? 'كورتيزون' : 'Corticosteroid'}</option>
            <option value="other">{isAr ? 'أخرى' : 'Other'}</option>
          </select>
          <select
            value={newFreq}
            onChange={(e) => setNewFreq(e.target.value as MedicationScheduleItem['frequency'])}
            className="sm:col-span-2 px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
          >
            <option value="morning">{isAr ? 'صباحاً (08:00)' : 'Morning'}</option>
            <option value="noon">{isAr ? 'ظهراً (13:00)' : 'Noon'}</option>
            <option value="evening">{isAr ? 'مساءً (19:00)' : 'Evening'}</option>
            <option value="bedtime">{isAr ? 'قبل النوم' : 'Bedtime'}</option>
            <option value="prn">{isAr ? 'عند اللزوم' : 'PRN'}</option>
          </select>
          <button
            type="button"
            onClick={handleAddMedication}
            className="sm:col-span-1 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center justify-center cursor-pointer"
            title={isAr ? 'إضافة للجدول الدوائي' : 'Add medication'}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Timeline List */}
      {meds.length === 0 ? (
        <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
          {isAr
            ? 'لا توجد أدوية مسجلة في الجدول اليومي. أضف الأدوية أعلاه لتحليل تداخلاتها مع العلاج الطبيعي.'
            : 'No active medications scheduled. Add medications above to track dosing and PT precautions.'}
        </div>
      ) : (
        <div className="space-y-2">
          {meds.map((med) => {
            const meta = CATEGORY_META[med.category];
            return (
              <div
                key={med.id}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 flex flex-wrap items-center justify-between gap-3 hover:border-teal-500/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(med.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border transition-all cursor-pointer tabular-nums ${
                      med.status === 'taken'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : med.status === 'missed'
                        ? 'bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                        : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {med.timeSlot} •{' '}
                    {med.status === 'taken'
                      ? isAr
                        ? 'تم أخذها'
                        : 'Taken'
                      : med.status === 'missed'
                      ? isAr
                        ? 'فائتة'
                        : 'Missed'
                      : isAr
                      ? 'مجدولة'
                      : 'Scheduled'}
                  </button>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {med.name}
                      </span>
                      <span className="text-xs font-mono font-semibold text-teal-600 dark:text-teal-400 tabular-nums">
                        {med.dosage}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${meta.badgeClass}`}>
                        {isAr ? meta.labelAr : meta.labelEn}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {isAr ? meta.precautionAr : meta.precautionEn}
                    </p>
                  </div>
                </div>

                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleDelete(med.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Physical Therapy Precaution Banner if Anticoagulant or NSAID active */}
      {activePrecautions.some((m) => m.category === 'anticoagulant') && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center gap-2.5 text-xs text-rose-800 dark:text-rose-200">
          <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
          <span className="font-semibold">
            {isAr
              ? 'تنبيه سريري حرج: المريض يتناول مميعات دم — يُحظر الوخز بالإبر الجافة العميقة أو تحريك الأنسجة الرخوة العنيف.'
              : 'Critical PT Alert: Patient is on Anticoagulants — Avoid deep dry needling and high-force instrument-assisted soft tissue mobilization.'}
          </span>
        </div>
      )}
    </div>
  );
};
