// =======================================================================
// PhysioRecord — Patient Neurological Screening Panel (NeuroScreeningPanel)
// In-Session Clinical Recording Tool: Myotomes, Dermatomes & Reflexes
// shadcn/ui Clinical Standard: Zero Dual-Language Clutter & Clean UX
// =======================================================================

import React, { useState, useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { CheckCircle2 } from 'lucide-react';
import type {
  NeuroScreeningBatteryData,
  MyotomeMotorEntry,
  DermatomeSensoryEntry,
  DtrAssessmentEntry,
  SensoryFindingStatus,
  ReflexGradeValue,
  MmtGradeValue,
} from '../../types/clinical';

export interface NeuroScreeningPanelProps {
  value?: NeuroScreeningBatteryData;
  onChange?: (battery: NeuroScreeningBatteryData) => void;
  readOnly?: boolean;
  compactPreview?: boolean;
}

// Key Myotomes Root Levels
const DEFAULT_MYOTOME_DEFINITIONS: Array<{
  rootLevel: string;
  movementEn: string;
  movementAr: string;
}> = [
  { rootLevel: 'C5', movementEn: 'Elbow Flexion', movementAr: 'ثني المرفق' },
  { rootLevel: 'C6', movementEn: 'Wrist Extension', movementAr: 'بسط الرسغ' },
  { rootLevel: 'C7', movementEn: 'Elbow Extension', movementAr: 'بسط المرفق' },
  { rootLevel: 'C8', movementEn: 'Finger Flexion', movementAr: 'ثني الأصابع' },
  { rootLevel: 'T1', movementEn: 'Finger Abduction', movementAr: 'تباعد الأصابع' },
  { rootLevel: 'L2', movementEn: 'Hip Flexion', movementAr: 'ثني الورك' },
  { rootLevel: 'L3', movementEn: 'Knee Extension', movementAr: 'بسط الركبة' },
  { rootLevel: 'L4', movementEn: 'Ankle Dorsiflexion', movementAr: 'عطف الكاحل الظهري' },
  { rootLevel: 'L5', movementEn: 'Great Toe Extension', movementAr: 'بسط إبهام القدم' },
  { rootLevel: 'S1', movementEn: 'Ankle Plantarflexion', movementAr: 'عطف الكاحل الأخمصي' },
];

// Key Dermatomes Root Levels
const DERMATOME_ROOTS: string[] = [
  'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8', 'T1',
  'L1', 'L2', 'L3', 'L4', 'L5', 'S1', 'S2', 'S3', 'S4'
];

// Key DTR Reflex Definitions
const DTR_DEFINITIONS: Array<{
  reflexId: 'biceps' | 'brachioradialis' | 'triceps' | 'patellar' | 'achilles';
  labelEn: string;
  labelAr: string;
  rootLevel: string;
}> = [
  { reflexId: 'biceps', labelEn: 'Biceps Reflex', labelAr: 'المنعكس العضدي', rootLevel: 'C5, C6' },
  { reflexId: 'brachioradialis', labelEn: 'Brachioradialis Reflex', labelAr: 'المنعكس العضدي الكعبري', rootLevel: 'C6' },
  { reflexId: 'triceps', labelEn: 'Triceps Reflex', labelAr: 'منعكس ثلاثية الرؤوس', rootLevel: 'C7' },
  { reflexId: 'patellar', labelEn: 'Patellar Reflex', labelAr: 'المنعكس الرضفي', rootLevel: 'L4' },
  { reflexId: 'achilles', labelEn: 'Achilles Reflex', labelAr: 'منعكس أخيليس', rootLevel: 'S1' },
];

const MMT_GRADES_OPTIONS: Array<MmtGradeValue | 'NT'> = [
  '5', '4+', '4', '4-', '3+', '3', '3-', '2', '1', '0', 'NT'
];

const REFLEX_GRADES_OPTIONS: ReflexGradeValue[] = [
  '0', '1+', '2+', '3+', '4+', 'not_tested'
];

export const NeuroScreeningPanel: React.FC<NeuroScreeningPanelProps> = ({
  value,
  onChange,
  readOnly = false,
  compactPreview = false,
}) => {
  const { isRtl, bi } = useLanguage();

  // Internal Sub-tabs
  const [activeSubTab, setActiveSubTab] = useState<'myotomes' | 'dermatomes' | 'reflexes'>('myotomes');

  // Active Dermatome root selected for inspection
  const [selectedDermatomeRoot, setSelectedDermatomeRoot] = useState<string>('C6');
  const [dermatomeBodyView, setDermatomeBodyView] = useState<'anterior' | 'posterior'>('anterior');

  // Safe initialized state
  const currentMyotomes = useMemo<MyotomeMotorEntry[]>(() => {
    if (value?.myotomes && value.myotomes.length > 0) return value.myotomes;
    return DEFAULT_MYOTOME_DEFINITIONS.map((def) => ({
      rootLevel: def.rootLevel,
      movementLabelEn: def.movementEn,
      movementLabelAr: def.movementAr,
      rightGrade: null,
      leftGrade: null,
    }));
  }, [value?.myotomes]);

  const currentDermatomes = useMemo<DermatomeSensoryEntry[]>(() => {
    if (value?.dermatomes && value.dermatomes.length > 0) return value.dermatomes;
    return DERMATOME_ROOTS.map((root) => ({
      rootLevel: root,
      rightStatus: 'not_tested',
      leftStatus: 'not_tested',
    }));
  }, [value?.dermatomes]);

  const currentReflexes = useMemo<DtrAssessmentEntry[]>(() => {
    if (value?.reflexes && value.reflexes.length > 0) return value.reflexes;
    return DTR_DEFINITIONS.map((def) => ({
      reflexId: def.reflexId,
      reflexLabelEn: def.labelEn,
      reflexLabelAr: def.labelAr,
      rootLevel: def.rootLevel,
      rightGrade: null,
      leftGrade: null,
    }));
  }, [value?.reflexes]);

  // Update battery helper
  const emitUpdate = (
    updatedMyotomes: MyotomeMotorEntry[],
    updatedDermatomes: DermatomeSensoryEntry[],
    updatedReflexes: DtrAssessmentEntry[],
    notes?: string
  ) => {
    if (readOnly || !onChange) return;
    onChange({
      batteryVersion: '1.0.0',
      myotomes: updatedMyotomes,
      dermatomes: updatedDermatomes,
      reflexes: updatedReflexes,
      clinicalNotes: notes !== undefined ? notes : value?.clinicalNotes,
      updatedAt: new Date().toISOString(),
    });
  };

  // --- Handlers: Myotomes ---
  const handleUpdateMyotomeGrade = (
    root: string,
    side: 'right' | 'left',
    grade: MmtGradeValue | 'NT' | null
  ) => {
    const next = currentMyotomes.map((item) => {
      if (item.rootLevel !== root) return item;
      return side === 'right' ? { ...item, rightGrade: grade } : { ...item, leftGrade: grade };
    });
    emitUpdate(next, currentDermatomes, currentReflexes);
  };

  const handleSetAllMyotomesNormal = () => {
    const next = currentMyotomes.map((item) => ({
      ...item,
      rightGrade: '5' as MmtGradeValue,
      leftGrade: '5' as MmtGradeValue,
    }));
    emitUpdate(next, currentDermatomes, currentReflexes);
  };

  // --- Handlers: Dermatomes ---
  const handleUpdateDermatomeStatus = (
    root: string,
    side: 'right' | 'left',
    status: SensoryFindingStatus
  ) => {
    const next = currentDermatomes.map((item) => {
      if (item.rootLevel !== root) return item;
      return side === 'right' ? { ...item, rightStatus: status } : { ...item, leftStatus: status };
    });
    emitUpdate(currentMyotomes, next, currentReflexes);
  };

  const handleSetAllDermatomesIntact = () => {
    const next = currentDermatomes.map((item) => ({
      ...item,
      rightStatus: 'intact' as SensoryFindingStatus,
      leftStatus: 'intact' as SensoryFindingStatus,
    }));
    emitUpdate(currentMyotomes, next, currentReflexes);
  };

  // --- Handlers: Reflexes ---
  const handleUpdateReflexGrade = (
    reflexId: string,
    side: 'right' | 'left',
    grade: ReflexGradeValue | null
  ) => {
    const next = currentReflexes.map((item) => {
      if (item.reflexId !== reflexId) return item;
      return side === 'right' ? { ...item, rightGrade: grade } : { ...item, leftGrade: grade };
    });
    emitUpdate(currentMyotomes, currentDermatomes, next);
  };

  const handleSetAllReflexesNormal = () => {
    const next = currentReflexes.map((item) => ({
      ...item,
      rightGrade: '2+' as ReflexGradeValue,
      leftGrade: '2+' as ReflexGradeValue,
    }));
    emitUpdate(currentMyotomes, currentDermatomes, next);
  };

  // Active Dermatome entry
  const selectedDermatomeEntry = useMemo(() => {
    return (
      currentDermatomes.find((d) => d.rootLevel === selectedDermatomeRoot) || {
        rootLevel: selectedDermatomeRoot,
        rightStatus: 'not_tested' as SensoryFindingStatus,
        leftStatus: 'not_tested' as SensoryFindingStatus,
      }
    );
  }, [currentDermatomes, selectedDermatomeRoot]);

  // Color helper for Dermatomes SVG
  const getDermatomeColor = (root: string) => {
    const entry = currentDermatomes.find((d) => d.rootLevel === root);
    if (!entry) return '#e2e8f0';

    if (entry.rightStatus === 'anesthesia' || entry.leftStatus === 'anesthesia') return '#ef4444';
    if (entry.rightStatus === 'hyperesthesia' || entry.leftStatus === 'hyperesthesia') return '#f97316';
    if (entry.rightStatus === 'paresthesia' || entry.leftStatus === 'paresthesia') return '#f59e0b';
    if (entry.rightStatus === 'hypoesthesia' || entry.leftStatus === 'hypoesthesia') return '#0284c7';
    if (entry.rightStatus === 'intact' || entry.leftStatus === 'intact') return '#10b981';

    return '#e2e8f0';
  };

  // Compact Preview Mode (Used inside SOAP Preview tab or summaries)
  if (compactPreview) {
    const testedMyotomes = currentMyotomes.filter((m) => m.rightGrade !== null || m.leftGrade !== null);
    const abnormalDermatomes = currentDermatomes.filter(
      (d) =>
        (d.rightStatus !== 'not_tested' && d.rightStatus !== 'intact') ||
        (d.leftStatus !== 'not_tested' && d.leftStatus !== 'intact')
    );
    const testedReflexes = currentReflexes.filter((r) => r.rightGrade !== null || r.leftGrade !== null);

    if (testedMyotomes.length === 0 && abnormalDermatomes.length === 0 && testedReflexes.length === 0) {
      return (
        <div className="text-xs text-slate-400 py-2">
          {bi('لم يتم توثيق فحص عصبي في هذه الجلسة.', 'No neurological screening documented.')}
        </div>
      );
    }

    return (
      <div className="space-y-3 text-xs bg-slate-50 p-3 rounded-lg border border-slate-200">
        {testedMyotomes.length > 0 && (
          <div>
            <span className="font-bold text-slate-700 block mb-1">
              {bi('القوة القطاعية (Myotomes):', 'Myotomes Testing:')}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {testedMyotomes.map((m) => (
                <span
                  key={m.rootLevel}
                  className="px-2 py-0.5 rounded bg-white border border-slate-200 font-mono text-[11px]"
                >
                  <strong className="text-slate-900">{m.rootLevel}:</strong> R:{m.rightGrade || '—'} / L:{m.leftGrade || '—'}
                </span>
              ))}
            </div>
          </div>
        )}

        {abnormalDermatomes.length > 0 && (
          <div>
            <span className="font-bold text-rose-700 block mb-1">
              {bi('المناطق الحسية غير الطبيعية (Dermatomes):', 'Abnormal Dermatomes:')}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {abnormalDermatomes.map((d) => (
                <span
                  key={d.rootLevel}
                  className="px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-800 text-[11px]"
                >
                  {d.rootLevel} (R:{d.rightStatus} / L:{d.leftStatus})
                </span>
              ))}
            </div>
          </div>
        )}

        {testedReflexes.length > 0 && (
          <div>
            <span className="font-bold text-slate-700 block mb-1">
              {bi('المنعكسات الوترية (Reflexes):', 'Deep Tendon Reflexes:')}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {testedReflexes.map((r) => (
                <span
                  key={r.reflexId}
                  className="px-2 py-0.5 rounded bg-white border border-slate-200 text-[11px]"
                >
                  <strong>{bi(r.reflexLabelAr, r.reflexLabelEn)}:</strong> R:{r.rightGrade || '—'} / L:{r.leftGrade || '—'}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Sensory status labels
  const SENSORY_STATUS_CONFIG: Record<
    SensoryFindingStatus,
    { labelAr: string; labelEn: string; colorClass: string }
  > = {
    intact: { labelAr: 'طبيعي', labelEn: 'Intact', colorClass: 'bg-emerald-50 text-emerald-700 border-emerald-300' },
    hypoesthesia: { labelAr: 'نقص حس', labelEn: 'Hypoesthesia', colorClass: 'bg-sky-50 text-sky-700 border-sky-300' },
    paresthesia: { labelAr: 'تنميل ووخز', labelEn: 'Paresthesia', colorClass: 'bg-amber-50 text-amber-700 border-amber-300' },
    hyperesthesia: { labelAr: 'فرط حس', labelEn: 'Hyperesthesia', colorClass: 'bg-orange-50 text-orange-700 border-orange-300' },
    anesthesia: { labelAr: 'انعدام حس', labelEn: 'Anesthesia', colorClass: 'bg-red-50 text-red-700 border-red-300' },
    not_tested: { labelAr: 'غير مفحوص', labelEn: 'Not Tested', colorClass: 'bg-slate-50 text-slate-500 border-slate-200' },
  };

  return (
    <div className="space-y-4" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Sub-Tabs Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveSubTab('myotomes')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeSubTab === 'myotomes'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {bi('فحص القوة العصبية (Myotomes)', 'Myotomes Testing')}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('dermatomes')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeSubTab === 'dermatomes'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {bi('فحص الإحساس القطاعي (Dermatomes)', 'Dermatomes Testing')}
          </button>

          <button
            type="button"
            onClick={() => setActiveSubTab('reflexes')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              activeSubTab === 'reflexes'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {bi('المنعكسات الوترية (Reflexes DTR)', 'Reflexes (DTR)')}
          </button>
        </div>

        {/* Quick Batch Actions */}
        {!readOnly && (
          <div className="flex items-center gap-2">
            {activeSubTab === 'myotomes' && (
              <button
                type="button"
                onClick={handleSetAllMyotomesNormal}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{bi('تعيين الكل طبيعي (5/5)', 'Set All Normal (5/5)')}</span>
              </button>
            )}

            {activeSubTab === 'dermatomes' && (
              <button
                type="button"
                onClick={handleSetAllDermatomesIntact}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{bi('تعيين الكل سليم', 'Set All Intact')}</span>
              </button>
            )}

            {activeSubTab === 'reflexes' && (
              <button
                type="button"
                onClick={handleSetAllReflexesNormal}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{bi('تعيين الكل طبيعي (2+)', 'Set All Normal (2+)')}</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* ======================================================================= */}
      {/* SUB-TAB 1: MYOTOMES                                                     */}
      {/* ======================================================================= */}
      {activeSubTab === 'myotomes' && (
        <div className="space-y-3">
          <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                <tr>
                  <th className="px-3 py-2.5 text-center w-16">{bi('المستوى', 'Root')}</th>
                  <th className="px-3 py-2.5">{bi('الحركة النموذجية المفحوصة', 'Key Action')}</th>
                  <th className="px-3 py-2.5 text-center w-36">{bi('اليمين (Right)', 'Right')}</th>
                  <th className="px-3 py-2.5 text-center w-36">{bi('اليسار (Left)', 'Left')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentMyotomes.map((item) => (
                  <tr key={item.rootLevel} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-3 py-2 text-center font-bold font-mono text-slate-900 bg-slate-50/50">
                      {item.rootLevel}
                    </td>
                    <td className="px-3 py-2 text-slate-800">
                      {bi(item.movementLabelAr, item.movementLabelEn)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {readOnly ? (
                        <span className="font-mono font-bold text-slate-700">
                          {item.rightGrade || '—'}
                        </span>
                      ) : (
                        <select
                          value={item.rightGrade || ''}
                          onChange={(e) =>
                            handleUpdateMyotomeGrade(
                              item.rootLevel,
                              'right',
                              (e.target.value as MmtGradeValue | 'NT') || null
                            )
                          }
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded font-mono focus:ring-1 focus:ring-primary-500 focus:outline-hidden bg-white"
                        >
                          <option value="">{bi('اختر الدرجة...', 'Select...')}</option>
                          {MMT_GRADES_OPTIONS.map((g) => (
                            <option key={g} value={g}>
                              {g === 'NT' ? bi('NT (غير مفحوص)', 'NT (Not Tested)') : `${g} / 5`}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {readOnly ? (
                        <span className="font-mono font-bold text-slate-700">
                          {item.leftGrade || '—'}
                        </span>
                      ) : (
                        <select
                          value={item.leftGrade || ''}
                          onChange={(e) =>
                            handleUpdateMyotomeGrade(
                              item.rootLevel,
                              'left',
                              (e.target.value as MmtGradeValue | 'NT') || null
                            )
                          }
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded font-mono focus:ring-1 focus:ring-primary-500 focus:outline-hidden bg-white"
                        >
                          <option value="">{bi('اختر الدرجة...', 'Select...')}</option>
                          {MMT_GRADES_OPTIONS.map((g) => (
                            <option key={g} value={g}>
                              {g === 'NT' ? bi('NT (غير مفحوص)', 'NT (Not Tested)') : `${g} / 5`}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* SUB-TAB 2: DERMATOMES                                                   */}
      {/* ======================================================================= */}
      {activeSubTab === 'dermatomes' && (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
          {/* Interactive SVG Body Column (4 cols) */}
          <div className="md:col-span-4 bg-slate-50 border border-slate-200 rounded-lg p-3 flex flex-col items-center">
            {/* View Switcher */}
            <div className="flex items-center gap-1 mb-2 bg-white p-0.5 rounded border border-slate-200">
              <button
                type="button"
                onClick={() => setDermatomeBodyView('anterior')}
                className={`px-2.5 py-1 text-[11px] font-medium rounded ${
                  dermatomeBodyView === 'anterior'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {bi('منظر أمامي', 'Anterior View')}
              </button>
              <button
                type="button"
                onClick={() => setDermatomeBodyView('posterior')}
                className={`px-2.5 py-1 text-[11px] font-medium rounded ${
                  dermatomeBodyView === 'posterior'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {bi('منظر خلفي', 'Posterior View')}
              </button>
            </div>

            {/* SVG Visualizer */}
            <div className="w-48 h-80 relative flex items-center justify-center">
              <svg viewBox="0 0 200 400" className="w-full h-full drop-shadow-xs">
                {/* Head */}
                <circle
                  cx="100" cy="30" r="20"
                  fill={getDermatomeColor('C2')}
                  stroke="#64748b" strokeWidth="1.5"
                  className="cursor-pointer transition-colors"
                  onClick={() => setSelectedDermatomeRoot('C2')}
                />
                <text x="100" y="34" fontSize="8" textAnchor="middle" fill="#1e293b" className="pointer-events-none font-bold">C2</text>

                {/* Neck C3 */}
                <rect
                  x="90" y="52" width="20" height="12" rx="2"
                  fill={getDermatomeColor('C3')}
                  stroke="#64748b" strokeWidth="1"
                  className="cursor-pointer transition-colors"
                  onClick={() => setSelectedDermatomeRoot('C3')}
                />
                <text x="100" y="61" fontSize="7" textAnchor="middle" fill="#1e293b" className="pointer-events-none font-semibold">C3</text>

                {/* Shoulders C4 */}
                <path
                  d="M 68 64 L 132 64 L 126 84 L 74 84 Z"
                  fill={getDermatomeColor('C4')}
                  stroke="#64748b" strokeWidth="1"
                  className="cursor-pointer transition-colors"
                  onClick={() => setSelectedDermatomeRoot('C4')}
                />
                <text x="100" y="76" fontSize="7" textAnchor="middle" fill="#1e293b" className="pointer-events-none font-semibold">C4</text>

                {/* Arms C5 */}
                <rect
                  x="48" y="86" width="20" height="50" rx="4"
                  fill={getDermatomeColor('C5')}
                  stroke="#64748b" strokeWidth="1"
                  className="cursor-pointer transition-colors"
                  onClick={() => setSelectedDermatomeRoot('C5')}
                />
                <rect
                  x="132" y="86" width="20" height="50" rx="4"
                  fill={getDermatomeColor('C5')}
                  stroke="#64748b" strokeWidth="1"
                  className="cursor-pointer transition-colors"
                  onClick={() => setSelectedDermatomeRoot('C5')}
                />
                <text x="58" y="112" fontSize="7" textAnchor="middle" fill="#1e293b" className="pointer-events-none font-semibold">C5</text>
                <text x="142" y="112" fontSize="7" textAnchor="middle" fill="#1e293b" className="pointer-events-none font-semibold">C5</text>

                {/* Forearms C6 */}
                <rect
                  x="44" y="138" width="18" height="50" rx="4"
                  fill={getDermatomeColor('C6')}
                  stroke="#64748b" strokeWidth="1"
                  className="cursor-pointer transition-colors"
                  onClick={() => setSelectedDermatomeRoot('C6')}
                />
                <rect
                  x="138" y="138" width="18" height="50" rx="4"
                  fill={getDermatomeColor('C6')}
                  stroke="#64748b" strokeWidth="1"
                  className="cursor-pointer transition-colors"
                  onClick={() => setSelectedDermatomeRoot('C6')}
                />
                <text x="53" y="164" fontSize="7" textAnchor="middle" fill="#1e293b" className="pointer-events-none font-semibold">C6</text>
                <text x="147" y="164" fontSize="7" textAnchor="middle" fill="#1e293b" className="pointer-events-none font-semibold">C6</text>

                {/* Thoracic Trunk T1-T12 */}
                <rect
                  x="72" y="86" width="56" height="100" rx="4"
                  fill={getDermatomeColor('T1')}
                  stroke="#64748b" strokeWidth="1"
                  className="cursor-pointer transition-colors"
                  onClick={() => setSelectedDermatomeRoot('T1')}
                />
                <text x="100" y="138" fontSize="8" textAnchor="middle" fill="#475569" className="pointer-events-none font-semibold">T1–T12</text>

                {/* Lumbar / Groin L1-L2 */}
                <rect
                  x="74" y="188" width="52" height="34" rx="4"
                  fill={getDermatomeColor('L2')}
                  stroke="#64748b" strokeWidth="1"
                  className="cursor-pointer transition-colors"
                  onClick={() => setSelectedDermatomeRoot('L2')}
                />
                <text x="100" y="208" fontSize="7" textAnchor="middle" fill="#1e293b" className="pointer-events-none font-semibold">L1–L2</text>

                {/* Anterior Thigh L3 */}
                <rect
                  x="75" y="224" width="22" height="46" rx="4"
                  fill={getDermatomeColor('L3')}
                  stroke="#64748b" strokeWidth="1"
                  className="cursor-pointer transition-colors"
                  onClick={() => setSelectedDermatomeRoot('L3')}
                />
                <rect
                  x="103" y="224" width="22" height="46" rx="4"
                  fill={getDermatomeColor('L3')}
                  stroke="#64748b" strokeWidth="1"
                  className="cursor-pointer transition-colors"
                  onClick={() => setSelectedDermatomeRoot('L3')}
                />
                <text x="86" y="250" fontSize="7" textAnchor="middle" fill="#1e293b" className="pointer-events-none font-semibold">L3</text>
                <text x="114" y="250" fontSize="7" textAnchor="middle" fill="#1e293b" className="pointer-events-none font-semibold">L3</text>

                {/* Medial Leg L4 */}
                <rect
                  x="75" y="272" width="18" height="66" rx="3"
                  fill={getDermatomeColor('L4')}
                  stroke="#64748b" strokeWidth="1"
                  className="cursor-pointer transition-colors"
                  onClick={() => setSelectedDermatomeRoot('L4')}
                />
                <rect
                  x="107" y="272" width="18" height="66" rx="3"
                  fill={getDermatomeColor('L4')}
                  stroke="#64748b" strokeWidth="1"
                  className="cursor-pointer transition-colors"
                  onClick={() => setSelectedDermatomeRoot('L4')}
                />
                <text x="84" y="306" fontSize="7" textAnchor="middle" fill="#1e293b" className="pointer-events-none font-semibold">L4</text>
                <text x="116" y="306" fontSize="7" textAnchor="middle" fill="#1e293b" className="pointer-events-none font-semibold">L4</text>

                {/* Lateral Leg L5 */}
                <rect
                  x="93" y="272" width="14" height="66" rx="2"
                  fill={getDermatomeColor('L5')}
                  stroke="#64748b" strokeWidth="1"
                  className="cursor-pointer transition-colors"
                  onClick={() => setSelectedDermatomeRoot('L5')}
                />
                <rect
                  x="125" y="272" width="14" height="66" rx="2"
                  fill={getDermatomeColor('L5')}
                  stroke="#64748b" strokeWidth="1"
                  className="cursor-pointer transition-colors"
                  onClick={() => setSelectedDermatomeRoot('L5')}
                />
                <text x="100" y="306" fontSize="6" textAnchor="middle" fill="#1e293b" className="pointer-events-none font-semibold">L5</text>
                <text x="132" y="306" fontSize="6" textAnchor="middle" fill="#1e293b" className="pointer-events-none font-semibold">L5</text>

                {/* Feet S1 */}
                <rect
                  x="72" y="340" width="22" height="16" rx="3"
                  fill={getDermatomeColor('S1')}
                  stroke="#64748b" strokeWidth="1"
                  className="cursor-pointer transition-colors"
                  onClick={() => setSelectedDermatomeRoot('S1')}
                />
                <rect
                  x="106" y="340" width="22" height="16" rx="3"
                  fill={getDermatomeColor('S1')}
                  stroke="#64748b" strokeWidth="1"
                  className="cursor-pointer transition-colors"
                  onClick={() => setSelectedDermatomeRoot('S1')}
                />
                <text x="83" y="351" fontSize="7" textAnchor="middle" fill="#1e293b" className="pointer-events-none font-semibold">S1</text>
                <text x="117" y="351" fontSize="7" textAnchor="middle" fill="#1e293b" className="pointer-events-none font-semibold">S1</text>
              </svg>
            </div>
            <span className="text-[10px] text-slate-400 mt-1">
              {bi('انقر على أي منطقة لتحديد مستواها وتوثيق الحس', 'Click any region to select and record status')}
            </span>
          </div>

          {/* Active Level Sensation Controller (8 cols) */}
          <div className="md:col-span-8 space-y-4">
            <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-slate-900 text-white font-mono font-bold text-xs">
                    {selectedDermatomeRoot}
                  </span>
                  <span className="text-xs font-semibold text-slate-800">
                    {bi(`توثيق الإحساس للمستوى ${selectedDermatomeRoot}`, `Document Sensation for ${selectedDermatomeRoot}`)}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {DERMATOME_ROOTS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setSelectedDermatomeRoot(r)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold ${
                        selectedDermatomeRoot === r
                          ? 'bg-primary-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bilateral Sensation Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Right Side */}
                <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">{bi('الجانب الأيمن (Right)', 'Right Side')}</span>
                    <span className={`px-2 py-0.5 text-[10px] rounded border font-semibold ${SENSORY_STATUS_CONFIG[selectedDermatomeEntry.rightStatus].colorClass}`}>
                      {bi(SENSORY_STATUS_CONFIG[selectedDermatomeEntry.rightStatus].labelAr, SENSORY_STATUS_CONFIG[selectedDermatomeEntry.rightStatus].labelEn)}
                    </span>
                  </div>

                  {!readOnly && (
                    <div className="grid grid-cols-2 gap-1">
                      {(Object.keys(SENSORY_STATUS_CONFIG) as SensoryFindingStatus[]).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => handleUpdateDermatomeStatus(selectedDermatomeRoot, 'right', st)}
                          className={`px-2 py-1 rounded text-[11px] font-medium border text-center transition-all ${
                            selectedDermatomeEntry.rightStatus === st
                              ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {bi(SENSORY_STATUS_CONFIG[st].labelAr, SENSORY_STATUS_CONFIG[st].labelEn)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Left Side */}
                <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">{bi('الجانب الأيسر (Left)', 'Left Side')}</span>
                    <span className={`px-2 py-0.5 text-[10px] rounded border font-semibold ${SENSORY_STATUS_CONFIG[selectedDermatomeEntry.leftStatus].colorClass}`}>
                      {bi(SENSORY_STATUS_CONFIG[selectedDermatomeEntry.leftStatus].labelAr, SENSORY_STATUS_CONFIG[selectedDermatomeEntry.leftStatus].labelEn)}
                    </span>
                  </div>

                  {!readOnly && (
                    <div className="grid grid-cols-2 gap-1">
                      {(Object.keys(SENSORY_STATUS_CONFIG) as SensoryFindingStatus[]).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => handleUpdateDermatomeStatus(selectedDermatomeRoot, 'left', st)}
                          className={`px-2 py-1 rounded text-[11px] font-medium border text-center transition-all ${
                            selectedDermatomeEntry.leftStatus === st
                              ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {bi(SENSORY_STATUS_CONFIG[st].labelAr, SENSORY_STATUS_CONFIG[st].labelEn)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Summary List */}
            <div className="border border-slate-200 rounded-lg bg-white overflow-hidden max-h-52 overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-center w-14">{bi('المستوى', 'Root')}</th>
                    <th className="px-3 py-2 text-center">{bi('الحس الأيمن', 'Right Sensory Status')}</th>
                    <th className="px-3 py-2 text-center">{bi('الحس الأيسر', 'Left Sensory Status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentDermatomes.map((item) => (
                    <tr
                      key={item.rootLevel}
                      onClick={() => setSelectedDermatomeRoot(item.rootLevel)}
                      className={`cursor-pointer transition-colors ${
                        selectedDermatomeRoot === item.rootLevel ? 'bg-primary-50/50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <td className="px-3 py-1.5 text-center font-bold font-mono text-slate-900">
                        {item.rootLevel}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${SENSORY_STATUS_CONFIG[item.rightStatus].colorClass}`}>
                          {bi(SENSORY_STATUS_CONFIG[item.rightStatus].labelAr, SENSORY_STATUS_CONFIG[item.rightStatus].labelEn)}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${SENSORY_STATUS_CONFIG[item.leftStatus].colorClass}`}>
                          {bi(SENSORY_STATUS_CONFIG[item.leftStatus].labelAr, SENSORY_STATUS_CONFIG[item.leftStatus].labelEn)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* SUB-TAB 3: REFLEXES (DTR)                                               */}
      {/* ======================================================================= */}
      {activeSubTab === 'reflexes' && (
        <div className="space-y-3">
          <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold">
                <tr>
                  <th className="px-3 py-2.5">{bi('المنعكس الوتري المفحوص', 'Deep Tendon Reflex')}</th>
                  <th className="px-3 py-2.5 text-center w-24">{bi('المستوى', 'Root')}</th>
                  <th className="px-3 py-2.5 text-center w-48">{bi('اليمين (Right)', 'Right')}</th>
                  <th className="px-3 py-2.5 text-center w-48">{bi('اليسار (Left)', 'Left')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentReflexes.map((item) => (
                  <tr key={item.reflexId} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {bi(item.reflexLabelAr, item.reflexLabelEn)}
                    </td>
                    <td className="px-3 py-2 text-center font-mono font-semibold text-slate-600 bg-slate-50/50">
                      {item.rootLevel}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {readOnly ? (
                        <span className="font-mono font-bold text-slate-700">
                          {item.rightGrade || '—'}
                        </span>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          {REFLEX_GRADES_OPTIONS.map((g) => (
                            <button
                              key={g}
                              type="button"
                              onClick={() => handleUpdateReflexGrade(item.reflexId, 'right', g)}
                              className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold border transition-all ${
                                item.rightGrade === g
                                  ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {g === 'not_tested' ? 'NT' : g}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {readOnly ? (
                        <span className="font-mono font-bold text-slate-700">
                          {item.leftGrade || '—'}
                        </span>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          {REFLEX_GRADES_OPTIONS.map((g) => (
                            <button
                              key={g}
                              type="button"
                              onClick={() => handleUpdateReflexGrade(item.reflexId, 'left', g)}
                              className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold border transition-all ${
                                item.leftGrade === g
                                  ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {g === 'not_tested' ? 'NT' : g}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Clinical Notes Field */}
      <div>
        <label className="block text-xs font-semibold text-slate-700 mb-1">
          {bi('ملاحظات الفحص العصبي السريري الإضافية:', 'Additional Neurological Screening Notes:')}
        </label>
        <textarea
          value={value?.clinicalNotes || ''}
          onChange={(e) =>
            emitUpdate(currentMyotomes, currentDermatomes, currentReflexes, e.target.value)
          }
          disabled={readOnly}
          rows={2}
          placeholder={bi(
            'سجل أي علامات إضافية مثل علامة بابينسكي، الرمع، أو شذوذات حسية محددة...',
            'Note any additional findings like Babinski sign, clonus, or specific sensory anomalies...'
          )}
          className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:ring-1 focus:ring-primary-500 focus:outline-hidden disabled:bg-slate-50"
        />
      </div>
    </div>
  );
};
