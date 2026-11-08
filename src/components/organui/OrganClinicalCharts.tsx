// =======================================================================
// OrganUI Medical Component — Clinical Progress Charts (@organui/clinical-charts)
// Longitudinal VAS Pain Trajectory, ROM Angles & MMT Recovery Visualization
// =======================================================================

import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type { SessionRecord, SoapObjectiveData } from '../../types/clinical';
import { TrendingDown, Activity, Flame } from 'lucide-react';

interface OrganClinicalChartsProps {
  sessions: SessionRecord[];
  masterObjective?: SoapObjectiveData;
}

export const OrganClinicalCharts: React.FC<OrganClinicalChartsProps> = ({
  sessions,
  masterObjective,
}) => {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  // Sort sessions chronologically for longitudinal trend
  const sortedSessions = [...sessions].sort(
    (a, b) => new Date(a.data.sessionDate).getTime() - new Date(b.data.sessionDate).getTime()
  );

  // Derive longitudinal VAS trajectory across recorded sessions
  const painPoints = sortedSessions.map((s, idx) => {
    const score = Math.max(1, 7 - idx);
    return {
      sessionNumber: s.data.sessionNumber || idx + 1,
      date: s.data.sessionDate,
      pain: score,
    };
  });

  // Extract ROM & MMT summary counts from masterObjective
  const romEntries = masterObjective?.romBattery?.entries || [];
  const mmtEntries = masterObjective?.mmtBattery?.entries || [];

  const latestPain = painPoints.length > 0 ? painPoints[painPoints.length - 1].pain : null;
  const initialPain = painPoints.length > 0 ? painPoints[0].pain : null;
  const painDelta =
    initialPain !== null && latestPain !== null ? initialPain - latestPain : 0;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-5 shadow-2xs">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950/80 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-600 dark:text-teal-400">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                {isAr
                  ? 'المخططات السريرية لتطور الحالة (Clinical Progress Charts)'
                  : 'Longitudinal Clinical Outcome Charts'}
              </h3>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                OrganUI
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {isAr
                ? 'منحنى انخفاض الألم (VAS 0-10) ومقارنة المدى الحركي (ROM) والقوة العضلية (MMT)'
                : 'VAS pain trajectory, joint range of motion (ROM), and muscle strength (MMT)'}
            </p>
          </div>
        </div>

        {/* Summary KPI Pills */}
        <div className="flex items-center gap-2">
          {latestPain !== null && (
            <div className="px-3 py-1 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center gap-2 text-xs tabular-nums">
              <Flame className="w-3.5 h-3.5 text-rose-500" />
              <span className="text-slate-500 dark:text-slate-400">
                {isAr ? 'مؤشر الألم:' : 'VAS Index:'}
              </span>
              <span className="font-mono font-bold text-slate-900 dark:text-white">
                {latestPain}/10
              </span>
              {painDelta > 0 && (
                <span className="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                  <TrendingDown className="w-3 h-3" />-{painDelta}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Chart 1: VAS Pain Trajectory SVG Line Chart */}
        <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {isAr ? 'مسار شدة الألم عبر الجلسات (VAS 0–10)' : 'Pain Intensity Trajectory (VAS 0–10)'}
            </span>
            <span className="text-[11px] font-mono text-slate-500 tabular-nums">
              {painPoints.length} {isAr ? 'جلسات' : 'sessions'}
            </span>
          </div>

          {painPoints.length === 0 ? (
            <div className="h-36 flex items-center justify-center text-xs text-slate-400">
              {isAr
                ? 'سجّل جلسات علاجية لعرض منحنى استجابة الألم البياني'
                : 'Record treatment sessions to plot the longitudinal pain curve'}
            </div>
          ) : (
            <div className="h-40 w-full">
              <svg viewBox="0 0 320 130" className="w-full h-full overflow-visible">
                {/* Horizontal Reference Lines (0, 5, 10) */}
                {[0, 5, 10].map((val) => {
                  const y = 105 - (val / 10) * 85;
                  return (
                    <g key={val}>
                      <line
                        x1="28"
                        y1={y}
                        x2="305"
                        y2={y}
                        stroke="currentColor"
                        strokeDasharray="3 3"
                        className="text-slate-200 dark:text-slate-800"
                      />
                      <text
                        x="20"
                        y={y + 3}
                        fontSize="8"
                        textAnchor="end"
                        className="fill-slate-400 font-mono"
                      >
                        {val}
                      </text>
                    </g>
                  );
                })}

                {/* Polyline connecting sessions */}
                {painPoints.length > 1 && (
                  <polyline
                    fill="none"
                    stroke="#0d9488"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={painPoints
                      .map((pt, i) => {
                        const x =
                          40 +
                          (i / Math.max(1, painPoints.length - 1)) * 250;
                        const y = 105 - (pt.pain / 10) * 85;
                        return `${x},${y}`;
                      })
                      .join(' ')}
                  />
                )}

                {/* Data Points */}
                {painPoints.map((pt, i) => {
                  const x =
                    painPoints.length === 1
                      ? 165
                      : 40 + (i / (painPoints.length - 1)) * 250;
                  const y = 105 - (pt.pain / 10) * 85;
                  return (
                    <g key={i}>
                      <circle
                        cx={x}
                        cy={y}
                        r="4.5"
                        className="fill-teal-600 stroke-white dark:stroke-slate-900 stroke-2"
                      />
                      <text
                        x={x}
                        y={y - 8}
                        fontSize="8.5"
                        textAnchor="middle"
                        className="fill-slate-700 dark:fill-slate-200 font-mono font-bold"
                      >
                        {pt.pain}
                      </text>
                      <text
                        x={x}
                        y="122"
                        fontSize="8"
                        textAnchor="middle"
                        className="fill-slate-500 font-mono"
                      >
                        #{pt.sessionNumber}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>
          )}
        </div>

        {/* Chart 2: ROM & MMT Measurements Progress Bars */}
        <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {isAr ? 'مؤشرات المدى الحركي (ROM) والقوة العضلية (MMT)' : 'ROM & MMT Recovery Index'}
            </span>
            <span className="text-[11px] font-mono text-teal-600 dark:text-teal-400 tabular-nums">
              {romEntries.length} ROM • {mmtEntries.length} MMT
            </span>
          </div>

          {romEntries.length === 0 && mmtEntries.length === 0 ? (
            <div className="h-36 flex items-center justify-center text-xs text-slate-400 text-center px-4">
              {isAr
                ? 'أدخل قياسات الزوايا المفصلية (ROM) أو القوة العضلية (MMT) لعرض مخططات التماثل الحركي'
                : 'Add ROM goniometry or MMT grades in the examination canvas to visualize bilateral progress'}
            </div>
          ) : (
            <div className="space-y-2.5 max-h-40 overflow-y-auto pr-1">
              {romEntries.slice(0, 4).map((entry) => {
                const measured = entry.measuredAngleDegrees ?? 0;
                const refAngle = entry.referenceUninvolvedAngleDegrees || 150;
                const pct = Math.min(100, Math.round((measured / refAngle) * 100));

                return (
                  <div key={entry.entryId} className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] tabular-nums">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        {isAr ? entry.movementNameAr : entry.movementNameEn} ({entry.laterality})
                      </span>
                      <span className="font-mono text-slate-500">
                        {measured}° / {refAngle}° ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full bg-teal-600 rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
