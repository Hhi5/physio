// =======================================================================
// PhysioRecord — Gait, Posture & Balance Assessment Widget
// TUG Test (Timed Up & Go), Postural Deviations, and Gait Mechanics
// =======================================================================

import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type { GaitPostureData } from '../../types/clinicalWidgets';
import { Timer, Footprints, AlertCircle, CheckCircle2 } from 'lucide-react';

interface GaitPostureWidgetProps {
  value: GaitPostureData | undefined;
  onChange: (updated: GaitPostureData) => void;
  readOnly?: boolean;
}

const POSTURE_DEVIATIONS_LIST = [
  { id: 'forward_head', ar: 'بروز الرأس للأمام (Forward Head Posture)', en: 'Forward Head Posture' },
  { id: 'thoracic_kyphosis', ar: 'حداب صدري زائد (Thoracic Kyphosis)', en: 'Increased Thoracic Kyphosis' },
  { id: 'lumbar_hyperlordosis', ar: 'بزل قطني مفرط (Lumbar Hyperlordosis)', en: 'Lumbar Hyperlordosis' },
  { id: 'scoliosis_curve', ar: 'انحراف جانبي / جنف (Scoliotic Curve)', en: 'Scoliotic Deviation' },
  { id: 'pelvic_anterior_tilt', ar: 'ميل الحوض للأمام (Anterior Pelvic Tilt)', en: 'Anterior Pelvic Tilt' },
  { id: 'pelvic_posterior_tilt', ar: 'ميل الحوض للخلف (Posterior Pelvic Tilt)', en: 'Posterior Pelvic Tilt' },
  { id: 'shoulder_elevation_asymmetry', ar: 'عدم تناظر ارتفاع الكتفين', en: 'Shoulder Elevation Asymmetry' },
  { id: 'genu_valgum', ar: 'تقارب الركبتين (روح الركبة Genu Valgum)', en: 'Genu Valgum (Knock Knees)' },
  { id: 'genu_varum', ar: 'تباعد الركبتين (فحج الركبة Genu Varum)', en: 'Genu Varum (Bow Legs)' },
];

export const GaitPostureWidget: React.FC<GaitPostureWidgetProps> = ({
  value,
  onChange,
  readOnly = false,
}) => {
  const { language, isRtl } = useLanguage();
  const isAr = language === 'ar';

  const currentData: GaitPostureData = value || {
    tugSeconds: null,
    postureDeviations: [],
    gaitPattern: 'normal',
    assistiveDevice: 'none',
  };

  const handleUpdate = (updates: Partial<GaitPostureData>) => {
    if (readOnly) return;
    onChange({
      ...currentData,
      ...updates,
    });
  };

  const toggleDeviation = (id: string) => {
    if (readOnly) return;
    const exists = currentData.postureDeviations.includes(id);
    const updated = exists
      ? currentData.postureDeviations.filter((d) => d !== id)
      : [...currentData.postureDeviations, id];
    handleUpdate({ postureDeviations: updated });
  };

  const getTugInterpretation = (sec: number | null | undefined) => {
    if (sec === null || sec === undefined) return null;
    if (sec < 10) {
      return {
        labelAr: 'حركة طبيعية ومستقلة تماماً (خطر سقوط منخفض)',
        labelEn: 'Normal Mobility (Low fall risk)',
        color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300',
      };
    }
    if (sec <= 20) {
      return {
        labelAr: 'وهن حركي متوسط (بحاجة لتدريب توازن وقوة)',
        labelEn: 'Frail / Moderate fall risk',
        color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 border-amber-300',
      };
    }
    return {
      labelAr: 'خطر سقوط مرتفع جداً (High Fall Risk > 20s)',
      labelEn: 'High Fall Risk (> 20s)',
      color: 'text-rose-600 bg-rose-50 dark:bg-rose-950/40 border-rose-300',
    };
  };

  const tugInterp = getTugInterpretation(currentData.tugSeconds);

  return (
    <div className="space-y-4">
      {/* TUG Test Section */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-850 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
              {isAr ? 'اختبار النهوض والمشي الموقوت (Timed Up & Go - TUG)' : 'Timed Up & Go (TUG) Test'}
            </h4>
          </div>
          <span className="text-[11px] text-slate-500">
            {isAr ? 'مسافة 3 أمتار قياسية' : 'Standard 3m Walk'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.1"
              min="1"
              max="120"
              disabled={readOnly}
              value={currentData.tugSeconds ?? ''}
              placeholder="0.0"
              onChange={(e) =>
                handleUpdate({
                  tugSeconds: e.target.value === '' ? null : Number(e.target.value),
                })
              }
              className="w-24 px-3 py-1.5 font-bold font-mono text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white text-center focus:ring-2 focus:ring-teal-500"
            />
            <span className="text-xs font-bold text-slate-500">
              {isAr ? 'ثانية (Seconds)' : 'sec'}
            </span>
          </div>

          {tugInterp && (
            <div className={`px-3 py-1 rounded-lg border text-xs font-semibold ${tugInterp.color}`}>
              {isAr ? tugInterp.labelAr : tugInterp.labelEn}
            </div>
          )}
        </div>
      </div>

      {/* Gait Pattern & Assistive Device */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Gait Pattern */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-850 space-y-2">
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
            {isAr ? 'نمط المشي السريري (Gait Pattern):' : 'Clinical Gait Pattern:'}
          </label>
          <select
            disabled={readOnly}
            value={currentData.gaitPattern}
            onChange={(e) => handleUpdate({ gaitPattern: e.target.value as any })}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium"
          >
            <option value="normal">{isAr ? 'طبيعي ومتناسق (Normal)' : 'Normal'}</option>
            <option value="antalgic">{isAr ? 'مشية تفادي الألم / أعرج (Antalgic Gait)' : 'Antalgic'}</option>
            <option value="trendelenburg">{isAr ? 'مشية ترندلنبورغ / ضعف الألوية (Trendelenburg)' : 'Trendelenburg'}</option>
            <option value="steppage">{isAr ? 'مشية هبوط القدم (Steppage / Foot Drop)' : 'Steppage / Foot Drop'}</option>
            <option value="ataxic">{isAr ? 'مشية رنحية غير متزنة (Ataxic)' : 'Ataxic'}</option>
            <option value="other">{isAr ? 'نمط آخر (Other)' : 'Other'}</option>
          </select>
        </div>

        {/* Assistive Device */}
        <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-850 space-y-2">
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
            {isAr ? 'الأداة المساعدة على المشي:' : 'Assistive Device:'}
          </label>
          <select
            disabled={readOnly}
            value={currentData.assistiveDevice}
            onChange={(e) => handleUpdate({ assistiveDevice: e.target.value as any })}
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-medium"
          >
            <option value="none">{isAr ? 'بدون أداة مساعدة (Independent / None)' : 'None (Independent)'}</option>
            <option value="single_cane">{isAr ? 'عكاز مفرد (Single Cane)' : 'Single Cane'}</option>
            <option value="crutches">{isAr ? 'عكازان كوعيان أو إبطيان (Crutches)' : 'Crutches'}</option>
            <option value="walker">{isAr ? 'مشاية إطار (Walker / Zimmer Frame)' : 'Walker'}</option>
            <option value="other">{isAr ? 'أخرى (Other)' : 'Other'}</option>
          </select>
        </div>
      </div>

      {/* Postural Deviations Multi-Select */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-850 space-y-2.5">
        <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
          {isAr ? 'المشاهدات الميكانيكية للقوام (Postural Deviations):' : 'Postural Deviations Observed:'}
        </label>
        <div className="flex flex-wrap gap-1.5">
          {POSTURE_DEVIATIONS_LIST.map((dev) => {
            const isSelected = currentData.postureDeviations.includes(dev.id);
            return (
              <button
                key={dev.id}
                type="button"
                disabled={readOnly}
                onClick={() => toggleDeviation(dev.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                  isSelected
                    ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700/80 hover:bg-slate-100'
                }`}
              >
                {isAr ? dev.ar : dev.en}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
