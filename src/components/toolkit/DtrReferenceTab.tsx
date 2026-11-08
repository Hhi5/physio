// =======================================================================
// PhysioRecord — Deep Tendon Reflexes (DTR) Reference Tab Component (Phase 2C)
// Interactive Reference for Tendon Reflexes, NINDS 0–4+ Grading, and Jendrassik
// =======================================================================

import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import {
  DTR_DEFINITIONS,
  NINDS_REFLEX_GRADES,
  DTR_ASYMMETRY_RULE_AR,
  DTR_ASYMMETRY_RULE_EN,
  JENDRASSIK_MANEUVER_NOTE_AR,
  JENDRASSIK_MANEUVER_NOTE_EN,
  getDtrById
} from '../../data/clinicalToolkit/dtrData';
import type { DtrReflexId, DtrGrade } from '../../types/clinicalToolkit';
import { Activity, ShieldAlert, CheckCircle2, Stethoscope, Sparkles } from 'lucide-react';

export const DtrReferenceTab: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const [selectedReflexId, setSelectedReflexId] = useState<DtrReflexId>('patellar');
  const [selectedSimulatedGrade, setSelectedSimulatedGrade] = useState<DtrGrade>('2+');

  const selectedReflex = getDtrById(selectedReflexId) || DTR_DEFINITIONS[3]; // Default to Patellar
  const activeGradeObj = NINDS_REFLEX_GRADES.find(g => g.grade === selectedSimulatedGrade) || NINDS_REFLEX_GRADES[2];

  return (
    <div className="space-y-6">
      
      {/* 1. Clinical Pearls: Asymmetry and Jendrassik Notices */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Asymmetry Rule Notice */}
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3 text-amber-950 dark:text-amber-200 text-sm">
          <ShieldAlert className="w-5 h-5 flex-shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-amber-900 dark:text-amber-100 flex items-center gap-1.5">
              <span>{isAr ? 'قاعدة عدم التناظر بين الجانبين (Asymmetry Rule)' : 'Bilateral Asymmetry Clinical Rule'}</span>
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
              {isAr ? DTR_ASYMMETRY_RULE_AR : DTR_ASYMMETRY_RULE_EN}
            </p>
          </div>
        </div>

        {/* Jendrassik Maneuver Notice */}
        <div className="bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 rounded-xl p-4 flex items-start gap-3 text-sky-950 dark:text-sky-200 text-sm">
          <Sparkles className="w-5 h-5 flex-shrink-0 text-sky-600 dark:text-sky-400 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-sky-900 dark:text-sky-100 flex items-center gap-1.5">
              <span>{isAr ? 'مناورة جيندراسيك للتعزيز (Jendrassik Maneuver)' : 'Jendrassik Reinforcement Maneuver'}</span>
            </p>
            <p className="text-xs text-sky-800 dark:text-sky-300 leading-relaxed">
              {isAr ? JENDRASSIK_MANEUVER_NOTE_AR : JENDRASSIK_MANEUVER_NOTE_EN}
            </p>
          </div>
        </div>

      </div>

      {/* 2. Interactive Five Core Reflex Cards Selector */}
      <div>
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center justify-between">
          <span>{isAr ? 'اختر المنعكس الوتري العميق للفحص:' : 'Select Deep Tendon Reflex (DTR):'}</span>
          <span className="text-[11px] font-normal text-slate-400">5 Essential Reflexes</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {DTR_DEFINITIONS.map(dtr => {
            const isSelected = selectedReflexId === dtr.reflexId;
            return (
              <button
                key={dtr.reflexId}
                onClick={() => setSelectedReflexId(dtr.reflexId)}
                className={`p-3.5 rounded-xl border text-start transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-primary-600 text-white border-primary-600 shadow-md shadow-primary-600/20 ring-2 ring-primary-500 ring-offset-1 dark:ring-offset-slate-900'
                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-[11px] font-black px-2 py-0.5 rounded ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800'
                    }`}>
                      {dtr.primaryRoot}
                    </span>
                    <span className={`text-[10px] font-mono ${isSelected ? 'text-primary-100' : 'text-slate-400'}`}>
                      {dtr.contributingRoots.join(', ')}
                    </span>
                  </div>
                  <div className="font-bold text-xs sm:text-sm leading-tight mt-1">
                    {isAr ? dtr.nameAr : dtr.nameEn}
                  </div>
                </div>
                <div className={`text-[10px] mt-2 pt-1 border-t truncate ${
                  isSelected ? 'border-primary-500/50 text-primary-100' : 'border-slate-100 dark:border-slate-700 text-slate-400'
                }`}>
                  {isAr ? dtr.peripheralNerveAr : dtr.peripheralNerveEn}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Detailed Selected Reflex View */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm space-y-5">
        
        {/* Title & Root Badges */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-700 pb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-primary-100 dark:bg-primary-950 text-primary-800 dark:text-primary-200">
                {isAr ? 'الجذر الأساسي: ' : 'Primary Root: '}{selectedReflex.primaryRoot}
              </span>
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                {isAr ? 'الجذور المساعدة: ' : 'Contributing: '}{selectedReflex.contributingRoots.join(', ')}
              </span>
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">
              {isAr ? selectedReflex.nameAr : selectedReflex.nameEn}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isAr ? selectedReflex.nameEn : selectedReflex.nameAr}
            </p>
          </div>

          <div className="text-end">
            <span className="inline-block px-3 py-1 rounded-lg text-xs font-bold bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-600">
              {isAr ? selectedReflex.peripheralNerveAr : selectedReflex.peripheralNerveEn}
            </span>
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
              {isAr ? selectedReflex.peripheralNerveEn : selectedReflex.peripheralNerveAr}
            </p>
          </div>
        </div>

        {/* Anatomical Testing Parameters Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Tapping Site Box */}
          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Stethoscope className="w-3.5 h-3.5 text-primary-600" />
              <span>{isAr ? 'موضع القرع والشاكوش (Tapping Site):' : 'Tapping Site & Technique:'}</span>
            </div>
            <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
              {isAr ? selectedReflex.tappingSiteAr : selectedReflex.tappingSiteEn}
            </p>
          </div>

          {/* Normal Response Box */}
          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>{isAr ? 'الاستجابة الطبيعية السوية (Normal Response):' : 'Normal Physiological Response:'}</span>
            </div>
            <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
              {isAr ? selectedReflex.normalResponseAr : selectedReflex.normalResponseEn}
            </p>
          </div>

          {/* Reinforcement Technique Box */}
          <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
            <div className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-sky-600" />
              <span>{isAr ? 'تقنية التعزيز المعتمدة (Reinforcement):' : 'Reinforcement Technique:'}</span>
            </div>
            <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
              {isAr ? selectedReflex.reinforcementTechniqueAr : selectedReflex.reinforcementTechniqueEn}
            </p>
          </div>

        </div>

        {/* Clinical Significance Box */}
        <div className="bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 space-y-1">
          <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-emerald-600" />
            <span>{isAr ? 'الأهمية السريرية والتفسير التشخيصي:' : 'Clinical Diagnostic Significance:'}</span>
          </div>
          <p className="text-xs text-emerald-900 dark:text-emerald-100 leading-relaxed">
            {selectedReflex.clinicalSignificanceAr}
          </p>
        </div>

      </div>

      {/* 4. Interactive NINDS 0 to 4+ Reflex Grade Simulator */}
      <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm space-y-4">
        
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700 pb-3">
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary-600" />
              <span>
                {isAr ? 'مقياس NINDS المعياري لدرجات المنعكسات الوترية (0 إلى 4+)' : 'NINDS Standard Reflex Grading Scale (0 to 4+)'}
              </span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isAr ? 'انقر فوق الدرجة لاستعراض الدلالة السريرية والمعيار الفسيولوجي المعتمد' : 'Click a grade to view its clinical interpretation and pathology criteria'}
            </p>
          </div>
          <span className="text-xs font-mono text-slate-400">
            NINDS / Bates' Guide Standard
          </span>
        </div>

        {/* Grade Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {NINDS_REFLEX_GRADES.map(g => {
            const isSelected = selectedSimulatedGrade === g.grade;
            return (
              <button
                key={g.grade}
                onClick={() => setSelectedSimulatedGrade(g.grade)}
                className={`p-3 rounded-xl border text-center transition-all flex flex-col items-center justify-center gap-1 ${
                  isSelected
                    ? g.grade === '0'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-600/20'
                      : g.grade === '4+'
                      ? 'bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/20'
                      : 'bg-primary-600 text-white border-primary-600 shadow-md shadow-primary-600/20'
                    : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <span className="text-lg font-black font-mono">{g.grade}</span>
                <span className="text-[11px] font-medium truncate w-full text-center">
                  {g.grade === '0' ? (isAr ? 'غائب' : 'Absent') :
                   g.grade === '1+' ? (isAr ? 'كليل / خامل' : 'Hypoactive') :
                   g.grade === '2+' ? (isAr ? 'طبيعي معتاد' : 'Normal') :
                   g.grade === '3+' ? (isAr ? 'نشط بزيادة' : 'Brisk') :
                   (isAr ? 'مفرط + رمع' : 'Clonus')}
                </span>
              </button>
            );
          })}
        </div>

        {/* Active Grade Detailed Interpretation Box */}
        <div className={`p-4 rounded-xl border transition-all ${
          activeGradeObj.grade === '0'
            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-950 dark:text-rose-100'
            : activeGradeObj.grade === '4+'
            ? 'bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-800 text-purple-950 dark:text-purple-100'
            : 'bg-slate-50 dark:bg-slate-900/60 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100'
        }`}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="font-bold text-sm">
              {isAr ? activeGradeObj.labelAr : activeGradeObj.labelEn}
            </span>
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
              activeGradeObj.isPhysiological
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
            }`}>
              {activeGradeObj.isPhysiological
                ? (isAr ? 'فسيولوجي / محتمل طبيعياً' : 'Physiological / May be Normal')
                : (isAr ? 'مرضي يستلزم التقصي' : 'Pathological Finding')}
            </span>
          </div>
          <p className="text-xs leading-relaxed font-medium">
            {isAr ? activeGradeObj.clinicalInterpretationAr : activeGradeObj.clinicalInterpretationEn}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 italic">
            {isAr ? activeGradeObj.clinicalInterpretationEn : activeGradeObj.clinicalInterpretationAr}
          </p>
        </div>

      </div>

    </div>
  );
};
