// =======================================================================
// PhysioRecord — Longitudinal Clinical Comparison Matrix (Phase 5)
// Side-by-Side Comparison Across Initial Evaluation -> Re-evaluations -> Discharge
// =======================================================================

import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { ClinicOperationsService } from '../../services/clinicOperationsService';
import type {
  EpisodeScopedClinicalStore,
  ClinicalAssessmentSnapshot,
} from '../../types/clinicManagement';
import {
  TrendingUp,
  Plus,
  CheckCircle2,
  ArrowUpRight,
  FileBarChart,
} from 'lucide-react';

interface LongitudinalComparisonViewProps {
  episodeStore: EpisodeScopedClinicalStore;
  episodeTitle: string;
  onSnapshotAdded: (updatedStore: EpisodeScopedClinicalStore) => void;
}

export const LongitudinalComparisonView: React.FC<LongitudinalComparisonViewProps> = ({
  episodeStore,
  episodeTitle,
  onSnapshotAdded,
}) => {
  const { language, isRtl } = useLanguage();
  const isAr = language === 'ar';

  const [snapshotType, setSnapshotType] =
    useState<ClinicalAssessmentSnapshot['snapshotType']>('initial_evaluation');
  const [justRecorded, setJustRecorded] = useState(false);

  const snapshots = episodeStore.snapshots || [];

  const handleCaptureSnapshot = () => {
    ClinicOperationsService.recordEpisodeSnapshot(
      episodeStore.episodeId,
      episodeStore.patientId,
      snapshotType
    );
    const refreshed = ClinicOperationsService.getEpisodeClinicalStore(
      episodeStore.episodeId,
      episodeStore.patientId
    );
    onSnapshotAdded(refreshed);
    setJustRecorded(true);
    setTimeout(() => setJustRecorded(false), 2500);
  };

  // Collect all unique ROM keys and MMT keys across snapshots + current live store
  const currentRomEntries = (episodeStore.objective?.romBattery?.entries || []).filter(
    (r) => r.isTested && r.measuredAngleDegrees !== null
  );
  const currentMmtEntries = (episodeStore.objective?.mmtBattery?.entries || []).filter(
    (m) => m.isTested && m.gradeValue !== null
  );

  const uniqueRomKeys = Array.from(
    new Set([
      ...snapshots.flatMap((s) => s.romSummary.map((r) => r.jointMovementKey)),
      ...currentRomEntries.map((r) => `${r.jointId}_${r.movementId}_${r.laterality}`),
    ])
  );

  const uniqueMmtKeys = Array.from(
    new Set([
      ...snapshots.flatMap((s) => s.mmtSummary.map((m) => m.muscleKey)),
      ...currentMmtEntries.map((m) => `${m.muscleGroupId}_${m.laterality}`),
    ])
  );

  const firstSnapshot = snapshots[0];
  const currentPainActivity = episodeStore.painOnActivityNrs ?? 5;
  const baselinePainActivity = firstSnapshot?.painNrsActivity ?? currentPainActivity;
  const painDelta = baselinePainActivity - currentPainActivity;

  return (
    <div className="space-y-5" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header & Capture Snapshot Action Bar */}
      <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileBarChart className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
              {isAr
                ? 'مصفوفة المقارنة السريرية الطولية (Initial Eval vs. Re-evaluations vs. Current)'
                : 'Longitudinal Clinical Comparison Matrix (Baseline vs. Re-evals vs. Current)'}
            </h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isAr
              ? `مقارنة قياسات المدى الحركي (ROM)، القوة العضلية (MMT)، الألم (NPRS)، ومقاييس الإعاقة لحلقة الرعاية: ${episodeTitle}`
              : `Side-by-side progression tracking for ${episodeTitle}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={snapshotType}
            onChange={(e) => setSnapshotType(e.target.value as any)}
            className="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200"
          >
            <option value="initial_evaluation">
              {isAr ? 'التقييم الأولي المرجعي (Initial Eval)' : 'Initial Evaluation (Baseline)'}
            </option>
            <option value="re_evaluation">
              {isAr ? 'إعادة تقييم مرحلي (Re-evaluation)' : 'Re-evaluation Snapshot'}
            </option>
            <option value="follow_up">
              {isAr ? 'متابعة سريرية (Follow-up)' : 'Follow-up Snapshot'}
            </option>
            <option value="discharge">
              {isAr ? 'تقييم التخريج الختامي (Discharge)' : 'Discharge Evaluation'}
            </option>
          </select>

          <button
            type="button"
            onClick={handleCaptureSnapshot}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap transition-colors ${
              justRecorded
                ? 'bg-emerald-600 text-white'
                : 'bg-teal-600 hover:bg-teal-500 text-white'
            }`}
          >
            {justRecorded ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>{isAr ? 'تم توثيق القراءات بالمصفوفة!' : 'Snapshot Captured!'}</span>
              </>
            ) : (
              <>
                <Plus className="w-4 h-4" />
                <span>
                  {isAr
                    ? '+ تثبيت القراءات الحالية في جدول المقارنة'
                    : '+ Capture Current Exam Snapshot'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Longitudinal Comparison Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-bold">
                <th className="py-3.5 px-4 text-start min-w-[210px]">
                  {isAr ? 'المعيار السريري / المفصل' : 'Clinical Parameter / Joint'}
                </th>
                {snapshots.map((snap) => (
                  <th key={snap.id} className="py-3.5 px-4 text-start min-w-[140px]">
                    <div className="text-slate-900 dark:text-white">
                      {isAr ? snap.labelAr : snap.labelEn}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 tabular-nums">
                      {snap.recordedDate}
                    </div>
                  </th>
                ))}
                <th className="py-3.5 px-4 text-start min-w-[150px] bg-teal-50/40 dark:bg-teal-950/30">
                  <div className="text-teal-700 dark:text-teal-300">
                    {isAr ? 'القراءة الحالية (الحية)' : 'Current Live Status'}
                  </div>
                  <div className="text-[10px] font-mono text-slate-400">
                    {isAr ? 'محدث الآن' : 'Active Chart'}
                  </div>
                </th>
                <th className="py-3.5 px-4 text-end min-w-[120px]">
                  {isAr ? 'مقدار التحسن (Δ)' : 'Net Change (Δ)'}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 tabular-nums">
              {/* Row 1: Pain NPRS at Rest */}
              <tr>
                <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                  {isAr ? 'شدة الألم أثناء الراحة (NPRS Rest)' : 'Pain at Rest (NPRS 0–10)'}
                </td>
                {snapshots.map((snap) => (
                  <td key={snap.id} className="py-3 px-4 font-mono">
                    {snap.painNrsRest}/10
                  </td>
                ))}
                <td className="py-3 px-4 font-mono font-bold text-teal-700 dark:text-teal-300 bg-teal-50/20 dark:bg-teal-950/20">
                  {episodeStore.painAtRestNrs ?? 0}/10
                </td>
                <td className="py-3 px-4 text-end font-mono font-bold">
                  {firstSnapshot ? (
                    <span
                      className={
                        firstSnapshot.painNrsRest - (episodeStore.painAtRestNrs ?? 0) >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600'
                      }
                    >
                      {firstSnapshot.painNrsRest - (episodeStore.painAtRestNrs ?? 0) > 0
                        ? `-${firstSnapshot.painNrsRest - (episodeStore.painAtRestNrs ?? 0)} pts`
                        : '0 pts'}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>

              {/* Row 2: Pain NPRS with Activity */}
              <tr>
                <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                  {isAr ? 'شدة الألم مع الحركة والمجهود (NPRS Activity)' : 'Pain on Activity (NPRS 0–10)'}
                </td>
                {snapshots.map((snap) => (
                  <td key={snap.id} className="py-3 px-4 font-mono">
                    {snap.painNrsActivity}/10
                  </td>
                ))}
                <td className="py-3 px-4 font-mono font-bold text-teal-700 dark:text-teal-300 bg-teal-50/20 dark:bg-teal-950/20">
                  {currentPainActivity}/10
                </td>
                <td className="py-3 px-4 text-end font-mono font-bold">
                  {firstSnapshot ? (
                    <span
                      className={
                        painDelta >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600'
                      }
                    >
                      {painDelta > 0 ? `-${painDelta} pts` : '0 pts'}
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>

              {/* Row 3: Functional Outcome Scale Score */}
              <tr>
                <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                  {isAr
                    ? `المقياس الوظيفي (${episodeStore.functionalScales?.scaleId?.toUpperCase() || 'ODI / QuickDASH'})`
                    : `Functional Scale (${episodeStore.functionalScales?.scaleId?.toUpperCase() || 'Outcome'})`}
                </td>
                {snapshots.map((snap) => (
                  <td key={snap.id} className="py-3 px-4 font-mono">
                    {snap.outcomeScale ? `${snap.outcomeScale.scorePercentage}%` : '—'}
                  </td>
                ))}
                <td className="py-3 px-4 font-mono font-bold text-teal-700 dark:text-teal-300 bg-teal-50/20 dark:bg-teal-950/20">
                  {episodeStore.functionalScales
                    ? `${episodeStore.functionalScales.scorePercentage}%`
                    : '—'}
                </td>
                <td className="py-3 px-4 text-end font-mono font-bold text-emerald-600 dark:text-emerald-400">
                  {firstSnapshot?.outcomeScale && episodeStore.functionalScales
                    ? `${Math.abs(
                        firstSnapshot.outcomeScale.scorePercentage -
                          episodeStore.functionalScales.scorePercentage
                      )}% Δ`
                    : '—'}
                </td>
              </tr>

              {/* Dynamic ROM Rows */}
              {uniqueRomKeys.map((romKey) => {
                const liveMatch = currentRomEntries.find(
                  (r) => `${r.jointId}_${r.movementId}_${r.laterality}` === romKey
                );
                const snapMatch = snapshots
                  .flatMap((s) => s.romSummary)
                  .find((r) => r.jointMovementKey === romKey);
                const label = isAr
                  ? liveMatch
                    ? `${liveMatch.jointNameAr} - ${liveMatch.movementNameAr} (${liveMatch.laterality})`
                    : snapMatch?.labelAr || romKey
                  : liveMatch
                  ? `${liveMatch.jointNameEn} ${liveMatch.movementNameEn} (${liveMatch.laterality})`
                  : snapMatch?.labelEn || romKey;

                const firstVal = firstSnapshot?.romSummary.find(
                  (r) => r.jointMovementKey === romKey
                )?.aromDegrees;
                const currentVal = liveMatch?.measuredAngleDegrees;
                const romGain =
                  firstVal !== undefined &&
                  firstVal !== null &&
                  currentVal !== undefined &&
                  currentVal !== null
                    ? currentVal - firstVal
                    : null;

                return (
                  <tr key={romKey}>
                    <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                      ROM · {label}
                    </td>
                    {snapshots.map((snap) => {
                      const entry = snap.romSummary.find((r) => r.jointMovementKey === romKey);
                      return (
                        <td key={snap.id} className="py-3 px-4 font-mono">
                          {entry?.aromDegrees !== undefined && entry?.aromDegrees !== null
                            ? `${entry.aromDegrees}°`
                            : '—'}
                        </td>
                      );
                    })}
                    <td className="py-3 px-4 font-mono font-bold text-teal-700 dark:text-teal-300 bg-teal-50/20 dark:bg-teal-950/20">
                      {currentVal !== undefined && currentVal !== null ? `${currentVal}°` : '—'}
                    </td>
                    <td className="py-3 px-4 text-end font-mono font-bold">
                      {romGain !== null ? (
                        <span
                          className={
                            romGain >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-amber-600'
                          }
                        >
                          {romGain > 0 ? `+${romGain}°` : `${romGain}°`}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                  </tr>
                );
              })}

              {/* Dynamic MMT Rows */}
              {uniqueMmtKeys.map((mmtKey) => {
                const liveMatch = currentMmtEntries.find(
                  (m) => `${m.muscleGroupId}_${m.laterality}` === mmtKey
                );
                const snapMatch = snapshots
                  .flatMap((s) => s.mmtSummary)
                  .find((m) => m.muscleKey === mmtKey);
                const label = isAr
                  ? liveMatch
                    ? `${liveMatch.muscleNameAr} (${liveMatch.laterality})`
                    : snapMatch?.labelAr || mmtKey
                  : liveMatch
                  ? `${liveMatch.muscleNameEn} (${liveMatch.laterality})`
                  : snapMatch?.labelEn || mmtKey;

                const firstGrade = firstSnapshot?.mmtSummary.find(
                  (m) => m.muscleKey === mmtKey
                )?.grade;
                const currentGrade = liveMatch?.gradeValue;

                return (
                  <tr key={mmtKey}>
                    <td className="py-3 px-4 font-semibold text-slate-800 dark:text-slate-200">
                      MMT · {label}
                    </td>
                    {snapshots.map((snap) => {
                      const entry = snap.mmtSummary.find((m) => m.muscleKey === mmtKey);
                      return (
                        <td key={snap.id} className="py-3 px-4 font-mono">
                          {entry ? `${entry.grade}/5` : '—'}
                        </td>
                      );
                    })}
                    <td className="py-3 px-4 font-mono font-bold text-teal-700 dark:text-teal-300 bg-teal-50/20 dark:bg-teal-950/20">
                      {currentGrade ? `${currentGrade}/5` : '—'}
                    </td>
                    <td className="py-3 px-4 text-end font-mono font-bold text-emerald-600 dark:text-emerald-400">
                      {firstGrade && currentGrade ? `${firstGrade} → ${currentGrade}/5` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
