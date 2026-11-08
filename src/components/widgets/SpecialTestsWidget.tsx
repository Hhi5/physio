// =======================================================================
// PhysioRecord — Orthopedic Provocative Special Tests Widget
// Shoulder, Knee, Spine, Hip, Elbow & Wrist Tests with 1-Click Status
// =======================================================================

import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type { OrthopedicSpecialTestItem, SpecialTestOutcome } from '../../types/clinicalWidgets';
import { Stethoscope, CheckCircle2, AlertTriangle, XCircle, HelpCircle, Filter } from 'lucide-react';

interface SpecialTestsWidgetProps {
  value: OrthopedicSpecialTestItem[] | undefined;
  onChange: (updated: OrthopedicSpecialTestItem[]) => void;
  readOnly?: boolean;
}

const MASTER_SPECIAL_TESTS: Omit<OrthopedicSpecialTestItem, 'outcome' | 'notes' | 'painScoreNrs'>[] = [
  // Shoulder
  { id: 'neer', joint: 'shoulder', nameEn: 'Neer Impingement Test', nameAr: 'اختبار نير للانحشار', targetPathologyEn: 'Subacromial Impingement', targetPathologyAr: 'متلازمة انحشار تحت الأخرم' },
  { id: 'hawkins_kennedy', joint: 'shoulder', nameEn: 'Hawkins-Kennedy Test', nameAr: 'اختبار هوكنز-كينيدي', targetPathologyEn: 'Supraspinatus Tendinopathy', targetPathologyAr: 'اعتلال وتر فوق الشوكة' },
  { id: 'empty_can', joint: 'shoulder', nameEn: 'Empty Can (Jobe Test)', nameAr: 'اختبار العلبة الفارغة (جوب)', targetPathologyEn: 'Supraspinatus Tear', targetPathologyAr: 'تمزق وتر فوق الشوكة' },
  { id: 'speeds', joint: 'shoulder', nameEn: "Speed's Test", nameAr: 'اختبار سبيد', targetPathologyEn: 'Biceps Tendinopathy / SLAP', targetPathologyAr: 'اعتلال وتر ذات الرأسين / إصابة الشفا' },
  
  // Knee
  { id: 'lachman', joint: 'knee', nameEn: 'Lachman Test', nameAr: 'اختبار لاخمان', targetPathologyEn: 'ACL Tear (High Sensitivity)', targetPathologyAr: 'تمزق الرباط الصليبي الأمامي' },
  { id: 'anterior_drawer_knee', joint: 'knee', nameEn: 'Anterior Drawer Test', nameAr: 'اختبار الجارور الأمامي للركبة', targetPathologyEn: 'ACL Instability', targetPathologyAr: 'عدم ثباتية الرباط الصليبي الأمامي' },
  { id: 'mcmurray', joint: 'knee', nameEn: "McMurray's Test", nameAr: 'اختبار ماكموراي', targetPathologyEn: 'Meniscal Tear', targetPathologyAr: 'تمزق الغضروف الهلالي' },
  { id: 'patellar_apprehension', joint: 'knee', nameEn: 'Patellar Apprehension Test', nameAr: 'اختبار خوف الرضفة (Apprehension)', targetPathologyEn: 'Patellar Instability / Subluxation', targetPathologyAr: 'عدم ثباتية أو خلع الرضفة' },

  // Spine
  { id: 'slr', joint: 'cervical', nameEn: 'Straight Leg Raise (SLR)', nameAr: 'رفع الساق المستقيمة (SLR)', targetPathologyEn: 'L4-S1 Lumbar Radiculopathy', targetPathologyAr: 'اعتلال الجذور العصبية القطنية' },
  { id: 'slump', joint: 'lumbar', nameEn: 'Slump Test', nameAr: 'اختبار الانحناء العصبي (Slump)', targetPathologyEn: 'Neural Tissue Mechanosensitivity', targetPathologyAr: 'حساسية التوتر العصبي السحائي' },
  { id: 'spurling', joint: 'cervical', nameEn: "Spurling's Compression Test", nameAr: 'اختبار سبورلينغ الضاغط', targetPathologyEn: 'Cervical Radiculopathy', targetPathologyAr: 'اعتلال الجذور العنقية' },

  // Hip
  { id: 'faber', joint: 'hip', nameEn: 'FABER (Patrick Test)', nameAr: 'اختبار فابر (باتريك)', targetPathologyEn: 'SI Joint Pathology / Hip Pathology', targetPathologyAr: 'اعتلال المفصل العجزي الحرقفي أو الورك' },
  { id: 'thomas', joint: 'hip', nameEn: 'Thomas Test', nameAr: 'اختبار توماس', targetPathologyEn: 'Iliopsoas Tightness', targetPathologyAr: 'قصر وتيبس العضلة الحرقفية القطنية' },

  // Elbow & Wrist
  { id: 'cozens', joint: 'elbow_wrist', nameEn: "Cozen's Test", nameAr: 'اختبار كوزن', targetPathologyEn: 'Lateral Epicondylalgia (Tennis Elbow)', targetPathologyAr: 'التهاب اللقيمة الوحشية (مرفق التنس)' },
  { id: 'phalen', joint: 'elbow_wrist', nameEn: "Phalen's Maneuver", nameAr: 'مناورة فالين', targetPathologyEn: 'Carpal Tunnel Syndrome (Median Nerve)', targetPathologyAr: 'متلازمة النفق الرسغي (العصب الناصف)' },
  { id: 'finkelstein', joint: 'elbow_wrist', nameEn: "Finkelstein's Test", nameAr: 'اختبار فينكلشتاين', targetPathologyEn: "De Quervain's Tenosynovitis", targetPathologyAr: 'التهاب غمد الوتر لدي كيرفان' },
];

export const SpecialTestsWidget: React.FC<SpecialTestsWidgetProps> = ({
  value = [],
  onChange,
  readOnly = false,
}) => {
  const { language, isRtl } = useLanguage();
  const isAr = language === 'ar';

  const [selectedJoint, setSelectedJoint] = useState<string>('all');

  const handleSetOutcome = (testId: string, outcome: SpecialTestOutcome) => {
    if (readOnly) return;
    const testDef = MASTER_SPECIAL_TESTS.find((t) => t.id === testId);
    if (!testDef) return;

    const existingIndex = value.findIndex((v) => v.id === testId);
    const updated = [...value];

    if (existingIndex >= 0) {
      if (value[existingIndex].outcome === outcome) {
        // Toggle off
        updated.splice(existingIndex, 1);
      } else {
        updated[existingIndex] = {
          ...updated[existingIndex],
          outcome,
        };
      }
    } else {
      updated.push({
        ...testDef,
        outcome,
      });
    }

    onChange(updated);
  };

  const getOutcome = (testId: string): SpecialTestOutcome => {
    const item = value.find((v) => v.id === testId);
    return item?.outcome || 'not_tested';
  };

  const filteredTests =
    selectedJoint === 'all'
      ? MASTER_SPECIAL_TESTS
      : MASTER_SPECIAL_TESTS.filter((t) => t.joint === selectedJoint);

  const positiveCount = value.filter((v) => v.outcome === 'positive' || v.outcome === 'pain_reproduced').length;

  return (
    <div className="space-y-4">
      {/* Top Joint Filter & Stats */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          <Filter className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
          {[
            { id: 'all', ar: 'كافة المفاصل', en: 'All Joints' },
            { id: 'shoulder', ar: 'الكتف', en: 'Shoulder' },
            { id: 'knee', ar: 'الركبة', en: 'Knee' },
            { id: 'cervical', ar: 'العنق', en: 'Cervical' },
            { id: 'lumbar', ar: 'القطنية', en: 'Lumbar' },
            { id: 'hip', ar: 'الورك', en: 'Hip' },
            { id: 'elbow_wrist', ar: 'المرفق والرسغ', en: 'Elbow & Wrist' },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedJoint(cat.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedJoint === cat.id
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
              }`}
            >
              {isAr ? cat.ar : cat.en}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {positiveCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
              {isAr ? `${positiveCount} فحص إيجابي` : `${positiveCount} Positive`}
            </span>
          )}
          <span className="text-xs text-slate-500 font-medium">
            {isAr ? `الموثق: ${value.length}` : `Documented: ${value.length}`}
          </span>
        </div>
      </div>

      {/* Tests Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredTests.map((test) => {
          const outcome = getOutcome(test.id);

          return (
            <div
              key={test.id}
              className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                outcome === 'positive'
                  ? 'border-red-300 bg-red-50/40 dark:border-red-900/60 dark:bg-red-950/20'
                  : outcome === 'pain_reproduced'
                  ? 'border-amber-300 bg-amber-50/40 dark:border-amber-900/60 dark:bg-amber-950/20'
                  : outcome === 'negative'
                  ? 'border-emerald-300 bg-emerald-50/30 dark:border-emerald-900/40 dark:bg-emerald-950/20'
                  : 'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-850'
              }`}
            >
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  {isAr ? test.nameAr : test.nameEn}
                </h4>
                <p className="text-[11px] text-teal-600 dark:text-teal-400">
                  {isAr ? `الهدف السريري: ${test.targetPathologyAr}` : `Target: ${test.targetPathologyEn}`}
                </p>
              </div>

              {/* Outcome Action Pills */}
              <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800 text-xs">
                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => handleSetOutcome(test.id, 'positive')}
                  className={`flex-1 py-1 rounded-lg font-bold transition-all ${
                    outcome === 'positive'
                      ? 'bg-red-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-red-50 hover:text-red-600'
                  }`}
                >
                  {isAr ? '+ إيجابي' : '+ Positive'}
                </button>

                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => handleSetOutcome(test.id, 'pain_reproduced')}
                  className={`flex-1 py-1 rounded-lg font-bold transition-all ${
                    outcome === 'pain_reproduced'
                      ? 'bg-amber-500 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-amber-50 hover:text-amber-600'
                  }`}
                >
                  {isAr ? 'ألم مطابق' : 'Pain Repro'}
                </button>

                <button
                  type="button"
                  disabled={readOnly}
                  onClick={() => handleSetOutcome(test.id, 'negative')}
                  className={`flex-1 py-1 rounded-lg font-bold transition-all ${
                    outcome === 'negative'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-emerald-50 hover:text-emerald-600'
                  }`}
                >
                  {isAr ? '- سلبي' : '- Negative'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
