// =======================================================================
// PhysioRecord — High-Precision Anatomical Body Chart Widget
// Medical-grade SVG with Anterior & Posterior View, Aspect Ratio Lock,
// Pin Drop, Symptom Type, and NRS Severity (0-10)
// =======================================================================

import React, { useState, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import {
  type PatientBodyChartData,
  type BodyChartMarker,
  type BodyChartView,
  type BodySymptomType,
  BODY_SYMPTOM_TYPES,
} from '../../types/clinical';
import { resolveAnatomicalRegionFromPoint } from '../../data/clinicalToolkit/bodyChartRegions';
import { AnatomicalFrontSvg, AnatomicalBackSvg } from './AnatomicalBodySvgs';
import { Trash2, AlertCircle, Eye, Info, CheckCircle2 } from 'lucide-react';

interface BodyChartWidgetProps {
  value: PatientBodyChartData | undefined;
  onChange: (updated: PatientBodyChartData) => void;
  readOnly?: boolean;
}

export const BodyChartWidget: React.FC<BodyChartWidgetProps> = ({
  value,
  onChange,
  readOnly = false,
}) => {
  const { language, isRtl } = useLanguage();
  const isAr = language === 'ar';

  const [activeViewMode, setActiveViewMode] = useState<'both' | 'anterior' | 'posterior'>('both');
  const [selectedSymptomType, setSelectedSymptomType] = useState<BodySymptomType>('pain_sharp');
  const [defaultSeverityNrs, setDefaultSeverityNrs] = useState<number>(6);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);

  const anteriorCanvasRef = useRef<HTMLDivElement>(null);
  const posteriorCanvasRef = useRef<HTMLDivElement>(null);

  const markers = value?.markers || [];
  const clinicianSummaryNotes = value?.clinicianSummaryNotes || '';

  const handleCanvasClick = (
    e: React.MouseEvent<HTMLDivElement>,
    view: BodyChartView,
    canvasRef: React.RefObject<HTMLDivElement | null>
  ) => {
    if (readOnly || !canvasRef.current) return;

    const target = e.target as HTMLElement;
    if (target.closest('.body-marker-pin') || target.closest('button')) {
      return;
    }

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const xPercent = (x / rect.width) * 100;
    const yPercent = (y / rect.height) * 100;

    const resolved = resolveAnatomicalRegionFromPoint(view, xPercent, yPercent);

    const newMarker: BodyChartMarker = {
      markerId: typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `mk-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      symptomType: selectedSymptomType,
      view,
      xPercent: resolved.xPercent,
      yPercent: resolved.yPercent,
      anatomicalRegionCode: resolved.regionCode,
      anatomicalRegionLabelAr: resolved.labelAr,
      anatomicalRegionLabelEn: resolved.labelEn,
      severityNrs: defaultSeverityNrs,
      description: '',
      createdAt: new Date().toISOString(),
    };

    const updatedMarkers = [...markers, newMarker];
    setSelectedMarkerId(newMarker.markerId);

    onChange({
      chartVersion: '1.0.0',
      markers: updatedMarkers,
      clinicianSummaryNotes,
      lastUpdatedAt: new Date().toISOString(),
    });
  };

  const handleRemoveMarker = (markerId: string) => {
    if (readOnly) return;
    const updatedMarkers = markers.filter((m) => m.markerId !== markerId);
    if (selectedMarkerId === markerId) {
      setSelectedMarkerId(null);
    }
    onChange({
      chartVersion: '1.0.0',
      markers: updatedMarkers,
      clinicianSummaryNotes,
      lastUpdatedAt: new Date().toISOString(),
    });
  };

  const handleClearAll = () => {
    if (readOnly) return;
    onChange({
      chartVersion: '1.0.0',
      markers: [],
      clinicianSummaryNotes,
      lastUpdatedAt: new Date().toISOString(),
    });
    setSelectedMarkerId(null);
  };

  const renderMarkerPins = (view: BodyChartView) => {
    return markers
      .filter((m) => m.view === view)
      .map((marker) => {
        const globalIndex = markers.findIndex((m) => m.markerId === marker.markerId) + 1;
        const symptomConfig = BODY_SYMPTOM_TYPES[marker.symptomType] || BODY_SYMPTOM_TYPES.pain_sharp;
        const isSelected = selectedMarkerId === marker.markerId;

        return (
          <div
            key={marker.markerId}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedMarkerId(marker.markerId);
            }}
            title={`${globalIndex}. ${isAr ? symptomConfig.ar : symptomConfig.en} — ${
              isAr ? marker.anatomicalRegionLabelAr : marker.anatomicalRegionLabelEn
            } (${marker.severityNrs ?? defaultSeverityNrs}/10)`}
            className={`body-marker-pin absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform select-none flex items-center justify-center rounded-full text-white font-bold font-mono text-[11px] shadow-lg ${
              isSelected
                ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-slate-900 z-20 animate-pulse'
                : 'hover:scale-115'
            }`}
            style={{
              left: `${marker.xPercent}%`,
              top: `${marker.yPercent}%`,
              backgroundColor: symptomConfig.colorHex,
              width: '26px',
              height: '26px',
            }}
          >
            {globalIndex}
          </div>
        );
      });
  };

  const selectedMarker = markers.find((m) => m.markerId === selectedMarkerId);

  return (
    <div className="space-y-4">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700/80">
        {/* View Toggle */}
        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveViewMode('both')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeViewMode === 'both'
                ? 'bg-teal-600 text-white shadow-xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {isAr ? 'الجهتان معاً' : 'Both Views'}
          </button>
          <button
            type="button"
            onClick={() => setActiveViewMode('anterior')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeViewMode === 'anterior'
                ? 'bg-teal-600 text-white shadow-xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {isAr ? 'أمامي (Anterior)' : 'Anterior'}
          </button>
          <button
            type="button"
            onClick={() => setActiveViewMode('posterior')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeViewMode === 'posterior'
                ? 'bg-teal-600 text-white shadow-xs font-semibold'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {isAr ? 'خلفي (Posterior)' : 'Posterior'}
          </button>
        </div>

        {/* Symptom Type Picker */}
        <div className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(BODY_SYMPTOM_TYPES) as BodySymptomType[]).map((typeKey) => {
            const config = BODY_SYMPTOM_TYPES[typeKey];
            const isSelected = selectedSymptomType === typeKey;
            return (
              <button
                key={typeKey}
                type="button"
                onClick={() => setSelectedSymptomType(typeKey)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border flex items-center gap-1.5 transition-all ${
                  isSelected
                    ? 'ring-2 ring-teal-500 shadow-xs'
                    : 'opacity-70 hover:opacity-100 bg-white dark:bg-slate-900'
                }`}
                style={{
                  borderColor: config.colorHex,
                  color: isSelected ? '#ffffff' : undefined,
                  backgroundColor: isSelected ? config.colorHex : undefined,
                }}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: isSelected ? '#ffffff' : config.colorHex }}
                />
                {isAr ? config.ar : config.en}
              </button>
            );
          })}
        </div>

        {/* Severity Slider & Clear */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">
              {isAr ? 'الشدة:' : 'Severity:'}
            </span>
            <input
              type="range"
              min="1"
              max="10"
              value={defaultSeverityNrs}
              onChange={(e) => setDefaultSeverityNrs(Number(e.target.value))}
              className="w-20 accent-teal-600"
            />
            <span
              className={`px-2 py-0.5 rounded font-bold text-white text-xs ${
                defaultSeverityNrs >= 7
                  ? 'bg-red-600'
                  : defaultSeverityNrs >= 4
                  ? 'bg-amber-500'
                  : 'bg-emerald-600'
              }`}
            >
              {defaultSeverityNrs}/10
            </span>
          </div>

          {markers.length > 0 && !readOnly && (
            <button
              type="button"
              onClick={handleClearAll}
              className="p-1.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
              title={isAr ? 'مسح كافة النقاط' : 'Clear all pins'}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Main Body Drawing Canvas Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Anatomical Diagrams Canvas */}
        <div
          className={`${
            markers.length > 0 ? 'lg:col-span-8' : 'lg:col-span-12'
          } p-6 bg-slate-900/90 rounded-2xl border border-slate-800 shadow-inner flex flex-wrap justify-center items-center gap-10 min-h-[440px]`}
        >
          {/* Anterior Canvas */}
          {(activeViewMode === 'both' || activeViewMode === 'anterior') && (
            <div className="flex flex-col items-center">
              <div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                <span>{isAr ? 'المنظر الأمامي' : 'Anterior View'}</span>
                <span className="text-[10px] text-teal-400 font-normal">
                  ({isAr ? 'اضغط لتثبيت نقطة ألم' : 'Click to pin'})
                </span>
              </div>
              <div
                ref={anteriorCanvasRef}
                onClick={(e) => handleCanvasClick(e, 'anterior', anteriorCanvasRef)}
                className="relative w-[180px] sm:w-[210px] aspect-[148/318] bg-slate-950/70 p-3 rounded-2xl border border-slate-800/80 hover:border-teal-500/50 transition-colors cursor-crosshair select-none flex items-center justify-center text-slate-300 dark:text-slate-400"
              >
                <AnatomicalFrontSvg className="w-full h-full text-slate-400 hover:text-slate-300 transition-colors" />
                {renderMarkerPins('anterior')}
              </div>
            </div>
          )}

          {/* Posterior Canvas */}
          {(activeViewMode === 'both' || activeViewMode === 'posterior') && (
            <div className="flex flex-col items-center">
              <div className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-1.5">
                <span>{isAr ? 'المنظر الخلفي' : 'Posterior View'}</span>
                <span className="text-[10px] text-teal-400 font-normal">
                  ({isAr ? 'اضغط لتثبيت نقطة ألم' : 'Click to pin'})
                </span>
              </div>
              <div
                ref={posteriorCanvasRef}
                onClick={(e) => handleCanvasClick(e, 'posterior', posteriorCanvasRef)}
                className="relative w-[180px] sm:w-[210px] aspect-[148/315] bg-slate-950/70 p-3 rounded-2xl border border-slate-800/80 hover:border-teal-500/50 transition-colors cursor-crosshair select-none flex items-center justify-center text-slate-300 dark:text-slate-400"
              >
                <AnatomicalBackSvg className="w-full h-full text-slate-400 hover:text-slate-300 transition-colors" />
                {renderMarkerPins('posterior')}
              </div>
            </div>
          )}
        </div>

        {/* Markers Sidebar List (when points exist) */}
        {markers.length > 0 && (
          <div className="lg:col-span-4 space-y-3 bg-white dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-700/80 max-h-[460px] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                {isAr ? `الأعراض المحددة (${markers.length})` : `Identified Symptoms (${markers.length})`}
              </h4>
              <span className="text-[11px] text-teal-600 dark:text-teal-400 font-medium">
                {isAr ? 'مرتبة بالترقيم' : 'Numbered'}
              </span>
            </div>

            <div className="space-y-2">
              {markers.map((marker, idx) => {
                const symptomConfig =
                  BODY_SYMPTOM_TYPES[marker.symptomType] || BODY_SYMPTOM_TYPES.pain_sharp;
                const isSelected = selectedMarkerId === marker.markerId;

                return (
                  <div
                    key={marker.markerId}
                    onClick={() => setSelectedMarkerId(marker.markerId)}
                    className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-start justify-between gap-2 ${
                      isSelected
                        ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/30 ring-1 ring-teal-500'
                        : 'border-slate-200 dark:border-slate-700/60 bg-slate-50/60 dark:bg-slate-900/40 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <span
                        className="w-5 h-5 rounded-full text-white font-bold flex items-center justify-center shrink-0 text-[10px]"
                        style={{ backgroundColor: symptomConfig.colorHex }}
                      >
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                          {isAr ? marker.anatomicalRegionLabelAr : marker.anatomicalRegionLabelEn}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {isAr ? symptomConfig.ar : symptomConfig.en} •{' '}
                          <span className="font-bold text-teal-600 dark:text-teal-400">
                            {marker.severityNrs ?? defaultSeverityNrs}/10
                          </span>
                        </p>
                      </div>
                    </div>

                    {!readOnly && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveMarker(marker.markerId);
                        }}
                        className="text-slate-400 hover:text-red-500 p-1 rounded-md transition-colors"
                        title={isAr ? 'حذف هذه النقطة' : 'Remove pin'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Selected Marker Note / Severity editor */}
            {selectedMarker && !readOnly && (
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-2">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block">
                  {isAr ? 'تعديل شدة النقطة المحددة:' : 'Edit Pin Severity:'}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={selectedMarker.severityNrs ?? 5}
                    onChange={(e) => {
                      const newSev = Number(e.target.value);
                      const updated = markers.map((m) =>
                        m.markerId === selectedMarker.markerId ? { ...m, severityNrs: newSev } : m
                      );
                      onChange({
                        chartVersion: '1.0.0',
                        markers: updated,
                        clinicianSummaryNotes,
                        lastUpdatedAt: new Date().toISOString(),
                      });
                    }}
                    className="w-full accent-teal-600"
                  />
                  <span className="font-bold text-xs text-teal-600 dark:text-teal-400 shrink-0">
                    {selectedMarker.severityNrs}/10
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Clinician Summary Notes */}
      <div>
        <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
          {isAr ? 'ملاحظات المعالج السريرية حول موضع وطبيعة الأعراض:' : 'Clinician Body Chart Summary Notes:'}
        </label>
        <textarea
          rows={2}
          value={clinicianSummaryNotes}
          disabled={readOnly}
          onChange={(e) =>
            onChange({
              chartVersion: '1.0.0',
              markers,
              clinicianSummaryNotes: e.target.value,
              lastUpdatedAt: new Date().toISOString(),
            })
          }
          placeholder={
            isAr
              ? 'مثال: ألم حاد ينتشر من الفقرات القطنية L4-L5 نحو الفخذ الأيسر، يزداد مع الانثناء إلى الأمام...'
              : 'e.g., Sharp radiating pain originating at L4-L5 spreading down posterior left thigh...'
          }
          className="w-full px-3 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-hidden focus:ring-2 focus:ring-teal-500 text-slate-800 dark:text-slate-200"
        />
      </div>
    </div>
  );
};
