// =======================================================================
// PhysioRecord — Patient Directory Component
// Modern Healthcare SaaS Directory with Grid/Table View & Light/Dark Theme
// =======================================================================

import React, { useState, useMemo } from 'react';
import { usePatients } from '../context/PatientContext';
import { useLanguage } from '../context/LanguageContext';
import type { PatientRecord } from '../types/clinical';
import {
  Search,
  UserPlus,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Phone,
  Calendar,
  Sparkles,
  HeartPulse,
  Briefcase,
  Archive,
  RotateCcw,
  Trash2,
  LayoutGrid,
  List,
  Users,
  ShieldCheck,
} from 'lucide-react';

interface PatientDirectoryProps {
  onSelectPatient: (patient: PatientRecord) => void;
  onOpenNewPatientModal: () => void;
  onOpenSyntheticModal: () => void;
}

export const PatientDirectory: React.FC<PatientDirectoryProps> = ({
  onSelectPatient,
  onOpenNewPatientModal,
  onOpenSyntheticModal,
}) => {
  const {
    activePatients,
    archivedPatients,
    loading,
    archivePatient,
    unarchivePatient,
  } = usePatients();
  const { bi, isRtl, language } = useLanguage();
  const isEn = language === 'en';

  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGender, setFilterGender] = useState<'all' | 'male' | 'female'>('all');
  const [filterRedFlagsOnly, setFilterRedFlagsOnly] = useState(false);

  const displayedList = activeTab === 'active' ? activePatients : archivedPatients;

  const redFlagCount = useMemo(
    () =>
      activePatients.filter(
        (p) => p.data.redFlags && p.data.redFlags.trim().length > 0
      ).length,
    [activePatients]
  );

  // In-memory zero-PII search
  const filteredPatients = useMemo(() => {
    return displayedList.filter((patient) => {
      const p = patient.data;
      const query = searchQuery.trim().toLowerCase();

      const matchesSearch =
        !query ||
        p.fullName.toLowerCase().includes(query) ||
        (p.fullNameAr && p.fullNameAr.toLowerCase().includes(query)) ||
        (p.phoneNumber && p.phoneNumber.includes(query)) ||
        (p.medicalHistory && p.medicalHistory.toLowerCase().includes(query)) ||
        (p.occupation && p.occupation.toLowerCase().includes(query));

      const matchesGender = filterGender === 'all' || p.gender === filterGender;
      const matchesRedFlags =
        !filterRedFlagsOnly || (p.redFlags && p.redFlags.trim().length > 0);

      return matchesSearch && matchesGender && matchesRedFlags;
    });
  }, [displayedList, searchQuery, filterGender, filterRedFlagsOnly]);

  const ChevronIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <div
      className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Top Clinical Directory Header & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
              EHR DIRECTORY
            </span>
            <h1 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
              {bi('السجل السريري المركزي للمرضى', 'Central Clinical Patient Registry')}
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {bi(
              'إدارة ملفات المرضى، التقييمات السريرية، الجداول الدوائية، والجلسات العلاجية المشفرة محلياً.',
              'Manage encrypted patient charts, OrganUI clinical assessments, medication schedules, and sessions.'
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenSyntheticModal}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>{bi('حالات سريرية تجريبية', 'Load Demo Cases')}</span>
          </button>

          <button
            type="button"
            onClick={onOpenNewPatientModal}
            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-all cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>{bi('+ تسجيل مريض جديد', '+ New Patient Record')}</span>
          </button>
        </div>
      </div>

      {/* Clinical KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {bi('المرضى النشطون حالياً', 'Active Clinical Charts')}
            </span>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums mt-0.5">
              {activePatients.length}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-800 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {bi('حالات تتطلب انتباهاً (Red Flags)', 'Clinical Red Flag Alerts')}
            </span>
            <p className="text-2xl font-extrabold text-rose-600 dark:text-rose-400 font-mono tabular-nums mt-0.5">
              {redFlagCount}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 flex items-center justify-center">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {bi('حالة التشفير السريري', 'Zero-Trust Encryption')}
            </span>
            <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1.5 flex items-center gap-1.5">
              <span>AES-256-GCM</span>
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                ({bi('محلي بالكامل', 'Local IndexedDB')})
              </span>
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Directory Tabs & View Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('active')}
            className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'active'
                ? 'border-teal-600 text-teal-600 dark:text-teal-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>{bi('المرضى النشطون', 'Active Patients')}</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono tabular-nums bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
              {activePatients.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('archived')}
            className={`pb-3 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'archived'
                ? 'border-amber-600 text-amber-600 dark:text-amber-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Archive className="w-4 h-4" />
            <span>{bi('سجل الأرشيف', 'Archived Records')}</span>
            <span className="px-2 py-0.5 rounded-full text-xs font-mono tabular-nums bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              {archivedPatients.length}
            </span>
          </button>
        </div>

        {/* Grid vs Table Toggle */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 mb-2">
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'grid'
                ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-2xs'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span>{bi('بطاقات', 'Cards')}</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              viewMode === 'table'
                ? 'bg-white dark:bg-slate-900 text-teal-600 dark:text-teal-400 shadow-2xs'
                : 'text-slate-500 dark:text-slate-400'
            }`}
          >
            <List className="w-3.5 h-3.5" />
            <span>{bi('جدول سريري', 'Clinical Table')}</span>
          </button>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl shadow-2xs border border-slate-200 dark:border-slate-800">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={bi(
                'بحث فوري باسم المريض، رقم الهاتف، التشخيص، أو التاريخ الطبي...',
                'Instant search by name, phone, diagnosis, or clinical history...'
              )}
              className={`w-full ${
                isRtl ? 'pl-4 pr-10' : 'pr-4 pl-10'
              } py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-teal-500 text-xs sm:text-sm transition-all text-slate-900 dark:text-white placeholder-slate-400`}
            />
            <Search
              className={`w-4 h-4 text-slate-400 absolute ${
                isRtl ? 'right-3.5' : 'left-3.5'
              } top-1/2 -translate-y-1/2`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className={`absolute ${
                  isRtl ? 'left-3' : 'right-3'
                } top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 bg-slate-200/70 dark:bg-slate-800 px-2 py-0.5 rounded-md cursor-pointer`}
              >
                {bi('مسح', 'Clear')}
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={filterGender}
              onChange={(e) => setFilterGender(e.target.value as any)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-200 bg-slate-50 dark:bg-slate-950 focus:outline-none focus:border-teal-500"
            >
              <option value="all">{bi('كافة الفئات', 'All Genders')}</option>
              <option value="male">{bi('ذكور', 'Male')}</option>
              <option value="female">{bi('إناث', 'Female')}</option>
            </select>

            <button
              type="button"
              onClick={() => setFilterRedFlagsOnly(!filterRedFlagsOnly)}
              className={`px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold border flex items-center gap-1.5 transition-colors cursor-pointer ${
                filterRedFlagsOnly
                  ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                  : 'bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <AlertCircle
                className={`w-4 h-4 ${
                  filterRedFlagsOnly ? 'text-rose-600 dark:text-rose-400' : 'text-slate-400'
                }`}
              />
              <span>{bi('علامات حمراء تحذيرية', 'Red Flags')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Directory Content */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
          <p>
            {bi(
              'جاري فك تشفير وتحميل السجلات السريرية المعتمدة...',
              'Decrypting and loading verified clinical records...'
            )}
          </p>
        </div>
      ) : filteredPatients.length > 0 ? (
        viewMode === 'table' ? (
          /* Clinical Table View */
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-start border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-3.5 px-4 text-start">{bi('المريض', 'Patient')}</th>
                    <th className="py-3.5 px-4 text-start">{bi('الجنس / العمر', 'Demographics')}</th>
                    <th className="py-3.5 px-4 text-start">{bi('التاريخ المرضي والمحاذير', 'Clinical Summary & Alerts')}</th>
                    <th className="py-3.5 px-4 text-start">{bi('الهاتف', 'Phone')}</th>
                    <th className="py-3.5 px-4 text-end">{bi('الإجراء', 'Action')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                  {filteredPatients.map((patient) => {
                    const p = patient.data;
                    const hasRedFlags = Boolean(p.redFlags && p.redFlags.trim().length > 0);
                    return (
                      <tr
                        key={patient.id}
                        onClick={() => onSelectPatient(patient)}
                        className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                      >
                        <td className="py-3.5 px-4 font-bold text-slate-900 dark:text-white">
                          <div className="flex items-center gap-2.5">
                            <span className="w-8 h-8 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 flex items-center justify-center font-bold text-xs shrink-0">
                              {(p.fullName || 'P').charAt(0)}
                            </span>
                            <div>
                              <div>{isEn ? p.fullName || p.fullNameAr : p.fullNameAr || p.fullName}</div>
                              <div className="text-[10px] font-mono text-slate-400 tabular-nums">
                                MRN #{patient.id.slice(0, 8)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 tabular-nums">
                          <span
                            className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                              p.gender === 'male'
                                ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                                : 'bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800'
                            }`}
                          >
                            {p.gender === 'male' ? bi('ذكر', 'Male') : bi('أنثى', 'Female')}{' '}
                            {p.age ? `• ${p.age}` : ''}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 max-w-xs">
                          {hasRedFlags && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[10px] font-bold mb-1">
                              <AlertCircle className="w-3 h-3" />
                              {p.redFlags}
                            </span>
                          )}
                          <p className="text-slate-600 dark:text-slate-400 truncate">
                            {p.medicalHistory || bi('لا يوجد تاريخ مرضي مسجل', 'No medical history')}
                          </p>
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-600 dark:text-slate-400 tabular-nums" dir="ltr">
                          {p.phoneNumber || '—'}
                        </td>
                        <td className="py-3.5 px-4 text-end">
                          <span className="inline-flex items-center gap-1 text-teal-600 dark:text-teal-400 font-bold">
                            <span>{bi('فتح السجل', 'Open Chart')}</span>
                            <ChevronIcon className="w-4 h-4" />
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Clinical Cards Grid View */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredPatients.map((patient) => {
              const p = patient.data;
              const hasRedFlags = Boolean(p.redFlags && p.redFlags.trim().length > 0);

              return (
                <div
                  key={patient.id}
                  className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 hover:border-teal-500/80 dark:hover:border-teal-500/80 hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div onClick={() => onSelectPatient(patient)} className="cursor-pointer">
                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 flex items-center justify-center font-bold text-sm shrink-0">
                          {(p.fullName || 'P').charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 dark:text-white hover:text-teal-600 dark:hover:text-teal-400 transition-colors text-sm">
                            {isEn ? p.fullName || p.fullNameAr : p.fullNameAr || p.fullName}
                          </h3>
                          <p className="text-[11px] text-slate-400 font-mono tabular-nums">
                            MRN #{patient.id.slice(0, 8)}
                          </p>
                        </div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold border tabular-nums ${
                          p.gender === 'male'
                            ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                            : 'bg-pink-50 dark:bg-pink-950/60 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800'
                        }`}
                      >
                        {p.gender === 'male' ? bi('ذكر', 'Male') : bi('أنثى', 'Female')}{' '}
                        {p.age ? `(${p.age})` : ''}
                      </span>
                    </div>

                    {/* Red Flags Alert Badge */}
                    {hasRedFlags && (
                      <div className="mb-3 px-2.5 py-1.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-center gap-1.5 font-semibold">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                        <span className="truncate">{p.redFlags}</span>
                      </div>
                    )}

                    {/* Medical Summary Snippet */}
                    {p.medicalHistory && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 mb-3 bg-slate-50 dark:bg-slate-950/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800/80">
                        {p.medicalHistory}
                      </p>
                    )}

                    {/* Metadata */}
                    <div className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400 mb-4 tabular-nums">
                      {p.phoneNumber && (
                        <div className="flex items-center gap-2 font-mono">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span dir="ltr">{p.phoneNumber}</span>
                        </div>
                      )}
                      {p.occupation && (
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                          <span>{p.occupation}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {bi('آخر تحديث:', 'Updated:')}{' '}
                          {new Date(patient.updatedAt).toLocaleDateString(
                            isEn ? 'en-US' : 'ar-SA'
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Action Controls */}
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => onSelectPatient(patient)}
                      className="text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 flex items-center gap-1 font-bold cursor-pointer"
                    >
                      <span>{bi('فتح الملف السريري', 'Open Patient Chart')}</span>
                      <ChevronIcon className="w-4 h-4" />
                    </button>

                    {/* Archival Actions */}
                    {activeTab === 'active' ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          archivePatient(patient.id);
                        }}
                        className="text-slate-400 hover:text-amber-700 dark:hover:text-amber-300 px-2 py-1 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/40 flex items-center gap-1 text-xs cursor-pointer"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span>{bi('أرشفة', 'Archive')}</span>
                      </button>
                    ) : (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            unarchivePatient(patient.id);
                          }}
                          className="text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center gap-1 text-xs cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>{bi('استعادة', 'Restore')}</span>
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectPatient(patient);
                          }}
                          className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center gap-1 text-xs cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : displayedList.length === 0 ? (
        /* Empty State */
        <div className="p-12 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-800 flex items-center justify-center mx-auto mb-4">
            <HeartPulse className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
            {activeTab === 'active'
              ? bi('لا يوجد مرضى مسجلون في القائمة النشطة', 'No active patient records found')
              : bi('الأرشيف فارغ حالياً', 'Archive is currently empty')}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
            {activeTab === 'active'
              ? bi(
                  'ابدأ بتسجيل أول مريض، أو قم بإدراج بيانات سريرية تجريبية لاستكشاف إمكانيات النظام.',
                  'Start by adding a new patient, or generate synthetic clinical cases to test the system.'
                )
              : bi('لم يتم نقل أي مريض إلى الأرشيف حتى الآن.', 'No patients have been archived yet.')}
          </p>
          {activeTab === 'active' && (
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={onOpenNewPatientModal}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl text-xs transition-all shadow-xs cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>{bi('تسجيل مريض جديد', 'New Patient')}</span>
              </button>
              <button
                type="button"
                onClick={onOpenSyntheticModal}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs transition-all cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                <span>{bi('إدراج بيانات تجريبية جاهزة', 'Load Synthetic Cases')}</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* No Search Match */
        <div className="p-8 text-center bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs">
          {bi(
            `لا توجد نتائج مطابقة لبحثك: "${searchQuery}".`,
            `No matching results for: "${searchQuery}".`
          )}
        </div>
      )}
    </div>
  );
};
