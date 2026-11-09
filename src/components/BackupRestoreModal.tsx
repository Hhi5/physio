// =======================================================================
// PhysioRecord — Backup & Restoration Modal (v1.1)
// With Full Data Loss Prevention & Restore Confirmation Inspection
// =======================================================================

import React, { useState } from 'react';
import { db } from '../db/db';
import { useVault } from '../context/VaultContext';
import { usePatients } from '../context/PatientContext';
import { useLanguage } from '../context/LanguageContext';
import {
  exportBackupPackage,
  restoreBackupPackage,
  inspectBackupPreview,
  type BackupPreviewSummary,
} from '../crypto/backup';
import {
  createDurablePreRestoreRecoveryBackup,
  saveExternalRecoveryBackupFile,
} from '../crypto/recovery';
import { localDate, formatClinicalDate } from '../utils/date';
import {
  X,
  Download,
  Upload,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  FileText,
  RefreshCw,
  ArrowRight,
  Database,
} from 'lucide-react';

interface BackupRestoreModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BackupRestoreModal: React.FC<BackupRestoreModalProps> = ({ isOpen, onClose }) => {
  const { vaultKek, unlock } = useVault();
  const { refreshPatients } = usePatients();
  const { bi, isRtl, language } = useLanguage();

  const [activeTab, setActiveTab] = useState<'export' | 'restore'>('export');

  // Export State
  const [exportPassword, setExportPassword] = useState('');
  const [confirmExportPassword, setConfirmExportPassword] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Restore State
  const [restoreFileContent, setRestoreFileContent] = useState<string | null>(null);
  const [restoreFileName, setRestoreFileName] = useState<string>('');
  const [restorePassword, setRestorePassword] = useState('');
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [previewSummary, setPreviewSummary] = useState<BackupPreviewSummary | null>(null);
  const [newVaultPassword, setNewVaultPassword] = useState('');
  const [confirmNewVaultPassword, setConfirmNewVaultPassword] = useState('');
  const [emergencyRecoveryPassword, setEmergencyRecoveryPassword] = useState('');
  const [confirmEmergencyRecoveryPassword, setConfirmEmergencyRecoveryPassword] = useState('');
  const [confirmedDataLoss, setConfirmedDataLoss] = useState(false);
  const [acknowledgedExternalRecovery, setAcknowledgedExternalRecovery] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [emergencyRecoverySnapshotId, setEmergencyRecoverySnapshotId] = useState<string | null>(null);
  const [emergencyRecoveryPackage, setEmergencyRecoveryPackage] = useState<string | null>(null);
  const [externalSaveMethod, setExternalSaveMethod] = useState<string | null>(null);

  if (!isOpen) return null;

  // Handle Export
  const handleExport = async (e: React.FormEvent) => {
    e.preventDefault();
    setExportError(null);

    if (exportPassword.length < 10) {
      setExportError('يجب ألا تقل كلمة مرور النسخة الاحتياطية عن 10 خانات.');
      return;
    }
    if (exportPassword !== confirmExportPassword) {
      setExportError('كلمتا المرور غير متطابقتين.');
      return;
    }
    if (!vaultKek) {
      setExportError('الخزينة مقفلة أو غير مهيأة.');
      return;
    }

    setExportLoading(true);
    try {
      const meta = await db.vaultMeta.get('auth');
      if (!meta) throw new Error('بيانات الخزينة المحلية غير موجودة.');

      const backupPackageStr = await exportBackupPackage(
        db,
        meta,
        vaultKek,
        exportPassword
      );

      // Trigger browser file download
      const blob = new Blob([backupPackageStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = localDate();
      a.href = url;
      a.download = `physiorecord_backup_${dateStr}.ptbackup`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportSuccess(true);
      setExportPassword('');
      setConfirmExportPassword('');
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : 'فشل تصدير النسخة الاحتياطية.');
    } finally {
      setExportLoading(false);
    }
  };

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreFileName(file.name);
    setRestoreError(null);
    setPreviewSummary(null);
    setConfirmedDataLoss(false);

    const reader = new FileReader();
    reader.onload = (event) => {
      setRestoreFileContent(event.target?.result as string);
    };
    reader.onerror = () => {
      setRestoreError('فشل قراءة الملف المختار.');
    };
    reader.readAsText(file);
  };

  // Step 1 of Restore: Inspect and Preview Backup (Data Loss Prevention)
  const handleInspectPreview = async (e: React.FormEvent) => {
    e.preventDefault();
    setRestoreError(null);

    if (!restoreFileContent) {
      setRestoreError('يرجى اختيار ملف النسخة الاحتياطية (.ptbackup) أولاً.');
      return;
    }
    if (!restorePassword) {
      setRestoreError('يرجى إدخال كلمة مرور النسخة الاحتياطية.');
      return;
    }

    setRestoreLoading(true);
    try {
      const summary = await inspectBackupPreview(restoreFileContent, restorePassword, db);
      setPreviewSummary(summary);
    } catch (err: unknown) {
      setRestoreError(err instanceof Error ? err.message : 'فشل التحقق من النسخة الاحتياطية. تأكد من كلمة المرور وسلامة الملف.');
    } finally {
      setRestoreLoading(false);
    }
  };

  // Step 2 of Restore: Execute Replacement with Safety Recovery Backup
  const handleExecuteRestore = async (e: React.FormEvent) => {
    e.preventDefault();
    setRestoreError(null);

    if (!confirmedDataLoss) {
      setRestoreError('يجب الموافقة الصريحة على إقرار استبدال البيانات للمتابعة.');
      return;
    }
    if (newVaultPassword.length < 10) {
      setRestoreError('يجب ألا تقل كلمة مرور الخزينة الجديدة عن 10 خانات.');
      return;
    }
    if (newVaultPassword !== confirmNewVaultPassword) {
      setRestoreError('كلمتا مرور الخزينة الجديدة غير متطابقتين.');
      return;
    }
    if (emergencyRecoveryPassword.length < 10) {
      setRestoreError('يجب ألا تقل كلمة مرور حماية نسخة التعافي الطارئة عن 10 خانات.');
      return;
    }
    if (emergencyRecoveryPassword !== confirmEmergencyRecoveryPassword) {
      setRestoreError('كلمتا مرور حماية نسخة التعافي الطارئة غير متطابقتين.');
      return;
    }
    if (!acknowledgedExternalRecovery) {
      setRestoreError('يجب تأكيد إقرار حفظ نسخة التعافي الطارئة الخارجية والاحتفاظ بكلمة مرورها.');
      return;
    }
    if (!restoreFileContent) return;

    setRestoreLoading(true);
    try {
      // 1. Create durable pre-restore emergency recovery backup of existing destination database
      let emergencyId: string | null = null;
      let emergencyPkg: string | null = null;
      let saveMethodDesc: string | null = null;

      const currentMeta = await db.vaultMeta.get('auth');
      if (currentMeta && vaultKek) {
        // Enforce mandatory emergency backup creation and full verification before restore!
        try {
          // A. Internal Logical Recovery Database (PhysioRecordEmergencyRecoveryDB)
          const recoveryResult = await createDurablePreRestoreRecoveryBackup(
            db,
            currentMeta,
            vaultKek,
            emergencyRecoveryPassword,
            'نسخة تعافٍ طارئة قبل استبدال قاعدة البيانات'
          );
          emergencyId = recoveryResult.snapshotId;
          emergencyPkg = recoveryResult.backupPackageStr;

          // B. External Encrypted Emergency Backup (Physical file outside browser storage)
          try {
            const extResult = await saveExternalRecoveryBackupFile(recoveryResult.backupPackageStr);
            saveMethodDesc = extResult.confirmedSaved
              ? 'تم الحفظ مباشرة على القرص عبر File System Access API'
              : 'تم تصدير وتنزيل الملف عبر المتصفح (Download Fallback)';
          } catch (fileErr: unknown) {
            if (fileErr instanceof Error && fileErr.message.includes('إلغاء')) {
              setRestoreLoading(false);
              setRestoreError('تم إلغاء عملية الاستعادة: ألغى المستخدم حفظ ملف نسخة التعافي الخارجي.');
              return;
            }
            console.warn('External file save fallback:', fileErr);
          }
        } catch (backupErr: unknown) {
          // STRICT RULE: Halt restore immediately if emergency recovery backup fails!
          const msg = backupErr instanceof Error ? backupErr.message : String(backupErr);
          setRestoreLoading(false);
          setRestoreError(`فشلت حماية البيانات السابقة: تعذر إنشاء نسخة التعافي الطارئة (${msg}). تم إيقاف عملية الاستعادة فوراً لحماية بياناتك من الضياع.`);
          return;
        }
      }

      // 2. Execute atomic restoration (with staging counter and new DEK)
      await restoreBackupPackage(
        restoreFileContent,
        restorePassword,
        newVaultPassword,
        db
      );

      // 3. Unlock with new password and refresh state
      await unlock(newVaultPassword);
      await refreshPatients();

      setEmergencyRecoverySnapshotId(emergencyId);
      setEmergencyRecoveryPackage(emergencyPkg);
      setExternalSaveMethod(saveMethodDesc);
      setRestoreSuccess(true);
    } catch (err: unknown) {
      setRestoreError(err instanceof Error ? err.message : 'فشل استعادة النسخة الاحتياطية.');
    } finally {
      setRestoreLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {bi('إدارة النسخ الاحتياطي والاستعادة المشفرة', 'Encrypted Backup & Restore (.ptbackup)')}
              </h2>
              <p className="text-xs text-slate-500">
                تصدير واستعادة السجلات السريرية مشفرة محلياً بـ AES-256-GCM و HKDF
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs Bar */}
        <div className="flex border-b border-slate-200 bg-slate-100/70 px-6 pt-3">
          <button
            type="button"
            onClick={() => { setActiveTab('export'); setExportSuccess(false); setExportError(null); }}
            className={`pb-3 px-4 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'export'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Download className="w-4 h-4" />
            <span>تصدير نسخة احتياطية (.ptbackup)</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('restore'); setRestoreSuccess(false); setRestoreError(null); }}
            className={`pb-3 px-4 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'restore'
                ? 'border-amber-600 text-amber-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>استعادة نسخة احتياطية</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* TAB 1: EXPORT */}
          {activeTab === 'export' && (
            <div>
              <div className="p-4 bg-primary-50/70 border border-primary-200 rounded-2xl text-primary-950 text-xs leading-relaxed space-y-1 mb-5">
                <div className="flex items-center gap-2 font-bold text-primary-800">
                  <ShieldCheck className="w-4 h-4 text-primary-600" />
                  <span>تشفير أظرف محصن ومستقل عن الجهاز (Envelope Encryption)</span>
                </div>
                <p>
                  يتم تشفير كافة السجلات السريرية بمفتاح بيانات عشوائي (DEK) محمي بكلمة مرور النسخة عبر خوارزمية HKDF-SHA256 مع ملح عشوائي مستقل (32 بايت). ملف النسخة مشفر بـ AES-256-GCM ويمكن حفظه بأمان على فلاش ميموري أو أي وسيط تخزين خارجي.
                </p>
              </div>

              {exportError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                  <span>{exportError}</span>
                </div>
              )}

              {exportSuccess && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-800 text-xs space-y-2 mb-4">
                  <div className="flex items-center gap-2 font-bold text-emerald-900">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span>تم تصدير وتنزيل ملف النسخة الاحتياطية بنجاح!</span>
                  </div>
                  <p>
                    احتفظ بهذا الملف في مكان آمن. ستحتاج إلى كلمة المرور التي اخترتها الآن عند استعادة السجلات.
                  </p>
                </div>
              )}

              <form onSubmit={handleExport} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    كلمة مرور حماية النسخة الاحتياطية
                  </label>
                  <input
                    type="password"
                    required
                    value={exportPassword}
                    onChange={(e) => setExportPassword(e.target.value)}
                    placeholder="اختر كلمة مرور قوية (6 خانات على الأقل)"
                    className="w-full px-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-left font-mono"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    تأكيد كلمة المرور
                  </label>
                  <input
                    type="password"
                    required
                    value={confirmExportPassword}
                    onChange={(e) => setConfirmExportPassword(e.target.value)}
                    placeholder="أعد إدخال كلمة المرور"
                    className="w-full px-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-left font-mono"
                    dir="ltr"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={exportLoading || !exportPassword || !confirmExportPassword}
                    className="w-full py-3 px-4 bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-md shadow-primary-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {exportLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>جاري التشفير وتوليد الحزمة...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        <span>تصدير وتنزيل ملف النسخة (.ptbackup)</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: RESTORE */}
          {activeTab === 'restore' && (
            <div>
              {restoreError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2 mb-4">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                  <span>{restoreError}</span>
                </div>
              )}

              {restoreSuccess && (
                <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl text-emerald-900 text-xs space-y-3 mb-4 text-center">
                  <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto" />
                  <h3 className="font-bold text-sm">تم استعادة وتحديث قاعدة البيانات بنجاح تام!</h3>
                  <p className="text-emerald-700 leading-relaxed">
                    تم توليد مفتاح بيانات تشغيلي جديد تماماً (Non-Extractable DEK)، وإعادة تشفير كافة السجلات برقم إصدار مفتاح جديد (dekVersion)، وتثبيت استهلاك العداد المرحلي الفعلي (Staging Counter)، وتفعيل الخزينة بنجاح.
                  </p>
                  
                  {emergencyRecoverySnapshotId && (
                    <div className="p-3 bg-white/80 border border-emerald-200 rounded-xl text-slate-700 text-[11px] text-right space-y-1.5">
                      <p className="font-bold text-emerald-800 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4 text-emerald-600" />
                        <span>تم توثيق نسخة التعافي الطارئة لبياناتك السابقة (Dual Recovery):</span>
                      </p>
                      <p className="font-mono text-slate-600">معرف اللقطة الداخلية: {emergencyRecoverySnapshotId}</p>
                      <p className="text-slate-600">
                        <strong>التخزين الداخلي:</strong> تم الحفظ منطقياً في قاعدة <code>PhysioRecordEmergencyRecoveryDB</code>.
                      </p>
                      {externalSaveMethod && (
                        <p className="text-emerald-800 font-semibold">
                          <strong>التصدير الخارجي:</strong> {externalSaveMethod}.
                        </p>
                      )}
                      <p className="text-[10px] text-amber-800 bg-amber-50 p-1.5 rounded-lg border border-amber-200">
                        تنبيه أمني: كلمة المرور لم تُحفظ في المتصفح نهائياً. يرجى استخدام كلمة مرور التعافي التي عينتها لفك تشفير هذه النسخة في حال الرجوع إليها.
                      </p>
                      {emergencyRecoveryPackage && (
                        <button
                          type="button"
                          onClick={() => {
                            const blob = new Blob([emergencyRecoveryPackage], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `physiorecord_emergency_backup_${emergencyRecoverySnapshotId}.ptbackup`;
                            document.body.appendChild(a);
                            a.click();
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                          }}
                          className="mt-2 text-primary-700 hover:text-primary-800 font-bold underline flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>تحميل ملف نسخة التعافي الطارئة السابقة كملف محلي (.ptbackup)</span>
                        </button>
                      )}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-3 px-6 py-2.5 bg-emerald-600 text-white font-bold rounded-xl text-xs hover:bg-emerald-700 shadow-sm"
                  >
                    إغلاق والعودة للسجلات السريرية
                  </button>
                </div>
              )}

              {!restoreSuccess && !previewSummary && (
                /* Step A: Select File and Enter Password to Preview */
                <form onSubmit={handleInspectPreview} className="space-y-4">
                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-xs leading-relaxed space-y-1">
                    <span className="font-bold">المرحلة الأولى: فحص ومعاينة حزمة النسخ (Pre-Inspection)</span>
                    <p>
                      اختر ملف النسخة وأدخل كلمة المرور الخاصة بها ليقوم النظام بفحص محتواها وعرض مقارنة دقيقة للسجلات قبل إجراء أي استبدال.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      اختر ملف النسخة الاحتياطية (.ptbackup)
                    </label>
                    <input
                      type="file"
                      accept=".ptbackup,.json"
                      onChange={handleFileChange}
                      className="w-full text-xs text-slate-500 file:mr-0 file:ml-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 cursor-pointer"
                    />
                    {restoreFileName && (
                      <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 font-mono">
                        <FileText className="w-3.5 h-3.5" />
                        <span>الملف المحدد: {restoreFileName}</span>
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      كلمة مرور حماية النسخة الاحتياطية
                    </label>
                    <input
                      type="password"
                      required
                      value={restorePassword}
                      onChange={(e) => setRestorePassword(e.target.value)}
                      placeholder="أدخل كلمة المرور التي حُمي بها الملف عند التصدير"
                      className="w-full px-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-left font-mono"
                      dir="ltr"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={restoreLoading || !restoreFileContent || !restorePassword}
                    className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-900 active:bg-slate-950 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {restoreLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>جاري فك تشفير وفحص الترويسة والحمولة في الذاكرة...</span>
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-4 h-4" />
                        <span>فحص ومعاينة السجلات قبل الاستعادة</span>
                      </>
                    )}
                  </button>
                </form>
              )}

              {!restoreSuccess && previewSummary && (
                /* Step B: Comparison, Confirmation & Safe Execution */
                <form onSubmit={handleExecuteRestore} className="space-y-5">
                  
                  {/* High Visibility Warning Box */}
                  <div className="p-4 bg-rose-50 border-2 border-rose-300 rounded-2xl text-rose-900 text-xs space-y-2">
                    <div className="flex items-center gap-2 font-bold text-rose-800 text-sm">
                      <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0" />
                      <span>تحذير سريري حاسم: استبدال شامل دون دمج (Full Replacement — No Merge)</span>
                    </div>
                    <p className="leading-relaxed">
                      عملية الاستعادة الكاملة ستستبدل قاعدة البيانات الحالية على هذا الجهاز بالكامل، <strong>ولن يتم دمج البيانات</strong>. كافة السجلات التي أُضيفت على هذا الجهاز ولم تكن موجودة في النسخة سيتم استبدالها.
                    </p>
                  </div>

                  {/* Side-by-side Comparison Matrix */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    
                    {/* Incoming Backup Metadata */}
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                        <Upload className="w-4 h-4 text-primary-600" />
                        <span>بيانات النسخة الاحتياطية الواردة</span>
                      </div>
                      <div className="space-y-1 text-slate-600">
                        <p className="flex justify-between">
                          <span>تاريخ إنشاء النسخة:</span>
                          <strong className="text-slate-800 font-mono">
                            {formatClinicalDate(previewSummary.exportDateUtc, language, { includeTime: true })}
                          </strong>
                        </p>
                        <p className="flex justify-between">
                          <span>إصدار المخطط:</span>
                          <strong className="text-slate-800 font-mono">{previewSummary.schemaVersion}</strong>
                        </p>
                        <p className="flex justify-between">
                          <span>عدد المرضى في النسخة:</span>
                          <strong className="text-primary-700 font-bold">{previewSummary.restoredPatientCount} مريض</strong>
                        </p>
                        <p className="flex justify-between">
                          <span>عدد الجلسات السريرية:</span>
                          <strong className="text-primary-700 font-bold">{previewSummary.restoredSessionCount} جلسة</strong>
                        </p>
                      </div>
                    </div>

                    {/* Current Destination Database State */}
                    <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                      <div className="font-bold text-slate-800 flex items-center gap-1.5 border-b border-slate-200 pb-1.5">
                        <Database className="w-4 h-4 text-amber-600" />
                        <span>الوضع الحالي على هذا الجهاز</span>
                      </div>
                      <div className="space-y-1 text-slate-600">
                        <p className="flex justify-between">
                          <span>المرضى الحاليون:</span>
                          <strong className="text-slate-800 font-bold">{previewSummary.currentPatientCount} مريض</strong>
                        </p>
                        <p className="flex justify-between">
                          <span>آخر تعديل محلي مسجل:</span>
                          <strong className="text-slate-800 font-mono">
                            {previewSummary.currentLatestModificationDate
                              ? formatClinicalDate(previewSummary.currentLatestModificationDate, language, { includeTime: true })
                              : 'لا توجد سجلات بعد'}
                          </strong>
                        </p>
                        <p className="text-[11px] text-amber-800 bg-amber-50 p-1.5 rounded-lg border border-amber-200 mt-2">
                          سيتم حفظ نسخة تعافٍ تلقائية (Safety Backup) للبيانات الحالية قبل الاستبدال.
                        </p>
                      </div>
                    </div>

                  </div>

                  {/* Explicit Confirmation Checkbox */}
                  <div className="p-3.5 bg-slate-100 rounded-xl border border-slate-200">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={confirmedDataLoss}
                        onChange={(e) => setConfirmedDataLoss(e.target.checked)}
                        className="w-4 h-4 mt-0.5 rounded text-primary-600 focus:ring-primary-500 border-slate-300"
                      />
                      <span className="text-xs font-bold text-slate-800 leading-relaxed">
                        أقر بأنني راجعت المقارنة أعلاه، وعلى علم تام بأن الاستعادة ستستبدل قاعدة البيانات الحالية على هذا الجهاز ولن يتم دمجها، وأطلب المتابعة.
                      </span>
                    </label>
                  </div>

                  {/* New Vault Password on Destination Device */}
                  <div className="space-y-3 pt-1 border-t border-slate-100">
                    <p className="text-xs font-bold text-slate-700">
                      اضبط كلمة مرور الخزينة المحلية الجديدة لهذا الجهاز (لحماية المفتاح المستعاد الجديد):
                    </p>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          كلمة مرور الخزينة الجديدة
                        </label>
                        <input
                          type="password"
                          required
                          value={newVaultPassword}
                          onChange={(e) => setNewVaultPassword(e.target.value)}
                          placeholder="6 خانات على الأقل"
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-left font-mono"
                          dir="ltr"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          تأكيد كلمة المرور
                        </label>
                        <input
                          type="password"
                          required
                          value={confirmNewVaultPassword}
                          onChange={(e) => setConfirmNewVaultPassword(e.target.value)}
                          placeholder="أعد إدخال كلمة المرور"
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-left font-mono"
                          dir="ltr"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Dual Pre-Restore Emergency Recovery Setup */}
                  <div className="space-y-3 pt-2 border-t border-slate-100">
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1.5 text-blue-900 text-[11px] leading-relaxed">
                      <div className="font-bold text-xs flex items-center gap-1.5 text-blue-800">
                        <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
                        <span>حماية البيانات الحالية عبر استراتيجية التعافي المزدوجة (Dual Recovery)</span>
                      </div>
                      <p>
                        قبل الاستبدال، سيتم تشفير وتصدير نسخة تعافٍ كاملة (.ptbackup) لحفظها كملف خارجي مستقل على جهازك، بالإضافة لحفظها داخلياً في قاعدة <code>PhysioRecordEmergencyRecoveryDB</code> كشبكة أمان منطقية.
                      </p>
                      <p className="text-[10px] text-blue-700 font-medium">
                        * تنبيه تقني: التخزين الداخلي للمتصفح (IndexedDB) لا يحمي من مسح بيانات الموقع أو حذف المتصفح، لذا يُلزم تصدير الملف خارج المتصفح وحفظ كلمة مروره.
                      </p>
                    </div>

                    <p className="text-xs font-bold text-slate-700">
                      اضبط كلمة مرور حماية نسخة التعافي الطارئة الخارجية:
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          كلمة مرور نسخة التعافي الطارئة
                        </label>
                        <input
                          type="password"
                          required
                          value={emergencyRecoveryPassword}
                          onChange={(e) => setEmergencyRecoveryPassword(e.target.value)}
                          placeholder="6 خانات على الأقل"
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-left font-mono"
                          dir="ltr"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">
                          تأكيد كلمة المرور
                        </label>
                        <input
                          type="password"
                          required
                          value={confirmEmergencyRecoveryPassword}
                          onChange={(e) => setConfirmEmergencyRecoveryPassword(e.target.value)}
                          placeholder="أعد إدخال كلمة المرور"
                          className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-left font-mono"
                          dir="ltr"
                        />
                      </div>
                    </div>

                    {/* Explicit Acknowledgment of External Recovery */}
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                      <label className="flex items-start gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={acknowledgedExternalRecovery}
                          onChange={(e) => setAcknowledgedExternalRecovery(e.target.checked)}
                          className="w-4 h-4 mt-0.5 rounded text-amber-600 focus:ring-amber-500 border-amber-300"
                        />
                        <span className="text-[11px] font-bold text-amber-900 leading-relaxed">
                          أقر بأنني قمت بضبط كلمة مرور نسخة التعافي الطارئة وسأقوم بتأكيد حفظ الملف الخارجي (.ptbackup)، وأدرك أن التخزين الداخلي للمتصفح لا يحمي من مسح بيانات الموقع أو حذف المتصفح.
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setPreviewSummary(null)}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-100"
                    >
                      إلغاء والعودة
                    </button>

                    <button
                      type="submit"
                      disabled={
                        restoreLoading ||
                        !confirmedDataLoss ||
                        !acknowledgedExternalRecovery ||
                        !newVaultPassword ||
                        !confirmNewVaultPassword ||
                        !emergencyRecoveryPassword ||
                        !confirmEmergencyRecoveryPassword
                      }
                      className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs sm:text-sm font-bold rounded-xl transition-all shadow-md shadow-rose-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {restoreLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>جاري توليد المفتاح الجديد، إعادة التشفير، والتبديل الذري...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          <span>تأكيد واستبدال قاعدة البيانات مع توليد DEK جديد</span>
                        </>
                      )}
                    </button>
                  </div>

                </form>
              )}

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
