// =======================================================================
// PhysioRecord — Comprehensive Validated PT Functional Outcome Measures
// Supports: ODI, NDI, SPADI, LEFS, QuickDASH, and PSFS with Longitudinal Tracking
// =======================================================================

import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type {
  FunctionalScaleEntry,
  ValidatedScaleId,
  OutcomeScoreHistoryPoint,
} from '../../types/clinicalWidgets';
import { FileCheck, Plus, TrendingDown, Trash2 } from 'lucide-react';

interface FunctionalScalesWidgetProps {
  value: FunctionalScaleEntry | undefined;
  onChange: (updated: FunctionalScaleEntry) => void;
  readOnly?: boolean;
}

interface ScaleDefinition {
  id: ValidatedScaleId;
  code: string;
  regionAr: string;
  regionEn: string;
  nameAr: string;
  nameEn: string;
  isHigherBetter?: boolean; // True for LEFS & PSFS
  items: Array<{ id: string; ar: string; en: string }>;
  options: Array<{ val: number; ar: string; en: string }>;
}

const VALIDATED_SCALES: Record<ValidatedScaleId, ScaleDefinition> = {
  odi: {
    id: 'odi',
    code: 'ODI',
    regionAr: 'العمود الفقري القطني وأسفل الظهر',
    regionEn: 'Lumbar Spine & Low Back',
    nameAr: 'مؤشر أوسوستري لإعاقة أسفل الظهر (Oswestry Disability Index - ODI)',
    nameEn: 'Oswestry Low Back Disability Index (ODI)',
    items: [
      { id: 'odi_1', ar: 'شدة ألم أسفل الظهر الحالية', en: 'Pain Intensity' },
      { id: 'odi_2', ar: 'العناية الشخصية (الاغتسال، ارتداء الملابس)', en: 'Personal Care (Washing, Dressing)' },
      { id: 'odi_3', ar: 'رفع الأشياء والأوزان', en: 'Lifting' },
      { id: 'odi_4', ar: 'المشي لمسافات', en: 'Walking' },
      { id: 'odi_5', ar: 'الجلوس على كرسي', en: 'Sitting' },
      { id: 'odi_6', ar: 'الوقوف المستمر', en: 'Standing' },
      { id: 'odi_7', ar: 'النوم ليلاً', en: 'Sleeping' },
      { id: 'odi_8', ar: 'الحياة الاجتماعية والتنقل', en: 'Social Life & Traveling' },
    ],
    options: [
      { val: 0, ar: '0: طبيعي', en: '0: None' },
      { val: 1, ar: '1: طفيف', en: '1: Mild' },
      { val: 2, ar: '2: متوسط', en: '2: Mod' },
      { val: 3, ar: '3: ملحوظ', en: '3: Fairly Severe' },
      { val: 4, ar: '4: شديد جداً', en: '4: Very Severe' },
      { val: 5, ar: '5: عجز تام', en: '5: Complete' },
    ],
  },
  ndi: {
    id: 'ndi',
    code: 'NDI',
    regionAr: 'العمود الفقري العنقي والرقبة',
    regionEn: 'Cervical Spine & Neck',
    nameAr: 'مؤشر إعاقة الرقبة المعتمد (Neck Disability Index - NDI)',
    nameEn: 'Neck Disability Index (NDI)',
    items: [
      { id: 'ndi_1', ar: 'شدة ألم الرقبة حالياً', en: 'Neck Pain Intensity' },
      { id: 'ndi_2', ar: 'العناية الشخصية اليومية', en: 'Personal Care' },
      { id: 'ndi_3', ar: 'القراءة واستخدام الشاشات', en: 'Reading & Screen Use' },
      { id: 'ndi_4', ar: 'الصداع العنقي المنشأ', en: 'Headaches' },
      { id: 'ndi_5', ar: 'التركيز الذهني', en: 'Concentration' },
      { id: 'ndi_6', ar: 'العمل والأنشطة المهنية', en: 'Work Activities' },
      { id: 'ndi_7', ar: 'قيادة السيارة والالتفات', en: 'Driving' },
      { id: 'ndi_8', ar: 'النوم والراحة', en: 'Sleeping' },
    ],
    options: [
      { val: 0, ar: '0: لا إعاقة', en: '0: None' },
      { val: 1, ar: '1: خفيفة', en: '1: Mild' },
      { val: 2, ar: '2: متوسطة', en: '2: Mod' },
      { val: 3, ar: '3: شديدة', en: '3: Severe' },
      { val: 4, ar: '4: بالغة', en: '4: Very Severe' },
      { val: 5, ar: '5: عجز كامل', en: '5: Complete' },
    ],
  },
  spadi: {
    id: 'spadi',
    code: 'SPADI',
    regionAr: 'مفصل الكتف وحزام الكتف',
    regionEn: 'Shoulder Complex',
    nameAr: 'مؤشر ألم وإعاقة الكتف (Shoulder Pain & Disability Index - SPADI)',
    nameEn: 'Shoulder Pain and Disability Index (SPADI)',
    items: [
      { id: 'spadi_1', ar: 'الألم عند الاستلقاء على الجانب المصاب', en: 'Pain lying on involved side' },
      { id: 'spadi_2', ar: 'الألم عند مد اليد لرف مرتفع فوق الرأس', en: 'Pain reaching high shelf' },
      { id: 'spadi_3', ar: 'الألم عند لمس مؤخرة الرقبة', en: 'Pain touching back of neck' },
      { id: 'spadi_4', ar: 'صعوبة غسل الشعر أو الظهر', en: 'Difficulty washing hair or back' },
      { id: 'spadi_5', ar: 'صعوبة ارتداء قميص أو سترة', en: 'Difficulty putting on shirt/coat' },
      { id: 'spadi_6', ar: 'صعوبة حمل جسم وزنه 4.5 كغم (10 أرطال)', en: 'Difficulty carrying 10 lbs (4.5 kg)' },
    ],
    options: [
      { val: 0, ar: '0: لا يوجد', en: '0: None' },
      { val: 2, ar: '2: خفيف', en: '2: Mild' },
      { val: 5, ar: '5: متوسط', en: '5: Mod' },
      { val: 8, ar: '8: شديد', en: '8: Severe' },
      { val: 10, ar: '10: تعذر تام', en: '10: Worst' },
    ],
  },
  lefs: {
    id: 'lefs',
    code: 'LEFS',
    regionAr: 'الطرف السفلي (الورك، الركبة، الكاحل)',
    regionEn: 'Lower Extremity (Hip, Knee, Ankle)',
    nameAr: 'المقياس الوظيفي للطرف السفلي (Lower Extremity Functional Scale - LEFS)',
    nameEn: 'Lower Extremity Functional Scale (LEFS)',
    isHigherBetter: true,
    items: [
      { id: 'lefs_1', ar: 'الجلوس في وضع القرفصاء (Squatting)', en: 'Squatting' },
      { id: 'lefs_2', ar: 'صعود ونزول طابق من الدرج (10 درجات)', en: 'Walking up or down 10 stairs' },
      { id: 'lefs_3', ar: 'الوقوف لمدة ساعة متواصلة', en: 'Standing for 1 hour' },
      { id: 'lefs_4', ar: 'المشي مسافة 1 كيلومتر', en: 'Walking 1 kilometer' },
      { id: 'lefs_5', ar: 'الجري على أرض مستوية أو غير مستوية', en: 'Running on even/uneven ground' },
      { id: 'lefs_6', ar: 'الالتفاف السريع أثناء الجري أو المشي (Cutting)', en: 'Making sharp turns' },
    ],
    options: [
      { val: 0, ar: '0: صعوبة قصوى', en: '0: Unable' },
      { val: 1, ar: '1: صعوبة كبيرة', en: '1: Quite a bit' },
      { val: 2, ar: '2: متوسطة', en: '2: Moderate' },
      { val: 3, ar: '3: صعوبة طفيفة', en: '3: A little bit' },
      { val: 4, ar: '4: بلا صعوبة', en: '4: No difficulty' },
    ],
  },
  quickdash: {
    id: 'quickdash',
    code: 'QuickDASH',
    regionAr: 'الطرف العلوي (الكتف، المرفق، الرسغ، اليد)',
    regionEn: 'Upper Extremity',
    nameAr: 'مقياس الإعاقة المختصر للطرف العلوي (QuickDASH)',
    nameEn: 'QuickDASH Upper Extremity Scale',
    items: [
      { id: 'q1', ar: 'فتح برطمان محكم أو جديد', en: 'Open a tight or new jar' },
      { id: 'q2', ar: 'القيام بالأعمال المنزلية الثقيلة', en: 'Heavy household chores' },
      { id: 'q3', ar: 'حمل حقيبة تسوق أو حقيبة سفر', en: 'Carry a shopping bag or briefcase' },
      { id: 'q4', ar: 'غسل أو تجفيف ظهرك', en: 'Wash or dry your back' },
      { id: 'q5', ar: 'استخدام سكين لتقطيع الطعام', en: 'Use a knife to cut food' },
      { id: 'q6', ar: 'الأنشطة الرياضية التي تتطلب استخدام القوة', en: 'Recreational activities requiring force' },
    ],
    options: [
      { val: 1, ar: '1: لا صعوبة', en: '1: None' },
      { val: 2, ar: '2: خفيفة', en: '2: Mild' },
      { val: 3, ar: '3: متوسطة', en: '3: Mod' },
      { val: 4, ar: '4: شديدة', en: '4: Severe' },
      { val: 5, ar: '5: عجز تام', en: '5: Unable' },
    ],
  },
  psfs: {
    id: 'psfs',
    code: 'PSFS',
    regionAr: 'مقياس الأنشطة الخاصة بالمريض (عام لكافة الحالات)',
    regionEn: 'Patient-Specific Functional Scale (All Regions)',
    nameAr: 'المقياس الوظيفي الخاص بالمريض (PSFS 0–10)',
    nameEn: 'Patient-Specific Functional Scale (PSFS)',
    isHigherBetter: true,
    items: [],
    options: [],
  },
  oswestry: {
    id: 'odi',
    code: 'ODI',
    regionAr: 'العمود الفقري القطني',
    regionEn: 'Lumbar Spine',
    nameAr: 'مؤشر أوسوستري (ODI)',
    nameEn: 'Oswestry Disability Index (ODI)',
    items: [],
    options: [],
  },
};

const SCALE_TABS: ValidatedScaleId[] = ['odi', 'ndi', 'spadi', 'lefs', 'quickdash', 'psfs'];

export const FunctionalScalesWidget: React.FC<FunctionalScalesWidgetProps> = ({
  value,
  onChange,
  readOnly = false,
}) => {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const initialScale: ValidatedScaleId =
    value?.scaleId && value.scaleId !== 'oswestry' ? value.scaleId : 'odi';
  const [selectedScaleId, setSelectedScaleId] = useState<ValidatedScaleId>(initialScale);
  const [visitTypeForLog, setVisitTypeForLog] = useState<
    OutcomeScoreHistoryPoint['visitType']
  >('initial_evaluation');
  const [newPsfsActivity, setNewPsfsActivity] = useState('');

  const activeScale = VALIDATED_SCALES[selectedScaleId] || VALIDATED_SCALES.odi;
  const responses = value?.responses || {};
  const psfsActivities = value?.psfsActivities || [
    { id: 'psfs_1', activity: isAr ? 'صعود الدرج دون ألم' : 'Climbing stairs pain-free', score0to10: 4 },
    { id: 'psfs_2', activity: isAr ? 'الجلوس للعمل المكتبي 45 دقيقة' : 'Sitting at desk for 45 mins', score0to10: 5 },
  ];
  const history = value?.history || [];

  const computeAndEmit = (
    scaleDef: ScaleDefinition,
    updatedResponses: Record<string, number>,
    updatedPsfs = psfsActivities,
    updatedHistory = history
  ) => {
    let percentage = 0;
    if (scaleDef.id === 'psfs') {
      if (updatedPsfs.length > 0) {
        const avg =
          updatedPsfs.reduce((sum, item) => sum + item.score0to10, 0) / updatedPsfs.length;
        percentage = Math.round(avg * 10);
      }
    } else {
      const answeredIds = scaleDef.items
        .map((i) => i.id)
        .filter((id) => updatedResponses[id] !== undefined);

      if (answeredIds.length > 0) {
        const sum = answeredIds.reduce((acc, k) => acc + updatedResponses[k], 0);
        const count = answeredIds.length;
        if (scaleDef.id === 'quickdash') {
          percentage = Math.round(((sum / count - 1) * 25) * 10) / 10;
        } else if (scaleDef.id === 'spadi') {
          percentage = Math.round((sum / (count * 10)) * 100);
        } else if (scaleDef.id === 'lefs') {
          percentage = Math.round((sum / (count * 4)) * 100);
        } else {
          // ODI & NDI (0 to 5 per item)
          percentage = Math.round((sum / (count * 5)) * 100);
        }
      }
    }

    let severityLabelAr = '';
    let severityLabelEn = '';

    if (scaleDef.isHigherBetter) {
      // LEFS / PSFS: 100% = full function
      if (percentage >= 75) {
        severityLabelAr = 'كفاءة وظيفية عالية (High Function)';
        severityLabelEn = 'High Functional Level';
      } else if (percentage >= 45) {
        severityLabelAr = 'محدودية وظيفية متوسطة (Moderate Limitation)';
        severityLabelEn = 'Moderate Functional Limitation';
      } else {
        severityLabelAr = 'محدودية وظيفية شديدة (Severe Limitation)';
        severityLabelEn = 'Severe Functional Limitation';
      }
    } else {
      // Disability scales (ODI, NDI, SPADI, QuickDASH): 0% = no disability
      if (percentage <= 20) {
        severityLabelAr = 'عجز وظيفي طفيف (Minimal Disability)';
        severityLabelEn = 'Minimal Disability';
      } else if (percentage <= 40) {
        severityLabelAr = 'عجز وظيفي متوسط (Moderate Disability)';
        severityLabelEn = 'Moderate Disability';
      } else if (percentage <= 60) {
        severityLabelAr = 'عجز وظيفي شديد (Severe Disability)';
        severityLabelEn = 'Severe Disability';
      } else {
        severityLabelAr = 'إعاقة وظيفية بالغة (Crippling Disability)';
        severityLabelEn = 'Very Severe Disability';
      }
    }

    onChange({
      scaleId: scaleDef.id,
      scaleNameAr: scaleDef.nameAr,
      scaleNameEn: scaleDef.nameEn,
      scorePercentage: percentage,
      severityLabelAr,
      severityLabelEn,
      responses: updatedResponses,
      psfsActivities: updatedPsfs,
      history: updatedHistory,
    });
  };

  const handleSelectScale = (id: ValidatedScaleId) => {
    setSelectedScaleId(id);
    const def = VALIDATED_SCALES[id];
    computeAndEmit(def, responses, psfsActivities, history);
  };

  const handleScoreChange = (qId: string, score: number) => {
    if (readOnly) return;
    const updatedResponses = { ...responses, [qId]: score };
    computeAndEmit(activeScale, updatedResponses, psfsActivities, history);
  };

  const handleAddPsfsActivity = () => {
    if (!newPsfsActivity.trim() || readOnly) return;
    const updatedPsfs = [
      ...psfsActivities,
      {
        id: `psfs_${Date.now()}`,
        activity: newPsfsActivity.trim(),
        score0to10: 5,
      },
    ];
    setNewPsfsActivity('');
    computeAndEmit(activeScale, responses, updatedPsfs, history);
  };

  const handleUpdatePsfsScore = (id: string, score0to10: number) => {
    if (readOnly) return;
    const updatedPsfs = psfsActivities.map((a) =>
      a.id === id ? { ...a, score0to10 } : a
    );
    computeAndEmit(activeScale, responses, updatedPsfs, history);
  };

  const handleRemovePsfsActivity = (id: string) => {
    if (readOnly) return;
    const updatedPsfs = psfsActivities.filter((a) => a.id !== id);
    computeAndEmit(activeScale, responses, updatedPsfs, history);
  };

  const handleLogToHistory = () => {
    if (readOnly) return;
    const currentScore = value?.scorePercentage ?? 0;
    const newPoint: OutcomeScoreHistoryPoint = {
      id: `hist_${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      visitType: visitTypeForLog,
      scaleId: activeScale.id,
      scaleNameAr: activeScale.code,
      scaleNameEn: activeScale.code,
      scorePercentage: currentScore,
      severityLabelAr: value?.severityLabelAr || '',
      severityLabelEn: value?.severityLabelEn || '',
    };
    const updatedHistory = [...history, newPoint];
    computeAndEmit(activeScale, responses, psfsActivities, updatedHistory);
  };

  const currentScore = value?.scorePercentage ?? 0;

  return (
    <div className="space-y-4">
      {/* Scale Selector Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
        {SCALE_TABS.map((scaleKey) => {
          const def = VALIDATED_SCALES[scaleKey];
          const isSelected = selectedScaleId === scaleKey;
          return (
            <button
              key={scaleKey}
              type="button"
              onClick={() => handleSelectScale(scaleKey)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                isSelected
                  ? 'bg-teal-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>{def.code}</span>
              <span className="text-[10px] opacity-80 ms-1.5 hidden sm:inline">
                ({isAr ? def.regionAr.split(' ')[0] : def.regionEn.split(' ')[0]})
              </span>
            </button>
          );
        })}
      </div>

      {/* Active Scale Summary Card & Longitudinal Logger */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
            <FileCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span>{isAr ? activeScale.nameAr : activeScale.nameEn}</span>
          </h4>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {activeScale.isHigherBetter
              ? isAr
                ? 'مقياس كفاءة وظيفية: الدرجة الأعلى (100%) تعني قدرة وظيفية أفضل'
                : 'Functional Capacity Scale: Higher score (100%) indicates better function'
              : isAr
              ? 'مقياس عجز وظيفي: الدرجة الأقل (0%) تعني تحسناً وانخفاضاً في الإعاقة'
              : 'Disability Scale: Lower score (0%) indicates less disability & clinical improvement'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="text-center">
              <div className="text-lg font-extrabold font-mono tabular-nums text-teal-600 dark:text-teal-400">
                {currentScore}%
              </div>
              <div className="text-[10px] text-slate-500 font-bold">
                {activeScale.code}
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
            <div className="text-xs font-bold text-slate-800 dark:text-slate-200 max-w-[160px]">
              {isAr
                ? value?.severityLabelAr || 'يرجى استكمال البنود'
                : value?.severityLabelEn || 'Complete items below'}
            </div>
          </div>

          {!readOnly && (
            <div className="flex items-center gap-1.5">
              <select
                value={visitTypeForLog}
                onChange={(e) => setVisitTypeForLog(e.target.value as any)}
                className="px-2.5 py-1.5 text-xs rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 font-medium"
              >
                <option value="initial_evaluation">
                  {isAr ? 'تقييم أولي (Baseline)' : 'Initial Eval'}
                </option>
                <option value="re_evaluation">
                  {isAr ? 'إعادة تقييم (Re-eval)' : 'Re-evaluation'}
                </option>
                <option value="discharge">
                  {isAr ? 'تقييم التخريج (Discharge)' : 'Discharge'}
                </option>
              </select>
              <button
                type="button"
                onClick={handleLogToHistory}
                className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isAr ? 'تثبيت النتيجة للمقارنة' : 'Record Snapshot'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Scale Items / Questionnaire */}
      {activeScale.id === 'psfs' ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newPsfsActivity}
              onChange={(e) => setNewPsfsActivity(e.target.value)}
              placeholder={
                isAr
                  ? 'أضف نشاطاً وظيفياً يهم المريض (مثال: الصلاة، حمل الطفل، الجري)...'
                  : 'Add patient-specific activity (e.g., lifting child, kneeling)...'
              }
              className="flex-1 px-3.5 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
            />
            <button
              type="button"
              onClick={handleAddPsfsActivity}
              className="px-3.5 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
            >
              {isAr ? '+ إضافة نشاط' : '+ Add Activity'}
            </button>
          </div>

          <div className="space-y-2">
            {psfsActivities.map((act, idx) => (
              <div
                key={act.id}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-bold text-[10px] flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {act.activity}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={act.score0to10}
                    onChange={(e) => handleUpdatePsfsScore(act.id, Number(e.target.value))}
                    className="w-32 accent-teal-600 cursor-pointer"
                  />
                  <span className="text-xs font-mono font-bold tabular-nums text-teal-600 dark:text-teal-400 w-12 text-end">
                    {act.score0to10}/10
                  </span>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => handleRemovePsfsActivity(act.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {activeScale.items.map((q, idx) => {
            const selectedVal = responses[q.id];
            return (
              <div
                key={q.id}
                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                    {idx + 1}
                  </span>
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    {isAr ? q.ar : q.en}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1 shrink-0">
                  {activeScale.options.map((opt) => (
                    <button
                      key={opt.val}
                      type="button"
                      disabled={readOnly}
                      onClick={() => handleScoreChange(q.id, opt.val)}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                        selectedVal === opt.val
                          ? 'bg-teal-600 text-white font-bold shadow-2xs'
                          : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      {isAr ? opt.ar : opt.en}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Longitudinal Score History Table */}
      {history.length > 0 && (
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
            <TrendingDown className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <span>
              {isAr
                ? 'سجل المقارنة الزمنية لمقاييس النتائج الوظيفية (Outcome Trajectory):'
                : 'Longitudinal Outcome Score History:'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-2 px-3 text-start">{isAr ? 'التاريخ' : 'Date'}</th>
                  <th className="py-2 px-3 text-start">{isAr ? 'مرحلة التقييم' : 'Visit Stage'}</th>
                  <th className="py-2 px-3 text-start">{isAr ? 'المقياس' : 'Scale'}</th>
                  <th className="py-2 px-3 text-start">{isAr ? 'النتيجة' : 'Score'}</th>
                  <th className="py-2 px-3 text-start">{isAr ? 'التصنيف السريري' : 'Interpretation'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {history.map((pt) => (
                  <tr key={pt.id} className="tabular-nums">
                    <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-400">{pt.date}</td>
                    <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                      {pt.visitType === 'initial_evaluation'
                        ? isAr
                          ? 'التقييم الأولي'
                          : 'Initial Eval'
                        : pt.visitType === 're_evaluation'
                        ? isAr
                          ? 'إعادة تقييم'
                          : 'Re-evaluation'
                        : isAr
                        ? 'التخريج'
                        : 'Discharge'}
                    </td>
                    <td className="py-2 px-3 font-mono font-bold text-teal-700 dark:text-teal-400">
                      {pt.scaleNameEn}
                    </td>
                    <td className="py-2 px-3 font-mono font-bold text-slate-900 dark:text-white">
                      {pt.scorePercentage}%
                    </td>
                    <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                      {isAr ? pt.severityLabelAr : pt.severityLabelEn}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
