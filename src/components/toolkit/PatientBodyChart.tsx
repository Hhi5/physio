// =======================================================================
// PhysioRecord — Interactive Patient Body Chart Component (Phase 2C — Milestone 2)
// 100% Client-Side Encrypted Vector Pinning for Symptoms, Regions & Severity
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
import {
  ShieldCheck,
  Trash2,
  Lock,
  FileText,
  Eye,
  AlertCircle,
} from 'lucide-react';

interface PatientBodyChartProps {
  value: PatientBodyChartData | undefined;
  onChange: (updated: PatientBodyChartData) => void;
  readOnly?: boolean;
  compactPreview?: boolean;
}

export const PatientBodyChart: React.FC<PatientBodyChartProps> = ({
  value,
  onChange,
  readOnly = false,
  compactPreview = false,
}) => {
  const { language, isRtl } = useLanguage();
  const isAr = language === 'ar';

  const [activeViewMode, setActiveViewMode] = useState<'both' | 'anterior' | 'posterior'>('both');
  const [selectedSymptomType, setSelectedSymptomType] = useState<BodySymptomType>('pain_sharp');
  const [defaultSeverityNrs, setDefaultSeverityNrs] = useState<number>(7);
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const anteriorCanvasRef = useRef<HTMLDivElement>(null);
  const posteriorCanvasRef = useRef<HTMLDivElement>(null);

  const markers = value?.markers || [];
  const clinicianSummaryNotes = value?.clinicianSummaryNotes || '';

  // -------------------------------------------------------------------------
  // Marker Addition via Click
  // -------------------------------------------------------------------------
  const handleCanvasClick = (
    e: React.MouseEvent<HTMLDivElement>,
    view: BodyChartView,
    canvasRef: React.RefObject<HTMLDivElement | null>
  ) => {
    if (readOnly) return;
    if (!canvasRef.current) return;

    // Check if click was on a marker pin or button
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
      markerId: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `mk-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
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

  // -------------------------------------------------------------------------
  // Marker Removal
  // -------------------------------------------------------------------------
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
    setConfirmClear(false);
  };

  // -------------------------------------------------------------------------
  // Marker Attribute Updates
  // -------------------------------------------------------------------------
  const handleUpdateMarker = (
    markerId: string,
    updates: Partial<Pick<BodyChartMarker, 'severityNrs' | 'description' | 'symptomType'>>
  ) => {
    if (readOnly) return;
    const updatedMarkers = markers.map((m) => {
      if (m.markerId !== markerId) return m;
      return {
        ...m,
        ...updates,
      };
    });
    onChange({
      chartVersion: '1.0.0',
      markers: updatedMarkers,
      clinicianSummaryNotes,
      lastUpdatedAt: new Date().toISOString(),
    });
  };

  const handleSummaryNotesChange = (text: string) => {
    if (readOnly) return;
    onChange({
      chartVersion: '1.0.0',
      markers,
      clinicianSummaryNotes: text,
      lastUpdatedAt: new Date().toISOString(),
    });
  };

  // -------------------------------------------------------------------------
  // SVG Anatomical Silhouettes
  // -------------------------------------------------------------------------
  const renderAnteriorSvg = () => (
    <svg viewBox="0 0 200 420" className="w-full h-full select-none pointer-events-none drop-shadow-xs">
      {/* Head */}
      <circle cx="100" cy="35" r="21" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1.5" className="dark:fill-slate-700 dark:stroke-slate-600" />
      {/* Eyes & Mouth landmark hints */}
      <circle cx="93" cy="33" r="1.5" fill="#94A3B8" />
      <circle cx="107" cy="33" r="1.5" fill="#94A3B8" />
      <path d="M 96 42 Q 100 45 104 42" fill="none" stroke="#94A3B8" strokeWidth="1" />
      
      {/* Body & Limbs Outer Silhouette */}
      <path
        d="M 85 55 L 60 75 L 40 130 L 25 180 L 33 182 L 48 135 L 65 95 L 80 90 L 80 185 L 75 270 L 72 350 L 88 350 L 92 270 L 97 195 L 103 195 L 108 270 L 112 350 L 128 350 L 125 270 L 120 185 L 120 90 L 135 95 L 152 135 L 167 182 L 175 180 L 160 130 L 140 75 L 115 55 Z"
        fill="#E2E8F0"
        stroke="#94A3B8"
        strokeWidth="1.5"
        className="dark:fill-slate-700 dark:stroke-slate-600"
      />

      {/* Anatomical Landmark Guides */}
      {/* Clavicles */}
      <path d="M 70 82 Q 100 90 130 82" fill="none" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="2,2" />
      {/* Nipple / T4 landmark line */}
      <circle cx="86" cy="120" r="1.5" fill="#94A3B8" />
      <circle cx="114" cy="120" r="1.5" fill="#94A3B8" />
      {/* Umbilicus / T10 landmark */}
      <circle cx="100" cy="155" r="2" fill="#94A3B8" />
      {/* Knees */}
      <ellipse cx="84" cy="272" rx="4.5" ry="3.5" fill="none" stroke="#CBD5E1" strokeWidth="1" />
      <ellipse cx="116" cy="272" rx="4.5" ry="3.5" fill="none" stroke="#CBD5E1" strokeWidth="1" />
    </svg>
  );

  const renderPosteriorSvg = () => (
    <svg viewBox="0 0 200 420" className="w-full h-full select-none pointer-events-none drop-shadow-xs">
      {/* Head Back */}
      <circle cx="100" cy="35" r="21" fill="#E2E8F0" stroke="#94A3B8" strokeWidth="1.5" className="dark:fill-slate-700 dark:stroke-slate-600" />
      <path d="M 92 48 Q 100 52 108 48" fill="none" stroke="#94A3B8" strokeWidth="1" />

      {/* Body & Limbs Outer Silhouette */}
      <path
        d="M 85 55 L 60 75 L 40 130 L 25 180 L 33 182 L 48 135 L 65 95 L 80 90 L 80 185 L 75 270 L 72 350 L 88 350 L 92 270 L 97 195 L 103 195 L 108 270 L 112 350 L 128 350 L 125 270 L 120 185 L 120 90 L 135 95 L 152 135 L 167 182 L 175 180 L 160 130 L 140 75 L 115 55 Z"
        fill="#E2E8F0"
        stroke="#94A3B8"
        strokeWidth="1.5"
        className="dark:fill-slate-700 dark:stroke-slate-600"
      />

      {/* Anatomical Landmark Guides */}
      {/* Spine Line */}
      <line x1="100" y1="58" x2="100" y2="190" stroke="#CBD5E1" strokeWidth="1" strokeDasharray="3,2" />
      {/* Scapulae Lines */}
      <path d="M 78 95 Q 73 115 82 125" fill="none" stroke="#CBD5E1" strokeWidth="1" />
      <path d="M 122 95 Q 127 115 118 125" fill="none" stroke="#CBD5E1" strokeWidth="1" />
      {/* Gluteal Crease */}
      <path d="M 86 215 Q 100 225 114 215" fill="none" stroke="#CBD5E1" strokeWidth="1.5" />
      <line x1="100" y1="190" x2="100" y2="225" stroke="#CBD5E1" strokeWidth="1" />
      {/* Popliteal Fossa (Back of knees) */}
      <path d="M 79 272 Q 84 275 89 272" fill="none" stroke="#CBD5E1" strokeWidth="1" />
      <path d="M 111 272 Q 116 275 121 272" fill="none" stroke="#CBD5E1" strokeWidth="1" />
      {/* Achilles insertion */}
      <line x1="84" y1="335" x2="84" y2="348" stroke="#CBD5E1" strokeWidth="1.5" />
      <line x1="116" y1="335" x2="116" y2="348" stroke="#CBD5E1" strokeWidth="1.5" />
    </svg>
  );

  // -------------------------------------------------------------------------
  // Render Marker Pins
  // -------------------------------------------------------------------------
  const renderMarkerPins = (view: BodyChartView) => {
    return markers
      .filter((m) => m.view === view)
      .map((marker) => {
        // Find index in overall markers array (1-based)
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
            title={`${globalIndex}. ${isAr ? symptomConfig.ar : symptomConfig.en} — ${isAr ? marker.anatomicalRegionLabelAr : marker.anatomicalRegionLabelEn} (${marker.severityNrs ?? defaultSeverityNrs}/10)`}
            className={`body-marker-pin absolute z-10 -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-transform select-none flex items-center justify-center rounded-full text-white font-bold font-mono text-[11px] shadow-md ${
              compactPreview ? 'w-5 h-5 text-[9px]' : 'w-6 h-6'
            } ${
              isSelected
                ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-slate-900 z-20'
                : 'hover:scale-110'
            }`}
            style={{
              left: `${marker.xPercent}%`,
              top: `${marker.yPercent}%`,
              backgroundColor: symptomConfig.colorHex,
            }}
          >
            {globalIndex}
          </div>
        );
      });
  };

  // =========================================================================
  // Compact Preview Mode (For SOAP Preview Tab)
  // =========================================================================
  if (compactPreview) {
    if (markers.length === 0 && !clinicianSummaryNotes.trim()) {
      return (
        <div className="p-3 text-center text-xs text-slate-400 dark:text-slate-500 italic bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700">
          {isAr ? 'لم يتم توثيق أي علامات على مخطط الجسم في هذه الجلسة.' : 'No body chart symptoms recorded in this session.'}
        </div>
      );
    }

    return (
      <div className="space-y-3 bg-slate-50 dark:bg-slate-850 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-primary-600" />
            {isAr ? 'مخطط أعراض المريض السريري' : 'Patient Body Chart Symptoms'}
          </span>
          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-[10px]">
            {markers.length} {isAr ? 'مواضع محددة' : 'points marked'}
          </span>
        </div>

        {/* Small Side-by-Side Silhouettes */}
        <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto">
          <div className="relative aspect-[200/420] bg-white dark:bg-slate-800 rounded-xl p-2 border border-slate-200 dark:border-slate-700 overflow-hidden">
            <span className="absolute top-1 start-2 text-[9px] font-bold text-slate-400 uppercase">
              {isAr ? 'أمامي' : 'Anterior'}
            </span>
            {renderAnteriorSvg()}
            {renderMarkerPins('anterior')}
          </div>
          <div className="relative aspect-[200/420] bg-white dark:bg-slate-800 rounded-xl p-2 border border-slate-200 dark:border-slate-700 overflow-hidden">
            <span className="absolute top-1 start-2 text-[9px] font-bold text-slate-400 uppercase">
              {isAr ? 'خلفي' : 'Posterior'}
            </span>
            {renderPosteriorSvg()}
            {renderMarkerPins('posterior')}
          </div>
        </div>

        {/* Compact Markers List */}
        {markers.length > 0 && (
          <div className="space-y-1.5 pt-1 border-t border-slate-200 dark:border-slate-700">
            {markers.map((m, idx) => {
              const cfg = BODY_SYMPTOM_TYPES[m.symptomType] || BODY_SYMPTOM_TYPES.pain_sharp;
              return (
                <div key={m.markerId} className="flex items-center justify-between text-[11px] p-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-4 h-4 rounded-full text-white text-[9px] font-mono font-bold flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: cfg.colorHex }}
                    >
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">
                      {isAr ? cfg.ar : cfg.en}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      ({isAr ? m.anatomicalRegionLabelAr : m.anatomicalRegionLabelEn})
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500 font-mono">
                    <span>NRS: {m.severityNrs ?? '-'}/10</span>
                    <span className="text-[10px] uppercase">[{m.view === 'anterior' ? (isAr ? 'أمامي' : 'Ant') : (isAr ? 'خلفي' : 'Post')}]</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Clinician Summary Notes */}
        {clinicianSummaryNotes && (
          <div className="p-2.5 rounded-xl bg-primary-50/60 dark:bg-primary-950/30 border border-primary-200 dark:border-primary-800 text-[11px] text-primary-900 dark:text-primary-100">
            <strong className="block mb-0.5">{isAr ? 'ملاحظات المعالج لتوزع الأعراض:' : 'Clinician Distribution Summary:'}</strong>
            <p className="leading-relaxed">{clinicianSummaryNotes}</p>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // Full Interactive Mode (Inside SOAP S-Tab)
  // =========================================================================
  return (
    <div className="space-y-4 bg-white dark:bg-slate-850 p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs" dir={isRtl ? 'rtl' : 'ltr'}>
      
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary-600" />
              <span>{isAr ? 'مخطط توثيق أعراض المريض' : 'Patient Body Chart Symptoms Mapping'}</span>
            </h3>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              100% Encrypted DEK
            </span>
            {readOnly && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                <Lock className="w-3 h-3" />
                {isAr ? 'معتمد (للقراءة فقط)' : 'Finalized (Read-Only)'}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isAr
              ? 'حدد نوع العرض السريري ثم انقر على موضع الشكوى في جسم المريض لتثبيت علامة مشفرة.'
              : 'Select symptom type then click anywhere on the body to drop an encrypted marker.'}
          </p>
        </div>

        {/* View Switcher: Both, Anterior, Posterior */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => setActiveViewMode('both')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              activeViewMode === 'both'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            {isAr ? 'كلاهما' : 'Both Views'}
          </button>
          <button
            type="button"
            onClick={() => setActiveViewMode('anterior')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              activeViewMode === 'anterior'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            {isAr ? 'أمامي' : 'Anterior'}
          </button>
          <button
            type="button"
            onClick={() => setActiveViewMode('posterior')}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
              activeViewMode === 'posterior'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            {isAr ? 'خلفي' : 'Posterior'}
          </button>
        </div>
      </div>

      {/* Symptom Category Selector Palette & Severity Control (Hidden if Read-Only) */}
      {!readOnly && (
        <div className="space-y-3 bg-slate-50 dark:bg-slate-900/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {isAr ? 'تصنيف الأعراض السريرية:' : 'Active Symptom Taxonomy:'}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">{isAr ? 'الشدة الافتراضية للعلامة:' : 'Default Severity:'}</span>
              <div className="flex items-center gap-1 font-mono text-xs">
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={defaultSeverityNrs}
                  onChange={(e) => setDefaultSeverityNrs(Number(e.target.value))}
                  className="w-20 accent-primary-600 cursor-pointer"
                />
                <span className="font-bold text-primary-700 dark:text-primary-400 w-8 text-center">{defaultSeverityNrs}/10</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {(Object.keys(BODY_SYMPTOM_TYPES) as BodySymptomType[]).map((typeKey) => {
              const cfg = BODY_SYMPTOM_TYPES[typeKey];
              const isSelected = selectedSymptomType === typeKey;

              return (
                <button
                  key={typeKey}
                  type="button"
                  onClick={() => setSelectedSymptomType(typeKey)}
                  className={`p-2 rounded-xl border text-start transition-all flex items-center gap-2 ${
                    isSelected
                      ? 'bg-white dark:bg-slate-800 shadow-sm ring-2 ring-primary-500 border-primary-500'
                      : 'bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 opacity-80 hover:opacity-100'
                  }`}
                >
                  <span
                    className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: cfg.colorHex }}
                  />
                  <div className="truncate">
                    <div className="text-xs font-bold text-slate-900 dark:text-white truncate">
                      {isAr ? cfg.ar : cfg.en}
                    </div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                      {isAr ? cfg.en : cfg.ar}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Grid: Canvases & Markers List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        
        {/* Canvases Column (Span 6 or 7) */}
        <div className={`space-y-2 ${activeViewMode === 'both' ? 'lg:col-span-7' : 'lg:col-span-6'}`}>
          <div className={`grid gap-4 ${activeViewMode === 'both' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 max-w-sm mx-auto'}`}>
            
            {/* ANTERIOR CANVAS */}
            {(activeViewMode === 'both' || activeViewMode === 'anterior') && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400 px-1">
                  <span>{isAr ? 'المشهد الأمامي (Anterior)' : 'Anterior View'}</span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {markers.filter((m) => m.view === 'anterior').length} {isAr ? 'علامة' : 'pts'}
                  </span>
                </div>
                <div
                  ref={anteriorCanvasRef}
                  onClick={(e) => handleCanvasClick(e, 'anterior', anteriorCanvasRef)}
                  className={`relative aspect-[200/420] w-full max-w-[280px] mx-auto bg-slate-50 dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-700 select-none overflow-hidden transition-all ${
                    !readOnly ? 'cursor-crosshair hover:border-primary-400 dark:hover:border-primary-600' : ''
                  }`}
                >
                  {renderAnteriorSvg()}
                  {renderMarkerPins('anterior')}
                </div>
              </div>
            )}

            {/* POSTERIOR CANVAS */}
            {(activeViewMode === 'both' || activeViewMode === 'posterior') && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-600 dark:text-slate-400 px-1">
                  <span>{isAr ? 'المشهد الخلفي (Posterior)' : 'Posterior View'}</span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {markers.filter((m) => m.view === 'posterior').length} {isAr ? 'علامة' : 'pts'}
                  </span>
                </div>
                <div
                  ref={posteriorCanvasRef}
                  onClick={(e) => handleCanvasClick(e, 'posterior', posteriorCanvasRef)}
                  className={`relative aspect-[200/420] w-full max-w-[280px] mx-auto bg-slate-50 dark:bg-slate-900 rounded-xl p-3 border border-slate-200 dark:border-slate-700 select-none overflow-hidden transition-all ${
                    !readOnly ? 'cursor-crosshair hover:border-primary-400 dark:hover:border-primary-600' : ''
                  }`}
                >
                  {renderPosteriorSvg()}
                  {renderMarkerPins('posterior')}
                </div>
              </div>
            )}

          </div>

          {!readOnly && (
            <p className="text-[11px] text-slate-400 dark:text-slate-500 text-center italic">
              {isAr
                ? '💡 انقر في أي نقطة على الجسم لتثبيت العرض المختار. انقر على أي علامة لتحديدها ومراجعة بياناتها.'
                : '💡 Click anywhere on the body to drop selected symptom. Click any marker to inspect.'}
            </p>
          )}
        </div>

        {/* Markers List & Summary Notes Column (Span 5 or 6) */}
        <div className={`space-y-4 ${activeViewMode === 'both' ? 'lg:col-span-5' : 'lg:col-span-6'}`}>
          
          {/* List Header */}
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <span>{isAr ? 'العلامات الموثقة في الجلسة' : 'Documented Markers'}</span>
              <span className="px-2 py-0.2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-mono text-xs font-bold">
                {markers.length}
              </span>
            </h4>

            {!readOnly && markers.length > 0 && (
              <div>
                {confirmClear ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-600 text-white hover:bg-rose-700"
                    >
                      {isAr ? 'تأكيد المسح' : 'Confirm'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClear(false)}
                      className="px-2 py-0.5 rounded text-[11px] bg-slate-200 text-slate-700 hover:bg-slate-300"
                    >
                      {isAr ? 'إلغاء' : 'Cancel'}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmClear(true)}
                    className="text-xs text-rose-600 hover:text-rose-700 dark:text-rose-400 font-medium flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isAr ? 'مسح الكل' : 'Clear All'}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* List Content */}
          <div className="space-y-2 max-h-[360px] overflow-y-auto pe-1">
            {markers.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 text-xs space-y-1">
                <AlertCircle className="w-6 h-6 mx-auto text-slate-300 dark:text-slate-600 mb-1" />
                <p className="font-semibold text-slate-600 dark:text-slate-400">
                  {isAr ? 'لا توجد علامات مسجلة بعد' : 'No symptoms marked yet'}
                </p>
                <p className="text-[11px]">
                  {isAr
                    ? 'اختر العرض من اللوحة أعلاه ثم انقر فوق موضع الشكوى في الرسم.'
                    : 'Select a symptom and click the body canvas to place a marker.'}
                </p>
              </div>
            ) : (
              markers.map((marker, index) => {
                const symptomCfg = BODY_SYMPTOM_TYPES[marker.symptomType] || BODY_SYMPTOM_TYPES.pain_sharp;
                const isSelected = selectedMarkerId === marker.markerId;

                return (
                  <div
                    key={marker.markerId}
                    onClick={() => setSelectedMarkerId(marker.markerId)}
                    className={`p-3 rounded-xl border transition-all space-y-2 text-xs ${
                      isSelected
                        ? 'bg-primary-50/50 dark:bg-primary-950/30 border-primary-300 dark:border-primary-700 ring-1 ring-primary-400'
                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300'
                    }`}
                  >
                    {/* Marker Top Bar */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-5 h-5 rounded-full text-white font-mono font-bold text-xs flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: symptomCfg.colorHex }}
                        >
                          {index + 1}
                        </span>
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white">
                            {isAr ? symptomCfg.ar : symptomCfg.en}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 ms-1.5">
                            • {isAr ? marker.anatomicalRegionLabelAr : marker.anatomicalRegionLabelEn}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {marker.view === 'anterior' ? (isAr ? 'أمامي' : 'Ant') : (isAr ? 'خلفي' : 'Post')}
                        </span>
                        {!readOnly && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveMarker(marker.markerId);
                            }}
                            title={isAr ? 'حذف العلامة' : 'Delete marker'}
                            className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Severity & Coordinates Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] pt-1 border-t border-slate-100 dark:border-slate-750">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 dark:text-slate-400">{isAr ? 'الشدة:' : 'Severity:'}</span>
                        {!readOnly ? (
                          <div className="flex items-center gap-1 font-mono">
                            <input
                              type="number"
                              min="0"
                              max="10"
                              value={marker.severityNrs ?? 7}
                              onChange={(e) =>
                                handleUpdateMarker(marker.markerId, {
                                  severityNrs: Number(e.target.value),
                                })
                              }
                              className="w-12 px-1.5 py-0.5 border border-slate-200 dark:border-slate-600 rounded text-center bg-white dark:bg-slate-700 text-xs font-bold"
                            />
                            <span className="text-slate-400">/ 10</span>
                          </div>
                        ) : (
                          <span className="font-bold font-mono text-slate-700 dark:text-slate-300">
                            {marker.severityNrs ?? '-'}/10
                          </span>
                        )}
                      </div>

                      <div className="text-[10px] font-mono text-slate-400">
                        ({marker.xPercent}%, {marker.yPercent}%)
                      </div>
                    </div>

                    {/* Marker Clinical Description Note */}
                    <div>
                      {!readOnly ? (
                        <input
                          type="text"
                          value={marker.description || ''}
                          onChange={(e) => handleUpdateMarker(marker.markerId, { description: e.target.value })}
                          placeholder={
                            isAr
                              ? 'وصف إضافي: مثال (يمتد للأسفل، ألم نابض يزداد بالحركة..)'
                              : 'Notes: e.g. radiating distally, deep ache...'
                          }
                          className="w-full px-2.5 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      ) : (
                        marker.description && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 italic">
                            "{marker.description}"
                          </p>
                        )
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Clinician Global Distribution Summary */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-700">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              {isAr ? 'ملاحظات المعالج العامة لتوزع الأعراض (Clinician Summary):' : 'Clinician Symptoms Distribution Summary:'}
            </label>
            {!readOnly ? (
              <textarea
                value={clinicianSummaryNotes}
                onChange={(e) => handleSummaryNotesChange(e.target.value)}
                rows={2}
                placeholder={
                  isAr
                    ? 'مثال: الأعراض تتبع مسار عصب الورك الأيمن L5-S1 مع خدر في ظاهر القدم وتيبس عضلي في عضلات الإلية...'
                    : 'e.g. Distribution conforms to L5-S1 sciatic trajectory with sensory blunting...'
                }
                className="w-full px-3 py-2 text-xs border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            ) : (
              clinicianSummaryNotes && (
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-900 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                  {clinicianSummaryNotes}
                </p>
              )
            )}
          </div>

        </div>

      </div>

    </div>
  );
};
