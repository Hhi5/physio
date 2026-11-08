// =======================================================================
// PhysioRecord — Application Navbar
// =======================================================================

import React from 'react';
import { useVault } from '../context/VaultContext';
import { usePatients } from '../context/PatientContext';
import { useLanguage } from '../context/LanguageContext';
import { 
  Activity, 
  Lock, 
  ShieldCheck, 
  CloudOff, 
  Database,
  Users,
  Globe
} from 'lucide-react';

interface NavbarProps {
  onOpenSyntheticModal: () => void;
  onOpenPatientModal: () => void;
  onOpenBackupModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenSyntheticModal,
  onOpenPatientModal,
  onOpenBackupModal,
}) => {
  const { lock } = useVault();
  const { patients } = usePatients();
  const { language, toggleLanguage, t } = useLanguage();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-600 flex items-center justify-center text-white shadow-md shadow-primary-600/30">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">{t('appName')}</h1>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary-50 text-primary-700 border border-primary-200">
                {t('clinicBadge')}
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              {t('appSubtitle')}
            </p>
          </div>
        </div>

        {/* Security & Local Status Badges */}
        <div className="hidden md:flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>{t('encryptedLocalBadge')}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
            <CloudOff className="w-3.5 h-3.5 text-slate-500" />
            <span>{t('noCloudBadge')}</span>
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-primary-50 text-primary-700 border border-primary-200">
            <Users className="w-3.5 h-3.5 text-primary-600" />
            <span>{patients.length} {t('patientCountBadge')}</span>
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Language Toggle Button (Bilingual Support: AR / EN) */}
          <button
            type="button"
            onClick={toggleLanguage}
            title={language === 'ar' ? 'Switch to English' : 'التحويل إلى العربية'}
            className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200"
          >
            <Globe className="w-3.5 h-3.5 text-primary-600" />
            <span className="font-semibold">{language === 'ar' ? 'English' : 'العربية'}</span>
          </button>

          {/* Add Synthetic Data Button */}
          <button
            type="button"
            onClick={onOpenSyntheticModal}
            title="إضافة حالات سريرية تجريبية للاختبار"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200"
          >
            <Database className="w-3.5 h-3.5 text-slate-500" />
            <span>{t('syntheticData')}</span>
          </button>

          {/* Backup and Restore Button */}
          <button
            type="button"
            onClick={onOpenBackupModal}
            title="إدارة النسخ الاحتياطي والاستعادة المشفرة (.ptbackup)"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors border border-slate-200"
          >
            <Database className="w-3.5 h-3.5 text-primary-600" />
            <span className="hidden md:inline">{t('backupRestore')}</span>
          </button>

          {/* New Patient Button */}
          <button
            type="button"
            onClick={onOpenPatientModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 active:bg-primary-800 transition-all shadow-sm shadow-primary-600/20"
          >
            <span>{t('newPatient')}</span>
          </button>

          {/* Lock Vault Button */}
          <button
            type="button"
            onClick={lock}
            title="قفل الخزينة فوراً ومسح الذاكرة"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-all"
          >
            <Lock className="w-4 h-4 text-slate-500 group-hover:text-rose-600" />
            <span className="hidden sm:inline">{t('lockVault')}</span>
          </button>
        </div>

      </div>
    </header>
  );
};
