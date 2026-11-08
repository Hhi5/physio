// =======================================================================
// PhysioRecord — Vault Lock & Setup Screen
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
} from 'lucide-react';

export const LockScreen: React.FC = () => {
  const { isInitialized, setupPassword, unlock, wipeDatabase } = useVault();
  const { language, toggleLanguage, bi, isRtl } = useLanguage();
  const { theme, toggleTheme } = useTheme();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetInput, setResetInput] = useState('');

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError(
        bi(
          'يجب أن تتكون كلمة المرور من 6 خانات على الأقل.',
          'Password must be at least 6 characters long.'
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
      await setupPassword(password);
    } catch (err: any) {
      setError(err?.message || bi('فشل ضبط كلمة المرور', 'Failed to set password'));
    } finally {
      setLoading(false);
    }
  };

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
    } catch (err: any) {
      setError(err?.message || bi('حدث خطأ أثناء فك التشفير', 'Error during decryption'));
    } finally {
      setLoading(false);
    }
  };

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
      setShowResetConfirm(false);
      setPassword('');
      setConfirmPassword('');
      setError(
        bi(
          'تم مسح قاعدة البيانات بنجاح. يمكنك الآن ضبط كلمة مرور جديدة.',
          'Database wiped successfully. You can now set a new password.'
        )
      );
    } catch (err: any) {
      setError(
        bi('حدث خطأ أثناء مسح قاعدة البيانات: ', 'Error during wipe: ') + err.message
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
            <Activity className="w-7 h-7" />
          </div>
          <span className="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-bold bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 mb-2">
            AES-256-GCM ZERO-KNOWLEDGE EHR
          </span>
          <h1 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {isInitialized
              ? bi('الخزينة السريرية مقفلة', 'Clinical Vault Locked')
              : bi('تهيئة نظام PhysioRecord', 'Initialize PhysioRecord')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {isInitialized
              ? bi(
                  'أدخل كلمة المرور لفك تشفير والوصول إلى سجلات المرضى',
                  'Enter password to decrypt and access patient records'
                )
              : bi(
                  'قم بضبط كلمة مرور الخزينة لحماية وتشفير سجلات المرضى محلياً',
                  'Set vault password to encrypt and protect records locally'
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

        {/* Unlock Form */}
        {isInitialized ? (
          <form onSubmit={handleUnlock} className="space-y-4">
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
                  placeholder="••••••••"
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
          </form>
        ) : (
          /* Initial Setup Form */
          <form onSubmit={handleSetup} className="space-y-4">
            <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-xl text-amber-900 dark:text-amber-200 text-xs leading-relaxed flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <span>
                <strong>{bi('تنبيه سريري هام:', 'Important Clinical Notice:')}</strong>{' '}
                {bi(
                  'تعتمد هذه الخزينة على معمارية المعرفة الصفرية. يتم تشفير كافة بيانات المرضى محلياً بـ AES-256-GCM.',
                  'This vault operates on zero-knowledge architecture. All patient data is encrypted locally with AES-256-GCM.'
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
                  placeholder="••••••••"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-teal-500 transition-all pr-10 text-slate-900 dark:text-white text-left font-mono text-sm"
                  dir="ltr"
                />
                <KeyRound className="w-4 h-4 text-slate-400 absolute right-3 top-3" />
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                {bi('الحد الأدنى 6 خانات (يفضل استخدام أحرف وأرقام ورموز)', 'Minimum 6 characters')}
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
                  placeholder="••••••••"
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
                  <span>{bi('تهيئة الخزينة وبدء الاستخدام', 'Initialize Vault')}</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Reset / Wipe options */}
        {isInitialized && (
          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 text-center">
            {!showResetConfirm ? (
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="text-xs text-rose-500 hover:text-rose-600 hover:underline transition-colors cursor-pointer"
              >
                {bi(
                  'هل نسيت كلمة المرور؟ أو تريد مسح قاعدة البيانات للبدء من جديد؟',
                  'Forgot password or need to reset the local database?'
                )}
              </button>
            ) : (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 rounded-xl text-start">
                <p className="text-xs font-bold text-rose-800 dark:text-rose-200 mb-1">
                  {bi(
                    'تحذير: سيتم حذف كافة المرضى والسجلات بشكل نهائي وغير قابل للاسترجاع!',
                    'Warning: All patients and clinical records will be permanently deleted!'
                  )}
                </p>
                <p className="text-xs text-rose-600 dark:text-rose-300 mb-2">
                  {bi(
                    'اكتب كلمة مسح في الحقل التالي للتأكيد:',
                    'Type WIPE to confirm database reset:'
                  )}
                </p>
                <input
                  type="text"
                  value={resetInput}
                  onChange={(e) => setResetInput(e.target.value)}
                  placeholder={bi('اكتب: مسح', 'Type: WIPE')}
                  className="w-full px-3 py-1.5 text-xs bg-white dark:bg-slate-950 border border-rose-300 dark:border-rose-800 rounded-lg mb-2 text-slate-900 dark:text-white focus:outline-none"
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
                      setShowResetConfirm(false);
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
