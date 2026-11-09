// =======================================================================
// PhysioRecord — Active Examination Canvas (Drop Zone & Modular Cards)
// Renders active assessment widgets with drag-and-drop drop-target
// =======================================================================

import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type { SoapObjectiveData, PatientBodyChartData } from '../../types/clinical';
import type { OrthopedicSpecialTestItem, GaitPostureData, FunctionalScaleEntry, CustomWidgetDefinition } from '../../types/clinicalWidgets';
import { BodyChartWidget } from '../widgets/BodyChartWidget';
import { RomWidget } from '../widgets/RomWidget';
import { MmtWidget } from '../widgets/MmtWidget';
import { NeuroWidget } from '../widgets/NeuroWidget';
import { SpecialTestsWidget } from '../widgets/SpecialTestsWidget';
import { GaitPostureWidget } from '../widgets/GaitPostureWidget';
import { FunctionalScalesWidget } from '../widgets/FunctionalScalesWidget';
import { DynamicCustomWidget } from '../widgets/DynamicCustomWidget';
import {
  ChevronDown,
  ChevronUp,
  Trash2,
  MapPin,
  Activity,
  Dumbbell,
  Brain,
  Stethoscope,
  Footprints,
  FileCheck,
  Sparkles,
  Inbox,
} from 'lucide-react';

interface ActiveExamCanvasProps {
  activeWidgetIds: string[];
  onRemoveWidget: (widgetId: string) => void;
  onAddWidget: (widgetId: string) => void;
  bodyChart: PatientBodyChartData | undefined;
  onBodyChartChange: (chart: PatientBodyChartData) => void;
  objective: SoapObjectiveData;
  onObjectiveChange: (obj: SoapObjectiveData) => void;
  specialTests: OrthopedicSpecialTestItem[];
  onSpecialTestsChange: (tests: OrthopedicSpecialTestItem[]) => void;
  gaitPosture: GaitPostureData | undefined;
  onGaitPostureChange: (gait: GaitPostureData) => void;
  functionalScales: FunctionalScaleEntry | undefined;
  onFunctionalScalesChange: (scale: FunctionalScaleEntry) => void;
  customWidgetsData: Record<string, Record<string, unknown>>;
  onCustomWidgetsDataChange: (data: Record<string, Record<string, unknown>>) => void;
  readOnly?: boolean;
}

export const ActiveExamCanvas: React.FC<ActiveExamCanvasProps> = ({
  activeWidgetIds,
  onRemoveWidget,
  onAddWidget,
  bodyChart,
  onBodyChartChange,
  objective,
  onObjectiveChange,
  specialTests,
  onSpecialTestsChange,
  gaitPosture,
  onGaitPostureChange,
  functionalScales,
  onFunctionalScalesChange,
  customWidgetsData,
  onCustomWidgetsDataChange,
  readOnly = false,
}) => {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const [isDragOver, setIsDragOver] = useState(false);
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});

  const [customDefinitions, setCustomDefinitions] = useState<CustomWidgetDefinition[]>([]);
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem('physiorecord_custom_widgets');
      if (stored) {
        setCustomDefinitions(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const widgetId = e.dataTransfer.getData('text/plain');
    if (widgetId) {
      onAddWidget(widgetId);
    }
  };

  const toggleCollapse = (id: string) => {
    setCollapsedMap((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const getWidgetTitle = (id: string) => {
    switch (id) {
      case 'body_chart':
        return {
          title: isAr ? 'مخطط الجسم التشريحي ومواضع الألم (OrganUI Body Map)' : 'OrganUI Anatomical Body Map & Pain Charting',
          icon: <MapPin className="w-4 h-4 text-rose-500" />,
        };
      case 'rom':
        return {
          title: isAr ? 'قياس المدى الحركي المفصلي (ROM Goniometry)' : 'Range of Motion (ROM Goniometry)',
          icon: <Activity className="w-4 h-4 text-teal-600 dark:text-teal-400" />,
        };
      case 'mmt':
        return {
          title: isAr ? 'اختبار القوة العضلية اليدوي (MMT MRC Scale)' : 'Manual Muscle Strength (MMT MRC Scale)',
          icon: <Dumbbell className="w-4 h-4 text-blue-600 dark:text-blue-400" />,
        };
      case 'neuro':
        return {
          title: isAr ? 'الفحص العصبي وخريطة القطاعات الجلدية (OrganUI Dermatomes & DTR)' : 'Neurological Screening & OrganUI Dermatome Map',
          icon: <Brain className="w-4 h-4 text-purple-600 dark:text-purple-400" />,
        };
      case 'special_tests':
        return {
          title: isAr ? 'الفحوصات العظمية التخصصية (Orthopedic Provocative)' : 'Orthopedic Special Provocative Tests',
          icon: <Stethoscope className="w-4 h-4 text-amber-600 dark:text-amber-400" />,
        };
      case 'gait_posture':
        return {
          title: isAr ? 'تقييم المشي والقوام واختبار TUG' : 'Gait, Posture & Timed Up & Go (TUG)',
          icon: <Footprints className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />,
        };
      case 'functional_scales':
        return {
          title: isAr ? 'المقاييس الوظيفية الدولية (QuickDASH)' : 'Functional Outcome Scales (QuickDASH)',
          icon: <FileCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />,
        };
      default: {
        const customDef = customDefinitions.find((cd) => cd.id === id);
        return {
          title: customDef
            ? isAr
              ? customDef.titleAr
              : customDef.titleEn
            : isAr
            ? 'فحص سريري مخصص'
            : 'Custom Clinical Test',
          icon: <Sparkles className="w-4 h-4 text-fuchsia-600 dark:text-fuchsia-400" />,
        };
      }
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`rounded-2xl transition-all ${
        isDragOver
          ? 'ring-2 ring-teal-500 ring-dashed bg-teal-50/50 dark:bg-teal-950/20 p-2'
          : 'space-y-4'
      }`}
    >
      {/* Drop Zone Visual Cue when dragging */}
      {isDragOver && (
        <div className="p-8 border-2 border-dashed border-teal-500 rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-center">
          <p className="text-sm font-bold text-teal-700 dark:text-teal-300">
            {isAr ? 'أفلت الفحص هنا لإدراجه فوراً في السجل السريري' : 'Drop examination card here to insert into chart'}
          </p>
        </div>
      )}

      {/* Empty State when no widgets are active */}
      {activeWidgetIds.length === 0 && !isDragOver && (
        <div className="p-10 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white/60 dark:bg-slate-900/40 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 flex items-center justify-center mx-auto">
            <Inbox className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {isAr ? 'لم يتم إدراج أي فحوصات سريرية بعد' : 'No clinical examination cards added yet'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto mt-1">
              {isAr
                ? 'انقر على أي أداة من رف الفحوصات أعلاه لإدراجها في السجل (مخطط الجسم، ROM، MMT، خريطة القطاعات الجلدية، أو الفحوصات العظمية).'
                : 'Click or drag any tool from the shelf above to document tests (Body Map, ROM, MMT, Dermatome Map, or Special Tests).'}
            </p>
          </div>
        </div>
      )}

      {/* Render Active Widgets */}
      <div className="space-y-4">
        {activeWidgetIds.map((widgetId) => {
          const isCollapsed = collapsedMap[widgetId] || false;
          const { title, icon } = getWidgetTitle(widgetId);

          return (
            <div
              key={widgetId}
              className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs overflow-hidden transition-all"
            >
              {/* Card Header */}
              <div className="px-5 py-3.5 bg-slate-50/80 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/60 shadow-2xs">
                    {icon}
                  </div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white tracking-wide">{title}</h3>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => toggleCollapse(widgetId)}
                    className="px-2.5 py-1 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer flex items-center gap-1"
                    title={isCollapsed ? (isAr ? 'توسيع' : 'Expand') : isAr ? 'طي' : 'Collapse'}
                  >
                    <span className="text-[11px] font-semibold">
                      {isCollapsed ? (isAr ? 'فتح' : 'Expand') : (isAr ? 'طي' : 'Collapse')}
                    </span>
                    {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                  </button>

                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => onRemoveWidget(widgetId)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title={isAr ? 'إزالة الفحص' : 'Remove card'}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Card Body */}
              {!isCollapsed && (
                <div className="p-5 bg-white dark:bg-slate-900">
                  {widgetId === 'body_chart' && (
                    <BodyChartWidget
                      value={bodyChart}
                      onChange={onBodyChartChange}
                      readOnly={readOnly}
                    />
                  )}

                  {widgetId === 'rom' && (
                    <RomWidget
                      value={objective.romBattery}
                      onChange={(battery) =>
                        onObjectiveChange({ ...objective, romBattery: battery })
                      }
                      readOnly={readOnly}
                    />
                  )}

                  {widgetId === 'mmt' && (
                    <MmtWidget
                      value={objective.mmtBattery}
                      onChange={(battery) =>
                        onObjectiveChange({ ...objective, mmtBattery: battery })
                      }
                      readOnly={readOnly}
                    />
                  )}

                  {widgetId === 'neuro' && (
                    <NeuroWidget
                      value={objective.neuroScreening}
                      onChange={(screening) =>
                        onObjectiveChange({ ...objective, neuroScreening: screening })
                      }
                      readOnly={readOnly}
                    />
                  )}

                  {widgetId === 'special_tests' && (
                    <SpecialTestsWidget
                      value={specialTests}
                      onChange={onSpecialTestsChange}
                      readOnly={readOnly}
                    />
                  )}

                  {widgetId === 'gait_posture' && (
                    <GaitPostureWidget
                      value={gaitPosture}
                      onChange={onGaitPostureChange}
                      readOnly={readOnly}
                    />
                  )}

                  {widgetId === 'functional_scales' && (
                    <FunctionalScalesWidget
                      value={functionalScales}
                      onChange={onFunctionalScalesChange}
                      readOnly={readOnly}
                    />
                  )}

                  {/* AI Custom Widgets */}
                  {!['body_chart', 'rom', 'mmt', 'neuro', 'special_tests', 'gait_posture', 'functional_scales'].includes(widgetId) && (
                    (() => {
                      const customDef = customDefinitions.find((cd) => cd.id === widgetId);
                      if (!customDef) {
                        return (
                          <p className="text-xs text-slate-400 italic">
                            {isAr ? 'لم يتم العثور على تعريف هذا الفحص المخصص.' : 'Custom widget definition not found.'}
                          </p>
                        );
                      }
                      return (
                        <DynamicCustomWidget
                          definition={customDef}
                          value={customWidgetsData[widgetId] || {}}
                          onChange={(widgetVal) =>
                            onCustomWidgetsDataChange({
                              ...customWidgetsData,
                              [widgetId]: widgetVal,
                            })
                          }
                          readOnly={readOnly}
                        />
                      );
                    })()
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
