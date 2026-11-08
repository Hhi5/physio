// =======================================================================
// PhysioRecord — Clinical Examination Widget Shelf (Palette)
// Collapsible Top Shelf with Compact Quick-Bar Mode, Category Tabs & OrganUI
// =======================================================================

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type { ExamWidgetDescriptor, ExamCategory, CustomWidgetDefinition } from '../../types/clinicalWidgets';
import {
  Search,
  Plus,
  Sparkles,
  Layers,
  MapPin,
  Activity,
  Dumbbell,
  Brain,
  Stethoscope,
  Footprints,
  FileCheck,
  GripHorizontal,
  ChevronUp,
  ChevronDown,
  Minimize2,
  Maximize2,
  Check,
} from 'lucide-react';

interface ExamWidgetShelfProps {
  onAddWidget: (widgetId: string) => void;
  onOpenCustomStudio: () => void;
  activeWidgetIds: string[];
}

const BUILT_IN_WIDGETS: ExamWidgetDescriptor[] = [
  {
    id: 'body_chart',
    category: 'body_chart',
    titleAr: 'مخطط الجسم التشريحي (OrganUI Body Map)',
    titleEn: 'OrganUI Anatomical Body Map',
    subtitleAr: 'تحديد المناطق التشريحية ومواضع وأعماق الألم (Anterior / Posterior)',
    subtitleEn: 'Interactive region selection & anatomical symptom pin mapping',
    badgeLabelAr: 'OrganUI تشريحي',
    badgeLabelEn: 'OrganUI BodyMap',
    badgeColorClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800',
    iconName: 'MapPin',
    descriptionAr: 'تحديد المناطق التشريحية ونقاط الألم على المتجهات الطبية',
    descriptionEn: 'Plot precise symptom markers and anatomical zones',
  },
  {
    id: 'rom',
    category: 'rom_mmt',
    titleAr: 'المدى الحركي المفصلي (ROM)',
    titleEn: 'Range of Motion (ROM)',
    subtitleAr: 'قياس درجات الزوايا الحركية (AROM / PROM / AAROM)',
    subtitleEn: 'Goniometric range of motion for all joints',
    badgeLabelAr: 'مفصلي',
    badgeLabelEn: 'Goniometry',
    badgeColorClass: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800',
    iconName: 'Activity',
    descriptionAr: 'عنق، ظهر، كتف، كوع، رسغ، ورك، ركبة، كاحل',
    descriptionEn: 'Cervical, lumbar, shoulder, elbow, wrist, hip, knee, ankle',
  },
  {
    id: 'mmt',
    category: 'rom_mmt',
    titleAr: 'اختبار القوة العضلية (MMT)',
    titleEn: 'Manual Muscle Testing (MMT)',
    subtitleAr: 'مقياس مجلس البحوث الطبية العالمي (MRC Scale 0-5)',
    subtitleEn: 'Medical Research Council 0-5 strength grading',
    badgeLabelAr: 'عضلي MRC',
    badgeLabelEn: 'MRC Scale',
    badgeColorClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800',
    iconName: 'Dumbbell',
    descriptionAr: 'مقارنة ثنائية الأطراف للأطراف العلوية والسفلية والجذع',
    descriptionEn: 'Bilateral side-by-side upper/lower extremity strength',
  },
  {
    id: 'neuro',
    category: 'neurology',
    titleAr: 'خريطة القطاعات الحسية والفحص العصبي',
    titleEn: 'OrganUI Dermatome Map & Neuro',
    subtitleAr: 'خريطة القطاعات الجلدية (C2-S5) والمنعكسات الوترية (DTR) والعضلية',
    subtitleEn: 'Interactive C2-S5 Dermatomes, DTR Reflexes & Myotomes',
    badgeLabelAr: 'OrganUI عصبي',
    badgeLabelEn: 'OrganUI Neuro',
    badgeColorClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800',
    iconName: 'Brain',
    descriptionAr: 'تقييم الحس الجلدي ASIA ومنعكسات الرضفة والعرقوب والقطع C5-S1',
    descriptionEn: 'ASIA sensory dermatome map, reflexes and motor roots',
  },
  {
    id: 'special_tests',
    category: 'special_tests',
    titleAr: 'الفحوصات العظمية التخصصية',
    titleEn: 'Orthopedic Special Tests',
    subtitleAr: 'اختبارات الاستفزاز العظمي (Neer, Lachman, SLR, Phalen)',
    subtitleEn: 'Provocative orthopedic joint tests with instant results',
    badgeLabelAr: 'سريري عظمي',
    badgeLabelEn: 'Orthopedic',
    badgeColorClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
    iconName: 'Stethoscope',
    descriptionAr: 'توثيق بنقرة واحدة (+ إيجابي / ألم مطابق / - سلبي)',
    descriptionEn: 'One-click documentation (+ Positive / Pain / - Negative)',
  },
  {
    id: 'gait_posture',
    category: 'gait_balance',
    titleAr: 'تقييم المشي والقوام والتوازن',
    titleEn: 'Gait, Posture & TUG Test',
    subtitleAr: 'اختبار النهوض والمشي TUG وانحرافات القوام والمشية',
    subtitleEn: 'Timed Up & Go test, postural deviations & gait mechanics',
    badgeLabelAr: 'حركي وظيفي',
    badgeLabelEn: 'Mobility',
    badgeColorClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800',
    iconName: 'Footprints',
    descriptionAr: 'قياس خطر السقوط والعرج والمشية غير المتزنة',
    descriptionEn: 'Fall risk assessment, antalgic gait, and postural analysis',
  },
  {
    id: 'functional_scales',
    category: 'functional_scales',
    titleAr: 'المقاييس الوظيفية (QuickDASH)',
    titleEn: 'Functional Outcome Scales',
    subtitleAr: 'مقياس الإعاقة الوظيفية للطرف العلوي مع حساب النسبة تلقائياً',
    subtitleEn: 'Upper limb disability score with automated percentage',
    badgeLabelAr: 'مقياس دولي',
    badgeLabelEn: 'Outcome Scale',
    badgeColorClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
    iconName: 'FileCheck',
    descriptionAr: 'استبيان معياري لتقييم صعوبة المهام الحياتية اليومية',
    descriptionEn: 'Standard questionnaire evaluating activities of daily living',
  },
];

export const ExamWidgetShelf: React.FC<ExamWidgetShelfProps> = ({
  onAddWidget,
  onOpenCustomStudio,
  activeWidgetIds,
}) => {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isCompactMode, setIsCompactMode] = useState<boolean>(false);
  const [customWidgets, setCustomWidgets] = useState<CustomWidgetDefinition[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('physiorecord_custom_widgets');
      if (stored) {
        setCustomWidgets(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  const allWidgets: ExamWidgetDescriptor[] = [
    ...BUILT_IN_WIDGETS,
    ...customWidgets.map((cw) => ({
      id: cw.id,
      category: 'custom_ai' as ExamCategory,
      titleAr: cw.titleAr,
      titleEn: cw.titleEn,
      subtitleAr: cw.clinicalSpecialtyAr,
      subtitleEn: cw.clinicalSpecialtyEn,
      badgeLabelAr: 'مخصص AI',
      badgeLabelEn: 'AI Custom',
      badgeColorClass: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950/60 dark:text-fuchsia-300 dark:border-fuchsia-800',
      iconName: 'Sparkles',
      descriptionAr: cw.descriptionAr,
      descriptionEn: cw.descriptionEn,
      isCustom: true,
    })),
  ];

  const filteredWidgets = allWidgets.filter((w) => {
    const matchesCat = selectedCategory === 'all' || w.category === selectedCategory;
    const matchesQuery =
      searchQuery.trim() === '' ||
      w.titleAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.titleEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.descriptionAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.descriptionEn.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  const getWidgetIcon = (iconName: string, small = false) => {
    const cls = small ? 'w-4 h-4' : 'w-5 h-5';
    switch (iconName) {
      case 'MapPin':
        return <MapPin className={`${cls} text-rose-500`} />;
      case 'Activity':
        return <Activity className={`${cls} text-teal-600 dark:text-teal-400`} />;
      case 'Dumbbell':
        return <Dumbbell className={`${cls} text-blue-600 dark:text-blue-400`} />;
      case 'Brain':
        return <Brain className={`${cls} text-purple-600 dark:text-purple-400`} />;
      case 'Stethoscope':
        return <Stethoscope className={`${cls} text-amber-600 dark:text-amber-400`} />;
      case 'Footprints':
        return <Footprints className={`${cls} text-emerald-600 dark:text-emerald-400`} />;
      case 'FileCheck':
        return <FileCheck className={`${cls} text-indigo-600 dark:text-indigo-400`} />;
      case 'Sparkles':
      default:
        return <Sparkles className={`${cls} text-fuchsia-600 dark:text-fuchsia-400`} />;
    }
  };

  const handleDragStart = (e: React.DragEvent, widgetId: string) => {
    e.dataTransfer.setData('text/plain', widgetId);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="space-y-3 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs transition-all">
      {/* Top Header & Shelf Mode Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-600 dark:text-teal-400">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                {isAr ? 'رف الفحوصات والأدوات السريرية (Clinical Shelf)' : 'Clinical Examination Shelf'}
              </h3>
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 tabular-nums">
                {activeWidgetIds.length}/{allWidgets.length} {isAr ? 'مفعل' : 'Active'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Controls: Compact Mode Toggle + Custom Widget Studio */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCompactMode((prev) => !prev)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title={isCompactMode ? (isAr ? 'عرض الشبكة الكاملة' : 'Expand grid') : (isAr ? 'الوضع المضغوط السريع' : 'Compact shelf mode')}
          >
            {isCompactMode ? (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                <span>{isAr ? 'توسيع الرف' : 'Expand Shelf'}</span>
              </>
            ) : (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-slate-500" />
                <span>{isAr ? 'وضع مضغوط' : 'Compact Bar'}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenCustomStudio}
            className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-2xs flex items-center gap-1.5 transition-all shrink-0 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-white" />
            <span>{isAr ? '+ أداة فحص مخصصة' : '+ Custom Exam Tool'}</span>
          </button>
        </div>
      </div>

      {/* Category Filter Tabs & Search Bar (Shown in both modes for instant filtering) */}
      <div className="flex flex-wrap items-center gap-2.5 pt-1 border-t border-slate-100 dark:border-slate-800/80">
        {!isCompactMode && (
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                isAr
                  ? 'ابحث باسم الفحص، المفصل، أو العضلات (مثال: كتف، ROM، ركبة، عصب)...'
                  : 'Search test, joint, muscle (e.g., shoulder, ROM, knee, neuro)...'
              }
              className="w-full ps-8 pe-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-teal-500"
            />
          </div>
        )}

        {/* Categories */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
          {[
            { id: 'all', ar: 'الكل', en: 'All Tools' },
            { id: 'body_chart', ar: 'مخطط الجسم', en: 'Body Map' },
            { id: 'rom_mmt', ar: 'حركة وقوة (ROM/MMT)', en: 'ROM / MMT' },
            { id: 'neurology', ar: 'أعصاب وقطاعات حسية', en: 'Neuro & Dermatomes' },
            { id: 'special_tests', ar: 'اختبارات عظمية', en: 'Orthopedic' },
            { id: 'gait_balance', ar: 'مشي وتوازن', en: 'Gait / TUG' },
            { id: 'functional_scales', ar: 'مقاييس وظيفية', en: 'Scales' },
            { id: 'custom_ai', ar: 'مخصص', en: 'Custom' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                selectedCategory === cat.id
                  ? 'bg-teal-600 text-white shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {isAr ? cat.ar : cat.en}
            </button>
          ))}
        </div>
      </div>

      {/* Mode A: Compact Single-Row Quick Pill Bar */}
      {isCompactMode ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {filteredWidgets.map((widget) => {
            const isAdded = activeWidgetIds.includes(widget.id);
            return (
              <button
                key={widget.id}
                type="button"
                draggable
                onDragStart={(e) => handleDragStart(e, widget.id)}
                onClick={() => onAddWidget(widget.id)}
                className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  isAdded
                    ? 'bg-teal-50 dark:bg-teal-950/60 border-teal-500 text-teal-800 dark:text-teal-200 shadow-2xs'
                    : 'bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-teal-400'
                }`}
              >
                {getWidgetIcon(widget.iconName, true)}
                <span>{isAr ? widget.titleAr : widget.titleEn}</span>
                {isAdded ? (
                  <Check className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
                ) : (
                  <Plus className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>
            );
          })}
        </div>
      ) : (
        /* Mode B: Expanded Clinical Card Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pt-1">
          {filteredWidgets.map((widget) => {
            const isAdded = activeWidgetIds.includes(widget.id);

            return (
              <div
                key={widget.id}
                draggable
                onDragStart={(e) => handleDragStart(e, widget.id)}
                onClick={() => onAddWidget(widget.id)}
                className={`group relative p-3.5 rounded-xl border transition-all cursor-pointer select-none flex flex-col justify-between gap-2.5 ${
                  isAdded
                    ? 'bg-teal-50/60 dark:bg-teal-950/30 border-teal-500/80 ring-1 ring-teal-500/30 shadow-2xs'
                    : 'bg-slate-50/50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-teal-400 dark:hover:border-teal-700 hover:bg-white dark:hover:bg-slate-900'
                }`}
              >
                <div>
                  {/* Top Row: Icon, Badge, Drag Handle */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs group-hover:scale-105 transition-transform">
                      {getWidgetIcon(widget.iconName)}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${widget.badgeColorClass}`}
                      >
                        {isAr ? widget.badgeLabelAr : widget.badgeLabelEn}
                      </span>
                      <GripHorizontal className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
                    </div>
                  </div>

                  {/* Title & Subtitle */}
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors">
                    {isAr ? widget.titleAr : widget.titleEn}
                  </h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                    {isAr ? widget.subtitleAr : widget.subtitleEn}
                  </p>
                </div>

                {/* Bottom State / Action */}
                <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 dark:text-slate-400 font-medium">
                    {isAdded
                      ? isAr
                        ? '✓ مدرج في السجل'
                        : '✓ Active in chart'
                      : isAr
                      ? '+ انقر أو اسحب للإضافة'
                      : '+ Click or drag to add'}
                  </span>
                  <span
                    className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
                      isAdded
                        ? 'bg-teal-600 text-white font-bold'
                        : 'bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 group-hover:bg-teal-600 group-hover:text-white'
                    }`}
                  >
                    {isAdded ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
