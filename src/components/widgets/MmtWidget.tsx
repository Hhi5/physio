// =======================================================================
// PhysioRecord — Modern MMT Manual Muscle Strength Testing Widget
// Medical Research Council (MRC Scale 0-5) with Bilateral Testing
// =======================================================================

import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type { MmtAssessmentBatteryData, MmtMeasurementEntry, MmtGradeValue, BodyLaterality } from '../../types/clinical';
import { MMT_MUSCLE_GROUPS_CATALOG, MRC_GRADES_CATALOG } from '../../data/clinicalToolkit/romMmtCatalog';
import { Dumbbell, CheckCircle2, ChevronRight, Info } from 'lucide-react';

interface MmtWidgetProps {
  value: MmtAssessmentBatteryData | undefined;
  onChange: (updated: MmtAssessmentBatteryData) => void;
  readOnly?: boolean;
}

const PRIMARY_GRADES: MmtGradeValue[] = ['0', '1', '2', '3', '4', '5'];

export const MmtWidget: React.FC<MmtWidgetProps> = ({
  value,
  onChange,
  readOnly = false,
}) => {
  const { language, isRtl } = useLanguage();
  const isAr = language === 'ar';

  const [activeRegion, setActiveRegion] = useState<'upper' | 'lower' | 'spine'>('upper');

  const entries = value?.entries || [];

  const getFilteredMuscles = () => {
    switch (activeRegion) {
      case 'upper':
        return MMT_MUSCLE_GROUPS_CATALOG.filter((m) =>
          ['shoulder', 'elbow', 'wrist'].some((part) => m.muscleGroupId.includes(part))
        );
      case 'lower':
        return MMT_MUSCLE_GROUPS_CATALOG.filter((m) =>
          ['hip', 'knee', 'ankle'].some((part) => m.muscleGroupId.includes(part))
        );
      case 'spine':
        return MMT_MUSCLE_GROUPS_CATALOG.filter((m) =>
          m.muscleGroupId.includes('cervical') || m.muscleGroupId.includes('trunk')
        );
      default:
        return MMT_MUSCLE_GROUPS_CATALOG;
    }
  };

  const handleSetGrade = (
    muscleGroupId: string,
    laterality: BodyLaterality,
    grade: MmtGradeValue | null
  ) => {
    if (readOnly) return;

    const muscleDef = MMT_MUSCLE_GROUPS_CATALOG.find((m) => m.muscleGroupId === muscleGroupId);
    const existingIndex = entries.findIndex(
      (e) => e.muscleGroupId === muscleGroupId && e.laterality === laterality
    );

    const updatedEntries = [...entries];

    if (existingIndex >= 0) {
      if (grade === null) {
        updatedEntries.splice(existingIndex, 1);
      } else {
        updatedEntries[existingIndex] = {
          ...updatedEntries[existingIndex],
          gradeValue: grade,
          isTested: true,
        };
      }
    } else if (grade !== null) {
      const newEntry: MmtMeasurementEntry = {
        entryId: typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `mmt-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        muscleGroupId,
        muscleNameAr: muscleDef?.nameAr || muscleGroupId,
        muscleNameEn: muscleDef?.nameEn || muscleGroupId,
        actionNameAr: muscleDef?.actionNameAr || '',
        actionNameEn: muscleDef?.actionNameEn || '',
        laterality,
        gravityCondition: ['0', '1', '2-', '2', '2+'].includes(grade)
          ? 'gravity_eliminated'
          : 'against_gravity',
        isTested: true,
        gradeValue: grade,
      };
      updatedEntries.push(newEntry);
    }

    onChange({
      batteryVersion: '1.0.0',
      entries: updatedEntries,
      updatedAt: new Date().toISOString(),
    });
  };

  const getGradeValue = (muscleGroupId: string, laterality: BodyLaterality): MmtGradeValue | null => {
    const found = entries.find(
      (e) => e.muscleGroupId === muscleGroupId && e.laterality === laterality
    );
    return found?.gradeValue ?? null;
  };

  const getGradeBadgeStyle = (grade: MmtGradeValue | null) => {
    if (!grade) return 'bg-slate-100 dark:bg-slate-800 text-slate-400';
    switch (grade) {
      case '5':
        return 'bg-emerald-600 text-white font-bold shadow-xs';
      case '4':
        return 'bg-teal-600 text-white font-bold shadow-xs';
      case '3':
        return 'bg-amber-500 text-white font-bold shadow-xs';
      case '2':
        return 'bg-orange-500 text-white font-bold shadow-xs';
      case '1':
        return 'bg-rose-500 text-white font-bold shadow-xs';
      case '0':
        return 'bg-red-700 text-white font-bold shadow-xs';
      default:
        return 'bg-slate-200 text-slate-800';
    }
  };

  const filteredMuscles = getFilteredMuscles();

  return (
    <div className="space-y-4">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
        <div className="flex items-center gap-1.5">
          <Dumbbell className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            {isAr ? 'المنطقة العضلية:' : 'Muscle Region:'}
          </span>
          <div className="flex items-center bg-white dark:bg-slate-900 rounded-lg p-1 border border-slate-200 dark:border-slate-700 text-xs">
            <button
              type="button"
              onClick={() => setActiveRegion('upper')}
              className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                activeRegion === 'upper'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {isAr ? 'الطرف العلوي' : 'Upper Extremity'}
            </button>
            <button
              type="button"
              onClick={() => setActiveRegion('lower')}
              className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                activeRegion === 'lower'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {isAr ? 'الطرف السفلي' : 'Lower Extremity'}
            </button>
            <button
              type="button"
              onClick={() => setActiveRegion('spine')}
              className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                activeRegion === 'spine'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {isAr ? 'العمود الفقري' : 'Spine / Axial'}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {isAr ? `العضلات المختبرة: ${entries.length}` : `Tested Muscles: ${entries.length}`}
          </span>
        </div>
      </div>

      {/* Muscle List Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredMuscles.map((muscle) => {
          const isMidline = muscle.applicableLateralities.includes('midline');
          const leftGrade = getGradeValue(muscle.muscleGroupId, 'left');
          const rightGrade = getGradeValue(muscle.muscleGroupId, 'right');
          const midlineGrade = getGradeValue(muscle.muscleGroupId, 'midline');

          return (
            <div
              key={muscle.muscleGroupId}
              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-850 hover:border-slate-300 dark:hover:border-slate-600 transition-colors space-y-3"
            >
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {isAr ? muscle.nameAr : muscle.nameEn}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {isAr ? muscle.actionNameAr : muscle.actionNameEn}
                </p>
              </div>

              {isMidline ? (
                <div className="space-y-1 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">
                      {isAr ? 'درجة القوة:' : 'Strength Grade:'}
                    </span>
                    <span className="font-bold text-xs text-teal-600 dark:text-teal-400">
                      {midlineGrade ? `MRC Grade ${midlineGrade}` : isAr ? 'غير مختبر' : 'Untested'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {PRIMARY_GRADES.map((g) => (
                      <button
                        key={g}
                        type="button"
                        disabled={readOnly}
                        onClick={() =>
                          handleSetGrade(
                            muscle.muscleGroupId,
                            'midline',
                            midlineGrade === g ? null : g
                          )
                        }
                        className={`flex-1 py-1 rounded-md text-xs font-bold font-mono transition-all border ${
                          midlineGrade === g
                            ? getGradeBadgeStyle(g) + ' border-transparent'
                            : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                  {/* Right Side */}
                  <div className="space-y-1 p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {isAr ? 'الأيمن (R):' : 'Right:'}
                      </span>
                      <span className="font-mono font-bold text-teal-600 dark:text-teal-400">
                        {rightGrade ? `G${rightGrade}` : '-'}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {PRIMARY_GRADES.map((g) => (
                        <button
                          key={g}
                          type="button"
                          disabled={readOnly}
                          onClick={() =>
                            handleSetGrade(
                              muscle.muscleGroupId,
                              'right',
                              rightGrade === g ? null : g
                            )
                          }
                          className={`flex-1 py-1 text-[11px] font-bold font-mono rounded transition-all ${
                            rightGrade === g
                              ? getGradeBadgeStyle(g)
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Left Side */}
                  <div className="space-y-1 p-2 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {isAr ? 'الأيسر (L):' : 'Left:'}
                      </span>
                      <span className="font-mono font-bold text-teal-600 dark:text-teal-400">
                        {leftGrade ? `G${leftGrade}` : '-'}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5">
                      {PRIMARY_GRADES.map((g) => (
                        <button
                          key={g}
                          type="button"
                          disabled={readOnly}
                          onClick={() =>
                            handleSetGrade(
                              muscle.muscleGroupId,
                              'left',
                              leftGrade === g ? null : g
                            )
                          }
                          className={`flex-1 py-1 text-[11px] font-bold font-mono rounded transition-all ${
                            leftGrade === g
                              ? getGradeBadgeStyle(g)
                              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
