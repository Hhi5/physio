// =======================================================================
// PhysioRecord — In-App AI Custom Widget Studio Modal
// Copy AI Prompt -> Paste & Import Widget JSON -> Live Interactive Preview -> Save
// =======================================================================

import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type { CustomWidgetDefinition } from '../../types/clinicalWidgets';
import { DynamicCustomWidget } from '../widgets/DynamicCustomWidget';
import {
  Sparkles,
  Copy,
  Check,
  Code2,
  Play,
  Save,
  X,
  FileText,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

interface CustomWidgetStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWidgetCreated: (widget: CustomWidgetDefinition) => void;
}

const AI_PROMPT_TEMPLATE = `أنت خبير في هندسة النظم السريرية والعلاج الطبيعي.
أريدك أن تنشئ لي فحصاً سريرياً مخصصاً لتطبيق PhysioRecord بصيغة JSON نظيفة وصالحة فقط (دون شروحات نصية خارج كائن الـ JSON).

المطلوب مني كمعالج فيزيائي هو:
[اكتب هنا اسم الفحص ومواصفاته السريرية وما تريد اختباره بالتفصيل، مثلاً: فحص التوازن الدهليزي، أو فحص العصب السابع، أو تقييم إصابات الركبة الرياضية]

يجب أن يلتزم كائن الـ JSON بالهيكل الدقيق التالي:
{
  "id": "معرف_فريد_بالانجليزية_بدون_مسافات_مثال_vestibular_balance",
  "titleAr": "اسم الفحص بالعربية",
  "titleEn": "Clinical Test Name in English",
  "category": "custom_ai",
  "clinicalSpecialtyAr": "التخصص السريري بالعربية (مثال: تأهيل دهليزي وعصبي)",
  "clinicalSpecialtyEn": "Specialty in English (e.g. Vestibular & Neuro Rehab)",
  "descriptionAr": "وصف دقيق للهدف السريري من الفحص",
  "descriptionEn": "Clinical purpose of this assessment",
  "version": "1.0.0",
  "fields": [
    {
      "id": "field_1",
      "type": "slider | number | radio | select | text",
      "labelAr": "عنوان السؤال أو القياس بالعربية",
      "labelEn": "Field Label in English",
      "min": 0,
      "max": 10,
      "step": 1,
      "unit": "ثانية أو درجة (اختياري)",
      "options": [
        { "value": "normal", "labelAr": "طبيعي", "labelEn": "Normal", "score": 0 },
        { "value": "mild", "labelAr": "طفيف", "labelEn": "Mild", "score": 1 },
        { "value": "severe", "labelAr": "شديد", "labelEn": "Severe", "score": 3 }
      ]
    }
  ],
  "interpretations": [
    {
      "minScore": 0,
      "maxScore": 2,
      "severityAr": "أداء طبيعي / استجابة سليمة",
      "severityEn": "Normal Function",
      "clinicalRecommendationAr": "متابعة الخطة العلاجية الحالية"
    },
    {
      "minScore": 3,
      "maxScore": 10,
      "severityAr": "خلل وظيفي يتطلب تدخلاً علاجياً",
      "severityEn": "Significant Impairment",
      "clinicalRecommendationAr": "إدراج تمارين الاستقرار والتوازن الدهليزي مرتين يومياً"
    }
  ]
}`;

const PRESET_BELLS_PALSY: CustomWidgetDefinition = {
  id: 'facial_nerve_bells_palsy',
  titleAr: 'تقييم شلل العصب السابع الوجهي (House-Brackmann)',
  titleEn: "House-Brackmann Facial Nerve Scale",
  category: 'custom_ai',
  clinicalSpecialtyAr: 'التأهيل العصبي لعضلات الوجه',
  clinicalSpecialtyEn: 'Facial Neuromuscular Rehabilitation',
  descriptionAr: 'تقييم تناظر عضلات الوجه (رفع الحواجب، إغلاق العين، الابتسام، النفخ)',
  descriptionEn: 'Assess facial muscle symmetry at rest and during voluntary motion',
  version: '1.0.0',
  createdAt: new Date().toISOString(),
  fields: [
    {
      id: 'forehead_wrinkle',
      type: 'radio',
      labelAr: 'حركة الجبهة وتجاعيد رفع الحواجب:',
      labelEn: 'Forehead Wrinkling (Frontalis):',
      options: [
        { value: 'normal', labelAr: 'تناظر تام', labelEn: 'Normal', score: 0 },
        { value: 'mild_weakness', labelAr: 'ضعف طفيف', labelEn: 'Mild Weakness', score: 1 },
        { value: 'absent', labelAr: 'غياب تام للحركة', labelEn: 'Absent', score: 2 },
      ],
    },
    {
      id: 'eye_closure',
      type: 'radio',
      labelAr: 'إغلاق العين بإحكام (Orbicularis Oculi):',
      labelEn: 'Eye Closure (Orbicularis Oculi):',
      options: [
        { value: 'complete_effortless', labelAr: 'إغلاق كامل بسهولة', labelEn: 'Complete', score: 0 },
        { value: 'complete_with_effort', labelAr: 'إغلاق كامل بجهد', labelEn: 'Complete with effort', score: 1 },
        { value: 'incomplete', labelAr: 'إغلاق غير كامل (ظهور البياض)', labelEn: 'Incomplete', score: 3 },
      ],
    },
    {
      id: 'smile_symmetry',
      type: 'radio',
      labelAr: 'تناظر الابتسامة وإظهار الأسنان:',
      labelEn: 'Smile Symmetry:',
      options: [
        { value: 'symmetric', labelAr: 'متناظرة تماماً', labelEn: 'Symmetric', score: 0 },
        { value: 'asymmetric_mild', labelAr: 'انحراف طفيف', labelEn: 'Mild Asymmetry', score: 1 },
        { value: 'asymmetric_severe', labelAr: 'انحراف شديد', labelEn: 'Severe Asymmetry', score: 2 },
      ],
    },
    {
      id: 'lip_pucker',
      type: 'radio',
      labelAr: 'ضم الشفتين والنفخ (الزر التعبيري):',
      labelEn: 'Lip Pucker & Puffing:',
      options: [
        { value: 'tight_seal', labelAr: 'إغلاق محكم دون تسريب هواء', labelEn: 'Tight Seal', score: 0 },
        { value: 'mild_air_leak', labelAr: 'تسريب هواء طفيف', labelEn: 'Mild Leak', score: 1 },
        { value: 'severe_leak', labelAr: 'تعذر الضم تماماً', labelEn: 'Unable', score: 2 },
      ],
    },
  ],
  interpretations: [
    {
      minScore: 0,
      maxScore: 1,
      severityAr: 'الدرجة الأولى / شلل طفيف جداً أو متعافي (Grade I-II)',
      severityEn: 'Grade I-II: Normal or Mild Dysfunction',
      clinicalRecommendationAr: 'المتابعة بتمارين المقاومة الخفيفة والمراقبة',
    },
    {
      minScore: 2,
      maxScore: 4,
      severityAr: 'الدرجة الثالثة / ضعف وظيفي متوسط (Grade III)',
      severityEn: 'Grade III: Moderate Dysfunction',
      clinicalRecommendationAr: 'تطبيق التنبيه الكهربائي الحسي الخفيف وإعادة التأهيل العصبي العضلي',
    },
    {
      minScore: 5,
      maxScore: 10,
      severityAr: 'الدرجة الرابعة إلى الخامسة / ضعف شديد (Grade IV-V)',
      severityEn: 'Grade IV-V: Moderately Severe to Severe',
      clinicalRecommendationAr: 'حماية العين بترطيب مستمر وخطط التحفيز المركز للوجه',
    },
  ],
};

export const CustomWidgetStudioModal: React.FC<CustomWidgetStudioModalProps> = ({
  isOpen,
  onClose,
  onWidgetCreated,
}) => {
  const { language, isRtl } = useLanguage();
  const isAr = language === 'ar';

  const [activeTab, setActiveTab] = useState<'prompt' | 'import'>('prompt');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [jsonInput, setJsonInput] = useState('');
  const [parsedWidget, setParsedWidget] = useState<CustomWidgetDefinition | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [previewState, setPreviewState] = useState<Record<string, unknown>>({});

  if (!isOpen) return null;

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(AI_PROMPT_TEMPLATE);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 3000);
  };

  const handleLoadPreset = () => {
    setJsonInput(JSON.stringify(PRESET_BELLS_PALSY, null, 2));
    setParsedWidget(PRESET_BELLS_PALSY);
    setParseError(null);
  };

  const handleValidateJson = () => {
    try {
      setParseError(null);
      const parsed = JSON.parse(jsonInput);
      if (!parsed.id || !parsed.titleAr || !parsed.titleEn || !Array.isArray(parsed.fields)) {
        throw new Error(
          isAr
            ? 'الكود غير مطابق: يجب أن يحتوي على id, titleAr, titleEn, ومصفوفة fields صالحة.'
            : 'Invalid widget schema: missing id, titleAr, titleEn, or fields array.'
        );
      }
      setParsedWidget(parsed);
    } catch (err: unknown) {
      setParseError(err instanceof Error ? err.message : 'Invalid JSON syntax');
      setParsedWidget(null);
    }
  };

  const handleSaveToClinic = () => {
    if (!parsedWidget) return;

    try {
      const existingStr = localStorage.getItem('physiorecord_custom_widgets');
      const existing: CustomWidgetDefinition[] = existingStr ? JSON.parse(existingStr) : [];
      const filtered = existing.filter((w) => w.id !== parsedWidget.id);
      const updated = [...filtered, parsedWidget];

      localStorage.setItem('physiorecord_custom_widgets', JSON.stringify(updated));
      onWidgetCreated(parsedWidget);
      onClose();
    } catch (e: unknown) {
      setParseError(e instanceof Error ? e.message : 'Error saving custom widget');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-850 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-600 text-white">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isAr ? 'استوديو بناء الفحوصات السريرية المخصصة' : 'Custom Clinical Widget Studio'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isAr
                  ? 'صمم أي فحص سريري مخصص وأضفه لرف أدوات الفحص في عيادتك'
                  : 'Design custom clinical tests and import them into your clinic shelf'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center px-6 pt-3 gap-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setActiveTab('prompt')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'prompt'
                ? 'text-teal-600 dark:text-teal-400 border-teal-600 dark:border-teal-500 bg-teal-50/50 dark:bg-slate-850'
                : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Copy className="w-4 h-4" />
            <span>{isAr ? '1. نسخ القالب القياسي' : '1. Copy Schema Template'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('import')}
            className={`px-4 py-2.5 text-xs font-bold rounded-t-xl transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === 'import'
                ? 'text-teal-600 dark:text-teal-400 border-teal-600 dark:border-teal-500 bg-teal-50/50 dark:bg-slate-850'
                : 'text-slate-500 dark:text-slate-400 border-transparent hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <Code2 className="w-4 h-4" />
            <span>{isAr ? '2. لصق الكود والمعاينة الحية' : '2. Paste Code & Live Preview'}</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'prompt' ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-fuchsia-950/20 border border-fuchsia-800/40 text-xs text-fuchsia-200 leading-relaxed space-y-2">
                <p className="font-bold flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-fuchsia-400" />
                  <span>{isAr ? 'كيف تستخدم هذه الميزة؟' : 'How does this work?'}</span>
                </p>
                <ol className="list-decimal list-inside space-y-1 text-slate-300">
                  <li>
                    {isAr
                      ? 'اضغط على زر "نسخ البرومبت" أدناه.'
                      : 'Click the "Copy AI Prompt" button below.'}
                  </li>
                  <li>
                    {isAr
                      ? 'افتح ChatGPT أو Claude أو Gemini، والصق البرومبت، واكتب ما تريده في السطر المخصص (مثلاً: "أريد فحص توازن الأطفال").'
                      : 'Open ChatGPT, Claude, or Gemini, paste the prompt, and specify your clinical test request.'}
                  </li>
                  <li>
                    {isAr
                      ? 'انسخ كود الـ JSON الذي سيعطيك إياه الذكاء الاصطناعي.'
                      : 'Copy the JSON code provided by the AI.'}
                  </li>
                  <li>
                    {isAr
                      ? 'ارجع للتبويب الثاني هنا (لصق الكود والمعاينة) والصق الكود واضغط حفظ!'
                      : 'Switch to the "Paste Code & Live Preview" tab, paste it, and save to your clinic!'}
                  </li>
                </ol>
              </div>

              {/* Prompt Text Box */}
              <div className="relative">
                <textarea
                  readOnly
                  rows={10}
                  value={AI_PROMPT_TEMPLATE}
                  className="w-full p-4 font-mono text-xs rounded-2xl bg-slate-950 border border-slate-800 text-slate-300 select-all focus:outline-hidden"
                />
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className="absolute top-3 right-3 rtl:right-auto rtl:left-3 px-3 py-1.5 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                >
                  {copiedPrompt ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300" />
                      <span>{isAr ? 'تم النسخ!' : 'Copied!'}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>{isAr ? 'نسخ البرومبت' : 'Copy Prompt'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-200">
                  {isAr ? 'الصق كود الـ JSON الناتج من الذكاء الاصطناعي:' : 'Paste AI Generated JSON Code:'}
                </label>
                <button
                  type="button"
                  onClick={handleLoadPreset}
                  className="text-xs text-fuchsia-400 hover:text-fuchsia-300 font-semibold underline"
                >
                  {isAr ? 'تجربة نموذج جاهز (شلل العصب السابع Bell\'s Palsy)' : 'Load sample preset (Bell\'s Palsy)'}
                </button>
              </div>

              <textarea
                rows={7}
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder={isAr ? 'الصق كود JSON هنا...' : 'Paste JSON code here...'}
                className="w-full p-3 font-mono text-xs rounded-xl bg-slate-950 border border-slate-800 text-slate-200 focus:outline-hidden focus:border-fuchsia-500"
              />

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleValidateJson}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Play className="w-4 h-4 text-teal-400" />
                  <span>{isAr ? 'معاينة وتشغيل الفحص' : 'Validate & Preview'}</span>
                </button>

                {parseError && (
                  <p className="text-xs text-rose-400 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{parseError}</span>
                  </p>
                )}
              </div>

              {/* Live Preview Container */}
              {parsedWidget && (
                <div className="space-y-3 pt-3 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <Check className="w-4 h-4" />
                      <span>{isAr ? 'المعاينة الحية التفاعلية للفحص:' : 'Live Interactive Test Preview:'}</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleSaveToClinic}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                    >
                      <Save className="w-4 h-4" />
                      <span>{isAr ? 'حفظ وإضافة إلى العيادة' : 'Save to Clinic Repository'}</span>
                    </button>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
                    <DynamicCustomWidget
                      definition={parsedWidget}
                      value={previewState}
                      onChange={setPreviewState}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
