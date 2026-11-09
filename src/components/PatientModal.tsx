// =======================================================================
// PhysioRecord — Patient Creation & Editing Modal
// =======================================================================

import React, { useState, useEffect } from 'react';
import { usePatients } from '../context/PatientContext';
import { useLanguage } from '../context/LanguageContext';
import type { PatientClinicalData, PatientRecord, Gender, DominantHand } from '../types/clinical';
import { computePatientAge } from '../utils/date';
import { 
  X, 
  Save, 
  AlertTriangle, 
  User, 
  FileText, 
  ShieldAlert 
} from 'lucide-react';

interface PatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientToEdit?: PatientRecord | null;
  onSavedSuccess?: (patient: PatientRecord) => void;
}

export const PatientModal: React.FC<PatientModalProps> = ({
  isOpen,
  onClose,
  patientToEdit,
  onSavedSuccess,
}) => {
  const { savePatient } = usePatients();
  const { bi, isRtl } = useLanguage();

  // Tab navigation inside modal
  const [activeTab, setActiveTab] = useState<'general' | 'medical' | 'precautions'>('general');

  // Form State
  const [formData, setFormData] = useState<PatientClinicalData>({
    fullName: '',
    fullNameAr: '',
    dateOfBirth: '',
    age: undefined,
    gender: 'male',
    phoneNumber: '',
    address: '',
    occupation: '',
    dominantHand: 'right',
    medicalHistory: '',
    previousSurgeries: '',
    currentMedications: '',
    allergies: '',
    comorbidities: '',
    precautions: '',
    redFlags: '',
    psychosocialFactors: '',
    generalNotes: '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patientToEditId = patientToEdit?.id ?? null;

  // Initialize form when opening or editing
  useEffect(() => {
    if (!isOpen) return;

    if (patientToEdit) {
      setFormData({ ...patientToEdit.data });
    } else {
      setFormData({
        fullName: '',
        fullNameAr: '',
        dateOfBirth: '',
        age: undefined,
        gender: 'male',
        phoneNumber: '',
        address: '',
        occupation: '',
        dominantHand: 'right',
        medicalHistory: '',
        previousSurgeries: '',
        currentMedications: '',
        allergies: '',
        comorbidities: '',
        precautions: '',
        redFlags: '',
        psychosocialFactors: '',
        generalNotes: '',
      });
    }
    setActiveTab('general');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, patientToEditId]);

  // Calculate age automatically when DOB changes
  const handleDobChange = (dob: string) => {
    const calculatedAge = computePatientAge(dob, undefined);
    setFormData(prev => ({
      ...prev,
      dateOfBirth: dob,
      age: dob ? calculatedAge : prev.age,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.fullName.trim() && !formData.fullNameAr?.trim()) {
      setError('يرجى إدخال اسم المريض (بالعربية أو الإنجليزية).');
      setActiveTab('general');
      return;
    }

    setSaving(true);
    try {
      // Stamp the profile summary edit timestamp before saving.
      // This timestamp records when this demographic/medical background summary was last updated.
      // It is NOT a clinical measurement record — session-level ROM/MMT measurements are Phase 2.
      const computedAgeFromDob = computePatientAge(formData.dateOfBirth, formData.age);
      const stampedFormData: PatientClinicalData = {
        ...formData,
        age: formData.dateOfBirth ? computedAgeFromDob : formData.age,
        profileSummaryUpdatedAt: new Date().toISOString(),
      };
      const saved = await savePatient(stampedFormData, patientToEdit?.id);
      if (onSavedSuccess) onSavedSuccess(saved);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'فشل حفظ بيانات المريض.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex justify-center items-center p-4" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden border border-slate-100 flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {patientToEdit ? bi('تعديل الملف السريري للمريض', 'Edit Patient Clinical Profile') : bi('تسجيل مريض جديد', 'New Patient Registration')}
            </h2>
            <p className="text-xs text-slate-500">
              {patientToEdit
                ? 'تعديل الملخص السريري الديموغرافي — قياسات ROM/MMT المتسلسلة تُسجَّل في جلسات المرحلة الثانية'
                : 'كافة البيانات تُشفر محلياً بـ AES-256-GCM قبل حفظها في المتصفح'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tabs */}
        <div className="px-6 pt-3 flex gap-2 border-b border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            className={`pb-3 px-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'general'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-4 h-4" />
            <span>{bi('البيانات الأساسية', 'Demographics')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('medical')}
            className={`pb-3 px-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'medical'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>{bi('التاريخ الطبي والجراحي', 'Medical History')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('precautions')}
            className={`pb-3 px-3 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'precautions'
                ? 'border-rose-600 text-rose-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>{bi('المحاذير والأعلام الحمراء', 'Precautions & Red Flags')}</span>
            {Boolean(formData.redFlags?.trim()) && (
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            )}
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: General Info */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    اسم المريض بالعربية <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.fullNameAr || ''}
                    onChange={(e) => setFormData({ ...formData, fullNameAr: e.target.value })}
                    placeholder="مثال: أحمد بن فهد الشمري"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Full Name (English)
                  </label>
                  <input
                    type="text"
                    value={formData.fullName || ''}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="e.g. Ahmed Al-Shammari"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-left font-sans"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {bi('تاريخ الميلاد', 'Date of Birth')}
                  </label>
                  <input
                    type="date"
                    value={formData.dateOfBirth || ''}
                    onChange={(e) => handleDobChange(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    العمر (سنوات)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="125"
                    value={formData.age !== undefined ? formData.age : ''}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value ? parseInt(e.target.value, 10) : undefined })}
                    placeholder="يُحسب تلقائياً أو يُدخل يدوياً"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {bi('الجنس', 'Gender')}
                  </label>
                  <select
                    value={formData.gender}
                    onChange={(e) => setFormData({ ...formData, gender: e.target.value as Gender })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    <option value="male">ذكر</option>
                    <option value="female">أنثى</option>
                    <option value="other">أخرى</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {bi('رقم الهاتف', 'Phone Number')}
                  </label>
                  <input
                    type="tel"
                    value={formData.phoneNumber || ''}
                    onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                    placeholder="05XXXXXXXX"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 text-left"
                    dir="ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    المهنة ونمط العمل
                  </label>
                  <input
                    type="text"
                    value={formData.occupation || ''}
                    onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
                    placeholder="مثال: موظف مكتبي، معلم، رياضي"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    اليد المهيمنة
                  </label>
                  <select
                    value={formData.dominantHand}
                    onChange={(e) => setFormData({ ...formData, dominantHand: e.target.value as DominantHand })}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
                  >
                    <option value="right">{bi('اليمنى', 'Right')}</option>
                    <option value="left">{bi('اليسرى', 'Left')}</option>
                    <option value="ambidextrous">كلتا اليدين (Ambidextrous)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {bi('عنوان السكن', 'Residential Address')} (اختياري)
                </label>
                <input
                  type="text"
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="المدينة — الحي"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          )}

          {/* TAB 2: Medical History */}
          {activeTab === 'medical' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  التاريخ المرضي العام وطبيعة الشكوى الحالية
                </label>
                <textarea
                  rows={3}
                  value={formData.medicalHistory || ''}
                  onChange={(e) => setFormData({ ...formData, medicalHistory: e.target.value })}
                  placeholder="وصف الإصابة، آلية الحدوث، التاريخ الزمني، التشخيص الأولي..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    العمليات الجراحية السابقة
                  </label>
                  <textarea
                    rows={2}
                    value={formData.previousSurgeries || ''}
                    onChange={(e) => setFormData({ ...formData, previousSurgeries: e.target.value })}
                    placeholder="أي جراحات سابقة مع تواريخها..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {bi('الأدوية الحالية المستمرة', 'Current Medications')}
                  </label>
                  <textarea
                    rows={2}
                    value={formData.currentMedications || ''}
                    onChange={(e) => setFormData({ ...formData, currentMedications: e.target.value })}
                    placeholder="المسكنات، مميعات الدم، أدوية الضغط..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {bi('الحساسية المعروفة', 'Known Allergies')}
                  </label>
                  <input
                    type="text"
                    value={formData.allergies || ''}
                    onChange={(e) => setFormData({ ...formData, allergies: e.target.value })}
                    placeholder="حساسية دوائية، لاصقات طبية، لاتكس..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {bi('الأمراض المصاحبة', 'Comorbidities')}
                  </label>
                  <input
                    type="text"
                    value={formData.comorbidities || ''}
                    onChange={(e) => setFormData({ ...formData, comorbidities: e.target.value })}
                    placeholder="سكري، ضغط، هشاشة عظام، قلب..."
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Precautions & Red Flags */}
          {activeTab === 'precautions' && (
            <div className="space-y-4">
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl">
                <label className="block text-xs font-bold text-rose-800 mb-1 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <span>{bi('الأعلام الحمراء (تستدعي تحويلاً أو إيقافاً فورياً)', 'Red Flags (Immediate Medical Referral / Contraindication)')}</span>
                </label>
                <textarea
                  rows={2}
                  value={formData.redFlags || ''}
                  onChange={(e) => setFormData({ ...formData, redFlags: e.target.value })}
                  placeholder="مثال: اشتباه DVT، متلازمة ذيل الفرس (Cauda Equina)، ألم صدري غير مستقر، اضطراب عصبي تصاعدي مفاجئ..."
                  className="w-full px-3 py-2 rounded-xl border border-rose-300 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {bi('المحاذير وموانع العلاج أثناء التأهيل', 'Clinical Precautions & Contraindications')}
                </label>
                <textarea
                  rows={2}
                  value={formData.precautions || ''}
                  onChange={(e) => setFormData({ ...formData, precautions: e.target.value })}
                  placeholder="مثال: قيود تحميل الوزن، محاذير التواء الكتف، محاذير عظم القص بعد الجراحة..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {bi('العوامل النفسية الاجتماعية والبيئية', 'Psychosocial Factors & Yellow Flags')}
                </label>
                <textarea
                  rows={2}
                  value={formData.psychosocialFactors || ''}
                  onChange={(e) => setFormData({ ...formData, psychosocialFactors: e.target.value })}
                  placeholder="مستوى الدافعية، مخاوف الحركة (Kinesiophobia)، الدعم الأسري، ضغوط العمل..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {bi('ملاحظات عامة للمعالج', 'General Clinical Notes')}
                </label>
                <textarea
                  rows={2}
                  value={formData.generalNotes || ''}
                  onChange={(e) => setFormData({ ...formData, generalNotes: e.target.value })}
                  placeholder="أي توجيهات أو ملاحظات إضافية..."
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          )}

          {/* Modal Footer Controls */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
            >
              إلغاء
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-all shadow-md shadow-primary-600/20 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? bi('جاري التشفير والحفظ...', 'Encrypting & Saving...') : bi('حفظ بيانات المريض', 'Save Patient Record')}</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
