// =======================================================================
// PhysioRecord — Modern Expansive Neurological Screening Widget
// Dermatomes (OrganUI Interactive Map), Myotomes (Motor), and DTR Reflexes
// =======================================================================

import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type {
  NeuroScreeningBatteryData,
  ReflexGradeValue,
  MmtGradeValue,
  DermatomeSensoryEntry,
} from '../../types/clinical';
import { OrganDermatomeMap } from '../organui/OrganDermatomeMap';

interface NeuroWidgetProps {
  value: NeuroScreeningBatteryData | undefined;
  onChange: (updated: NeuroScreeningBatteryData) => void;
  readOnly?: boolean;
}

const DEFAULT_MYOTOMES = [
  { root: 'C5', en: 'Shoulder Abduction', ar: 'تبعيد الكتف' },
  { root: 'C6', en: 'Elbow Flexion / Wrist Ext', ar: 'ثني المرفق / بسط الرسغ' },
  { root: 'C7', en: 'Elbow Ext / Wrist Flex', ar: 'بسط المرفق / ثني الرسغ' },
  { root: 'C8', en: 'Finger Flexion', ar: 'ثني الأصابع' },
  { root: 'T1', en: 'Finger Abduction', ar: 'تبعيد الأصابع' },
  { root: 'L2', en: 'Hip Flexion', ar: 'ثني الورك' },
  { root: 'L3', en: 'Knee Extension', ar: 'بسط الركبة' },
  { root: 'L4', en: 'Ankle Dorsiflexion', ar: 'العطف الظهري للكاحل' },
  { root: 'L5', en: 'Great Toe Extension', ar: 'بسط إبهام القدم' },
  { root: 'S1', en: 'Ankle Plantarflexion', ar: 'العطف الأخمصي للكاحل' },
];

const DEFAULT_REFLEXES = [
  { id: 'biceps', root: 'C5-C6', en: 'Biceps Reflex', ar: 'منعكس العضلة ذات الرأسين' },
  { id: 'brachioradialis', root: 'C6', en: 'Brachioradialis Reflex', ar: 'منعكس العضدية الكعبرية' },
  { id: 'triceps', root: 'C7', en: 'Triceps Reflex', ar: 'منعكس العضلة ثلاثية الرؤوس' },
  { id: 'patellar', root: 'L3-L4', en: 'Patellar (Knee Jerk)', ar: 'منعكس الرضفة (نفضة الركبة)' },
  { id: 'achilles', root: 'S1', en: 'Achilles (Ankle Jerk)', ar: 'منعكس وتر العرقوب (الكاحل)' },
] as const;

export const NeuroWidget: React.FC<NeuroWidgetProps> = ({
  value,
  onChange,
  readOnly = false,
}) => {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const [activeTab, setActiveTab] = useState<'dermatomes' | 'reflexes' | 'myotomes'>('dermatomes');

  const dermatomes = value?.dermatomes || [];
  const myotomes = value?.myotomes || [];
  const reflexes = value?.reflexes || [];
  const clinicalNotes = value?.clinicalNotes || '';

  const handleUpdateDermatomes = (updatedDermatomes: DermatomeSensoryEntry[]) => {
    if (readOnly) return;
    onChange({
      batteryVersion: '1.0.0',
      dermatomes: updatedDermatomes,
      myotomes,
      reflexes,
      clinicalNotes,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleUpdateReflex = (
    reflexId: 'biceps' | 'brachioradialis' | 'triceps' | 'patellar' | 'achilles',
    side: 'right' | 'left',
    grade: ReflexGradeValue
  ) => {
    if (readOnly) return;
    const refConfig = DEFAULT_REFLEXES.find((r) => r.id === reflexId);
    const existingIndex = reflexes.findIndex((r) => r.reflexId === reflexId);
    const updatedReflexes = [...reflexes];

    if (existingIndex >= 0) {
      updatedReflexes[existingIndex] = {
        ...updatedReflexes[existingIndex],
        [side === 'right' ? 'rightGrade' : 'leftGrade']: grade,
      };
    } else {
      updatedReflexes.push({
        reflexId,
        reflexLabelEn: refConfig?.en || reflexId,
        reflexLabelAr: refConfig?.ar || reflexId,
        rootLevel: refConfig?.root || '',
        rightGrade: side === 'right' ? grade : null,
        leftGrade: side === 'left' ? grade : null,
      });
    }

    onChange({
      batteryVersion: '1.0.0',
      dermatomes,
      myotomes,
      reflexes: updatedReflexes,
      clinicalNotes,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleUpdateMyotome = (
    rootLevel: string,
    side: 'right' | 'left',
    grade: MmtGradeValue | 'NT' | null
  ) => {
    if (readOnly) return;
    const myoConfig = DEFAULT_MYOTOMES.find((m) => m.root === rootLevel);
    const existingIndex = myotomes.findIndex((m) => m.rootLevel === rootLevel);
    const updatedMyotomes = [...myotomes];

    if (existingIndex >= 0) {
      updatedMyotomes[existingIndex] = {
        ...updatedMyotomes[existingIndex],
        [side === 'right' ? 'rightGrade' : 'leftGrade']: grade,
      };
    } else {
      updatedMyotomes.push({
        rootLevel,
        movementLabelEn: myoConfig?.en || '',
        movementLabelAr: myoConfig?.ar || '',
        rightGrade: side === 'right' ? grade : null,
        leftGrade: side === 'left' ? grade : null,
      });
    }

    onChange({
      batteryVersion: '1.0.0',
      dermatomes,
      myotomes: updatedMyotomes,
      reflexes,
      clinicalNotes,
      updatedAt: new Date().toISOString(),
    });
  };

  const getReflexGrade = (
    reflexId: 'biceps' | 'brachioradialis' | 'triceps' | 'patellar' | 'achilles',
    side: 'right' | 'left'
  ): ReflexGradeValue | null => {
    const found = reflexes.find((r) => r.reflexId === reflexId);
    return side === 'right' ? found?.rightGrade ?? null : found?.leftGrade ?? null;
  };

  const getMyotomeGrade = (rootLevel: string, side: 'right' | 'left'): string | null => {
    const found = myotomes.find((m) => m.rootLevel === rootLevel);
    return side === 'right' ? found?.rightGrade ?? null : found?.leftGrade ?? null;
  };

  const REFLEX_GRADES: ReflexGradeValue[] = ['0', '1+', '2+', '3+', '4+'];

  return (
    <div className="space-y-4">
      {/* Sub-tab switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-1.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700/80">
        <div className="flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('dermatomes')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'dermatomes'
                ? 'bg-teal-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700'
            }`}
          >
            {isAr ? 'خريطة القطاعات الجلدية (OrganUI Dermatomes)' : 'Interactive Dermatomes (C2–S5)'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reflexes')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'reflexes'
                ? 'bg-teal-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700'
            }`}
          >
            {isAr ? 'المنعكسات الوترية العميقة (DTR)' : 'Deep Tendon Reflexes (DTR)'}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('myotomes')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'myotomes'
                ? 'bg-teal-600 text-white shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-700'
            }`}
          >
            {isAr ? 'القطع العضلية العصبية (Myotomes)' : 'Key Motor Myotomes'}
          </button>
        </div>

        <span className="text-[11px] text-teal-700 dark:text-teal-400 font-semibold px-2">
          {activeTab === 'dermatomes'
            ? isAr
              ? 'معيار ASIA الحسي ثنائي الجانب'
              : 'ASIA ISNCSCI Sensory Mapping'
            : activeTab === 'reflexes'
            ? isAr
              ? '2+ يمثل الاستجابة الطبيعية'
              : '2+ represents normal reflex'
            : isAr
            ? 'فحص القوة العصبية للجذور C5-S1'
            : 'Motor root screening C5-S1'}
        </span>
      </div>

      {/* Tab 1: OrganUI Interactive Dermatome Map */}
      {activeTab === 'dermatomes' && (
        <OrganDermatomeMap
          value={dermatomes}
          onChange={handleUpdateDermatomes}
          readOnly={readOnly}
        />
      )}

      {/* Tab 2: Reflexes View */}
      {activeTab === 'reflexes' && (
        <div className="space-y-2.5">
          {DEFAULT_REFLEXES.map((ref) => {
            const rGrade = getReflexGrade(ref.id, 'right');
            const lGrade = getReflexGrade(ref.id, 'left');

            return (
              <div
                key={ref.id}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div className="min-w-[180px]">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800 font-mono">
                      {ref.root}
                    </span>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                      {isAr ? ref.ar : ref.en}
                    </h4>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 flex-1">
                  {/* Right */}
                  <div className="flex items-center justify-between gap-1 p-1.5 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 px-1">
                      {isAr ? 'الأيمن (R):' : 'Right:'}
                    </span>
                    <div className="flex items-center gap-0.5">
                      {REFLEX_GRADES.map((g) => (
                        <button
                          key={g}
                          type="button"
                          disabled={readOnly}
                          onClick={() => handleUpdateReflex(ref.id, 'right', g)}
                          className={`px-2 py-0.5 text-[11px] font-mono font-bold rounded transition-colors cursor-pointer tabular-nums ${
                            rGrade === g
                              ? g === '2+'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-teal-600 text-white'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Left */}
                  <div className="flex items-center justify-between gap-1 p-1.5 bg-slate-50 dark:bg-slate-950 rounded-lg border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 px-1">
                      {isAr ? 'الأيسر (L):' : 'Left:'}
                    </span>
                    <div className="flex items-center gap-0.5">
                      {REFLEX_GRADES.map((g) => (
                        <button
                          key={g}
                          type="button"
                          disabled={readOnly}
                          onClick={() => handleUpdateReflex(ref.id, 'left', g)}
                          className={`px-2 py-0.5 text-[11px] font-mono font-bold rounded transition-colors cursor-pointer tabular-nums ${
                            lGrade === g
                              ? g === '2+'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-teal-600 text-white'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 3: Myotomes View */}
      {activeTab === 'myotomes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {DEFAULT_MYOTOMES.map((myo) => {
            const rGrade = getMyotomeGrade(myo.root, 'right');
            const lGrade = getMyotomeGrade(myo.root, 'left');

            return (
              <div
                key={myo.root}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-6 rounded-md font-bold font-mono text-xs flex items-center justify-center bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800">
                      {myo.root}
                    </span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {isAr ? myo.ar : myo.en}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center justify-between p-1.5 bg-slate-50 dark:bg-slate-950 rounded-lg text-xs">
                    <span className="text-[11px] font-bold text-slate-500">R:</span>
                    <div className="flex items-center gap-1 font-mono tabular-nums">
                      {(['5', '4', '3', '2', '0'] as MmtGradeValue[]).map((g) => (
                        <button
                          key={g}
                          type="button"
                          disabled={readOnly}
                          onClick={() => handleUpdateMyotome(myo.root, 'right', rGrade === g ? null : g)}
                          className={`w-5 h-5 text-[10px] font-bold rounded cursor-pointer ${
                            rGrade === g
                              ? 'bg-teal-600 text-white'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-1.5 bg-slate-50 dark:bg-slate-950 rounded-lg text-xs">
                    <span className="text-[11px] font-bold text-slate-500">L:</span>
                    <div className="flex items-center gap-1 font-mono tabular-nums">
                      {(['5', '4', '3', '2', '0'] as MmtGradeValue[]).map((g) => (
                        <button
                          key={g}
                          type="button"
                          disabled={readOnly}
                          onClick={() => handleUpdateMyotome(myo.root, 'left', lGrade === g ? null : g)}
                          className={`w-5 h-5 text-[10px] font-bold rounded cursor-pointer ${
                            lGrade === g
                              ? 'bg-teal-600 text-white'
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Clinical Notes */}
      <div>
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
          {isAr ? 'ملاحظات الفحص العصبي (Dermatomal pattern / Babinski / Clonus):' : 'Neurological Findings Notes:'}
        </label>
        <textarea
          rows={2}
          value={clinicalNotes}
          disabled={readOnly}
          onChange={(e) =>
            onChange({
              batteryVersion: '1.0.0',
              dermatomes,
              myotomes,
              reflexes,
              clinicalNotes: e.target.value,
              updatedAt: new Date().toISOString(),
            })
          }
          placeholder={
            isAr
              ? 'مثال: لا يوجد نقص حس جلدي واضح، منعكس الرضفة متماثل بالجهتين (2+)، عدم وجود استجابة بابينسكي مرضية...'
              : 'e.g., Sensation intact across L4-S1 dermatomes, Babinski negative, no clonus detected...'
          }
          className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-teal-500"
        />
      </div>
    </div>
  );
};
