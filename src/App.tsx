// =======================================================================
// PhysioRecord — Next-Gen Main Application Root Component
// Mounting Providers, ThemeProvider, Vault Lock Gate, and Clinical AppLayout
// =======================================================================

import React from 'react';
import { VaultProvider, useVault } from './context/VaultContext';
import { PatientProvider } from './context/PatientContext';
import { EpisodeProvider } from './context/EpisodeContext';
import { SessionProvider } from './context/SessionContext';
import { LanguageProvider, useLanguage } from './context/LanguageContext';
import { ThemeProvider } from './context/ThemeContext';
import { LockScreen } from './components/LockScreen';
import { AppLayout } from './components/layout/AppLayout';
import { RefreshCw } from 'lucide-react';

const AppContent: React.FC = () => {
  const { ready, isLocked } = useVault();
  const { language, isRtl } = useLanguage();
  const isAr = language === 'ar';

  // Still initializing IndexedDB vault metadata
  if (!ready) {
    return (
      <div
        className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-center items-center text-slate-900 dark:text-white transition-colors"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        <RefreshCw className="w-8 h-8 text-teal-600 dark:text-teal-400 animate-spin mb-3" />
        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
          {isAr
            ? 'جاري فحص الخزينة المشفرة والتحقق من التخزين المحلي...'
            : 'Initializing local encrypted vault...'}
        </p>
      </div>
    );
  }

  // Vault is locked -> Show Lock Screen
  if (isLocked) {
    return <LockScreen />;
  }

  // Vault is unlocked -> Show Main Next-Gen EHR Layout
  return <AppLayout />;
};

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <VaultProvider>
          <PatientProvider>
            <EpisodeProvider>
              <SessionProvider>
                <AppContent />
              </SessionProvider>
            </EpisodeProvider>
          </PatientProvider>
        </VaultProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
