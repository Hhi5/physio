// =======================================================================
// PhysioRecord — Patient Creation & Editing Slide-over Drawer (Phase 4)
// Includes Demographics, Referring Physician, Emergency Contact & Clinical Alerts
// =======================================================================

import React, { useState, useEffect } from 'react';
import { Drawer } from '../layout/Drawer';
import { usePatients } from '../../context/PatientContext';
import { useLanguage } from '../../context/LanguageContext';
import { ClinicOperationsService } from '../../services/clinicOperationsService';
import type { PatientClinicalData, PatientRecord } from '../../types/clinical';
import { Save, ShieldAlert, UserCheck } from 'lucide-react';

interface PatientDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  patientToEdit?: PatientRecord | null;
  onSavedSuccess?: (patient: PatientRecord) => void;
}

export const PatientDrawer: React.FC<PatientDrawerProps> = ({
  isOpen,
  onClose,
  patientToEdit,
  onSavedSuccess,
}) => {
  const { savePatient } = usePatients();
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const [formData, setFormData] = useState<PatientClinicalData>({
    fullName: '',
    fullNameAr: '',
    dateOfBirth: '',
    gender: 'male',
    phoneNumber: '',
    occupation: '',
    referringPhysician: '',
    referringClinic: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    medicalHistory: '',
    allergies: '',
    precautions: '',
    contraindications: '',
    redFlags: '',
    generalNotes: '',
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (patientToEdit) {
      setFormData({ ...patientToEdit.data });
    } else {
      setFormData({
        fullName: '',
        fullNameAr: '',
        dateOfBirth: '',
        gender: 'male',
        phoneNumber: '',
        occupation: '',
        referringPhysician: '',
        referringClinic: '',
        emergencyContactName: '',
        emergencyContactPhone: '',
        medicalHistory: '',
        allergies: '',
        precautions: '',
        contraindications: '',
        redFlags: '',
        generalNotes: '',
      });
    }
    setError(null);
  }, [patientToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.fullName.trim()) {
      setError(isAr ? 'يرجى إدخال اسم المريض كاملاً.' : 'Patient full name is required.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const saved = await savePatient(formData, patientToEdit?.id);
      ClinicOperationsService.appendAuditLog({
        actionType: patientToEdit ? 'patient_updated' : 'patient_created',
        entityType: 'patient',
        entityId: saved.id,
        summaryAr: `${patientToEdit ? 'تحديث' : 'تسجيل'} ملف المريض: ${formData.fullName}`,
        summaryEn: `${patientToEdit ? 'Updated' : 'Created'} patient record: ${formData.fullName}`,
      });
      if (onSavedSuccess) onSavedSuccess(saved);
      onClose();
    } catch (err: any) {
      console.error('Failed to save patient:', err);
      setError(err.message || 'Error saving patient record');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={
        patientToEdit
          ? isAr
            ? 'تعديل ملف المريض'
            : 'Edit Patient Record'
          : isAr
          ? 'تسجيل مريض جديد بالعيادة (Patient Intake)'
          : 'New Patient Intake'
      }
      subtitle={
        isAr
          ? 'بيانات سريرية مشفرة محلياً بـ AES-256-GCM لا تغادر جهازك'
          : 'Client-side encrypted with AES-256-GCM, zero cloud exposure'
      }
      footer={
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {isAr ? 'إلغاء' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white rounded-xl flex items-center gap-2 transition-all cursor-pointer"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{isAr ? 'حفظ الملف مشفراً' : 'Save Patient'}</span>
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300">
            {error}
          </div>
        )}

        {/* Full Name */}
        <div>
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
            {isAr ? 'الاسم الكامل للمريض *' : 'Full Name *'}
          </label>
          <input
            type="text"
            required
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            placeholder={isAr ? 'مثال: أحمد عبد الله الرمضاني' : 'e.g., Ahmed Al-Ramdani'}
            className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-750 text-slate-900 dark:text-white"
          />
        </div>

        {/* Phone & Gender */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
              {isAr ? 'رقم الهاتف / واتساب' : 'Phone Number'}
            </label>
            <input
              type="tel"
              value={formData.phoneNumber || ''}
              onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
              placeholder="+964 770 000 0000"
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-750 text-slate-900 dark:text-white font-mono tabular-nums"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
              {isAr ? 'الجنس' : 'Gender'}
            </label>
            <select
              value={formData.gender}
              onChange={(e) => setFormData({ ...formData, gender: e.target.value as any })}
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-750 text-slate-900 dark:text-white"
            >
              <option value="male">{isAr ? 'ذكر' : 'Male'}</option>
              <option value="female">{isAr ? 'أنثى' : 'Female'}</option>
              <option value="other">{isAr ? 'أخرى' : 'Other'}</option>
            </select>
          </div>
        </div>

        {/* DOB & Occupation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
              {isAr ? 'تاريخ الميلاد' : 'Date of Birth'}
            </label>
            <input
              type="date"
              value={formData.dateOfBirth || ''}
              onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-750 text-slate-900 dark:text-white tabular-nums"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
              {isAr ? 'المهنة وطبيعة العمل' : 'Occupation'}
            </label>
            <input
              type="text"
              value={formData.occupation || ''}
              onChange={(e) => setFormData({ ...formData, occupation: e.target.value })}
              placeholder={isAr ? 'مهندس، عمل مكتبي، رياضي...' : 'Engineer, athlete, driver...'}
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-750 text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* Referring Physician & Emergency Contact */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-teal-700 dark:text-teal-400 font-bold text-xs">
            <UserCheck className="w-4 h-4" />
            <span>{isAr ? 'الطبيب المحيل وبيانات الطوارئ' : 'Referring Doctor & Emergency Contact'}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                {isAr ? 'الطبيب الاستشاري المحيل:' : 'Referring Physician:'}
              </label>
              <input
                type="text"
                value={formData.referringPhysician || ''}
                onChange={(e) => setFormData({ ...formData, referringPhysician: e.target.value })}
                placeholder={isAr ? 'د. حيدر العبيدي...' : 'Dr. Haider Al-Obaidi...'}
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-750 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                {isAr ? 'هاتف الطوارئ (قريب المريض):' : 'Emergency Contact Phone:'}
              </label>
              <input
                type="text"
                value={formData.emergencyContactPhone || ''}
                onChange={(e) => setFormData({ ...formData, emergencyContactPhone: e.target.value })}
                placeholder="+964 780 000 0000"
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-750 text-slate-900 dark:text-white font-mono"
              />
            </div>
          </div>
        </div>

        {/* Medical History */}
        <div>
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
            {isAr ? 'التاريخ الطبي والجراحي السابق' : 'Medical & Surgical History'}
          </label>
          <textarea
            rows={2}
            value={formData.medicalHistory || ''}
            onChange={(e) => setFormData({ ...formData, medicalHistory: e.target.value })}
            placeholder={isAr ? 'أمراض مزمنة، عمليات سابقة، كسور...' : 'Chronic conditions, past surgeries, trauma...'}
            className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-750 text-slate-900 dark:text-white"
          />
        </div>

        {/* Red Flags & Contraindications */}
        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 space-y-3">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs">
            <ShieldAlert className="w-4 h-4" />
            <span>{isAr ? 'التحذيرات السريرية وموانع الاستعمال (Red Flags & Contraindications)' : 'Clinical Alerts & Contraindications'}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                {isAr ? 'العلامات الحمراء (Red Flags):' : 'Red Flags:'}
              </label>
              <input
                type="text"
                value={formData.redFlags || ''}
                onChange={(e) => setFormData({ ...formData, redFlags: e.target.value })}
                placeholder={isAr ? 'هشاشة عظام حادة، خدر السرج...' : 'Severe osteoporosis, night pain...'}
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-750 text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                {isAr ? 'موانع الأجهزة والحساسية:' : 'Contraindications & Allergies:'}
              </label>
              <input
                type="text"
                value={formData.contraindications || ''}
                onChange={(e) => setFormData({ ...formData, contraindications: e.target.value })}
                placeholder={isAr ? 'منظم ضربات قلب، جلطة وريدية...' : 'Pacemaker, DVT history...'}
                className="w-full px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-750 text-slate-900 dark:text-white"
              />
            </div>
          </div>
        </div>
      </form>
    </Drawer>
  );
};
