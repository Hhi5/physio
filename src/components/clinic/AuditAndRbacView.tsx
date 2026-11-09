// =======================================================================
// PhysioRecord — Role-Based Access Control (RBAC) & Immutable Audit Log (Phase 9)
// =======================================================================

import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import {
  ClinicOperationsService,
  CLINIC_STAFF_ROSTER,
  ROLE_PERMISSIONS,
} from '../../services/clinicOperationsService';
import { formatClinicalDate } from '../../utils/date';
import type { ClinicStaffMember, AuditLogEntry } from '../../types/clinicManagement';
import { ShieldCheck, UserCheck, Lock, FileSpreadsheet, CheckCircle2, XCircle } from 'lucide-react';

interface AuditAndRbacViewProps {
  onRoleChanged?: (staff: ClinicStaffMember) => void;
}

export const AuditAndRbacView: React.FC<AuditAndRbacViewProps> = ({ onRoleChanged }) => {
  const { language, isRtl } = useLanguage();
  const isAr = language === 'ar';

  const [activeStaff, setActiveStaff] = useState<ClinicStaffMember>(
    ClinicOperationsService.getActiveStaff()
  );
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(
    ClinicOperationsService.getAuditLogs()
  );

  const handleSelectStaff = (staffId: string) => {
    const updated = ClinicOperationsService.setActiveStaff(staffId);
    setActiveStaff(updated);
    setAuditLogs(ClinicOperationsService.getAuditLogs());
    if (onRoleChanged) onRoleChanged(updated);
  };

  const perms = ROLE_PERMISSIONS[activeStaff.role];

  return (
    <div
      className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <span>
              {isAr
                ? 'صلاحيات المستخدمين وسجل التدقيق الأمني والسريري (RBAC & Audit Log)'
                : 'Role-Based Access Control (RBAC) & Clinical Audit Trail'}
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isAr
              ? 'إدارة صلاحيات الكادر الطبي والاستقبال، قفل الملاحظات المعتمدة بـ SHA-256، وتتبع كافة العمليات الحساسة.'
              : 'Manage clinical and front-desk staff permissions, SHA-256 note locks, and immutable audit logs.'}
          </p>
        </div>
      </div>

      {/* Staff Role Switcher Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {CLINIC_STAFF_ROSTER.map((staff) => {
          const isCurrent = activeStaff.id === staff.id;
          const rolePerm = ROLE_PERMISSIONS[staff.role];
          return (
            <button
              key={staff.id}
              type="button"
              onClick={() => handleSelectStaff(staff.id)}
              className={`text-start p-4 rounded-2xl border transition-all cursor-pointer space-y-2 ${
                isCurrent
                  ? 'bg-teal-50/70 dark:bg-teal-950/50 border-teal-600 dark:border-teal-500'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-700 dark:text-teal-400">
                  {isAr ? rolePerm.labelAr : rolePerm.labelEn}
                </span>
                {isCurrent && (
                  <UserCheck className="w-4 h-4 text-teal-600 dark:text-teal-400" />
                )}
              </div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-white">
                {isAr ? staff.nameAr : staff.nameEn}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isAr ? staff.specialtyAr : staff.specialtyEn}
              </p>
            </button>
          );
        })}
      </div>

      {/* Active Role Permission Matrix */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          {isAr
            ? `الصلاحيات الممنوحة للدور الحالي (${perms.labelAr}):`
            : `Active Role Capabilities (${perms.labelEn}):`}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {[
            {
              ok: perms.canEditClinicalCharts,
              ar: 'تحرير السجلات والتقييمات السريرية والتمارين',
              en: 'Edit Clinical Assessments & Flowsheets',
            },
            {
              ok: perms.canFinalizeAndLockNotes,
              ar: 'اعتماد وقفل الملاحظات السريرية نهائياً (Sign & Lock)',
              en: 'Sign & Lock Finalized Clinical Notes',
            },
            {
              ok: perms.canManageAppointments,
              ar: 'إدارة المواعيد وقائمة الانتظار',
              en: 'Manage Appointments & Waiting List',
            },
            {
              ok: perms.canCollectPaymentsIQD,
              ar: 'إصدار الفواتير واستلام الدفعات النقدية (IQD)',
              en: 'Issue Invoices & Collect IQD Payments',
            },
            {
              ok: perms.canDeleteFinancialRecords,
              ar: 'حذف وتعديل السجلات المالية والمصاريف',
              en: 'Delete Financial Records & Expenses',
            },
            {
              ok: perms.canViewAuditLogs,
              ar: 'الاطلاع على سجل التدقيق الأمني الكامل',
              en: 'Inspect Security & Clinical Audit Log',
            },
          ].map((item, i) => (
            <div
              key={i}
              className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-2.5"
            >
              {item.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
              )}
              <span className="font-semibold text-slate-800 dark:text-slate-200">
                {isAr ? item.ar : item.en}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Immutable Audit Log Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {isAr
                ? 'سجل التدقيق الأمني والسريري غير القابل للتعديل (Immutable Audit Trail)'
                : 'Immutable Clinical & Financial Audit Trail'}
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-500 tabular-nums">
            {auditLogs.length} {isAr ? 'عملية موثقة' : 'events'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                <th className="py-3 px-4 text-start">{isAr ? 'التوقيت' : 'Timestamp'}</th>
                <th className="py-3 px-4 text-start">{isAr ? 'المستخدم / الدور' : 'Actor / Role'}</th>
                <th className="py-3 px-4 text-start">{isAr ? 'نوع الإجراء' : 'Action Type'}</th>
                <th className="py-3 px-4 text-start">{isAr ? 'التفاصيل الموثقة' : 'Audit Summary'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    {isAr
                      ? 'سيتم تسجيل كافة العمليات السريرية والمالية هنا تلقائياً.'
                      : 'All clinical and financial operations are logged here automatically.'}
                  </td>
                </tr>
              ) : (
                auditLogs.map((log) => (
                  <tr key={log.id} className="tabular-nums">
                    <td className="py-3 px-4 font-mono text-slate-500">
                      {formatClinicalDate(log.timestamp, isAr ? 'ar' : 'en', { includeTime: true })}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                      {log.actorName} ({log.actorRole})
                    </td>
                    <td className="py-3 px-4 font-mono text-teal-700 dark:text-teal-400">
                      {log.actionType}
                    </td>
                    <td className="py-3 px-4 text-slate-700 dark:text-slate-300">
                      {isAr ? log.summaryAr : log.summaryEn}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
