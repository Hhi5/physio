// =======================================================================
// PhysioRecord — Interactive Clinical Reference Toolkit Modal (Phase 2C)
// High Z-Index (z-[70]) Overlay Modal Supporting Seamless Cross-Modal Reference
// =======================================================================

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { DermatomesMapTab } from './DermatomesMapTab';
import { MyotomesTab } from './MyotomesTab';
import { DtrReferenceTab } from './DtrReferenceTab';
import { X, Layers, Activity, Stethoscope, ShieldCheck, BookOpen } from 'lucide-react';

export type ToolkitTabId = 'dermatomes' | 'myotomes' | 'dtr';

interface ClinicalToolkitModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: ToolkitTabId;
}

export const ClinicalToolkitModal: React.FC<ClinicalToolkitModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'dermatomes',
}) => {
  const { isRtl, language } = useLanguage();
  const isAr = language === 'ar';

  const [activeTab, setActiveTab] = useState<ToolkitTabId>(initialTab);

  // Sync tab if initialTab changes when opening
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // Handle ESC key press to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[70] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/70 backdrop-blur-xs overflow-y-auto"
      dir={isRtl ? 'rtl' : 'ltr'}
      role="dialog"
      aria-modal="true"
      aria-labelledby="toolkit-modal-title"
    >
      <div 
        className="w-full max-w-5xl my-auto bg-slate-50 dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[94vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* Header Bar */}
        <div className="bg-white dark:bg-slate-850 px-5 sm:px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 flex-shrink-0">
          
          {/* Title and Icon */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-600 text-white flex items-center justify-center shadow-md shadow-primary-600/30 flex-shrink-0">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="toolkit-modal-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {isAr ? 'المراجع السريرية التفاعلية' : 'Interactive Clinical Reference Toolkit'}
                </h2>
                <span className="hidden sm:inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-950 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800">
                  Phase 2C — Milestone 1
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isAr ? 'دليل الفحص العصبي الشامل: القطاعات الجلدية، العضلية، والمنعكسات الوترية العميقة' : 'Comprehensive Neurological Reference: Dermatomes, Myotomes & Deep Tendon Reflexes'}
              </p>
            </div>
          </div>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            title={isAr ? 'إغلاق المرجع (Esc)' : 'Close toolkit (Esc)'}
            className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 flex items-center justify-center transition-colors flex-shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher Navigation */}
        <div className="bg-slate-100/80 dark:bg-slate-800/80 px-4 sm:px-6 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 overflow-x-auto flex-shrink-0">
          <div className="flex items-center gap-2">
            
            {/* Dermatomes Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('dermatomes')}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'dermatomes'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>{isAr ? 'خريطة القطاعات الجلدية (Dermatomes)' : 'Dermatomes Map'}</span>
            </button>

            {/* Myotomes Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('myotomes')}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'myotomes'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
            >
              <Activity className="w-4 h-4" />
              <span>{isAr ? 'القطاعات العضلية (Myotomes)' : 'Myotomes Reference'}</span>
            </button>

            {/* DTR Tab */}
            <button
              type="button"
              onClick={() => setActiveTab('dtr')}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap ${
                activeTab === 'dtr'
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
              }`}
            >
              <Stethoscope className="w-4 h-4" />
              <span>{isAr ? 'المنعكسات الوترية العميقة (DTR)' : 'Deep Tendon Reflexes'}</span>
            </button>

          </div>

          <div className="hidden lg:flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <BookOpen className="w-3.5 h-3.5 text-primary-600" />
            <span>{isAr ? 'مراجع مفتوحة ومتاحة محلياً' : 'Local Offline Clinical Reference'}</span>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {activeTab === 'dermatomes' && <DermatomesMapTab />}
          {activeTab === 'myotomes' && <MyotomesTab />}
          {activeTab === 'dtr' && <DtrReferenceTab />}
        </div>

        {/* Scientific Sources & Verification Footer */}
        <div className="bg-white dark:bg-slate-850 px-5 sm:px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400 flex-shrink-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>
              {isAr
                ? 'المعايير المعتمدة: ASIA / ISNCSCI (2025) • Foerster (1933) • Lee et al. (2008) • Kendall (5th Ed) • NINDS Guidelines'
                : 'Validated Standards: ASIA / ISNCSCI (2025) • Foerster (1933) • Lee et al. (2008) • Kendall (5th Ed) • NINDS Guidelines'}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            {isAr ? 'إغلاق المرجع' : 'Close'}
          </button>
        </div>

      </div>
    </div>
  );
};
