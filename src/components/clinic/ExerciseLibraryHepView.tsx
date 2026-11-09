// =======================================================================
// PhysioRecord — Searchable PT Exercise Library & HEP Builder (Phase 6)
// Filter by Region, Goal, and Equipment with Printable Bilingual HEP Sheet
// =======================================================================

import React, { useState, useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { PT_EXERCISE_CATALOG } from '../../services/clinicOperationsService';
import { localDate } from '../../utils/date';
import type {
  ExerciseAnatomicalRegion,
  ExerciseTherapeuticGoal,
  ExerciseLibraryItem,
  HepPrescriptionItem,
} from '../../types/clinicManagement';
import {
  Search,
  Dumbbell,
  Plus,
  Printer,
  CheckCircle2,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

interface ExerciseLibraryHepViewProps {
  embeddedHepProgram?: HepPrescriptionItem[];
  onUpdateEmbeddedHep?: (updated: HepPrescriptionItem[]) => void;
  patientName?: string;
  episodeTitle?: string;
}

export const ExerciseLibraryHepView: React.FC<ExerciseLibraryHepViewProps> = ({
  embeddedHepProgram,
  onUpdateEmbeddedHep,
  patientName,
  episodeTitle,
}) => {
  const { language, isRtl } = useLanguage();
  const isAr = language === 'ar';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegion, setSelectedRegion] = useState<ExerciseAnatomicalRegion | 'all'>('all');
  const [selectedGoal, setSelectedGoal] = useState<ExerciseTherapeuticGoal | 'all'>('all');
  const [localHepList, setLocalHepList] = useState<HepPrescriptionItem[]>([]);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const activeHepList = embeddedHepProgram !== undefined ? embeddedHepProgram : localHepList;
  const setHepList = (updated: HepPrescriptionItem[]) => {
    if (onUpdateEmbeddedHep) {
      onUpdateEmbeddedHep(updated);
    } else {
      setLocalHepList(updated);
    }
  };

  const regionLabels: Record<ExerciseAnatomicalRegion | 'all', { ar: string; en: string }> = {
    all: { ar: 'جميع المناطق التشريحية', en: 'All Regions' },
    cervical: { ar: 'الرقبة والعمود العنقي', en: 'Cervical Spine' },
    shoulder: { ar: 'الكتف ولوح الكتف', en: 'Shoulder Complex' },
    elbow_wrist: { ar: 'المرفق والرسغ واليد', en: 'Elbow, Wrist & Hand' },
    thoracic_lumbar: { ar: 'أسفل الظهر والعمود القطني', en: 'Thoracic & Lumbar Spine' },
    hip_pelvis: { ar: 'الورك والحوض', en: 'Hip & Pelvis' },
    knee: { ar: 'مفصل الركبة', en: 'Knee Joint' },
    ankle_foot: { ar: 'الكاحل والقدم', en: 'Ankle & Foot' },
    neuro_balance: { ar: 'التوازن والتأهيل العصبي', en: 'Neuro & Balance' },
  };

  const goalLabels: Record<ExerciseTherapeuticGoal | 'all', { ar: string; en: string }> = {
    all: { ar: 'جميع الأهداف العلاجية', en: 'All Goals' },
    mobility_rom: { ar: 'تحسين المدى الحركي (ROM)', en: 'ROM & Mobility' },
    strengthening: { ar: 'التقوية العضلية المتدرجة', en: 'Progressive Strengthening' },
    core_stability: { ar: 'الثبات المحوري والعميق', en: 'Core & Spinal Stability' },
    stretching_flexibility: { ar: 'الاستطالة والمرونة', en: 'Stretching & Flexibility' },
    neuromuscular_balance: { ar: 'التحكم العصبي العضلي والتوازن', en: 'Neuromuscular & Balance' },
    pain_modulation: { ar: 'تخفيف الألم والمركزية (McKenzie)', en: 'Pain Modulation' },
  };

  const filteredExercises = useMemo(() => {
    return PT_EXERCISE_CATALOG.filter((ex) => {
      const matchRegion = selectedRegion === 'all' || ex.region === selectedRegion;
      const matchGoal = selectedGoal === 'all' || ex.goal === selectedGoal;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        ex.nameAr.toLowerCase().includes(q) ||
        ex.nameEn.toLowerCase().includes(q) ||
        ex.instructionsAr.toLowerCase().includes(q);
      return matchRegion && matchGoal && matchSearch;
    });
  }, [searchQuery, selectedRegion, selectedGoal]);

  const handleAssignToHep = (ex: ExerciseLibraryItem) => {
    if (activeHepList.some((h) => h.exerciseId === ex.id)) return;
    const newItem: HepPrescriptionItem = {
      id: `hep_${Date.now()}_${ex.id}`,
      exerciseId: ex.id,
      nameAr: ex.nameAr,
      nameEn: ex.nameEn,
      region: ex.region,
      sets: ex.defaultSets,
      reps: ex.defaultReps,
      holdSeconds: ex.defaultHoldSeconds,
      frequencyPerDay: 2,
      daysPerWeek: 5,
      loadOrBand: ex.defaultLoadOrBand,
      instructionsAr: ex.instructionsAr,
      instructionsEn: ex.instructionsEn,
      complianceStatus: 'full',
    };
    setHepList([...activeHepList, newItem]);
  };

  const handleUpdateHepDosage = (
    id: string,
    field: keyof HepPrescriptionItem,
    val: number | string
  ) => {
    setHepList(
      activeHepList.map((item) => (item.id === id ? { ...item, [field]: val } : item))
    );
  };

  const handleRemoveHepItem = (id: string) => {
    setHepList(activeHepList.filter((item) => item.id !== id));
  };

  return (
    <div
      className={
        embeddedHepProgram !== undefined
          ? 'space-y-5'
          : 'max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6'
      }
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Dumbbell className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <span>
              {isAr
                ? 'مكتبة التمارين العلاجية وبناء البرنامج المنزلي (Exercise Library & HEP)'
                : 'Therapeutic Exercise Library & Home Exercise Program (HEP) Builder'}
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isAr
              ? 'ابحث حسب المنطقة التشريحية أو الهدف العلاجي، وحدد الجرعة الحركية (Sets × Reps × Hold) لوصفة المريض المنزلية.'
              : 'Filter exercises by region and therapeutic goal, customize dosage, and build patient HEP prescriptions.'}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowPrintPreview(!showPrintPreview)}
          className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-2 cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>
            {showPrintPreview
              ? isAr
                ? 'العودة لمكتبة التمارين'
                : 'Back to Exercise Library'
              : isAr
              ? `معاينة وطباعة البرنامج المنزلي (${activeHepList.length})`
              : `Patient HEP Sheet (${activeHepList.length})`}
          </span>
        </button>
      </div>

      {showPrintPreview ? (
        /* Printable Patient Home Exercise Program (HEP) Card */
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-white">
                {isAr
                  ? 'البرنامج العلاجي المنزلي للمريض (Home Exercise Program - HEP)'
                  : 'Patient Home Exercise Program (HEP)'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {patientName ? `${isAr ? 'المريض: ' : 'Patient: '}${patientName} · ` : ''}
                {episodeTitle || (isAr ? 'خطة التأهيل الحركي' : 'Rehabilitation Plan')}
              </p>
            </div>
            <div className="text-xs font-mono text-slate-500">
              {localDate()}
            </div>
          </div>

          {activeHepList.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-8">
              {isAr
                ? 'لم تتم إضافة تمارين للبرنامج المنزلي بعد. اختر تمارين من المكتبة أدناه.'
                : 'No exercises assigned to HEP yet.'}
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeHepList.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-teal-600 text-white font-mono font-bold text-xs flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          {item.nameAr}
                        </h4>
                        <p className="text-[11px] text-slate-500">{item.nameEn}</p>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {isAr ? item.instructionsAr : item.instructionsEn}
                  </p>

                  <div className="pt-2 border-t border-slate-200 dark:border-slate-800 grid grid-cols-4 gap-2 text-center font-mono text-xs tabular-nums">
                    <div className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <div className="text-[10px] text-slate-400">{isAr ? 'جولات' : 'Sets'}</div>
                      <div className="font-bold text-teal-600 dark:text-teal-400">{item.sets}</div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <div className="text-[10px] text-slate-400">{isAr ? 'تكرار' : 'Reps'}</div>
                      <div className="font-bold text-teal-600 dark:text-teal-400">{item.reps}</div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <div className="text-[10px] text-slate-400">{isAr ? 'ثبات (ث)' : 'Hold (s)'}</div>
                      <div className="font-bold text-teal-600 dark:text-teal-400">
                        {item.holdSeconds}s
                      </div>
                    </div>
                    <div className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                      <div className="text-[10px] text-slate-400">{isAr ? 'يومياً' : 'Daily'}</div>
                      <div className="font-bold text-teal-600 dark:text-teal-400">
                        {item.frequencyPerDay}x
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Columns: Searchable Exercise Catalog */}
          <div className="lg:col-span-2 space-y-4">
            {/* Search & Filters */}
            <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isAr ? 'بحث باسم التمرين...' : 'Search exercise...'}
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <select
                value={selectedRegion}
                onChange={(e) => setSelectedRegion(e.target.value as ExerciseAnatomicalRegion | 'all')}
                className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-semibold"
              >
                {Object.entries(regionLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {isAr ? v.ar : v.en}
                  </option>
                ))}
              </select>

              <select
                value={selectedGoal}
                onChange={(e) => setSelectedGoal(e.target.value as ExerciseTherapeuticGoal | 'all')}
                className="px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-semibold"
              >
                {Object.entries(goalLabels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {isAr ? v.ar : v.en}
                  </option>
                ))}
              </select>
            </div>

            {/* Catalog Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredExercises.map((ex) => {
                const isAdded = activeHepList.some((h) => h.exerciseId === ex.id);
                return (
                  <div
                    key={ex.id}
                    className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>{isAr ? regionLabels[ex.region].ar : regionLabels[ex.region].en}</span>
                        <span>·</span>
                        <span>{isAr ? goalLabels[ex.goal].ar : goalLabels[ex.goal].en}</span>
                      </div>

                      <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                        {isAr ? ex.nameAr : ex.nameEn}
                      </h3>

                      <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                        {isAr ? ex.instructionsAr : ex.instructionsEn}
                      </p>

                      {ex.precautionsAr && (
                        <div className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>{isAr ? ex.precautionsAr : ex.precautionsEn}</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <span className="text-[11px] font-mono text-slate-500 tabular-nums">
                        {ex.defaultSets} × {ex.defaultReps}{' '}
                        {ex.defaultHoldSeconds > 0 ? `(${ex.defaultHoldSeconds}s)` : ''} ·{' '}
                        {ex.defaultLoadOrBand}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleAssignToHep(ex)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer ${
                          isAdded
                            ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-teal-600 hover:bg-teal-500 text-white'
                        }`}
                      >
                        {isAdded ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{isAr ? 'مضاف للبرنامج' : 'Assigned'}</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>{isAr ? 'إضافة لـ HEP' : 'Add to HEP'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column: Active HEP Prescription Builder */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden h-fit">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isAr ? 'وصفة التمارين المنزلية (Active HEP)' : 'Assigned HEP Prescription'}
              </h3>
              <span className="text-xs font-mono font-bold text-teal-600 dark:text-teal-400 tabular-nums">
                {activeHepList.length}
              </span>
            </div>

            {activeHepList.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                {isAr
                  ? 'انقر على "إضافة لـ HEP" بجانب أي تمرين لتخصيص الجرعة الحركية للمريض.'
                  : 'Click "Add to HEP" on any exercise to customize patient dosage.'}
              </div>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {activeHepList.map((item) => (
                  <div key={item.id} className="p-4 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {isAr ? item.nameAr : item.nameEn}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveHepItem(item.id)}
                        className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-xs font-mono tabular-nums">
                      <div>
                        <label className="text-[10px] text-slate-500 block">
                          {isAr ? 'الجولات (Sets)' : 'Sets'}
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={item.sets}
                          onChange={(e) =>
                            handleUpdateHepDosage(item.id, 'sets', Number(e.target.value))
                          }
                          className="w-full px-2 py-1 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block">
                          {isAr ? 'التكرار (Reps)' : 'Reps'}
                        </label>
                        <input
                          type="number"
                          min="1"
                          value={item.reps}
                          onChange={(e) =>
                            handleUpdateHepDosage(item.id, 'reps', Number(e.target.value))
                          }
                          className="w-full px-2 py-1 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 block">
                          {isAr ? 'ثبات (Hold s)' : 'Hold (s)'}
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={item.holdSeconds}
                          onChange={(e) =>
                            handleUpdateHepDosage(item.id, 'holdSeconds', Number(e.target.value))
                          }
                          className="w-full px-2 py-1 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
