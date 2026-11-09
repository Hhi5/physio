// =======================================================================
// PhysioRecord — Enterprise Application Layout Shell (3-Device Responsive)
// Supports Smartphone (Bottom Nav + Top Bar), Tablet (Top Bar + Drawer),
// and Desktop (Permanent Left/Right Rail + Split Workspace)
// =======================================================================

import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { usePatients } from '../../context/PatientContext';
import { useTheme } from '../../context/ThemeContext';
import { useVault } from '../../context/VaultContext';
import { Sidebar, type MainClinicNavView } from './Sidebar';
import { PatientDirectory } from '../PatientDirectory';
import { PatientWorkspace } from '../workspace/PatientWorkspace';
import { ReceptionCommandCenterView } from '../clinic/ReceptionCommandCenterView';
import { AppointmentScheduleView } from '../clinic/AppointmentScheduleView';
import { IraqiFinancialLedgerView } from '../clinic/IraqiFinancialLedgerView';
import { ExerciseLibraryHepView } from '../clinic/ExerciseLibraryHepView';
import { AuditAndRbacView } from '../clinic/AuditAndRbacView';
import { PatientDrawer } from '../drawers/PatientDrawer';
import { ClinicalToolkitModal } from '../toolkit/ClinicalToolkitModal';
import { BackupRestoreModal } from '../BackupRestoreModal';
import { SyntheticDataModal } from '../SyntheticDataModal';
import { CustomWidgetStudioModal } from '../workspace/CustomWidgetStudioModal';
import type { PatientRecord } from '../../types/clinical';
import {
  Menu,
  Activity,
  UserPlus,
  Sun,
  Moon,
  LayoutDashboard,
  Users,
  Calendar,
  Wallet,
  Dumbbell,
  ShieldCheck,
  AlertTriangle,
  X,
} from 'lucide-react';

export const AppLayout: React.FC = () => {
  const { isRtl, language } = useLanguage();
  const isAr = language === 'ar';
  const { patients } = usePatients();
  const { theme, toggleTheme } = useTheme();
  const { lastRepairSummary, repairError, dismissRepairNotice } = useVault();

  const [activeNavView, setActiveNavView] = useState<MainClinicNavView>('patients');
  const [selectedPatient, setSelectedPatient] = useState<PatientRecord | null>(null);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [, setRoleTick] = useState(0);

  // Modals & Drawers State
  const [isNewPatientDrawerOpen, setIsNewPatientDrawerOpen] = useState(false);
  const [isToolkitOpen, setIsToolkitOpen] = useState(false);
  const [isCustomStudioOpen, setIsCustomStudioOpen] = useState(false);
  const [isBackupOpen, setIsBackupOpen] = useState(false);
  const [isSyntheticDataOpen, setIsSyntheticDataOpen] = useState(false);

  const handleSelectPatientById = (patientId: string) => {
    const found = patients.find((p) => p.id === patientId) || null;
    setSelectedPatient(found);
    if (found) {
      setActiveNavView('patient_workspace');
    }
  };

  const handleNavigateView = (view: MainClinicNavView) => {
    if (view !== 'patient_workspace') {
      setSelectedPatient(null);
    }
    setActiveNavView(view);
  };

  const effectiveView: MainClinicNavView = selectedPatient ? 'patient_workspace' : activeNavView;

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className="flex flex-col lg:flex-row h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 antialiased font-sans transition-colors"
    >
      {/* Mobile & Tablet Top App Bar (< 1024px) */}
      <header className="lg:hidden h-14 px-3 sm:px-5 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0 z-30">
        {/* Zone 1: Menu Trigger & Brand */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsMobileSidebarOpen(true)}
            className="min-h-[42px] min-w-[42px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center font-black shrink-0">
              <Activity className="w-4 h-4" />
            </div>
            <span className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight whitespace-nowrap">
              PhysioRecord
            </span>
          </div>
        </div>

        {/* Zone 2: Tablet Quick Mode Switcher (Visible on sm/md tablets) */}
        <div className="hidden sm:flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => handleNavigateView('patients')}
            className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap ${
              effectiveView === 'patients' || effectiveView === 'patient_workspace' || effectiveView === 'exercises'
                ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {isAr ? 'السجل السريري (EHR)' : 'Clinical EHR'}
          </button>
          <button
            type="button"
            onClick={() => handleNavigateView('reception_dashboard')}
            className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer whitespace-nowrap ${
              effectiveView === 'reception_dashboard' || effectiveView === 'schedule' || effectiveView === 'finance' || effectiveView === 'audit'
                ? 'bg-white dark:bg-slate-900 text-teal-700 dark:text-teal-300 shadow-2xs'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {isAr ? 'الاستقبال والحسابات (IQD)' : 'Reception & IQD'}
          </button>
        </div>

        {/* Zone 3: Quick New Patient & Theme Toggle */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsNewPatientDrawerOpen(true)}
            className="min-h-[40px] px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">{isAr ? 'مريض جديد' : 'New Patient'}</span>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
          >
            {theme === 'light' ? (
              <Moon className="w-4 h-4 text-slate-600" />
            ) : (
              <Sun className="w-4 h-4 text-amber-400" />
            )}
          </button>
        </div>
      </header>

      {/* Navigation Sidebar (Permanent on Desktop lg+, Slide-over Drawer on Mobile/Tablet) */}
      <Sidebar
        currentView={effectiveView}
        onNavigateView={handleNavigateView}
        onSelectPatient={handleSelectPatientById}
        selectedPatientId={selectedPatient?.id}
        onOpenNewPatient={() => setIsNewPatientDrawerOpen(true)}
        onOpenToolkit={() => setIsToolkitOpen(true)}
        onOpenCustomStudio={() => setIsCustomStudioOpen(true)}
        onOpenBackup={() => setIsBackupOpen(true)}
        onOpenSyntheticData={() => setIsSyntheticDataOpen(true)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area (with bottom padding on mobile so Fixed Bottom Tab Bar never overlaps) */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-950 relative pb-16 md:pb-0">
        {(repairError ||
          (lastRepairSummary &&
            (lastRepairSummary.repairedCount > 0 || lastRepairSummary.skippedCount > 0))) && (
          <div
            className={`px-4 py-2.5 border-b text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 ${
              repairError
                ? 'bg-rose-50 dark:bg-rose-950/70 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200'
                : 'bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
            }`}
          >
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 font-bold">
                {repairError ? (
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                )}
                <span>
                  {repairError
                    ? isAr
                      ? `تنبيه إصلاح السجلات السريرية عند فتح الخزينة: ${repairError}`
                      : `Vault unlock repair warning: ${repairError}`
                    : isAr
                      ? `إشعار مزامنة السجلات السريرية: تم إصلاح قفل الاعتماد لـ (${lastRepairSummary?.repairedCount ?? 0}) ملاحظة SOAP مرتبطة بجلسات معتمدة${
                          lastRepairSummary && lastRepairSummary.skippedCount > 0
                            ? `، وتم تخطي (${lastRepairSummary.skippedCount}) سجل لتعديله المتزامن (سيتم إعادة المحاولة عند الفتح القادم).`
                            : '.'
                        }`
                      : `Clinical record lock repair: Synchronized finalization lock for (${lastRepairSummary?.repairedCount ?? 0}) SOAP note(s)${
                          lastRepairSummary && lastRepairSummary.skippedCount > 0
                            ? `, and skipped (${lastRepairSummary.skippedCount}) concurrently modified record(s) for retry on next unlock.`
                            : '.'
                        }`}
                </span>
              </div>
              {!repairError &&
                lastRepairSummary &&
                lastRepairSummary.repairedSessionIds.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 ps-6">
                    <span className="text-[11px] font-semibold opacity-90">
                      {isAr ? 'الجلسات التي تم إصلاح قفلها (اضغط للمراجعة):' : 'Repaired sessions (click to review):'}
                    </span>
                    {(lastRepairSummary.repairedSessions && lastRepairSummary.repairedSessions.length > 0
                      ? lastRepairSummary.repairedSessions
                      : lastRepairSummary.repairedSessionIds.map((sessionId) => ({
                          sessionId,
                          episodeId: '',
                          patientId: '',
                        }))
                    ).map((item) => (
                      <button
                        key={item.sessionId}
                        type="button"
                        onClick={() => {
                          if (item.patientId) {
                            handleSelectPatientById(item.patientId);
                          }
                        }}
                        className="px-2 py-0.5 rounded-md bg-amber-200/70 dark:bg-amber-900/70 hover:bg-amber-300 dark:hover:bg-amber-800 text-amber-950 dark:text-amber-100 font-mono text-[11px] font-bold underline decoration-dotted cursor-pointer"
                        title={
                          isAr
                            ? `فتح ملف المريض لمراجعة الجلسة ${item.sessionId}`
                            : `Open patient workspace to review session ${item.sessionId}`
                        }
                      >
                        #{item.sessionId}
                      </button>
                    ))}
                  </div>
                )}
            </div>
            <button
              type="button"
              onClick={dismissRepairNotice}
              className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer shrink-0 self-end sm:self-center"
              aria-label="Dismiss repair notice"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {selectedPatient ? (
          <PatientWorkspace
            patient={selectedPatient}
            onBackToDirectory={() => {
              setSelectedPatient(null);
              setActiveNavView('patients');
            }}
          />
        ) : activeNavView === 'reception_dashboard' ? (
          <div className="flex-1 overflow-y-auto">
            <ReceptionCommandCenterView
              onSelectPatient={(p) => {
                setSelectedPatient(p);
                setActiveNavView('patient_workspace');
              }}
              onOpenNewPatient={() => setIsNewPatientDrawerOpen(true)}
              onNavigateTab={(tab) => handleNavigateView(tab)}
            />
          </div>
        ) : activeNavView === 'schedule' ? (
          <div className="flex-1 overflow-y-auto">
            <AppointmentScheduleView />
          </div>
        ) : activeNavView === 'finance' ? (
          <div className="flex-1 overflow-y-auto">
            <IraqiFinancialLedgerView />
          </div>
        ) : activeNavView === 'exercises' ? (
          <div className="flex-1 overflow-y-auto">
            <ExerciseLibraryHepView />
          </div>
        ) : activeNavView === 'audit' ? (
          <div className="flex-1 overflow-y-auto">
            <AuditAndRbacView onRoleChanged={() => setRoleTick((t) => t + 1)} />
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-full overflow-y-auto">
            <PatientDirectory
              onSelectPatient={(p) => {
                setSelectedPatient(p);
                setActiveNavView('patient_workspace');
              }}
              onOpenNewPatientModal={() => setIsNewPatientDrawerOpen(true)}
              onOpenSyntheticModal={() => setIsSyntheticDataOpen(true)}
            />
          </div>
        )}
      </main>

      {/* Mobile Thumb-Zone Bottom Tab Bar (< 768px) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 grid grid-cols-5 items-center px-1">
        {[
          {
            id: 'reception_dashboard' as MainClinicNavView,
            ar: 'الاستقبال',
            en: 'Reception',
            icon: LayoutDashboard,
          },
          {
            id: 'patients' as MainClinicNavView,
            ar: 'المرضى',
            en: 'Patients',
            icon: Users,
          },
          {
            id: 'schedule' as MainClinicNavView,
            ar: 'المواعيد',
            en: 'Schedule',
            icon: Calendar,
          },
          {
            id: 'finance' as MainClinicNavView,
            ar: 'الحسابات',
            en: 'IQD',
            icon: Wallet,
          },
          {
            id: 'exercises' as MainClinicNavView,
            ar: 'التمارين',
            en: 'HEP',
            icon: Dumbbell,
          },
        ].map((item) => {
          const Icon = item.icon;
          const isActive =
            effectiveView === item.id ||
            (item.id === 'patients' && effectiveView === 'patient_workspace');
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleNavigateView(item.id)}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors cursor-pointer ${
                isActive
                  ? 'text-teal-600 dark:text-teal-400 font-extrabold'
                  : 'text-slate-500 dark:text-slate-400 font-medium'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] leading-tight whitespace-nowrap">
                {isAr ? item.ar : item.en}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Global Slide-Over Drawers & Modals */}
      <PatientDrawer
        isOpen={isNewPatientDrawerOpen}
        onClose={() => setIsNewPatientDrawerOpen(false)}
        onSavedSuccess={(newPatient) => {
          setSelectedPatient(newPatient);
          setActiveNavView('patient_workspace');
        }}
      />

      <ClinicalToolkitModal
        isOpen={isToolkitOpen}
        onClose={() => setIsToolkitOpen(false)}
      />

      <CustomWidgetStudioModal
        isOpen={isCustomStudioOpen}
        onClose={() => setIsCustomStudioOpen(false)}
        onWidgetCreated={() => {}}
      />

      <BackupRestoreModal
        isOpen={isBackupOpen}
        onClose={() => setIsBackupOpen(false)}
      />

      <SyntheticDataModal
        isOpen={isSyntheticDataOpen}
        onClose={() => setIsSyntheticDataOpen(false)}
      />
    </div>
  );
};
