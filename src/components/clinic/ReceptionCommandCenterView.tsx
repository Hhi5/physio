// =======================================================================
// PhysioRecord — Reception & Clinic Command Center Dashboard (Phase 7)
// Today's Arrival Queue, Waiting List, Iraqi IQD Financial KPIs & Clinical Alerts
// =======================================================================

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { usePatients } from '../../context/PatientContext';
import {
  ClinicOperationsService,
  formatIQD,
} from '../../services/clinicOperationsService';
import type {
  ClinicAppointment,
  AppointmentStatus,
  WaitingListEntry,
  FinancialInvoiceIQD,
  ClinicExpenseIQD,
} from '../../types/clinicManagement';
import type { PatientRecord } from '../../types/clinical';
import {
  Calendar,
  Clock,
  UserPlus,
  Users,
  Wallet,
  AlertCircle,
  CheckCircle2,
  ArrowUpRight,
  Stethoscope,
  ClipboardList,
} from 'lucide-react';

interface ReceptionCommandCenterViewProps {
  onSelectPatient: (patient: PatientRecord) => void;
  onOpenNewPatient: () => void;
  onNavigateTab: (tab: 'schedule' | 'finance' | 'exercises' | 'patients' | 'audit') => void;
}

export const ReceptionCommandCenterView: React.FC<ReceptionCommandCenterViewProps> = ({
  onSelectPatient,
  onOpenNewPatient,
  onNavigateTab,
}) => {
  const { language, isRtl } = useLanguage();
  const isAr = language === 'ar';
  const { activePatients } = usePatients();

  const [appointments, setAppointments] = useState<ClinicAppointment[]>([]);
  const [waitingList, setWaitingList] = useState<WaitingListEntry[]>([]);
  const [invoices, setInvoices] = useState<FinancialInvoiceIQD[]>([]);
  const [expenses, setExpenses] = useState<ClinicExpenseIQD[]>([]);

  const refreshData = () => {
    setAppointments(ClinicOperationsService.getAppointments());
    setWaitingList(ClinicOperationsService.getWaitingList());
    setInvoices(ClinicOperationsService.getInvoicesIQD());
    setExpenses(ClinicOperationsService.getExpensesIQD());
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleStatusChange = (id: string, status: AppointmentStatus) => {
    const updated = ClinicOperationsService.updateAppointmentStatus(id, status);
    setAppointments(updated);
  };

  const today = new Date().toISOString().split('T')[0];
  const todayAppointments = appointments.filter((a) => a.date === today);

  // Iraqi Financial KPIs
  const totalCollectedIQD = invoices.reduce((sum, inv) => sum + inv.paidAmountIQD, 0);
  const totalOutstandingDebtIQD = invoices.reduce((sum, inv) => sum + inv.balanceDueIQD, 0);
  const totalExpensesIQD = expenses.reduce((sum, exp) => sum + exp.amountIQD, 0);
  const netClinicBalanceIQD = totalCollectedIQD - totalExpensesIQD;

  const statusLabels: Record<AppointmentStatus, { ar: string; en: string; color: string }> = {
    scheduled: {
      ar: 'مجدول',
      en: 'Scheduled',
      color: 'text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 border-sky-200 dark:border-sky-800',
    },
    arrived: {
      ar: 'وصل للاستقبال',
      en: 'Arrived',
      color: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800',
    },
    in_session: {
      ar: 'داخل الجلسة',
      en: 'In Session',
      color: 'text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/60 border-teal-200 dark:border-teal-800',
    },
    completed: {
      ar: 'مكتمل',
      en: 'Completed',
      color: 'text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800',
    },
    cancelled: {
      ar: 'ملغى',
      en: 'Cancelled',
      color: 'text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700',
    },
    no_show: {
      ar: 'لم يحضر',
      en: 'No-Show',
      color: 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800',
    },
  };

  return (
    <div
      className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Top Command Center Header */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1">
            <span>{isAr ? 'لوحة قيادة العيادة والاستقبال' : 'Clinic Operations Command Center'}</span>
            <span>·</span>
            <span className="font-mono tabular-nums">{today}</span>
          </div>
          <h1 className="text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
            {isAr
              ? 'مركز الاستقبال والعمليات السريرية والمالية (IQD)'
              : 'Reception, Scheduling & Clinical Command Center'}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigateTab('schedule')}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Calendar className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>{isAr ? 'جدول المواعيد الكامل' : 'Full Schedule'}</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateTab('finance')}
            className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Wallet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>{isAr ? 'الحسابات والديون (د.ع)' : 'IQD Billing & Ledger'}</span>
          </button>

          <button
            type="button"
            onClick={onOpenNewPatient}
            className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4" />
            <span>{isAr ? '+ تسجيل مريض جديد' : '+ New Patient Intake'}</span>
          </button>
        </div>
      </div>

      {/* 4-Column Operational & Iraqi Financial KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {isAr ? 'مواعيد وجلسات اليوم' : "Today's Appointments"}
            </span>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums mt-1">
              {todayAppointments.length}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              {todayAppointments.filter((a) => a.status === 'completed' || a.status === 'in_session').length}{' '}
              {isAr ? 'نشط / مكتمل' : 'active / done'} · {waitingList.length}{' '}
              {isAr ? 'في قائمة الانتظار' : 'on waitlist'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950 text-teal-600 dark:text-teal-400 border border-teal-200 dark:border-teal-800 flex items-center justify-center">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {isAr ? 'إجمالي المقبوضات (IQD)' : 'Total Collected (IQD)'}
            </span>
            <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 font-mono tabular-nums mt-1">
              {formatIQD(totalCollectedIQD, isAr)}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              {isAr ? 'صافي بعد المصاريف: ' : 'Net after expenses: '}
              <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">
                {formatIQD(netClinicBalanceIQD, isAr)}
              </span>
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center">
            <Wallet className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {isAr ? 'ديون وذمم المرضى المتبقية' : 'Patient Balances Due (Debt)'}
            </span>
            <p className="text-xl font-extrabold text-amber-600 dark:text-amber-400 font-mono tabular-nums mt-1">
              {formatIQD(totalOutstandingDebtIQD, isAr)}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              {invoices.filter((i) => i.balanceDueIQD > 0).length}{' '}
              {isAr ? 'فواتير بدفعات جزئية' : 'partial/unpaid invoices'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800 flex items-center justify-center">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              {isAr ? 'المرضى المسجلون بالخزينة' : 'Encrypted Patient Charts'}
            </span>
            <p className="text-2xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums mt-1">
              {activePatients.length}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {isAr ? 'حلقات رعاية معزولة بالكامل' : 'Isolated Episodes of Care'}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Two-Column Grid: Today's Live Reception Queue & Waitlist + Unpaid Balances */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Columns: Today's Arrival & Therapist Session Queue */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-teal-600 dark:text-teal-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                {isAr
                  ? 'قائمة حضور وجلسات المرضى اليوم (Live Reception Queue)'
                  : "Today's Patient Arrival & Treatment Queue"}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab('schedule')}
              className="text-xs font-bold text-teal-600 dark:text-teal-400 hover:underline flex items-center gap-1 cursor-pointer"
            >
              <span>{isAr ? 'إدارة المواعيد' : 'Manage Schedule'}</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {todayAppointments.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500 dark:text-slate-400">
                {isAr ? 'لا توجد مواعيد مسجلة لهذا اليوم بعد.' : 'No appointments scheduled for today.'}
              </div>
            ) : (
              todayAppointments.map((appt) => {
                const st = statusLabels[appt.status];
                const matchedPatient = activePatients.find(
                  (p) =>
                    p.id === appt.patientId ||
                    p.data.fullName.trim() === appt.patientName.trim()
                );

                return (
                  <div
                    key={appt.id}
                    className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-bold text-teal-700 dark:text-teal-400 tabular-nums">
                          {appt.startTime}
                        </span>
                        <span className="text-slate-300 dark:text-slate-700">·</span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          {appt.patientName}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${st.color}`}
                        >
                          {isAr ? st.ar : st.en}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>{appt.episodeTitle || (isAr ? 'تقييم وعلاج طبيعي' : 'PT Session')}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Stethoscope className="w-3 h-3 text-slate-400" />
                          {appt.therapistName}
                        </span>
                        {appt.roomOrBed && (
                          <>
                            <span>·</span>
                            <span>{appt.roomOrBed}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      {appt.status === 'scheduled' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(appt.id, 'arrived')}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-bold cursor-pointer whitespace-nowrap"
                        >
                          {isAr ? 'تسجيل وصول' : 'Check In'}
                        </button>
                      )}
                      {appt.status === 'arrived' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(appt.id, 'in_session')}
                          className="px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                        >
                          {isAr ? 'إدخال للجلسة' : 'Start Session'}
                        </button>
                      )}
                      {appt.status === 'in_session' && (
                        <button
                          type="button"
                          onClick={() => handleStatusChange(appt.id, 'completed')}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{isAr ? 'إنهاء الجلسة' : 'Complete'}</span>
                        </button>
                      )}
                      {matchedPatient && (
                        <button
                          type="button"
                          onClick={() => onSelectPatient(matchedPatient)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer whitespace-nowrap"
                        >
                          {isAr ? 'فتح السجل السريري' : 'Open Chart'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Waiting List & Outstanding IQD Debt Reminders */}
        <div className="space-y-6">
          {/* Waiting List Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  {isAr ? 'قائمة الانتظار (Waiting List)' : 'Active Waiting List'}
                </h3>
              </div>
              <span className="text-xs font-mono font-bold text-slate-500 tabular-nums">
                {waitingList.length}
              </span>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {waitingList.slice(0, 4).map((w) => (
                <div key={w.id} className="p-3.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                      {w.patientName}
                    </span>
                    <span
                      className={`text-[10px] font-bold ${
                        w.priority === 'urgent'
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-slate-500'
                      }`}
                    >
                      {w.priority === 'urgent'
                        ? isAr
                          ? 'أولوية عاجلة'
                          : 'Urgent'
                        : isAr
                        ? 'اعتيادي'
                        : 'Normal'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    {w.conditionOrRegion}
                  </p>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                    <span className="font-mono" dir="ltr">
                      {w.phone}
                    </span>
                    <span>{w.preferredDays}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Outstanding Patient Debt Reminders (IQD) */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  {isAr ? 'ذمم وديون مستحقة التحصيل (IQD)' : 'Unpaid Balances Due (IQD)'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigateTab('finance')}
                className="text-[11px] font-bold text-teal-600 dark:text-teal-400 hover:underline cursor-pointer"
              >
                {isAr ? 'تسديد دفعة' : 'Collect'}
              </button>
            </div>

            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {invoices
                .filter((i) => i.balanceDueIQD > 0)
                .slice(0, 4)
                .map((inv) => (
                  <div key={inv.id} className="p-3.5 flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">
                        {inv.patientName}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {isAr ? inv.titleAr : inv.titleEn}
                      </p>
                    </div>
                    <div className="text-end tabular-nums">
                      <p className="text-xs font-mono font-bold text-rose-600 dark:text-rose-400">
                        {formatIQD(inv.balanceDueIQD, isAr)}
                      </p>
                      <p className="text-[10px] text-slate-400 font-mono">
                        {isAr ? 'مدفوع: ' : 'Paid: '}
                        {formatIQD(inv.paidAmountIQD, isAr)}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
