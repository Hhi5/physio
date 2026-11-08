// =======================================================================
// PhysioRecord — Rapid ROM & MMT Clinical Assessment Panel (Phase 2C - Milestone 3)
// Interactive Clinical Workflows, Rapid Steppers, Bilateral Symmetry & MRC Standards
// =======================================================================

import React, { useState, useMemo } from 'react';
import {
  Compass,
  Dumbbell,
  Plus,
  Trash2,
  AlertCircle,
  AlertTriangle,
  Info,
  Scale,
  Minus,
  Sparkles,
} from 'lucide-react';
import type {
  RomMeasurementEntry,
  RomAssessmentBatteryData,
  MmtMeasurementEntry,
  MmtAssessmentBatteryData,
  RomMovementType,
  BodyLaterality,
  RomEndFeel,
  ClinicalNonTestableReason,
  MmtGradeValue,
  MmtGravityCondition,
} from '../../types/clinical';
import {
  ROM_JOINTS_CATALOG,
  MMT_MUSCLE_GROUPS_CATALOG,
  MRC_GRADES_CATALOG,
  CLINICAL_NON_TESTABLE_REASONS,
  ROM_END_FEELS,
  ROM_MOVEMENT_TYPES,
  BODY_LATERALITIES,
  calculateBilateralSymmetry,
} from '../../data/clinicalToolkit/romMmtCatalog';

export interface RomMmtAssessmentPanelProps {
  romBattery?: RomAssessmentBatteryData;
  mmtBattery?: MmtAssessmentBatteryData;
  onChangeRom?: (battery: RomAssessmentBatteryData) => void;
  onChangeMmt?: (battery: MmtAssessmentBatteryData) => void;
  readOnly?: boolean;
  compactPreview?: boolean;
  activeWorkflow?: 'rom' | 'mmt';
  hideWorkflowTabs?: boolean;
}

export const RomMmtAssessmentPanel: React.FC<RomMmtAssessmentPanelProps> = ({
  romBattery,
  mmtBattery,
  onChangeRom,
  onChangeMmt,
  readOnly = false,
  compactPreview = false,
  activeWorkflow: controlledWorkflow,
  hideWorkflowTabs = false,
}) => {
  // Primary sub-tab: 'rom' | 'mmt'
  const [internalWorkflow, setInternalWorkflow] = useState<'rom' | 'mmt'>('rom');
  const activeWorkflow = controlledWorkflow || internalWorkflow;
  const setActiveWorkflow = setInternalWorkflow;

  // -------------------------------------------------------------------------
  // ROM Entry Draft State
  // -------------------------------------------------------------------------
  const [selectedJointId, setSelectedJointId] = useState<string>(ROM_JOINTS_CATALOG[0].jointId);
  const currentJoint = useMemo(
    () => ROM_JOINTS_CATALOG.find((j) => j.jointId === selectedJointId) || ROM_JOINTS_CATALOG[0],
    [selectedJointId]
  );

  const [selectedMovementId, setSelectedMovementId] = useState<string>(
    currentJoint.movements[0]?.movementId || ''
  );
  const currentMovement = useMemo(
    () => currentJoint.movements.find((m) => m.movementId === selectedMovementId) || currentJoint.movements[0],
    [currentJoint, selectedMovementId]
  );

  const [movementType, setMovementType] = useState<RomMovementType>('AROM');
  const [romLaterality, setRomLaterality] = useState<BodyLaterality>(
    currentJoint.applicableLateralities[0] || 'right'
  );
  const [romIsTested, setRomIsTested] = useState<boolean>(true);
  const [measuredAngle, setMeasuredAngle] = useState<number | string>(90);
  const [referenceAngle, setReferenceAngle] = useState<number | string>('');
  const [endFeel, setEndFeel] = useState<RomEndFeel>('normal_capsular_firm');
  const [romPainNrs, setRomPainNrs] = useState<number>(0);
  const [romReasonNotTested, setRomReasonNotTested] = useState<ClinicalNonTestableReason>('severe_acute_pain');
  const [romNotes, setRomNotes] = useState<string>('');
  const [romError, setRomError] = useState<string | null>(null);

  // When joint changes, sync movement and applicable laterality
  const handleJointChange = (newJointId: string) => {
    setSelectedJointId(newJointId);
    const j = ROM_JOINTS_CATALOG.find((joint) => joint.jointId === newJointId);
    if (j && j.movements.length > 0) {
      setSelectedMovementId(j.movements[0].movementId);
      if (!j.applicableLateralities.includes(romLaterality)) {
        setRomLaterality(j.applicableLateralities[0]);
      }
    }
  };

  // Live symmetry computation for ROM
  const currentSymmetry = useMemo(() => {
    if (!romIsTested || typeof measuredAngle !== 'number') return null;
    const ref = typeof referenceAngle === 'number' ? referenceAngle : parseFloat(String(referenceAngle));
    if (isNaN(ref) || ref <= 0) return null;
    return calculateBilateralSymmetry(measuredAngle, ref);
  }, [romIsTested, measuredAngle, referenceAngle]);

  // Stepper helper for measured angle
  const adjustMeasuredAngle = (step: number) => {
    if (readOnly || !romIsTested) return;
    const currentVal = typeof measuredAngle === 'number' ? measuredAngle : parseFloat(String(measuredAngle)) || 0;
    const nextVal = Math.min(360, Math.max(-45, currentVal + step));
    setMeasuredAngle(nextVal);
  };

  // Add ROM Entry
  const handleAddRomEntry = () => {
    if (readOnly || !onChangeRom) return;
    setRomError(null);

    let angleDegrees: number | null = null;
    if (romIsTested) {
      const parsed = typeof measuredAngle === 'number' ? measuredAngle : parseFloat(String(measuredAngle));
      if (isNaN(parsed) || parsed < -45 || parsed > 360) {
        setRomError('يرجى إدخال زاوية قياس صحيحة بين -45° و 360°');
        return;
      }
      angleDegrees = parsed;
    }

    let refAngleDegrees: number | null = null;
    if (referenceAngle !== '') {
      const parsedRef = typeof referenceAngle === 'number' ? referenceAngle : parseFloat(String(referenceAngle));
      if (!isNaN(parsedRef)) {
        refAngleDegrees = parsedRef;
      }
    }

    const newEntry: RomMeasurementEntry = {
      entryId: crypto.randomUUID(),
      jointId: currentJoint.jointId,
      jointNameAr: currentJoint.nameAr,
      jointNameEn: currentJoint.nameEn,
      movementId: currentMovement.movementId,
      movementNameAr: currentMovement.nameAr,
      movementNameEn: currentMovement.nameEn,
      movementType,
      laterality: romLaterality,
      isTested: romIsTested,
      measuredAngleDegrees: romIsTested ? angleDegrees : null,
      referenceUninvolvedAngleDegrees: refAngleDegrees,
      endFeel: romIsTested ? endFeel : undefined,
      painNrsScore: romPainNrs,
      reasonNotTested: !romIsTested ? romReasonNotTested : undefined,
      clinicalNotes: romNotes.trim() ? romNotes.trim() : undefined,
    };

    const updatedEntries = [...(romBattery?.entries || []), newEntry];
    onChangeRom({
      batteryVersion: '1.0.0',
      entries: updatedEntries,
      updatedAt: new Date().toISOString(),
    });

    // Reset notes
    setRomNotes('');
  };

  // Remove ROM Entry
  const handleRemoveRomEntry = (entryId: string) => {
    if (readOnly || !onChangeRom || !romBattery) return;
    const updated = romBattery.entries.filter((e) => e.entryId !== entryId);
    onChangeRom({
      ...romBattery,
      entries: updated,
      updatedAt: new Date().toISOString(),
    });
  };

  // -------------------------------------------------------------------------
  // MMT Entry Draft State
  // -------------------------------------------------------------------------
  const [selectedMuscleGroupId, setSelectedMuscleGroupId] = useState<string>(
    MMT_MUSCLE_GROUPS_CATALOG[0].muscleGroupId
  );
  const currentMuscleGroup = useMemo(
    () =>
      MMT_MUSCLE_GROUPS_CATALOG.find((m) => m.muscleGroupId === selectedMuscleGroupId) ||
      MMT_MUSCLE_GROUPS_CATALOG[0],
    [selectedMuscleGroupId]
  );

  const [mmtLaterality, setMmtLaterality] = useState<BodyLaterality>('right');
  const [gravityCondition, setGravityCondition] = useState<MmtGravityCondition>('against_gravity');
  const [mmtIsTested, setMmtIsTested] = useState<boolean>(true);
  const [selectedGrade, setSelectedGrade] = useState<MmtGradeValue>('5');
  const [substitutionObserved, setSubstitutionObserved] = useState<boolean>(false);
  const [mmtPainNrs, setMmtPainNrs] = useState<number>(0);
  const [mmtReasonNotTested, setMmtReasonNotTested] = useState<ClinicalNonTestableReason>('severe_acute_pain');
  const [mmtNotes, setMmtNotes] = useState<string>('');
  const [mmtError, setMmtError] = useState<string | null>(null);

  // Add MMT Entry
  const handleAddMmtEntry = () => {
    if (readOnly || !onChangeMmt) return;
    setMmtError(null);

    const newEntry: MmtMeasurementEntry = {
      entryId: crypto.randomUUID(),
      muscleGroupId: currentMuscleGroup.muscleGroupId,
      muscleNameAr: currentMuscleGroup.nameAr,
      muscleNameEn: currentMuscleGroup.nameEn,
      actionNameAr: currentMuscleGroup.actionNameAr,
      actionNameEn: currentMuscleGroup.actionNameEn,
      laterality: mmtLaterality,
      gravityCondition,
      isTested: mmtIsTested,
      gradeValue: mmtIsTested ? selectedGrade : null,
      painNrsScore: mmtPainNrs,
      substitutionObserved: mmtIsTested ? substitutionObserved : false,
      reasonNotTested: !mmtIsTested ? mmtReasonNotTested : undefined,
      clinicalNotes: mmtNotes.trim() ? mmtNotes.trim() : undefined,
    };

    const updatedEntries = [...(mmtBattery?.entries || []), newEntry];
    onChangeMmt({
      batteryVersion: '1.0.0',
      entries: updatedEntries,
      updatedAt: new Date().toISOString(),
    });

    // Reset notes
    setMmtNotes('');
  };

  // Remove MMT Entry
  const handleRemoveMmtEntry = (entryId: string) => {
    if (readOnly || !onChangeMmt || !mmtBattery) return;
    const updated = mmtBattery.entries.filter((e) => e.entryId !== entryId);
    onChangeMmt({
      ...mmtBattery,
      entries: updated,
      updatedAt: new Date().toISOString(),
    });
  };

  // Grade color badges helper
  const getGradeBadgeClass = (grade: MmtGradeValue) => {
    switch (grade) {
      case '0':
        return 'bg-rose-100 text-rose-800 border-rose-300';
      case '1':
      case '2-':
      case '2':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case '2+':
      case '3-':
      case '3':
        return 'bg-yellow-100 text-yellow-900 border-yellow-300';
      case '3+':
      case '4-':
      case '4':
      case '4+':
        return 'bg-sky-100 text-sky-900 border-sky-300';
      case '5':
        return 'bg-emerald-100 text-emerald-900 border-emerald-300';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  // -------------------------------------------------------------------------
  // COMPACT PREVIEW MODE (for SOAP preview and session summaries)
  // -------------------------------------------------------------------------
  if (compactPreview) {
    const romEntries = romBattery?.entries || [];
    const mmtEntries = mmtBattery?.entries || [];

    if (romEntries.length === 0 && mmtEntries.length === 0) {
      return (
        <div className="py-2 text-xs text-slate-400 text-center italic">
          لم يتم توثيق قياسات ROM أو فحص عضلات MMT لهذه الجلسة.
        </div>
      );
    }

    return (
      <div className="space-y-3 text-xs">
        {/* ROM Summary */}
        {romEntries.length > 0 && (
          <div className="rounded-xl border border-teal-200 bg-teal-50/40 p-3">
            <div className="flex items-center gap-1.5 font-bold text-teal-900 mb-2 border-b border-teal-200/60 pb-1">
              <Compass className="w-3.5 h-3.5 text-teal-600" />
              <span>قياسات المدى الحركي (ROM) — {romEntries.length} قياسات</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {romEntries.map((e) => (
                <div
                  key={e.entryId}
                  className="bg-white/80 p-2 rounded-lg border border-teal-100 text-[11px] space-y-1 shadow-2xs"
                >
                  <div className="flex items-center justify-between font-bold text-slate-800">
                    <span>
                      {e.jointNameAr} — {e.movementNameAr}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] bg-teal-100 text-teal-800 font-mono">
                      {e.movementType}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>
                      الجهة: {BODY_LATERALITIES[e.laterality]?.ar || e.laterality}
                    </span>
                    {e.isTested ? (
                      <span className="font-bold text-teal-700 text-xs font-mono">
                        {e.measuredAngleDegrees}°
                        {e.referenceUninvolvedAngleDegrees != null && (
                          <span className="text-[10px] text-slate-400 mr-1">
                            (المرجع: {e.referenceUninvolvedAngleDegrees}°)
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                        غير مفحوص ({CLINICAL_NON_TESTABLE_REASONS[e.reasonNotTested!]?.ar || 'معذّر'})
                      </span>
                    )}
                  </div>
                  {e.isTested && e.endFeel && (
                    <div className="text-[10px] text-slate-500">
                      النهاية: {ROM_END_FEELS[e.endFeel]?.ar || e.endFeel}
                    </div>
                  )}
                  {e.painNrsScore !== undefined && e.painNrsScore > 0 && (
                    <div className="text-[10px] text-rose-600 font-medium">
                      درجة الألم: {e.painNrsScore}/10 (NRS)
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* MMT Summary */}
        {mmtEntries.length > 0 && (
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3">
            <div className="flex items-center gap-1.5 font-bold text-indigo-900 mb-2 border-b border-indigo-200/60 pb-1">
              <Dumbbell className="w-3.5 h-3.5 text-indigo-600" />
              <span>فحوصات القوة العضلية (MMT) — {mmtEntries.length} فحوصات</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {mmtEntries.map((e) => (
                <div
                  key={e.entryId}
                  className="bg-white/80 p-2 rounded-lg border border-indigo-100 text-[11px] space-y-1 shadow-2xs"
                >
                  <div className="flex items-center justify-between font-bold text-slate-800">
                    <span>{e.muscleNameAr}</span>
                    {e.isTested && e.gradeValue ? (
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border font-mono ${getGradeBadgeClass(
                          e.gradeValue
                        )}`}
                      >
                        درجة {e.gradeValue}
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                        غير مفحوص
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span>
                      {e.actionNameAr} ({BODY_LATERALITIES[e.laterality]?.ar || e.laterality})
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {e.gravityCondition === 'against_gravity' ? 'ضد الجاذبية' : 'إلغاء الجاذبية'}
                    </span>
                  </div>
                  {!e.isTested && e.reasonNotTested && (
                    <div className="text-[10px] text-amber-800">
                      السبب: {CLINICAL_NON_TESTABLE_REASONS[e.reasonNotTested]?.ar || e.reasonNotTested}
                    </div>
                  )}
                  {e.substitutionObserved && (
                    <div className="text-[10px] text-amber-700 font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-500" />
                      <span>لوحظت حركة تعويضية غير طبيعية (Trick Movement)</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // INTERACTIVE WORKFLOW MODE
  // -------------------------------------------------------------------------
  const romEntries = romBattery?.entries || [];
  const mmtEntries = mmtBattery?.entries || [];

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
      {/* Workflow Tabs Header */}
      {!hideWorkflowTabs && (
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveWorkflow('rom')}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeWorkflow === 'rom'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>المدى الحركي (ROM)</span>
            {romEntries.length > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  activeWorkflow === 'rom' ? 'bg-teal-700 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {romEntries.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveWorkflow('mmt')}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeWorkflow === 'mmt'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <Dumbbell className="w-3.5 h-3.5" />
            <span>الفحص العضلي (MMT)</span>
            {mmtEntries.length > 0 && (
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  activeWorkflow === 'mmt' ? 'bg-indigo-700 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {mmtEntries.length}
              </span>
            )}
          </button>
        </div>

        <div className="text-[11px] text-slate-500 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5 text-teal-600" />
          <span>قياس وتوثيق سريري معياري (WHO & MRC Standard)</span>
        </div>
      </div>
      )}

      {/* ===================================================================== */}
      {/* WORKFLOW 1: RANGE OF MOTION (ROM)                                    */}
      {/* ===================================================================== */}
      {activeWorkflow === 'rom' && (
        <div className="space-y-4">
          {!readOnly && (
            <div className="bg-teal-50/40 p-3.5 rounded-2xl border border-teal-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-950 flex items-center gap-1.5">
                  <Compass className="w-4 h-4 text-teal-600" />
                  <span>تسجيل قياس جديد للمدى الحركي (New ROM Entry)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setRomIsTested(!romIsTested)}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                    !romIsTested
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {!romIsTested ? '✓ محدد كـ غير قابل للفحص السريري' : 'تعذر الفحص السريري (Not Tested)'}
                </button>
              </div>

              {romError && (
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{romError}</span>
                </div>
              )}

              {/* Joint & Movement Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">المفصل المستهدف:</label>
                  <select
                    value={selectedJointId}
                    onChange={(e) => handleJointChange(e.target.value)}
                    className="w-full text-xs py-1.5 px-2.5 rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-teal-500"
                  >
                    {ROM_JOINTS_CATALOG.map((j) => (
                      <option key={j.jointId} value={j.jointId}>
                        {j.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">الحركة المفصلية:</label>
                  <select
                    value={selectedMovementId}
                    onChange={(e) => setSelectedMovementId(e.target.value)}
                    className="w-full text-xs py-1.5 px-2.5 rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-teal-500"
                  >
                    {currentJoint.movements.map((m) => (
                      <option key={m.movementId} value={m.movementId}>
                        {m.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">نوع المدى الحركي:</label>
                  <select
                    value={movementType}
                    onChange={(e) => setMovementType(e.target.value as RomMovementType)}
                    className="w-full text-xs py-1.5 px-2.5 rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-teal-500"
                  >
                    {(Object.keys(ROM_MOVEMENT_TYPES) as RomMovementType[]).map((t) => (
                      <option key={t} value={t}>
                        {ROM_MOVEMENT_TYPES[t].ar}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">الجهة / الطرف المفحوص:</label>
                  <select
                    value={romLaterality}
                    onChange={(e) => setRomLaterality(e.target.value as BodyLaterality)}
                    className="w-full text-xs py-1.5 px-2.5 rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-teal-500"
                  >
                    {currentJoint.applicableLateralities.map((lat) => (
                      <option key={lat} value={lat}>
                        {BODY_LATERALITIES[lat]?.ar || lat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Angle Inputs OR Non-Testable Reason */}
              {romIsTested ? (
                <div className="space-y-3 pt-1 border-t border-teal-200/60">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
                    {/* Primary Angle Input with Stepper */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-slate-700">
                          الزاوية المقاسة (بالدرجات °):
                        </label>
                        <span className="text-[10px] text-teal-700 font-mono font-medium">
                          المدى الطبيعي: {currentMovement.normalRangeDegrees}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => adjustMeasuredAngle(-5)}
                          className="px-2 py-1 text-xs font-mono font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700"
                          title="-5°"
                        >
                          -5°
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustMeasuredAngle(-1)}
                          className="px-2 py-1 text-xs font-mono font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700"
                          title="-1°"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <input
                          type="number"
                          value={measuredAngle}
                          onChange={(e) => setMeasuredAngle(e.target.value === '' ? '' : Number(e.target.value))}
                          step="1"
                          min="-45"
                          max="360"
                          className="w-full text-center text-sm font-bold font-mono py-1 rounded-xl border border-teal-300 bg-white focus:ring-2 focus:ring-teal-500"
                        />
                        <button
                          type="button"
                          onClick={() => adjustMeasuredAngle(1)}
                          className="px-2 py-1 text-xs font-mono font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700"
                          title="+1°"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => adjustMeasuredAngle(5)}
                          className="px-2 py-1 text-xs font-mono font-bold rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700"
                          title="+5°"
                        >
                          +5°
                        </button>
                      </div>
                    </div>

                    {/* Contralateral Reference Angle & BSI */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        زاوية الطرف السليم المقابل (اختياري):
                      </label>
                      <input
                        type="number"
                        placeholder="درجة الطرف المرجعي..."
                        value={referenceAngle}
                        onChange={(e) => setReferenceAngle(e.target.value === '' ? '' : Number(e.target.value))}
                        step="1"
                        min="0"
                        max="360"
                        className="w-full text-xs py-1.5 px-3 rounded-xl border border-slate-300 bg-white font-mono focus:ring-2 focus:ring-teal-500"
                      />
                    </div>

                    {/* End-Feel Picker */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        نهاية المدى الحركي (End-Feel):
                      </label>
                      <select
                        value={endFeel}
                        onChange={(e) => setEndFeel(e.target.value as RomEndFeel)}
                        className="w-full text-xs py-1.5 px-2.5 rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-teal-500"
                      >
                        {(Object.keys(ROM_END_FEELS) as RomEndFeel[]).map((key) => (
                          <option key={key} value={key}>
                            {ROM_END_FEELS[key].ar}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Symmetry Calculation Feedback */}
                  {currentSymmetry && currentSymmetry.symmetryIndexPercent !== null && (
                    <div className="p-2.5 rounded-xl bg-teal-100/70 border border-teal-200 text-xs text-teal-900 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Scale className="w-4 h-4 text-teal-700" />
                        <span>
                          <strong>مؤشر التناظر (BSI):</strong> {currentSymmetry.symmetryIndexPercent}% مقارنة بالطرف
                          المرجعي
                        </span>
                      </div>
                      <span className="font-mono font-bold text-teal-950">
                        عجز المدى: -{currentSymmetry.deficitDegrees}°
                      </span>
                    </div>
                  )}

                  {/* End-feel clinical description */}
                  <div className="text-[11px] text-slate-500 bg-white/70 p-2 rounded-lg border border-slate-200 flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 text-teal-600 shrink-0 mt-0.5" />
                    <span>{ROM_END_FEELS[endFeel]?.clinicalDescriptionAr}</span>
                  </div>

                  {/* Pain NRS Pills */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-700">شدة الألم مع الحركة (NRS 0-10):</span>
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setRomPainNrs(num)}
                        className={`w-6 h-6 rounded-lg text-[11px] font-mono font-bold border transition-all ${
                          romPainNrs === num
                            ? num > 6
                              ? 'bg-rose-600 text-white border-rose-600'
                              : num > 3
                              ? 'bg-amber-500 text-white border-amber-500'
                              : 'bg-teal-600 text-white border-teal-600'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                /* Non-Testable Reason Selection */
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
                  <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>سبب تعذر فحص المدى الحركي سريرياً (Mandatory Non-Testable Justification):</span>
                  </div>
                  <select
                    value={romReasonNotTested}
                    onChange={(e) => setRomReasonNotTested(e.target.value as ClinicalNonTestableReason)}
                    className="w-full text-xs py-2 px-3 rounded-xl border border-amber-300 bg-white font-medium focus:ring-2 focus:ring-amber-500"
                  >
                    {(Object.keys(CLINICAL_NON_TESTABLE_REASONS) as ClinicalNonTestableReason[]).map((r) => (
                      <option key={r} value={r}>
                        {CLINICAL_NON_TESTABLE_REASONS[r].ar}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Notes & Add Button */}
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-teal-200/60">
                <input
                  type="text"
                  placeholder="ملاحظات سريرية اختيارية (مثال: شعور بشد في نهاية الحركة، قصر نسبي في العضلات)..."
                  value={romNotes}
                  onChange={(e) => setRomNotes(e.target.value)}
                  className="w-full text-xs py-1.5 px-3 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-teal-500"
                />
                <button
                  type="button"
                  onClick={handleAddRomEntry}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 shadow-xs whitespace-nowrap transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة القياس إلى الجلسة</span>
                </button>
              </div>
            </div>
          )}

          {/* Recorded ROM Entries Table / Cards */}
          <div className="space-y-2">
            <h5 className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>القياسات المسجلة في هذه الجلسة ({romEntries.length}):</span>
              {romEntries.length === 0 && (
                <span className="text-[11px] text-slate-400 font-normal">لم تُضف أي قياسات بعد</span>
              )}
            </h5>

            {romEntries.length > 0 && (
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden bg-slate-50/50">
                {romEntries.map((entry) => {
                  const bsi =
                    entry.isTested && entry.measuredAngleDegrees !== null && entry.referenceUninvolvedAngleDegrees
                      ? calculateBilateralSymmetry(entry.measuredAngleDegrees, entry.referenceUninvolvedAngleDegrees)
                      : null;

                  return (
                    <div
                      key={entry.entryId}
                      className="p-3 bg-white hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5 font-bold text-slate-900">
                          <span>
                            {entry.jointNameAr} — {entry.movementNameAr}
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-teal-100 text-teal-800">
                            {entry.movementType}
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-700">
                            {BODY_LATERALITIES[entry.laterality]?.ar || entry.laterality}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 text-slate-600 text-[11px]">
                          {entry.isTested ? (
                            <>
                              <span className="font-bold text-teal-800 text-xs font-mono">
                                {entry.measuredAngleDegrees}°
                              </span>
                              {entry.referenceUninvolvedAngleDegrees != null && (
                                <span className="text-slate-400 font-mono">
                                  (المرجع: {entry.referenceUninvolvedAngleDegrees}°)
                                </span>
                              )}
                              {bsi && bsi.symmetryIndexPercent !== null && (
                                <span className="px-1.5 py-0.2 rounded bg-teal-50 text-teal-700 border border-teal-200 font-mono font-bold">
                                  BSI: {bsi.symmetryIndexPercent}%
                                </span>
                              )}
                              {entry.endFeel && (
                                <span className="text-slate-500">
                                  النهاية: {ROM_END_FEELS[entry.endFeel]?.ar}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              غير مفحوص: {CLINICAL_NON_TESTABLE_REASONS[entry.reasonNotTested!]?.ar}
                            </span>
                          )}

                          {entry.painNrsScore !== undefined && entry.painNrsScore > 0 && (
                            <span className="px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200 font-mono font-medium">
                              الألم: {entry.painNrsScore}/10
                            </span>
                          )}
                        </div>

                        {entry.clinicalNotes && (
                          <div className="text-[11px] text-slate-500 italic">ملاحظات: {entry.clinicalNotes}</div>
                        )}
                      </div>

                      {!readOnly && onChangeRom && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRomEntry(entry.entryId)}
                          className="self-end sm:self-auto p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                          title="حذف القياس"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* WORKFLOW 2: MANUAL MUSCLE TESTING (MMT)                              */}
      {/* ===================================================================== */}
      {activeWorkflow === 'mmt' && (
        <div className="space-y-4">
          {!readOnly && (
            <div className="bg-indigo-50/40 p-3.5 rounded-2xl border border-indigo-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
                  <Dumbbell className="w-4 h-4 text-indigo-600" />
                  <span>فحص عضلي يدوي جديد (New MMT Assessment)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setMmtIsTested(!mmtIsTested)}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                    !mmtIsTested
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  {!mmtIsTested ? '✓ محدد كـ غير قابل للفحص السريري' : 'تعذر الفحص السريري (Not Tested)'}
                </button>
              </div>

              {mmtError && (
                <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{mmtError}</span>
                </div>
              )}

              {/* Muscle Group & Configuration */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">المجموعة العضلية المفحوصة:</label>
                  <select
                    value={selectedMuscleGroupId}
                    onChange={(e) => setSelectedMuscleGroupId(e.target.value)}
                    className="w-full text-xs py-1.5 px-2.5 rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-indigo-500"
                  >
                    {MMT_MUSCLE_GROUPS_CATALOG.map((m) => (
                      <option key={m.muscleGroupId} value={m.muscleGroupId}>
                        {m.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">الطرف المفحوص:</label>
                  <select
                    value={mmtLaterality}
                    onChange={(e) => setMmtLaterality(e.target.value as BodyLaterality)}
                    className="w-full text-xs py-1.5 px-2.5 rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-indigo-500"
                  >
                    {currentMuscleGroup.applicableLateralities.map((lat) => (
                      <option key={lat} value={lat}>
                        {BODY_LATERALITIES[lat]?.ar || lat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">وضع الجاذبية (Condition):</label>
                  <select
                    value={gravityCondition}
                    onChange={(e) => setGravityCondition(e.target.value as MmtGravityCondition)}
                    className="w-full text-xs py-1.5 px-2.5 rounded-xl border border-slate-300 bg-white font-medium focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="against_gravity">ضد الجاذبية (Against Gravity — 3 to 5)</option>
                    <option value="gravity_eliminated">وضع إلغاء الجاذبية (Gravity Eliminated — 0 to 2)</option>
                  </select>
                </div>
              </div>

              {/* Tested Grade Selector OR Non-Testable Reason */}
              {mmtIsTested ? (
                <div className="space-y-3 pt-1 border-t border-indigo-200/60">
                  {/* MRC Grade Buttons Grid */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                      درجة القوة العضلية وفق مقياس مجلس البحوث الطبية (MRC Scale):
                    </label>
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-1.5">
                      {(Object.keys(MRC_GRADES_CATALOG) as MmtGradeValue[]).map((grade) => (
                        <button
                          key={grade}
                          type="button"
                          onClick={() => setSelectedGrade(grade)}
                          className={`py-1.5 px-1 rounded-xl text-xs font-mono font-bold border transition-all text-center flex flex-col items-center justify-center ${
                            selectedGrade === grade
                              ? 'ring-2 ring-indigo-600 shadow-xs ' + getGradeBadgeClass(grade)
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          <span>{grade}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Selected Grade Clinical Description Card */}
                  {selectedGrade && MRC_GRADES_CATALOG[selectedGrade] && (
                    <div className="p-2.5 rounded-xl bg-white border border-indigo-200 text-xs space-y-1">
                      <div className="flex items-center justify-between font-bold text-indigo-950">
                        <span>{MRC_GRADES_CATALOG[selectedGrade].labelAr}</span>
                        <span className="font-mono text-[11px] text-indigo-600">
                          {MRC_GRADES_CATALOG[selectedGrade].labelEn}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {MRC_GRADES_CATALOG[selectedGrade].descriptionAr}
                      </p>
                    </div>
                  )}

                  {/* Substitution & Pain Controls */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                    <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 select-none">
                      <input
                        type="checkbox"
                        checked={substitutionObserved}
                        onChange={(e) => setSubstitutionObserved(e.target.checked)}
                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                      <span className="text-[11px]">ملاحظة حركة تعويضية غير طبيعية (Trick/Substitution Movement)</span>
                    </label>

                    {/* Pain NRS */}
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[11px] font-bold text-slate-700">ألم الفحص:</span>
                      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setMmtPainNrs(num)}
                          className={`w-5 h-5 rounded text-[10px] font-mono font-bold border transition-all ${
                            mmtPainNrs === num
                              ? num > 5
                                ? 'bg-rose-600 text-white border-rose-600'
                                : 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* Non-Testable Reason Selection */
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-2">
                  <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>سبب تعذر فحص القوة العضلية سريرياً (Mandatory Non-Testable Justification):</span>
                  </div>
                  <select
                    value={mmtReasonNotTested}
                    onChange={(e) => setMmtReasonNotTested(e.target.value as ClinicalNonTestableReason)}
                    className="w-full text-xs py-2 px-3 rounded-xl border border-amber-300 bg-white font-medium focus:ring-2 focus:ring-amber-500"
                  >
                    {(Object.keys(CLINICAL_NON_TESTABLE_REASONS) as ClinicalNonTestableReason[]).map((r) => (
                      <option key={r} value={r}>
                        {CLINICAL_NON_TESTABLE_REASONS[r].ar}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Notes & Add Button */}
              <div className="flex flex-col sm:flex-row items-center gap-2 pt-2 border-t border-indigo-200/60">
                <input
                  type="text"
                  placeholder="ملاحظات سريرية حول الفحص العضلي..."
                  value={mmtNotes}
                  onChange={(e) => setMmtNotes(e.target.value)}
                  className="w-full text-xs py-1.5 px-3 rounded-xl border border-slate-300 bg-white focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="button"
                  onClick={handleAddMmtEntry}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-xs whitespace-nowrap transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة الفحص إلى الجلسة</span>
                </button>
              </div>
            </div>
          )}

          {/* Recorded MMT Entries List */}
          <div className="space-y-2">
            <h5 className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span>الفحوصات العضلية المسجلة في هذه الجلسة ({mmtEntries.length}):</span>
              {mmtEntries.length === 0 && (
                <span className="text-[11px] text-slate-400 font-normal">لم يُضف أي فحص بعد</span>
              )}
            </h5>

            {mmtEntries.length > 0 && (
              <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden bg-slate-50/50">
                {mmtEntries.map((entry) => (
                  <div
                    key={entry.entryId}
                    className="p-3 bg-white hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 font-bold text-slate-900">
                        <span>{entry.muscleNameAr}</span>
                        <span className="text-slate-500 text-[11px] font-normal">
                          ({entry.actionNameAr})
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-100 text-slate-700">
                          {BODY_LATERALITIES[entry.laterality]?.ar || entry.laterality}
                        </span>
                        {entry.isTested && entry.gradeValue ? (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-bold border font-mono ${getGradeBadgeClass(
                              entry.gradeValue
                            )}`}
                          >
                            درجة {entry.gradeValue} (MRC)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                            غير مفحوص: {CLINICAL_NON_TESTABLE_REASONS[entry.reasonNotTested!]?.ar}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                        <span className="text-slate-400">
                          {entry.gravityCondition === 'against_gravity' ? 'ضد الجاذبية' : 'وضع إلغاء الجاذبية'}
                        </span>
                        {entry.substitutionObserved && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-500" />
                            <span>حركة تعويضية (Trick)</span>
                          </span>
                        )}
                        {entry.painNrsScore !== undefined && entry.painNrsScore > 0 && (
                          <span className="px-1.5 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200 font-mono font-medium">
                            الألم: {entry.painNrsScore}/10
                          </span>
                        )}
                      </div>

                      {entry.clinicalNotes && (
                        <div className="text-[11px] text-slate-500 italic">ملاحظات: {entry.clinicalNotes}</div>
                      )}
                    </div>

                    {!readOnly && onChangeMmt && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMmtEntry(entry.entryId)}
                        className="self-end sm:self-auto p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                        title="حذف الفحص"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

