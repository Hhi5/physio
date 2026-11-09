// =======================================================================
// PhysioRecord — Vault Lock & Setup Screen
// Phase 1B: KDF Auto-Upgrade, Emergency Recovery Key, and Password Reset
// Modern Healthcare SaaS Authentication Gate with Light/Dark Theme
// =======================================================================

import React, { useState } from 'react';
import { useVault } from '../context/VaultContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import {
  Lock,
  Unlock,
  ShieldAlert,
  KeyRound,
  AlertTriangle,
  RefreshCw,
  Globe,
  Sun,
  Moon,
  Activity,
  Copy,
  Check,
  ShieldCheck,
  Key,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';

type ScreenMode = 'unlock' | 'setup' | 'show_recovery_key' | 'reset_password' | 'wipe';

export const LockScreen: React.FC = () => {
  const { isInitialized, setupPassword, unlock, resetPasswordWithRecovery, wipeDatabase } = useVault();
  const { language, toggleLanguage, bi, isRtl } = useLanguage();
  const { theme, toggleTheme } = useTheme();

  const [mode, setMode] = useState<ScreenMode>(isInitialized ? 'unlock' : 'setup');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryKeyInput, setRecoveryKeyInput] = useState('');
  const [activeRecoveryKey, setActiveRecoveryKey] = useState<string>('');
  const [recoveryAcknowledged, setRecoveryAcknowledged] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resetInput, setResetInput] = useState('');

  // Initial Vault Setup
  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 10) {
      setError(
        bi(
          'يجب أن تتكون كلمة المرور من 10 خانات على الأقل.',
          'Password must be at least 10 characters long.'
        )
      );
      return;
    }
    if (password !== confirmPassword) {
      setError(bi('كلمتا المرور غير متطابقتين.', 'Passwords do not match.'));
      return;
    }

    setLoading(true);
    try {
      const result = await setupPassword(password);
      setActiveRecoveryKey(result.recoveryKeyFormatted);
      setRecoveryAcknowledged(false);
      setMode('show_recovery_key');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : bi('فشل ضبط كلمة المرور', 'Failed to set password'));
    } finally {
      setLoading(false);
    }
  };

  // Standard Unlock
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    setLoading(true);
    try {
      const success = await unlock(password);
      if (!success) {
        setError(
          bi(
            'كلمة المرور غير صحيحة. يرجى المحاولة مرة أخرى.',
            'Incorrect password. Please try again.'
          )
        );
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : bi('حدث خطأ أثناء فك التشفير', 'Error during decryption'));
    } finally {
      setLoading(false);
    }
  };

  // Reset Password using Recovery Key
  const handleResetWithRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanedKey = recoveryKeyInput.trim();
    if (!cleanedKey) {
      setError(
        bi(
          'يرجى إدخال مفتاح الاسترداد لحالات الطوارئ.',
          'Please enter your Emergency Recovery Key.'
        )
      );
      return;
    }

    if (password.length < 10) {
      setError(
        bi(
          'يجب أن تتكون كلمة المرور الجديدة من 10 خانات على الأقل.',
          'New password must be at least 10 characters long.'
        )
      );
      return;
    }

    if (password !== confirmPassword) {
      setError(bi('كلمتا المرور غير متطابقتين.', 'Passwords do not match.'));
      return;
    }

    setLoading(true);
    try {
      const result = await resetPasswordWithRecovery(cleanedKey, password);
      // Present newly rotated recovery key to the clinician
      setActiveRecoveryKey(result.newRecoveryKeyFormatted);
      setRecoveryAcknowledged(false);
      setPassword('');
      setConfirmPassword('');
      setRecoveryKeyInput('');
      setMode('show_recovery_key');
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : bi('فشل استعادة الخزينة بمفتاح الاسترداد', 'Failed to reset password with recovery key')
      );
    } finally {
      setLoading(false);
    }
  };

  // Copy Recovery Key to Clipboard
  const handleCopyRecoveryKey = async () => {
    if (!activeRecoveryKey) return;
    try {
      await navigator.clipboard.writeText(activeRecoveryKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2500);
    } catch {
      // Fallback
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2500);
    }
  };

  // Confirm Wipe
  const handleWipe = async () => {
    if (resetInput !== bi('مسح', 'WIPE')) {
      setError(
        bi(
          'يرجى كتابة كلمة "مسح" لتأكيد إعادة التعيين.',
          'Please type "WIPE" to confirm reset.'
        )
      );
      return;
    }
    setLoading(true);
    try {
      await wipeDatabase();
      setMode('setup');
      setPassword('');
      setConfirmPassword('');
      setResetInput('');
      setError(
        bi(
          'تم مسح قاعدة البيانات بنجاح. يمكنك الآن ضبط كلمة مرور جديدة.',
          'Database wiped successfully. You can now set a new password.'
        )
      );
    } catch (err: unknown) {
      setError(
        bi('حدث خطأ أثناء مسح قاعدة البيانات: ', 'Error during wipe: ') +
          (err instanceof Error ? err.message : String(err))
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center p-4 selection:bg-teal-500 selection:text-white relative transition-colors"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Top Right Utility Controls: Theme + Language */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex items-center gap-2">
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer shadow-2xs"
          title="Toggle Theme"
        >
          {theme === 'light' ? (
            <Moon className="w-4 h-4 text-slate-600" />
          ) : (
            <Sun className="w-4 h-4 text-amber-400" />
          )}
        </button>

        <button
          type="button"
          onClick={toggleLanguage}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all border border-slate-200 dark:border-slate-800 shadow-2xs cursor-pointer"
        >
          <Globe className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
          <span>{language === 'ar' ? 'English' : 'العربية'}</span>
        </button>
      </div>

      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800">
        {/* Header Icon & Title */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-teal-600 flex items-center justify-center text-white mb-3 shadow-md shadow-teal-600/20">
            {mode === 'show_recovery_key' ? (
              <ShieldCheck className="w-7 h-7" />
            ) : mode === 'reset_password' ? (
              <Key className="w-7 h-7" />
            ) : (
              <Activity className="w-7 h-7" />
            )}
          </div>
          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 mb-2">
            {bi('تشفير محلي (AES-256-GCM)', 'Local AES-256-GCM Encryption')}
          </span>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {mode === 'show_recovery_key'
              ? bi('مفتاح الاسترداد لحالات الطوارئ', 'Emergency Recovery Key')
              : mode === 'reset_password'
              ? bi('استعادة الخزينة وتعيين كلمة المرور', 'Reset Password via Recovery Key')
              : mode === 'wipe'
              ? bi('مسح قاعدة البيانات الشامل', 'Wipe Clinical Database')
              : isInitialized
              ? bi('الخزينة السريرية مقفلة', 'Clinical Vault Locked')
              : bi('تهيئة نظام PhysioRecord', 'Initialize PhysioRecord')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {mode === 'show_recovery_key'
              ? bi(
                  'احفظ هذا المفتاح الآن. لن يظهر لك مرة أخرى بعد مغادرة هذه الشاشة.',
                  'Save this master recovery key now. It will not be shown again.'
                )
              : mode === 'reset_password'
              ? bi(
                  'أدخل مفتاح الاسترداد المكون من 32 حرفاً لتعيين كلمة مرور جديدة دون فقدان السجلات',
                  'Enter your 32-character recovery key to set a new password without losing data'
                )
              : mode === 'wipe'
              ? bi(
                  'تحذير: سيتم حذف كافة السجلات محلياً وبشكل نهائي وغير قابل للاسترجاع',
                  'Warning: All records will be permanently deleted from local device'
                )
              : isInitialized
              ? bi(
                  'أدخل كلمة المرور لفك تشفير والوصول إلى سجلات المرضى',
                  'Enter password to decrypt and access patient records'
                )
              : bi(
                  'قم بضبط كلمة مرور قوية (10 خانات كحد أدنى) لتشفير السجلات محلياً',
                  'Set a strong password (minimum 10 characters) to encrypt records locally'
                )}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400 mt-0.5" />
            <div className="leading-relaxed">{error}</div>
          </div>
        )}

        {/* VIEW 1: ONE-TIME EMERGENCY RECOVERY KEY DISPLAY */}
        {mode === 'show_recovery_key' && (
          <div className="space-y-4">
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-amber-900 dark:text-amber-200 text-xs leading-relaxed flex items-start gap-2.5">
              <ShieldAlert className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div>
                <p className="font-bold mb-1">
                  {bi('تنبيه أمني وإجراء إلزامي:', 'Mandatory Clinical Security Notice:')}
                </p>
                <p>
                  {bi(
                    'هذا المفتاح هو وسيلتك الوحيدة لاسترجاع الوصول إلى سجلات مرضاك في حال نسيان كلمة المرور. لن يتم تخزين هذا المفتاح كنص صريح ولن تتمكن من رؤيته مرة أخرى.',
                    'This key is your only way to restore access to patient charts if you forget your password. It is never stored in plaintext and cannot be shown again.'
                  )}
                </p>
              </div>
            </div>

            {/* Formatted Monospace Recovery Key Card */}
            <div className="p-4 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-2">
                {bi('مفتاح الاسترداد (Base32 - 160 بت من الأمان العالي):', 'Master Recovery Key (Base32 - 160-bit CSPRNG entropy):')}
              </label>
              <div
                className="font-mono text-sm sm:text-base font-bold text-teal-700 dark:text-teal-300 tracking-wider text-center p-3 bg-white dark:bg-slate-900 rounded-lg border border-teal-200 dark:border-teal-800/60 select-all break-all"
                dir="ltr"
              >
                {activeRecoveryKey}
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={handleCopyRecoveryKey}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  {copiedKey ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span className="text-emerald-600 dark:text-emerald-400">
                        {bi('تم النسخ بنجاح', 'Copied!')}
                      </span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>{bi('نسخ المفتاح للحافظة', 'Copy Key')}</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Acknowledgment Checkbox */}
            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 cursor-pointer">
              <input
                type="checkbox"
                checked={recoveryAcknowledged}
                onChange={(e) => setRecoveryAcknowledged(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
              />
              <span className="text-xs text-slate-700 dark:text-slate-300 select-none">
                <strong>
                  {bi(
                    'أقر بأنني قمت بنسخ وحفظ مفتاح الاسترداد في مكان آمن وخارجي (مثل مدير كلمات المرور أو طباعته ورقياً)، وأدرك أنه لا يمكن استرجاع السجلات عند فقدانه.',
                    'I acknowledge that I have copied and securely stored this recovery key outside this device, and I understand that data cannot be recovered if both password and key are lost.'
                  )}
                </strong>
              </span>
            </label>

            {/* Continue to App Button */}
            <button
              type="button"
              disabled={!recoveryAcknowledged}
              onClick={() => {
                setActiveRecoveryKey('');
                setRecoveryAcknowledged(false);
              }}
              className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{bi('متابعة إلى النظام السريري', 'Continue to Clinical System')}</span>
              {isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        )}

        {/* VIEW 2: STANDARD UNLOCK */}
        {mode === 'unlock' && (
          <form onSubmit={handleUnlock} className="space-y-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
              <p>
                <strong>{bi('إشعار الأمان والبيانات:', 'Security & Data Notice:')}</strong>{' '}
                {bi(
                  'البيانات محفوظة على هذا الجهاز فقط ولا توجد خوادم سحابية. فقدان كلمة المرور ومفتاح الاسترداد يعني فقدان البيانات بشكل دائم.',
                  'Data never leaves this device; no cloud backup exists. Lost password + lost recovery key = permanent irreversible data loss.'
                )}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {bi('كلمة مرور الخزينة', 'Vault Password')}
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-teal-500 transition-all pr-10 text-slate-900 dark:text-white text-left font-mono text-sm"
                  dir="ltr"
                />
                <KeyRound className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{bi('جاري فك التشفير والتحقق...', 'Decrypting and verifying...')}</span>
                </>
              ) : (
                <>
                  <Unlock className="w-4 h-4" />
                  <span>{bi('فتح الخزينة والوصول للسجلات', 'Unlock Vault & Access Records')}</span>
                </>
              )}
            </button>

            {/* Navigation to Recovery Reset */}
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setPassword('');
                  setConfirmPassword('');
                  setRecoveryKeyInput('');
                  setMode('reset_password');
                }}
                className="text-xs text-teal-600 dark:text-teal-400 hover:underline font-bold transition-colors cursor-pointer inline-flex items-center gap-1.5"
              >
                <Key className="w-3.5 h-3.5" />
                <span>
                  {bi(
                    'هل نسيت كلمة المرور؟ استعادة الوصول عبر مفتاح الاسترداد',
                    'Forgot password? Recover with Emergency Recovery Key'
                  )}
                </span>
              </button>
            </div>
          </form>
        )}

        {/* VIEW 3: INITIAL SETUP FORM */}
        {mode === 'setup' && (
          <form onSubmit={handleSetup} className="space-y-4">
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-amber-900 dark:text-amber-200 text-xs leading-relaxed flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <span>
                <strong>{bi('تنبيه أمني وإشعار البيانات:', 'Important Security Notice:')}</strong>{' '}
                {bi(
                  'يتم تشفير هذه الخزينة محلياً داخل المتصفح بـ AES-256-GCM واشتقاق مفاتيح PBKDF2 (600,000 دورة). لا توجد نسخة احتياطية سحابية، وسيتم إنشاء مفتاح استرداد طارئ بعد ضبط كلمة المرور.',
                  'This vault is encrypted locally in your browser with AES-256-GCM and PBKDF2 (600,000 iterations). No cloud backup exists; an emergency recovery key will be generated for you.'
                )}
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {bi('اختر كلمة مرور قوية للخزينة', 'Choose a Strong Vault Password')}
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  autoFocus
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-teal-500 transition-all pr-10 text-slate-900 dark:text-white text-left font-mono text-sm"
                  dir="ltr"
                />
                <KeyRound className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                {bi('الحد الأدنى 10 خانات (يشترط أحرف وأرقام لضمان الأمان)', 'Minimum 10 characters')}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {bi('تأكيد كلمة المرور', 'Confirm Password')}
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-teal-500 transition-all pr-10 text-slate-900 dark:text-white text-left font-mono text-sm"
                  dir="ltr"
                />
                <KeyRound className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !password || !confirmPassword}
              className="w-full py-2.5 px-4 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{bi('جاري التوليد والتهيئة...', 'Initializing...')}</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>{bi('تهيئة الخزينة وتوليد مفتاح الاسترداد', 'Initialize Vault & Generate Recovery Key')}</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* VIEW 4: RESET PASSWORD USING EMERGENCY RECOVERY KEY */}
        {mode === 'reset_password' && (
          <form onSubmit={handleResetWithRecovery} className="space-y-4">
            <div className="p-3 bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900/60 rounded-xl text-teal-900 dark:text-teal-200 text-xs leading-relaxed flex items-start gap-2">
              <Key className="w-4 h-4 shrink-0 mt-0.5 text-teal-600 dark:text-teal-400" />
              <span>
                {bi(
                  'أدخل مفتاح الاسترداد لحالات الطوارئ (يمكن كتابته مع الفواصل أو بدونها)، متبوعاً بكلمة المرور الجديدة.',
                  'Enter your Emergency Recovery Key (with or without dashes), followed by your new password.'
                )}
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {bi('مفتاح الاسترداد لحالات الطوارئ', 'Emergency Recovery Key')}
              </label>
              <textarea
                required
                autoFocus
                rows={2}
                value={recoveryKeyInput}
                onChange={(e) => setRecoveryKeyInput(e.target.value)}
                placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX"
                className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-teal-500 transition-all text-slate-900 dark:text-white font-mono text-xs uppercase"
                dir="ltr"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {bi('كلمة المرور الجديدة للخزينة', 'New Vault Password')}
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-teal-500 transition-all text-slate-900 dark:text-white font-mono text-sm"
                dir="ltr"
              />
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                {bi('الحد الأدنى 10 خانات', 'Minimum 10 characters')}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 mb-1.5">
                {bi('تأكيد كلمة المرور الجديدة', 'Confirm New Password')}
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-teal-500 transition-all text-slate-900 dark:text-white font-mono text-sm"
                dir="ltr"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading || !recoveryKeyInput || !password || !confirmPassword}
                className="flex-1 py-2.5 px-4 bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold rounded-xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{bi('جاري فك التشفير والتدوير...', 'Recovering...')}</span>
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4" />
                    <span>{bi('استعادة الخزينة وتعيين كلمة المرور', 'Recover Vault')}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setPassword('');
                  setConfirmPassword('');
                  setRecoveryKeyInput('');
                  setMode('unlock');
                }}
                className="px-4 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                {bi('إلغاء', 'Cancel')}
              </button>
            </div>
          </form>
        )}

        {/* Reset / Wipe options */}
        {isInitialized && mode === 'unlock' && (
          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setMode('wipe');
              }}
              className="text-xs text-rose-500 hover:text-rose-600 hover:underline transition-colors cursor-pointer"
            >
              {bi(
                'مسح قاعدة البيانات الشامل والبدء من جديد (حذف نهائي)',
                'Permanently wipe local database and start fresh'
              )}
            </button>
          </div>
        )}

        {/* VIEW 5: WIPE CONFIRMATION */}
        {mode === 'wipe' && (
          <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-start space-y-3">
            <p className="text-xs font-bold text-rose-800 dark:text-rose-200">
              {bi(
                'تحذير أمني: سيتم حذف كافة سجلات المرضى والجلسات نهائياً دون إمكانية استرجاعها!',
                'Security Warning: All patient charts and sessions will be permanently destroyed!'
              )}
            </p>
            <p className="text-xs text-rose-600 dark:text-rose-300">
              {bi(
                'اكتب كلمة "مسح" في الحقل التالي لتأكيد الحذف الشامل:',
                'Type "WIPE" in the field below to confirm full reset:'
              )}
            </p>
            <input
              type="text"
              value={resetInput}
              onChange={(e) => setResetInput(e.target.value)}
              placeholder={bi('اكتب: مسح', 'Type: WIPE')}
              className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-rose-300 dark:border-rose-800 rounded-lg text-slate-900 dark:text-white focus:outline-none"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleWipe}
                disabled={resetInput !== bi('مسح', 'WIPE') || loading}
                className="flex-1 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-lg hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
              >
                {bi('تأكيد المسح الشامل', 'Confirm Wipe')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode(isInitialized ? 'unlock' : 'setup');
                  setResetInput('');
                }}
                className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs rounded-lg hover:bg-slate-300 cursor-pointer"
              >
                {bi('إلغاء', 'Cancel')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <footer className="mt-4 text-center text-xs text-slate-500 dark:text-slate-400">
        PhysioRecord —{' '}
        {bi(
          'جميع البيانات مشفرة ومحفوظة محلياً على جهازك',
          '100% Encrypted & Local-First Clinical EHR'
        )}
      </footer>
    </div>
  );
};
