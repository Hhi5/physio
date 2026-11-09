// =======================================================================
// PhysioRecord — Enterprise Clinical EHR & Reception Admin Sidebar
// Responsive Across Mobile Drawer, Tablet Drawer, and Desktop Permanent Rail
// =======================================================================

import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useVault } from '../../context/VaultContext';
import { usePatients } from '../../context/PatientContext';
import { useTheme } from '../../context/ThemeContext';
import { ClinicOperationsService, ROLE_PERMISSIONS } from '../../services/clinicOperationsService';
import {
  Users,
  Sparkles,
  Database,
  Lock,
  Globe,
  Plus,
  FlaskConical,
  Activity,
  Sun,
  Moon,
  BookOpen,
  LayoutDashboard,
  Calendar,
  Wallet,
  Dumbbell,
  ShieldCheck,
  X,
} from 'lucide-react';

export type MainClinicNavView =
  | 'reception_dashboard'
  | 'patients'
  | 'patient_workspace'
  | 'schedule'
  | 'finance'
  | 'exercises'
  | 'audit';

interface SidebarProps {
  currentView: MainClinicNavView;
  onNavigateView: (view: MainClinicNavView) => void;
  onSelectPatient: (patientId: string) => void;
  selectedPatientId?: string | null;
  onOpenNewPatient: () => void;
  onOpenToolkit?: () => void;
  onOpenCustomStudio: () => void;
  onOpenBackup: () => void;
  onOpenSyntheticData: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onNavigateView,
  onSelectPatient,
  selectedPatientId,
  onOpenNewPatient,
  onOpenToolkit,
  onOpenCustomStudio,
  onOpenBackup,
  onOpenSyntheticData,
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const { language, setLanguage, isRtl } = useLanguage();
  const isAr = language === 'ar';
  const { lock } = useVault();
  const { patients } = usePatients();
  const { theme, toggleTheme } = useTheme();

  const activeStaff = ClinicOperationsService.getActiveStaff();
  const roleInfo = ROLE_PERMISSIONS[activeStaff.role];
  const activePatients = patients.filter((p) => !p.isArchived).slice(0, 6);

  const isReceptionMode =
    currentView === 'reception_dashboard' ||
    currentView === 'schedule' ||
    currentView === 'finance' ||
    currentView === 'audit';

  const handleNavClick = (view: MainClinicNavView) => {
    onNavigateView(view);
    if (onCloseMobile) onCloseMobile();
  };

  const handlePatientClick = (id: string) => {
    onSelectPatient(id);
    if (onCloseMobile) onCloseMobile();
  };

  const sidebarContent = (
    <aside className="w-72 lg:w-64 bg-white dark:bg-slate-900 border-e border-slate-200 dark:border-slate-800 flex flex-col h-full shrink-0 select-none z-30 transition-colors">
      {/* Brand & Theme Toggle */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center font-black shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
              PhysioRecord
            </h1>
            <p className="text-[10px] text-teal-600 dark:text-teal-400 font-bold">
              {isAr ? 'نظام العيادة والسجل المشفر' : 'PT EHR & Clinic OS'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleTheme}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
            title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
          >
            {theme === 'light' ? (
              <Moon className="w-4 h-4 text-slate-600" />
            ) : (
              <Sun className="w-4 h-4 text-amber-400" />
            )}
          </button>

          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              className="lg:hidden min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer"
              aria-label="Close menu"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Modular Workspace Mode Switcher (Clinical EHR vs Reception Admin) */}
      <div className="p-3 pb-1">
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => handleNavClick('patients')}
            className={`min-h-[38px] py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
              !isReceptionMode
                ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            {isAr ? 'السجل السريري' : 'Clinical EHR'}
          </button>
          <button
            type="button"
            onClick={() => handleNavClick('reception_dashboard')}
            className={`min-h-[38px] py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer whitespace-nowrap ${
              isReceptionMode
                ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
            }`}
          >
            {isAr ? 'الاستقبال والإدارة' : 'Clinic & IQD'}
          </button>
        </div>
      </div>

      {/* Main Navigation Links */}
      <div className="p-3 space-y-1 overflow-y-auto">
        {/* Reception & Command Dashboard */}
        <button
          type="button"
          onClick={() => handleNavClick('reception_dashboard')}
          className={`w-full min-h-[42px] p-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-colors cursor-pointer ${
            currentView === 'reception_dashboard'
              ? 'bg-teal-600 text-white'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <LayoutDashboard className="w-4 h-4 shrink-0" />
          <span className="truncate">{isAr ? 'لوحة الاستقبال والعيادة' : 'Reception Dashboard'}</span>
        </button>

        {/* Patient Directory */}
        <button
          type="button"
          onClick={() => handleNavClick('patients')}
          className={`w-full min-h-[42px] p-2.5 rounded-xl text-xs font-bold flex items-center justify-between transition-colors cursor-pointer ${
            (currentView === 'patients' || currentView === 'patient_workspace') && !selectedPatientId
              ? 'bg-teal-600 text-white'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Users className="w-4 h-4 shrink-0" />
            <span className="truncate">{isAr ? 'دليل وسجلات المرضى' : 'Patient Directory'}</span>
          </div>
          <span className="text-[11px] font-mono tabular-nums opacity-80">
            {patients.length}
          </span>
        </button>

        {/* Appointment Schedule & Waitlist */}
        <button
          type="button"
          onClick={() => handleNavClick('schedule')}
          className={`w-full min-h-[42px] p-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-colors cursor-pointer ${
            currentView === 'schedule'
              ? 'bg-teal-600 text-white'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Calendar className="w-4 h-4 shrink-0" />
          <span className="truncate">{isAr ? 'جدول المواعيد والانتظار' : 'Schedule & Waitlist'}</span>
        </button>

        {/* Iraqi Financial System (IQD) */}
        <button
          type="button"
          onClick={() => handleNavClick('finance')}
          className={`w-full min-h-[42px] p-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-colors cursor-pointer ${
            currentView === 'finance'
              ? 'bg-teal-600 text-white'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Wallet className="w-4 h-4 shrink-0" />
          <span className="truncate">{isAr ? 'الحسابات والديون (IQD)' : 'IQD Financial Ledger'}</span>
        </button>

        {/* Exercise Library & HEP Builder */}
        <button
          type="button"
          onClick={() => handleNavClick('exercises')}
          className={`w-full min-h-[42px] p-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-colors cursor-pointer ${
            currentView === 'exercises'
              ? 'bg-teal-600 text-white'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <Dumbbell className="w-4 h-4 shrink-0" />
          <span className="truncate">{isAr ? 'مكتبة التمارين و HEP' : 'Exercise Library & HEP'}</span>
        </button>

        {/* RBAC & Audit Log */}
        <button
          type="button"
          onClick={() => handleNavClick('audit')}
          className={`w-full min-h-[42px] p-2.5 rounded-xl text-xs font-bold flex items-center gap-2.5 transition-colors cursor-pointer ${
            currentView === 'audit'
              ? 'bg-teal-600 text-white'
              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span className="truncate">{isAr ? 'الصلاحيات وسجل التدقيق' : 'RBAC & Audit Trail'}</span>
        </button>

        {/* Clinical Reference Toolkit */}
        {onOpenToolkit && (
          <button
            type="button"
            onClick={() => {
              onOpenToolkit();
              if (onCloseMobile) onCloseMobile();
            }}
            className="w-full min-h-[40px] p-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
            <span className="truncate">{isAr ? 'الأطلس المرجعي السريري' : 'Clinical Reference Atlas'}</span>
          </button>
        )}

        {/* Custom Exam Widget Studio */}
        <button
          type="button"
          onClick={() => {
            onOpenCustomStudio();
            if (onCloseMobile) onCloseMobile();
          }}
          className="w-full min-h-[40px] p-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 transition-colors cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-teal-600 dark:text-teal-400 shrink-0" />
          <span className="truncate">{isAr ? 'استوديو بناء أدوات الفحص' : 'Custom Widget Studio'}</span>
        </button>
      </div>

      {/* Quick Patients Section */}
      <div className="flex-1 overflow-y-auto px-3 py-2 border-t border-slate-200 dark:border-slate-800/80 space-y-1.5">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            {isAr ? 'المرضى النشطون' : 'Active Patients'}
          </span>
          <button
            type="button"
            onClick={() => {
              onOpenNewPatient();
              if (onCloseMobile) onCloseMobile();
            }}
            className="p-1.5 rounded-lg text-teal-600 dark:text-teal-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={isAr ? 'إضافة مريض جديد' : 'New patient'}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1">
          {activePatients.map((p) => {
            const isSelected = selectedPatientId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePatientClick(p.id)}
                className={`w-full min-h-[40px] text-start p-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2.5 cursor-pointer ${
                  isSelected
                    ? 'bg-teal-50 dark:bg-teal-950/70 text-teal-800 dark:text-teal-200 border border-teal-200 dark:border-teal-800 font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                }`}
              >
                <span className="w-6 h-6 rounded-lg bg-teal-600/10 dark:bg-teal-500/20 text-teal-700 dark:text-teal-300 font-bold text-[11px] flex items-center justify-center shrink-0">
                  {p.data.fullName ? p.data.fullName.charAt(0) : 'P'}
                </span>
                <span className="truncate">{p.data.fullName}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom Active Clinician Badge, Utilities & Vault Lock */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800 space-y-1.5 bg-slate-50/70 dark:bg-slate-900/90">
        <button
          type="button"
          onClick={() => handleNavClick('audit')}
          className="w-full p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-start cursor-pointer"
        >
          <div className="text-[10px] font-bold text-teal-600 dark:text-teal-400 truncate">
            {isAr ? roleInfo.labelAr : roleInfo.labelEn}
          </div>
          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
            {isAr ? activeStaff.nameAr : activeStaff.nameEn}
          </div>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              onOpenBackup();
              if (onCloseMobile) onCloseMobile();
            }}
            className="flex-1 min-h-[38px] p-2 rounded-xl text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
          >
            <Database className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
            <span className="truncate">{isAr ? 'نسخ احتياطي' : 'Backup'}</span>
          </button>

          {import.meta.env.DEV && (
            <button
              type="button"
              onClick={() => {
                onOpenSyntheticData();
                if (onCloseMobile) onCloseMobile();
              }}
              className="flex-1 min-h-[38px] p-2 rounded-xl text-[11px] font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <FlaskConical className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
              <span className="truncate">{isAr ? 'بيانات تجريبية' : 'Demo Data'}</span>
            </button>
          )}
        </div>

        <div className="pt-1 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setLanguage(isAr ? 'en' : 'ar')}
            className="flex-1 min-h-[40px] py-1.5 px-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center gap-1.5 text-xs font-bold transition-colors cursor-pointer"
          >
            <Globe className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>{isAr ? 'English' : 'العربية'}</span>
          </button>

          <button
            type="button"
            onClick={lock}
            className="min-h-[40px] py-1.5 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 flex items-center justify-center gap-1.5 text-xs font-bold transition-colors cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{isAr ? 'قفل' : 'Lock'}</span>
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop Permanent Sidebar (1024px+) */}
      <div className="hidden lg:flex h-full shrink-0">{sidebarContent}</div>

      {/* Mobile & Tablet Slide-Over Navigation Drawer (< 1024px) */}
      {isMobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex" dir={isRtl ? 'rtl' : 'ltr'}>
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-10 flex h-full max-w-[85vw] shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
