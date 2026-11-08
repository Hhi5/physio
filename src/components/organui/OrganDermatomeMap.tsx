// =======================================================================
// OrganUI Medical Component — Interactive Dermatome Map (@organui/dermatome-map)
// ASIA / ISNCSCI Sensory Nerve Root Mapping (C2–S5) with Bilateral Status
// =======================================================================

import React, { useState, useMemo } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import {
  DERMATOME_DEFINITIONS,
  getDermatomeByRoot,
} from '../../data/clinicalToolkit/dermatomesData';
import type { SpinalLevel, SpinalRegionGroup } from '../../types/clinicalToolkit';
import type { DermatomeSensoryEntry, SensoryFindingStatus } from '../../types/clinical';
import { Search, RotateCcw } from 'lucide-react';

interface OrganDermatomeMapProps {
  value: DermatomeSensoryEntry[];
  onChange: (updated: DermatomeSensoryEntry[]) => void;
  readOnly?: boolean;
}

const SENSORY_STATUS_OPTIONS: {
  id: SensoryFindingStatus;
  labelAr: string;
  labelEn: string;
  shortAr: string;
  shortEn: string;
  badgeClass: string;
  svgFillClass: string;
}[] = [
  {
    id: 'intact',
    labelAr: 'سليم (Intact 2/2)',
    labelEn: 'Intact (Normal 2/2)',
    shortAr: 'سليم',
    shortEn: 'Intact',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-800',
    svgFillClass: 'fill-emerald-400/80 stroke-emerald-600',
  },
  {
    id: 'hypoesthesia',
    labelAr: 'نقص حس (Hypoesthesia 1/2)',
    labelEn: 'Hypoesthesia (Diminished 1/2)',
    shortAr: 'نقص حس',
    shortEn: 'Hypo',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-800',
    svgFillClass: 'fill-amber-400/85 stroke-amber-600',
  },
  {
    id: 'hyperesthesia',
    labelAr: 'فرط حس / ألم عصبي (Hyperesthesia)',
    labelEn: 'Hyperesthesia (Hypersensitive)',
    shortAr: 'فرط حس',
    shortEn: 'Hyper',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/70 dark:text-orange-300 dark:border-orange-800',
    svgFillClass: 'fill-orange-500/85 stroke-orange-700',
  },
  {
    id: 'paresthesia',
    labelAr: 'خدر وتنميل (Paresthesia / Tingling)',
    labelEn: 'Paresthesia (Pins & Needles)',
    shortAr: 'تنميل',
    shortEn: 'Tingling',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/70 dark:text-purple-300 dark:border-purple-800',
    svgFillClass: 'fill-purple-400/85 stroke-purple-600',
  },
  {
    id: 'anesthesia',
    labelAr: 'انعدام حس كامل (Anesthesia 0/2)',
    labelEn: 'Anesthesia (Absent 0/2)',
    shortAr: 'انعدام',
    shortEn: 'Absent',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/70 dark:text-rose-300 dark:border-rose-800',
    svgFillClass: 'fill-rose-500/85 stroke-rose-700',
  },
];

export const OrganDermatomeMap: React.FC<OrganDermatomeMapProps> = ({
  value = [],
  onChange,
  readOnly = false,
}) => {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const [activeRoot, setActiveRoot] = useState<SpinalLevel>('L4');
  const [activeView, setActiveView] = useState<'anterior' | 'posterior'>('anterior');
  const [selectedGroup, setSelectedGroup] = useState<SpinalRegionGroup | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const selectedDermatome = useMemo(() => {
    return getDermatomeByRoot(activeRoot) || DERMATOME_DEFINITIONS[0];
  }, [activeRoot]);

  const filteredRoots = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return DERMATOME_DEFINITIONS.filter((d) => {
      const matchGroup = selectedGroup === 'all' || d.regionGroup === selectedGroup;
      if (!q) return matchGroup;
      return (
        matchGroup &&
        (d.rootLevel.toLowerCase().includes(q) ||
          d.canonicalRegionEn.toLowerCase().includes(q) ||
          d.canonicalRegionAr.includes(q) ||
          d.keySensoryPointEn.toLowerCase().includes(q) ||
          d.keySensoryPointAr.includes(q))
      );
    });
  }, [selectedGroup, searchQuery]);

  const getRootFinding = (root: string): DermatomeSensoryEntry | undefined => {
    return value.find((f) => f.rootLevel === root);
  };

  const handleSetStatus = (
    rootLevel: string,
    side: 'right' | 'left' | 'bilateral',
    status: SensoryFindingStatus
  ) => {
    if (readOnly) return;
    const existingIdx = value.findIndex((f) => f.rootLevel === rootLevel);
    const updated = [...value];

    if (existingIdx >= 0) {
      const curr = updated[existingIdx];
      updated[existingIdx] = {
        ...curr,
        rightStatus: side === 'right' || side === 'bilateral' ? status : curr.rightStatus,
        leftStatus: side === 'left' || side === 'bilateral' ? status : curr.leftStatus,
      };
    } else {
      updated.push({
        rootLevel,
        rightStatus: side === 'right' || side === 'bilateral' ? status : 'intact',
        leftStatus: side === 'left' || side === 'bilateral' ? status : 'intact',
      });
    }
    onChange(updated);
  };

  const handleClearRoot = (rootLevel: string) => {
    if (readOnly) return;
    onChange(value.filter((f) => f.rootLevel !== rootLevel));
  };

  // Helper to get SVG fill class for a dermatome zone on the interactive diagram
  const getZoneClass = (root: SpinalLevel) => {
    const isSelected = activeRoot === root;
    const finding = getRootFinding(root);
    if (finding) {
      // Prioritize abnormal side for visual highlight
      const worstStatus =
        finding.rightStatus !== 'intact' && finding.rightStatus !== 'not_tested'
          ? finding.rightStatus
          : finding.leftStatus;
      const opt = SENSORY_STATUS_OPTIONS.find((o) => o.id === worstStatus);
      if (opt) {
        return `cursor-pointer transition-all ${opt.svgFillClass} ${
          isSelected ? 'stroke-2 ring-2 ring-teal-500' : 'stroke-1 opacity-90 hover:opacity-100'
        }`;
      }
    }
    if (isSelected) {
      return 'cursor-pointer transition-all fill-teal-500/80 stroke-teal-700 dark:stroke-teal-300 stroke-2';
    }
    return 'cursor-pointer transition-all fill-slate-200/90 dark:fill-slate-800 stroke-slate-400 dark:stroke-slate-600 hover:fill-teal-200 dark:hover:fill-teal-900/70';
  };

  const activeFinding = getRootFinding(activeRoot);

  return (
    <div className="space-y-4">
      {/* OrganUI Header Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-teal-50 text-teal-700 border border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-800">
            OrganUI • ASIA ISNCSCI
          </span>
          <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
            {isAr
              ? 'خريطة القطاعات الجلدية الحسية التفاعلية (C2–S5)'
              : 'Interactive Sensory Dermatome Map (C2–S5)'}
          </span>
        </div>

        {/* Region Filter Tabs */}
        <div className="flex items-center gap-1 bg-white dark:bg-slate-900 p-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold">
          {(['all', 'cervical', 'thoracic', 'lumbar', 'sacral'] as const).map((grp) => (
            <button
              key={grp}
              type="button"
              onClick={() => setSelectedGroup(grp)}
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                selectedGroup === grp
                  ? 'bg-teal-600 text-white shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {grp === 'all' && (isAr ? 'الكل' : 'All')}
              {grp === 'cervical' && (isAr ? 'رقبي C' : 'Cervical')}
              {grp === 'thoracic' && (isAr ? 'صدري T' : 'Thoracic')}
              {grp === 'lumbar' && (isAr ? 'قطني L' : 'Lumbar')}
              {grp === 'sacral' && (isAr ? 'عجزي S' : 'Sacral')}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split Grid: Left SVG Body Map + Right Clinical Grading Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: OrganUI Anterior / Posterior Dermatome Vector Canvas */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col items-center shadow-2xs">
          <div className="w-full flex items-center justify-between mb-3">
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setActiveView('anterior')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  activeView === 'anterior'
                    ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {isAr ? 'أمامي (Anterior)' : 'Anterior'}
              </button>
              <button
                type="button"
                onClick={() => setActiveView('posterior')}
                className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  activeView === 'posterior'
                    ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                {isAr ? 'خلفي (Posterior)' : 'Posterior'}
              </button>
            </div>

            <span className="text-[11px] font-mono font-bold text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-950/60 px-2.5 py-1 rounded-md border border-teal-200 dark:border-teal-800">
              {activeRoot}
            </span>
          </div>

          {/* Interactive SVG Body Dermatome Map */}
          <div className="w-full max-w-[260px] h-[410px] flex items-center justify-center select-none">
            {activeView === 'anterior' ? (
              <svg viewBox="0 0 200 400" className="w-full h-full">
                {/* C2 Head */}
                <circle
                  cx="100"
                  cy="34"
                  r="22"
                  className={getZoneClass('C2')}
                  onClick={() => setActiveRoot('C2')}
                />
                <text x="100" y="37" fontSize="9" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200 font-mono font-bold pointer-events-none">
                  C2
                </text>

                {/* C3 Neck */}
                <path
                  d="M 85 56 Q 100 62 115 56 L 124 73 Q 100 80 76 73 Z"
                  className={getZoneClass('C3')}
                  onClick={() => setActiveRoot('C3')}
                />
                <text x="100" y="69" fontSize="8" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200 font-mono font-bold pointer-events-none">
                  C3
                </text>

                {/* C4 Shoulders */}
                <path
                  d="M 76 73 L 48 84 L 56 99 L 78 89 Z"
                  className={getZoneClass('C4')}
                  onClick={() => setActiveRoot('C4')}
                />
                <path
                  d="M 124 73 L 152 84 L 144 99 L 122 89 Z"
                  className={getZoneClass('C4')}
                  onClick={() => setActiveRoot('C4')}
                />
                <text x="63" y="90" fontSize="7" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200 font-mono font-bold pointer-events-none">
                  C4
                </text>
                <text x="137" y="90" fontSize="7" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200 font-mono font-bold pointer-events-none">
                  C4
                </text>

                {/* C5 Lateral Arm */}
                <path
                  d="M 48 84 L 34 128 L 45 131 L 56 99 Z"
                  className={getZoneClass('C5')}
                  onClick={() => setActiveRoot('C5')}
                />
                <path
                  d="M 152 84 L 166 128 L 155 131 L 144 99 Z"
                  className={getZoneClass('C5')}
                  onClick={() => setActiveRoot('C5')}
                />
                <text x="45" y="114" fontSize="7" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200 font-mono font-bold pointer-events-none">
                  C5
                </text>
                <text x="155" y="114" fontSize="7" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200 font-mono font-bold pointer-events-none">
                  C5
                </text>

                {/* C6 Lateral Forearm & Thumb */}
                <path
                  d="M 34 128 L 21 178 L 32 181 L 45 131 Z"
                  className={getZoneClass('C6')}
                  onClick={() => setActiveRoot('C6')}
                />
                <path
                  d="M 166 128 L 179 178 L 168 181 L 155 131 Z"
                  className={getZoneClass('C6')}
                  onClick={() => setActiveRoot('C6')}
                />
                <text x="32" y="158" fontSize="7" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200 font-mono font-bold pointer-events-none">
                  C6
                </text>
                <text x="168" y="158" fontSize="7" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200 font-mono font-bold pointer-events-none">
                  C6
                </text>

                {/* C7 Middle Finger */}
                <rect
                  x="22"
                  y="182"
                  width="9"
                  height="19"
                  rx="3"
                  className={getZoneClass('C7')}
                  onClick={() => setActiveRoot('C7')}
                />
                <rect
                  x="169"
                  y="182"
                  width="9"
                  height="19"
                  rx="3"
                  className={getZoneClass('C7')}
                  onClick={() => setActiveRoot('C7')}
                />

                {/* C8 Medial Hand / Little Finger */}
                <rect
                  x="12"
                  y="180"
                  width="8"
                  height="17"
                  rx="3"
                  className={getZoneClass('C8')}
                  onClick={() => setActiveRoot('C8')}
                />
                <rect
                  x="180"
                  y="180"
                  width="8"
                  height="17"
                  rx="3"
                  className={getZoneClass('C8')}
                  onClick={() => setActiveRoot('C8')}
                />

                {/* T1 Medial Forearm */}
                <path
                  d="M 45 131 L 32 181 L 40 183 L 52 135 Z"
                  className={getZoneClass('T1')}
                  onClick={() => setActiveRoot('T1')}
                />
                <path
                  d="M 155 131 L 168 181 L 160 183 L 148 135 Z"
                  className={getZoneClass('T1')}
                  onClick={() => setActiveRoot('T1')}
                />

                {/* Thoracic Trunk Bands */}
                <path
                  d="M 78 89 L 122 89 L 120 114 L 80 114 Z"
                  className={getZoneClass('T2')}
                  onClick={() => setActiveRoot('T2')}
                />
                <text x="100" y="104" fontSize="7.5" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200 font-mono font-bold pointer-events-none">
                  T2
                </text>

                <path
                  d="M 80 114 L 120 114 L 118 138 L 82 138 Z"
                  className={getZoneClass('T4')}
                  onClick={() => setActiveRoot('T4')}
                />
                <text x="100" y="129" fontSize="7.5" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200 font-mono font-bold pointer-events-none">
                  T4
                </text>

                <path
                  d="M 82 138 L 118 138 L 116 162 L 84 162 Z"
                  className={getZoneClass('T10')}
                  onClick={() => setActiveRoot('T10')}
                />
                <text x="100" y="153" fontSize="7.5" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200 font-mono font-bold pointer-events-none">
                  T10
                </text>

                <path
                  d="M 84 162 L 116 162 L 113 182 L 87 182 Z"
                  className={getZoneClass('L1')}
                  onClick={() => setActiveRoot('L1')}
                />
                <text x="100" y="175" fontSize="7.5" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200 font-mono font-bold pointer-events-none">
                  L1
                </text>

                {/* L2 Anterior Thigh */}
                <path
                  d="M 87 183 L 99 188 L 99 228 L 78 228 L 82 183 Z"
                  className={getZoneClass('L2')}
                  onClick={() => setActiveRoot('L2')}
                />
                <path
                  d="M 113 183 L 101 188 L 101 228 L 122 228 L 118 183 Z"
                  className={getZoneClass('L2')}
                  onClick={() => setActiveRoot('L2')}
                />
                <text x="89" y="210" fontSize="8" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200 font-mono font-bold pointer-events-none">
                  L2
                </text>
                <text x="111" y="210" fontSize="8" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200 font-mono font-bold pointer-events-none">
                  L2
                </text>

                {/* L3 Knee & Medial Distal Thigh */}
                <rect
                  x="77"
                  y="230"
                  width="21"
                  height="38"
                  rx="4"
                  className={getZoneClass('L3')}
                  onClick={() => setActiveRoot('L3')}
                />
                <rect
                  x="102"
                  y="230"
                  width="21"
                  height="38"
                  rx="4"
                  className={getZoneClass('L3')}
                  onClick={() => setActiveRoot('L3')}
                />
                <text x="87" y="252" fontSize="8" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200 font-mono font-bold pointer-events-none">
                  L3
                </text>
                <text x="113" y="252" fontSize="8" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200 font-mono font-bold pointer-events-none">
                  L3
                </text>

                {/* L4 Medial Leg & Malleolus */}
                <path
                  d="M 88 270 L 98 270 L 96 338 L 86 338 Z"
                  className={getZoneClass('L4')}
                  onClick={() => setActiveRoot('L4')}
                />
                <path
                  d="M 102 270 L 112 270 L 114 338 L 104 338 Z"
                  className={getZoneClass('L4')}
                  onClick={() => setActiveRoot('L4')}
                />
                <text x="92" y="306" fontSize="7.5" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200 font-mono font-bold pointer-events-none">
                  L4
                </text>
                <text x="108" y="306" fontSize="7.5" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200 font-mono font-bold pointer-events-none">
                  L4
                </text>

                {/* L5 Lateral Leg & Great Toe */}
                <path
                  d="M 76 270 L 87 270 L 85 338 L 74 338 Z"
                  className={getZoneClass('L5')}
                  onClick={() => setActiveRoot('L5')}
                />
                <path
                  d="M 113 270 L 124 270 L 126 338 L 115 338 Z"
                  className={getZoneClass('L5')}
                  onClick={() => setActiveRoot('L5')}
                />
                <text x="81" y="306" fontSize="7.5" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200 font-mono font-bold pointer-events-none">
                  L5
                </text>
                <text x="119" y="306" fontSize="7.5" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200 font-mono font-bold pointer-events-none">
                  L5
                </text>

                {/* S1 Lateral Foot */}
                <rect
                  x="73"
                  y="341"
                  width="23"
                  height="16"
                  rx="3"
                  className={getZoneClass('S1')}
                  onClick={() => setActiveRoot('S1')}
                />
                <rect
                  x="104"
                  y="341"
                  width="23"
                  height="16"
                  rx="3"
                  className={getZoneClass('S1')}
                  onClick={() => setActiveRoot('S1')}
                />
                <text x="84" y="352" fontSize="7.5" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200 font-mono font-bold pointer-events-none">
                  S1
                </text>
                <text x="116" y="352" fontSize="7.5" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200 font-mono font-bold pointer-events-none">
                  S1
                </text>
              </svg>
            ) : (
              <svg viewBox="0 0 200 400" className="w-full h-full">
                {/* C2 Occiput */}
                <circle
                  cx="100"
                  cy="34"
                  r="22"
                  className={getZoneClass('C2')}
                  onClick={() => setActiveRoot('C2')}
                />
                <text x="100" y="37" fontSize="9" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200 font-mono font-bold pointer-events-none">
                  C2
                </text>

                {/* C3-C4 Posterior Neck & Upper Trap */}
                <path
                  d="M 75 60 L 125 60 L 138 88 L 62 88 Z"
                  className={getZoneClass('C4')}
                  onClick={() => setActiveRoot('C4')}
                />
                <text x="100" y="77" fontSize="8" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200 font-mono font-bold pointer-events-none">
                  C3 / C4
                </text>

                {/* Thoracic Back */}
                <path
                  d="M 74 89 L 126 89 L 120 175 L 80 175 Z"
                  className={getZoneClass('T6')}
                  onClick={() => setActiveRoot('T6')}
                />
                <text x="100" y="135" fontSize="8" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200 font-mono font-bold pointer-events-none">
                  T1–T12
                </text>

                {/* Sacral Saddle S3 & S4-S5 */}
                <circle
                  cx="85"
                  cy="198"
                  r="14"
                  className={getZoneClass('S3')}
                  onClick={() => setActiveRoot('S3')}
                />
                <circle
                  cx="115"
                  cy="198"
                  r="14"
                  className={getZoneClass('S3')}
                  onClick={() => setActiveRoot('S3')}
                />
                <text x="85" y="201" fontSize="7.5" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200 font-mono font-bold pointer-events-none">
                  S3
                </text>
                <text x="115" y="201" fontSize="7.5" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200 font-mono font-bold pointer-events-none">
                  S3
                </text>

                <circle
                  cx="100"
                  cy="208"
                  r="7"
                  className={getZoneClass('S4')}
                  onClick={() => setActiveRoot('S4')}
                />

                {/* S2 Posterior Thigh */}
                <rect
                  x="79"
                  y="218"
                  width="18"
                  height="55"
                  rx="4"
                  className={getZoneClass('S2')}
                  onClick={() => setActiveRoot('S2')}
                />
                <rect
                  x="103"
                  y="218"
                  width="18"
                  height="55"
                  rx="4"
                  className={getZoneClass('S2')}
                  onClick={() => setActiveRoot('S2')}
                />
                <text x="88" y="248" fontSize="8" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200 font-mono font-bold pointer-events-none">
                  S2
                </text>
                <text x="112" y="248" fontSize="8" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200 font-mono font-bold pointer-events-none">
                  S2
                </text>

                {/* S1 Posterior Calf & Heel */}
                <rect
                  x="78"
                  y="278"
                  width="18"
                  height="68"
                  rx="4"
                  className={getZoneClass('S1')}
                  onClick={() => setActiveRoot('S1')}
                />
                <rect
                  x="104"
                  y="278"
                  width="18"
                  height="68"
                  rx="4"
                  className={getZoneClass('S1')}
                  onClick={() => setActiveRoot('S1')}
                />
                <text x="87" y="315" fontSize="8" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200 font-mono font-bold pointer-events-none">
                  S1
                </text>
                <text x="113" y="315" fontSize="8" textAnchor="middle" className="fill-slate-700 dark:fill-slate-200 font-mono font-bold pointer-events-none">
                  S1
                </text>
              </svg>
            )}
          </div>
        </div>

        {/* Right: Spinal Root Selector & Sensory Grading Controls */}
        <div className="lg:col-span-7 space-y-4">
          {/* Search & Root Pills */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 shadow-2xs">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  isAr
                    ? 'ابحث بالجذر العصبي (C6, L4, S1) أو نقطة الفحص الحسي...'
                    : 'Search nerve root (C6, L4, S1) or ASIA sensory point...'
                }
                className="w-full ps-8 pe-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-teal-500"
              />
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1">
              {filteredRoots.map((d) => {
                const finding = getRootFinding(d.rootLevel);
                const hasAbnormality =
                  finding &&
                  (finding.rightStatus !== 'intact' || finding.leftStatus !== 'intact');

                return (
                  <button
                    key={d.rootLevel}
                    type="button"
                    onClick={() => setActiveRoot(d.rootLevel)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      activeRoot === d.rootLevel
                        ? 'bg-teal-600 text-white shadow-2xs ring-2 ring-teal-500/30'
                        : hasAbnormality
                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-300 dark:border-amber-800'
                        : finding
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-teal-400'
                    }`}
                  >
                    <span>{d.rootLevel}</span>
                    {hasAbnormality && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Root Details & Bilateral Sensory Grading */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-4 shadow-2xs">
            <div className="flex items-start justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md text-xs font-mono font-bold bg-teal-600 text-white">
                    {selectedDermatome.rootLevel}
                  </span>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    {isAr ? selectedDermatome.canonicalRegionAr : selectedDermatome.canonicalRegionEn}
                  </h4>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">
                    {isAr ? 'نقطة فحص ASIA المعيارية: ' : 'Key ASIA Sensory Point: '}
                  </span>
                  {isAr ? selectedDermatome.keySensoryPointAr : selectedDermatome.keySensoryPointEn}
                </p>
              </div>

              {activeFinding && !readOnly && (
                <button
                  type="button"
                  onClick={() => handleClearRoot(activeRoot)}
                  className="text-xs text-slate-400 hover:text-rose-500 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{isAr ? 'مسح' : 'Clear'}</span>
                </button>
              )}
            </div>

            {/* Bilateral Grading Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Right Side */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {isAr ? 'الجانب الأيمن (Right):' : 'Right Side (R):'}
                  </span>
                  <span className="text-[11px] font-mono font-semibold text-teal-600 dark:text-teal-400">
                    {activeFinding?.rightStatus || (isAr ? 'غير مفحوص' : 'Unrecorded')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SENSORY_STATUS_OPTIONS.map((opt) => {
                    const isSelected = activeFinding?.rightStatus === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={readOnly}
                        onClick={() => handleSetStatus(activeRoot, 'right', opt.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                          isSelected
                            ? opt.badgeClass + ' ring-2 ring-teal-500/30'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                        }`}
                      >
                        {isAr ? opt.shortAr : opt.shortEn}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Left Side */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                    {isAr ? 'الجانب الأيسر (Left):' : 'Left Side (L):'}
                  </span>
                  <span className="text-[11px] font-mono font-semibold text-teal-600 dark:text-teal-400">
                    {activeFinding?.leftStatus || (isAr ? 'غير مفحوص' : 'Unrecorded')}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SENSORY_STATUS_OPTIONS.map((opt) => {
                    const isSelected = activeFinding?.leftStatus === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        disabled={readOnly}
                        onClick={() => handleSetStatus(activeRoot, 'left', opt.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                          isSelected
                            ? opt.badgeClass + ' ring-2 ring-teal-500/30'
                            : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300'
                        }`}
                      >
                        {isAr ? opt.shortAr : opt.shortEn}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Recorded Dermatome Findings Summary Chips */}
            {value.length > 0 && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                  {isAr ? 'القطاعات الحسية الموثقة بالمخطط:' : 'Documented Dermatome Findings:'}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {value.map((f) => (
                    <div
                      key={f.rootLevel}
                      onClick={() => setActiveRoot(f.rootLevel as SpinalLevel)}
                      className="px-2.5 py-1 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs flex items-center gap-2 cursor-pointer hover:border-teal-500"
                    >
                      <span className="font-mono font-bold text-teal-600 dark:text-teal-400">
                        {f.rootLevel}
                      </span>
                      <span className="text-[11px] text-slate-600 dark:text-slate-300 tabular-nums">
                        R: {f.rightStatus} | L: {f.leftStatus}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
