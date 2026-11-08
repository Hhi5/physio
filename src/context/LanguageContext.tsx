// =======================================================================
// PhysioRecord — Language & Internationalization Context (v2.0)
// Full Bilingual Support: Arabic (Default, RTL) & English (LTR)
// Standard Clinical Terminology with Zero Dual-Language Clutter
// =======================================================================

import React, { createContext, useContext, useState, useEffect } from 'react';

export type SupportedLanguage = 'ar' | 'en';

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => void;
  toggleLanguage: () => void;
  isRtl: boolean;
  t: (key: string) => string;
  bi: (arText: string, enText: string) => string;
}

const translations: Record<SupportedLanguage, Record<string, string>> = {
  ar: {
    // Brand & App
    appName: 'PhysioRecord',
    appSubtitle: 'نظام إدارة المرضى والتوثيق السريري للعلاج الطبيعي',
    clinicBadge: 'العيادة الذكية',
    encryptedLocalBadge: 'مشفر محلياً AES-256',
    noCloudBadge: 'محلي 100% بدون سحابة',
    patientCountBadge: 'مريض',

    // Nav Controls
    syntheticData: 'بيانات تجريبية',
    backupRestore: 'النسخ والاستعادة',
    newPatient: '+ مريض جديد',
    lockVault: 'قفل الخزينة',

    // Body Chart & Symptoms
    bodyChartTitle: 'مخطط أعراض المريض',
    bodyChartBadge: 'مخطط الجسم',
    bodyChartPoints: 'مواضع محددة',
    symptomSharp: 'ألم حاد / طاعن',
    symptomDull: 'ألم كليل / عميق',
    symptomNumbness: 'خدر / نقص إحساس',
    symptomTingling: 'وخز وتنميل عصبي',
    symptomBurning: 'ألم حارق',
    symptomStiffness: 'تيبّس وشد عضلي',

    // Directory
    directoryTitle: 'سجل المرضى السريري',
    directorySubtitle: 'إدارة وتوثيق ملفات المرضى وحلقات الرعاية السريرية',
    activeTab: 'المرضى النشطون',
    archivedTab: 'السجلات المؤرشفة',
    searchPlaceholder: 'بحث باسم المريض، رقم الهاتف، أو التشخيص الطبي...',
    noPatientsFound: 'لم يتم العثور على مرضى مطابقين للبحث',
    emptyActiveTitle: 'لا يوجد مرضى نشطون مسجلون حالياً',
    emptyActiveDesc: 'ابدأ بإضافة مريض جديد أو إدراج حالات تجريبية لاختبار المنظومة السريرية.',
    emptyArchivedTitle: 'لا توجد سجلات مؤرشفة',
    emptyArchivedDesc: 'يمكنك أرشفة ملفات المرضى الذين أتموا خططهم العلاجية للرجوع إليها مستقبلاً.',

    // Patient Card
    archiveAction: 'أرشفة',
    unarchiveAction: 'استعادة للنشطين',
    deleteAction: 'حذف نهائي',
    openProfile: 'فتح الملف السريري',
    ageYears: 'سنة',
    genderMale: 'ذكر',
    genderFemale: 'أنثى',
    genderOther: 'آخر',

    // Profile
    backToDirectory: 'العودة لقائمة المرضى',
    patientProfileTitle: 'الملف السريري للمريض',
    editPatient: 'تعديل البيانات',
    medicalHistory: 'التاريخ المرضي وطبيعة الإصابة',
    currentMedications: 'الأدوية الحالية المستمرة',
    previousSurgeries: 'العمليات الجراحية السابقة',
    allergies: 'الحساسية والمحاذير',
    precautionsRedFlags: 'علامات حمراء ومحاذير حرجة',
    generalNotes: 'ملاحظات عامة',
    careEpisodesTitle: 'حلقات الرعاية السريرية',
    clinicalSessionsTitle: 'سجل الجلسات وتوثيق المتابعة',
    newEpisodeBtn: 'بدء حلقة رعاية جديدة',

    // Backup & Restore
    backupTitle: 'إدارة النسخ الاحتياطي والاستعادة المشفرة',
    exportTab: 'تصدير نسخة احتياطية',
    restoreTab: 'استعادة وتحديث قاعدة البيانات',
  },
  en: {
    // Brand & App
    appName: 'PhysioRecord',
    appSubtitle: 'Local-First Clinical Physical Therapy EHR System',
    clinicBadge: 'Smart Clinic',
    encryptedLocalBadge: 'Encrypted at Rest AES-256',
    noCloudBadge: '100% Local / Zero Cloud',
    patientCountBadge: 'Patients',

    // Nav Controls
    syntheticData: 'Sample Data',
    backupRestore: 'Backup & Restore',
    newPatient: '+ New Patient',
    lockVault: 'Lock Vault',

    // Body Chart & Symptoms
    bodyChartTitle: 'Patient Body Chart',
    bodyChartBadge: 'Body Chart',
    bodyChartPoints: 'points marked',
    symptomSharp: 'Sharp / Lancinating Pain',
    symptomDull: 'Dull / Aching Pain',
    symptomNumbness: 'Numbness / Hypoesthesia',
    symptomTingling: 'Tingling / Paresthesia',
    symptomBurning: 'Burning / Dysesthesia',
    symptomStiffness: 'Stiffness / Tightness',

    // Directory
    directoryTitle: 'Clinical Patient Directory',
    directorySubtitle: 'Manage clinical records, episodes of care, and treatment plans',
    activeTab: 'Active Patients',
    archivedTab: 'Archived Records',
    searchPlaceholder: 'Search by patient name, phone number, or clinical condition...',
    noPatientsFound: 'No patients found matching your search',
    emptyActiveTitle: 'No Active Patients Registered',
    emptyActiveDesc: 'Start by adding a new patient record or inserting synthetic clinical cases.',
    emptyArchivedTitle: 'No Archived Records',
    emptyArchivedDesc: 'You can archive completed rehabilitation records to keep your active directory organized.',

    // Patient Card
    archiveAction: 'Archive',
    unarchiveAction: 'Restore to Active',
    deleteAction: 'Delete Permanently',
    openProfile: 'Open Clinical Profile',
    ageYears: 'yrs',
    genderMale: 'Male',
    genderFemale: 'Female',
    genderOther: 'Other',

    // Profile
    backToDirectory: 'Back to Directory',
    patientProfileTitle: 'Patient Clinical Profile',
    editPatient: 'Edit Information',
    medicalHistory: 'Medical & Injury History',
    currentMedications: 'Current Medications',
    previousSurgeries: 'Previous Surgeries',
    allergies: 'Allergies & Known Sensitivities',
    precautionsRedFlags: 'Critical Red Flags & Precautions',
    generalNotes: 'General Notes',
    careEpisodesTitle: 'Episodes of Care',
    clinicalSessionsTitle: 'Clinical Sessions & Follow-up Log',
    newEpisodeBtn: 'Start New Episode',

    // Backup & Restore
    backupTitle: 'Encrypted Backup & Restoration Management',
    exportTab: 'Export Encrypted Backup',
    restoreTab: 'Restore & Activate Database',
  },
};

const LanguageContext = createContext<LanguageContextType | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<SupportedLanguage>(() => {
    try {
      const saved = localStorage.getItem('physiorecord_language');
      if (saved === 'en' || saved === 'ar') return saved;
    } catch {
      // Ignore
    }
    return 'ar';
  });

  const isRtl = language === 'ar';

  const setLanguage = (lang: SupportedLanguage) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('physiorecord_language', lang);
    } catch {
      // Ignore
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  };

  useEffect(() => {
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = language;
  }, [language, isRtl]);

  const t = (key: string): string => {
    return translations[language][key] || translations['ar'][key] || key;
  };

  const bi = (arText: string, enText: string): string => {
    return language === 'ar' ? arText : enText;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, toggleLanguage, isRtl, t, bi }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
