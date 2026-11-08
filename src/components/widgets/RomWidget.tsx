// =======================================================================
// PhysioRecord — Modern Expansive ROM Goniometric Assessment Widget
// =======================================================================

import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type { RomAssessmentBatteryData, RomMeasurementEntry, RomMovementType, BodyLaterality } from '../../types/clinical';
import { ROM_JOINTS_CATALOG, ROM_MOVEMENT_TYPES, ROM_END_FEELS } from '../../data/clinicalToolkit/romMmtCatalog';
import { Activity, Plus, Trash2, CheckCircle2, ChevronRight, Gauge } from 'lucide-react';

interface RomWidgetProps {
  value: RomAssessmentBatteryData | undefined;
  onChange: (updated: RomAssessmentBatteryData) => void;
  readOnly?: boolean;
}

export const RomWidget: React.FC<RomWidgetProps> = ({
  value,
  onChange,
  readOnly = false,
}) => {
  const { language, isRtl } = useLanguage();
  const isAr = language === 'ar';

  const [selectedJointId, setSelectedJointId] = useState<string>('shoulder');
  const [movementType, setMovementType] = useState<RomMovementType>('AROM');

  const entries = value?.entries || [];

  const currentJointConfig = ROM_JOINTS_CATALOG.find((j) => j.jointId === selectedJointId) || ROM_JOINTS_CATALOG[0];

  const handleUpdateEntry = (
    jointId: string,
    movementId: string,
    laterality: BodyLaterality,
    angle: number | null
  ) => {
    if (readOnly) return;

    const existingIndex = entries.findIndex(
      (e) => e.jointId === jointId && e.movementId === movementId && e.laterality === laterality
    );

    const jointDef = ROM_JOINTS_CATALOG.find((j) => j.jointId === jointId);
    const movDef = jointDef?.movements.find((m) => m.movementId === movementId);

    const updatedEntries = [...entries];

    if (existingIndex >= 0) {
      if (angle === null) {
        updatedEntries.splice(existingIndex, 1);
      } else {
        updatedEntries[existingIndex] = {
          ...updatedEntries[existingIndex],
          measuredAngleDegrees: angle,
          movementType,
          isTested: true,
        };
      }
    } else if (angle !== null) {
      const newEntry: RomMeasurementEntry = {
        entryId: typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `rom-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        jointId,
        jointNameAr: jointDef?.nameAr || jointId,
        jointNameEn: jointDef?.nameEn || jointId,
        movementId,
        movementNameAr: movDef?.nameAr || movementId,
        movementNameEn: movDef?.nameEn || movementId,
        movementType,
        laterality,
        isTested: true,
        measuredAngleDegrees: angle,
      };
      updatedEntries.push(newEntry);
    }

    onChange({
      batteryVersion: '1.0.0',
      entries: updatedEntries,
      updatedAt: new Date().toISOString(),
    });
  };

  const getEntryValue = (jointId: string, movementId: string, laterality: BodyLaterality) => {
    const found = entries.find(
      (e) => e.jointId === jointId && e.movementId === movementId && e.laterality === laterality
    );
    return found?.measuredAngleDegrees ?? null;
  };

  return (
    <div className="space-y-4">
      {/* Top Bar: Movement Type Toggle & Tested Count */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
        <div className="flex items-center gap-1.5">
          <Gauge className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
            {isAr ? 'نوع قياس المدى الحركي:' : 'Measurement Type:'}
          </span>
          <div className="flex items-center bg-white dark:bg-slate-900 rounded-lg p-1 border border-slate-200 dark:border-slate-700 text-xs">
            {(Object.keys(ROM_MOVEMENT_TYPES) as RomMovementType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setMovementType(type)}
                className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                  movementType === type
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {isAr
              ? `الحركات الموثقة: ${entries.length}`
              : `Recorded Movements: ${entries.length}`}
          </span>
        </div>
      </div>

      {/* Joint Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {ROM_JOINTS_CATALOG.map((joint) => {
          const isSelected = selectedJointId === joint.jointId;
          const jointEntriesCount = entries.filter((e) => e.jointId === joint.jointId).length;

          return (
            <button
              key={joint.jointId}
              type="button"
              onClick={() => setSelectedJointId(joint.jointId)}
              className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 shrink-0 border ${
                isSelected
                  ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
            >
              <span>{isAr ? joint.nameAr.split('(')[0] : joint.nameEn}</span>
              {jointEntriesCount > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                    isSelected
                      ? 'bg-white/20 text-white font-mono'
                      : 'bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300 font-mono'
                  }`}
                >
                  {jointEntriesCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Movements Table / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {currentJointConfig.movements.map((mov) => {
          const isMidline = currentJointConfig.applicableLateralities.includes('midline');
          const leftVal = getEntryValue(currentJointConfig.jointId, mov.movementId, 'left');
          const rightVal = getEntryValue(currentJointConfig.jointId, mov.movementId, 'right');
          const midlineVal = getEntryValue(currentJointConfig.jointId, mov.movementId, 'midline');

          return (
            <div
              key={mov.movementId}
              className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-850 hover:border-slate-300 dark:hover:border-slate-600 transition-colors space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {isAr ? mov.nameAr : mov.nameEn}
                  </h4>
                  <p className="text-[11px] text-teal-600 dark:text-teal-400 font-medium">
                    {isAr ? `المدى الطبيعي: ${mov.normalRangeDegrees}` : `Normal: ${mov.normalRangeDegrees}`}
                  </p>
                </div>
              </div>

              {/* Bilateral or Midline Stepper Inputs */}
              {isMidline ? (
                <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-500 font-medium">
                    {isAr ? 'الزاوية المقاسة:' : 'Angle:'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      min="0"
                      max="180"
                      disabled={readOnly}
                      value={midlineVal ?? ''}
                      placeholder="°"
                      onChange={(e) =>
                        handleUpdateEntry(
                          currentJointConfig.jointId,
                          mov.movementId,
                          'midline',
                          e.target.value === '' ? null : Number(e.target.value)
                        )
                      }
                      className="w-16 px-2 py-1 text-center font-bold font-mono text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                    />
                    <span className="text-xs font-bold text-slate-400">°</span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
                  {/* Right Side */}
                  <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      {isAr ? 'الأيمن (R):' : 'Right:'}
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="180"
                        disabled={readOnly}
                        value={rightVal ?? ''}
                        placeholder="°"
                        onChange={(e) =>
                          handleUpdateEntry(
                            currentJointConfig.jointId,
                            mov.movementId,
                            'right',
                            e.target.value === '' ? null : Number(e.target.value)
                          )
                        }
                        className="w-14 px-1.5 py-0.5 text-center font-bold font-mono text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                      />
                      <span className="text-xs font-bold text-slate-400">°</span>
                    </div>
                  </div>

                  {/* Left Side */}
                  <div className="flex items-center justify-between gap-2 p-1.5 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      {isAr ? 'الأيسر (L):' : 'Left:'}
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        max="180"
                        disabled={readOnly}
                        value={leftVal ?? ''}
                        placeholder="°"
                        onChange={(e) =>
                          handleUpdateEntry(
                            currentJointConfig.jointId,
                            mov.movementId,
                            'left',
                            e.target.value === '' ? null : Number(e.target.value)
                          )
                        }
                        className="w-14 px-1.5 py-0.5 text-center font-bold font-mono text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:ring-2 focus:ring-teal-500"
                      />
                      <span className="text-xs font-bold text-slate-400">°</span>
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
