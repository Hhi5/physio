// =======================================================================
// PhysioRecord — Myotomes Clinical Reference Tab Component (Phase 2C)
// Interactive Reference for Myotomal Levels, Testing, and Differentiation
// =======================================================================

import React, { useState, useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import {
  MYOTOME_DEFINITIONS,
  MULTISEGMENTAL_INNERVATION_GENERAL_NOTE_AR,
  MULTISEGMENTAL_INNERVATION_GENERAL_NOTE_EN,
  getMyotomeByRoot
} from '../../data/clinicalToolkit/myotomesData';
import type { SpinalLevel, SpinalRegionGroup, MyotomeDefinition } from '../../types/clinicalToolkit';
import { Search, Info, ShieldAlert, Activity, CheckCircle2, ChevronRight, Stethoscope } from 'lucide-react';

const ASIA_KEY_ROOTS: SpinalLevel[] = ['C5', 'C6', 'C7', 'C8', 'T1', 'L2', 'L3', 'L4', 'L5', 'S1'];

export const MyotomesTab: React.FC = () => {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const [activeRoot, setActiveRoot] = useState<SpinalLevel>('L5');
  const [selectedRegion, setSelectedRegion] = useState<SpinalRegionGroup | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const selectedMyotome: MyotomeDefinition = useMemo(() => {
    return getMyotomeByRoot(activeRoot) || MYOTOME_DEFINITIONS[0];
  }, [activeRoot]);

  // Filtered definitions based on region and search query
  const filteredMyotomes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return MYOTOME_DEFINITIONS.filter(m => {
      const matchRegion = selectedRegion === 'all' || m.regionGroup === selectedRegion;
      if (!matchRegion) return false;
      if (!q) return true;

      const matchRoot = m.rootLevel.toLowerCase().includes(q);
      const matchMovEn = m.predominantMovementEn.toLowerCase().includes(q);
      const matchMovAr = m.predominantMovementAr.includes(q);
      const matchMuscle = m.keyMuscles.some(k =>
        k.nameEn.toLowerCase().includes(q) ||
        k.nameAr.includes(q) ||
        k.peripheralNerveEn.toLowerCase().includes(q) ||
        k.peripheralNerveAr.includes(q)
      );
      const matchDiff = m.differentialClinicalNotesEn.toLowerCase().includes(q) || m.differentialClinicalNotesAr.includes(q);

      return matchRoot || matchMovEn || matchMovAr || matchMuscle || matchDiff;
    });
  }, [selectedRegion, searchQuery]);

  const regionTabs: Array<{ id: SpinalRegionGroup | 'all'; labelAr: string; labelEn: string }> = [
    { id: 'all', labelAr: 'الكل (C1–S3)', labelEn: 'All Roots (C1–S3)' },
    { id: 'cervical', labelAr: 'الرقبي (C1–C8)', labelEn: 'Cervical (C1–C8)' },
    { id: 'thoracic', labelAr: 'الصدري (T1)', labelEn: 'Thoracic (T1)' },
    { id: 'lumbar', labelAr: 'القطني (L1–L5)', labelEn: 'Lumbar (L1–L5)' },
    { id: 'sacral', labelAr: 'العجزي (S1–S3)', labelEn: 'Sacral (S1–S3)' }
  ];

  return (
    <div className="space-y-6">
      {/* Multisegmental Innervation Pearl Notice */}
      <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 flex items-start gap-3 text-emerald-900 dark:text-emerald-200 text-sm">
        <Info className="w-5 h-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-emerald-950 dark:text-emerald-100 flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-emerald-600" />
            <span>
              {isAr ? 'القاعدة السريرية للتعصيب المشترك متعدد المستويات (Multisegmental Innervation)' : 'Multisegmental Innervation Clinical Principle'}
            </span>
          </p>
          <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
            {isAr ? MULTISEGMENTAL_INNERVATION_GENERAL_NOTE_AR : MULTISEGMENTAL_INNERVATION_GENERAL_NOTE_EN}
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute top-3 start-3 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              isAr
                ? 'ابحث بالجذر (L5, C5..)، الحركة (Dorsiflexion..)، أو العضلة (Tibialis anterior, Biceps..)'
                : 'Search by root (L5, C5..), movement, muscle, or nerve...'
            }
            className="w-full ps-9 pe-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute top-2.5 end-2.5 text-xs text-slate-400 hover:text-slate-600 px-1"
            >
              ✕
            </button>
          )}
        </div>

        {/* Region selector buttons */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          {regionTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedRegion(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                selectedRegion === tab.id
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {isAr ? tab.labelAr : tab.labelEn}
            </button>
          ))}
        </div>
      </div>

      {/* Root Selector Pills */}
      <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
        <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 flex items-center justify-between">
          <span>{isAr ? 'اختر الجذر الشوكي السريع:' : 'Quick Select Spinal Root:'}</span>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
            {isAr ? 'عضلة مفتاحية معتمدة (ASIA Key Myotome)' : 'ASIA Key Myotome'}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {MYOTOME_DEFINITIONS.map(m => {
            const isSelected = activeRoot === m.rootLevel;
            const isAsiaKey = ASIA_KEY_ROOTS.includes(m.rootLevel);
            return (
              <button
                key={m.rootLevel}
                onClick={() => setActiveRoot(m.rootLevel)}
                className={`relative px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600 ring-offset-1 dark:ring-offset-slate-900'
                    : isAsiaKey
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <span>{m.rootLevel}</span>
                {isAsiaKey && !isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Layout: Active Root Card & Quick Directory */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left / Main Column: Selected Myotome Detailed Card (Span 2) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-6 shadow-sm space-y-5">
            
            {/* Header: Root Badge, Region, and ASIA Status */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700 pb-4">
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-xl bg-emerald-600 text-white font-bold text-xl flex items-center justify-center shadow-md shadow-emerald-600/20">
                  {selectedMyotome.rootLevel}
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {selectedMyotome.regionGroup}
                    </span>
                    {ASIA_KEY_ROOTS.includes(selectedMyotome.rootLevel) && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                        ASIA / ISNCSCI Standard
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                    {isAr ? selectedMyotome.predominantMovementAr : selectedMyotome.predominantMovementEn}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {isAr ? selectedMyotome.predominantMovementEn : selectedMyotome.predominantMovementAr}
                  </p>
                </div>
              </div>
            </div>

            {/* Patient Testing Position Instruction */}
            <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
                <Stethoscope className="w-4 h-4 text-emerald-600" />
                <span>{isAr ? 'وضعية الفحص السريري وطريقة المقاومة:' : 'Clinical Testing Position & Technique:'}</span>
              </div>
              <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                {isAr ? selectedMyotome.testingPositionAr : selectedMyotome.testingPositionEn}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 italic">
                {isAr ? selectedMyotome.testingPositionEn : selectedMyotome.testingPositionAr}
              </p>
            </div>

            {/* Key Muscles & Peripheral Nerves Table */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {isAr ? 'العضلات المفتاحية والأعصاب المحيطية المغذية:' : 'Key Muscles & Innervating Peripheral Nerves:'}
              </h4>
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-700">
                {selectedMyotome.keyMuscles.map((muscle, idx) => (
                  <div key={idx} className="p-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                          {isAr ? muscle.nameAr : muscle.nameEn}
                        </span>
                        {muscle.isPrimaryRoot && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                            {isAr ? 'جذر أساسي' : 'Primary Root'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {isAr ? muscle.nameEn : muscle.nameAr}
                      </p>
                    </div>

                    <div className="sm:text-end">
                      <span className="inline-block px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600">
                        {isAr ? muscle.peripheralNerveAr : muscle.peripheralNerveEn}
                      </span>
                      <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                        {isAr ? muscle.peripheralNerveEn : muscle.peripheralNerveAr}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Differential Diagnosis Clinical Pearls */}
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-4 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900 dark:text-amber-200">
                <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>{isAr ? 'دروس التمييز السريري والتفريق التشخيصي:' : 'Differential Diagnosis & Clinical Pearls:'}</span>
              </div>
              <p className="text-xs text-amber-900 dark:text-amber-100 leading-relaxed">
                {isAr ? selectedMyotome.differentialClinicalNotesAr : selectedMyotome.differentialClinicalNotesEn}
              </p>
              <p className="text-[11px] text-amber-700 dark:text-amber-300 italic">
                {isAr ? selectedMyotome.differentialClinicalNotesEn : selectedMyotome.differentialClinicalNotesAr}
              </p>
            </div>

            {/* Source Citation */}
            <div className="text-[11px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-700 pt-3">
              <span className="font-semibold">{isAr ? 'المرجع العلمي المعتمد: ' : 'Standard Scientific Source: '}</span>
              {selectedMyotome.primarySourceCitation}
            </div>

          </div>
        </div>

        {/* Right Column: Search Results & Quick Navigation List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 px-1">
            <span>{isAr ? 'قائمة الجذور المتاحة' : 'Myotome Levels'}</span>
            <span className="font-normal text-slate-400">({filteredMyotomes.length})</span>
          </div>

          <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-700 max-h-[580px] overflow-y-auto">
            {filteredMyotomes.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                {isAr ? 'لا توجد جذور مطابقة للبحث' : 'No matching myotomes found'}
              </div>
            ) : (
              filteredMyotomes.map(m => {
                const isSelected = activeRoot === m.rootLevel;
                const isAsiaKey = ASIA_KEY_ROOTS.includes(m.rootLevel);
                return (
                  <button
                    key={m.rootLevel}
                    onClick={() => setActiveRoot(m.rootLevel)}
                    className={`w-full p-3 text-start transition-colors flex items-center justify-between gap-2 ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-s-4 border-emerald-600'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-750'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 rounded-lg font-bold text-xs flex items-center justify-center ${
                        isSelected
                          ? 'bg-emerald-600 text-white'
                          : isAsiaKey
                          ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}>
                        {m.rootLevel}
                      </span>
                      <div>
                        <div className="font-semibold text-xs text-slate-800 dark:text-slate-200">
                          {isAr ? m.predominantMovementAr : m.predominantMovementEn}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500">
                          {m.keyMuscles[0]?.nameEn}
                        </div>
                      </div>
                    </div>

                    <ChevronRight className={`w-4 h-4 text-slate-400 ${isSelected ? 'text-emerald-600' : ''}`} />
                  </button>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
