// =======================================================================
// PhysioRecord — Activity Log & Staff Labels (Phase 1C & Phase 9)
// Local-First Activity Trail & Transparent Staff Attribution
// =======================================================================

import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useVault } from '../../context/VaultContext';
import {
  ClinicOperationsService,
  CLINIC_STAFF_ROSTER,
  ROLE_PERMISSIONS,
} from '../../services/clinicOperationsService';
import { formatClinicalDate } from '../../utils/date';
import type { ClinicStaffMember, AuditLogEntry } from '../../types/clinicManagement';
import {
  ClipboardList,
  UserCheck,
  FileText,
  CheckCircle2,
  Database,
  ShieldAlert,
  Info,
} from 'lucide-react';

interface ActivityLogViewProps {
  onRoleChanged?: (staff: ClinicStaffMember) => void;
}

export const ActivityLogView: React.FC<ActivityLogViewProps> = ({ onRoleChanged }) => {
  const { language, isRtl } = useLanguage();
  const isAr = language === 'ar';
  const { persistenceGranted } = useVault();

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
      {/* Permanent Security & Data Responsibility Notice */}
      <div className="bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-2xl p-4 sm:p-5 text-amber-950 dark:text-amber-200">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs sm:text-sm">
            <h2 className="font-extrabold text-amber-900 dark:text-amber-100 flex items-center gap-2">
              <span>{isAr ? 'إشعار المسؤولية وأمان البيانات السريرية' : 'Clinical Security & Data Responsibility Notice'}</span>
            </h2>
            <p className="leading-relaxed">
              {isAr
                ? 'يعمل PhysioRecord بنظام محلي كامل داخل متصفح هذا الجهاز (Local-First). لا تخرج أي بيانات أو تشخيصات أو سجلات مرضى إلى خوادم سحابية. لا توجد أي نسخة احتياطية سحابية تلقائية، وفقدان كلمة مرور الخزينة ومفتاح الاسترداد يعني فقدان البيانات نهائياً وبشكل غير قابل للاسترجاع. تقع مسؤولية تصدير وحفظ النسخ الاحتياطية الدورية بصيغة (.ptbackup) على عاتق المعالج والعيادة بالكامل.'
                : 'PhysioRecord runs entirely client-side in this device’s browser (Local-First). No patient data, diagnoses, or records leave this device or touch cloud servers. No automatic cloud backup exists; losing both your vault password and recovery key results in permanent, irreversible data loss. Taking routine encrypted exports (.ptbackup) and keeping them secure is strictly the clinician’s and clinic’s responsibility.'}
            </p>
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            <span>
              {isAr
                ? 'سجل النشاط وتصنيفات الكادر (Activity Log & Staff Labels)'
                : 'Activity Log & Staff Labels'}
            </span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {isAr
              ? 'تحديد هوية الموثق السريري النشط، ومطالعة سجل العمليات الموثقة محلياً بالختم الرقمي SHA-256.'
              : 'Select active clinical attribution label and inspect locally verified operations.'}
          </p>
        </div>

        {/* Persistence Status Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700">
          <Database className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          <span className="text-slate-600 dark:text-slate-300">
            {isAr ? 'حالة التخزين المحلي:' : 'Local Storage:'}
          </span>
          <span className={persistenceGranted ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
            {persistenceGranted
              ? (isAr ? 'تخزين دائم (Persistent Storage)' : 'Persistent Storage')
              : (isAr ? 'تخزين قياسي (Best-Effort)' : 'Best-Effort')}
          </span>
        </div>
      </div>

      {/* Staff Label Clarification Notice */}
      <div className="p-3.5 bg-slate-100 dark:bg-slate-850 border border-slate-200 dark:border-slate-750 rounded-xl text-xs text-slate-700 dark:text-slate-300 flex items-start gap-2.5">
        <Info className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0 mt-0.5" />
        <p className="leading-relaxed">
          {isAr
            ? 'تنبيه الشفافية المعمارية: في التطبيقات المحلية الخالية من خادم وسيط، تعمل تصنيفات الكادر لأغراض التوثيق الإداري والسريري ونسب السجلات لأصحابها (Attribution). يمكن لأي شخص يملك وصولاً فعلياً لهذا الجهاز تبديل هوية الكادر بحرية.'
            : 'Architectural Transparency Notice: In local-only browser apps without a central auth server, staff labels serve clinical and administrative attribution. Anyone with physical access to this unlocked device can switch identities.'}
        </p>
      </div>

      {/* Staff Label Switcher Cards */}
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
                  ? 'bg-teal-50/70 dark:bg-teal-950/50 border-teal-600 dark:border-teal-500 ring-2 ring-teal-500/20'
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

      {/* Active Role Intended Clinical Responsibilities */}
      <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-4">
        <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          {isAr
            ? `المهام السريرية والإدارية المخصصة لهذا التصنيف (${perms.labelAr}):`
            : `Designated Clinical & Operational Tasks (${perms.labelEn}):`}
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {[
            {
              ok: perms.canEditClinicalCharts,
              ar: 'توثيق السجلات والتقييمات السريرية والتمارين',
              en: 'Clinical Assessments & Flowsheets Documentation',
            },
            {
              ok: perms.canFinalizeAndLockNotes,
              ar: 'اعتماد وقفل الملاحظات بختم النزاهة SHA-256',
              en: 'Sign & Seal Clinical Notes (SHA-256)',
            },
            {
              ok: perms.canManageAppointments,
              ar: 'جدولة المواعيد وتنظيم قائمة الانتظار',
              en: 'Appointment Scheduling & Waitlist',
            },
            {
              ok: perms.canCollectPaymentsIQD,
              ar: 'إصدار وصولات القبض واستلام النقد (IQD)',
              en: 'Issue Receipts & Collect IQD Cash',
            },
            {
              ok: perms.canDeleteFinancialRecords,
              ar: 'إدارة وتدقيق السجلات المالية والمصاريف',
              en: 'Financial Ledger & Expense Management',
            },
            {
              ok: perms.canViewAuditLogs,
              ar: 'الاطلاع على سجل النشاط والعمليات الموثقة',
              en: 'Inspect Local Activity Log',
            },
          ].map((item, i) => (
            <div
              key={i}
              className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center gap-2.5"
            >
              <CheckCircle2
                className={`w-4 h-4 shrink-0 ${
                  item.ok
                    ? 'text-teal-600 dark:text-teal-400'
                    : 'text-slate-300 dark:text-slate-600'
                }`}
              />
              <span
                className={`font-semibold ${
                  item.ok
                    ? 'text-slate-800 dark:text-slate-200'
                    : 'text-slate-400 dark:text-slate-500 line-through'
                }`}
              >
                {isAr ? item.ar : item.en}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Activity Log Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-teal-600 dark:text-teal-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              {isAr
                ? 'سجل النشاط السريري والإداري (Local Activity Log)'
                : 'Local Activity Log'}
            </h2>
          </div>
          <span className="text-xs font-mono text-slate-500 tabular-nums">
            {auditLogs.length} {isAr ? 'عملية مسجلة' : 'records'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 text-slate-500 font-bold">
                <th className="py-3 px-4 text-start">{isAr ? 'التوقيت' : 'Timestamp'}</th>
                <th className="py-3 px-4 text-start">{isAr ? 'الموثق / التصنيف' : 'Actor / Label'}</th>
                <th className="py-3 px-4 text-start">{isAr ? 'نوع الإجراء' : 'Action Type'}</th>
                <th className="py-3 px-4 text-start">{isAr ? 'تفاصيل النشاط الموثق' : 'Activity Summary'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {auditLogs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-500">
                    {isAr
                      ? 'سيتم توثيق كافة العمليات السريرية والمالية هنا تلقائياً.'
                      : 'All clinical and financial operations are recorded here automatically.'}
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

// Backwards-compatible alias for existing imports
export const AuditAndRbacView = ActivityLogView;
