// =======================================================================
// PhysioRecord — Clinical Addendum Modal (Phase 2B.2)
// Append-only Amendment of Finalized Clinical Records
// =======================================================================

import React, { useState, useEffect } from 'react';
import { 
  X, 
  FileEdit, 
  Save, 
  AlertCircle, 
  History, 
  ShieldCheck, 
  UserCheck 
} from 'lucide-react';
import { 
  ADDENDUM_REASONS, 
  type AddendumReason, 
  type ClinicalAddendumRecord, 
  type SessionRecord 
} from '../types/clinical';
import { useLanguage } from '../context/LanguageContext';

interface AddendumModalProps {
  isOpen: boolean;
  onClose: () => void;
  session: SessionRecord;
  existingAddenda: ClinicalAddendumRecord[];
  onAddAddendum: (
    targetTable: 'sessions' | 'soapNotes',
    targetId: string,
    data: {
      reasonForAmendment: AddendumReason;
      amendmentText: string;
      signedByTherapistName: string;
    }
  ) => Promise<void>;
}

export const AddendumModal: React.FC<AddendumModalProps> = ({
  isOpen,
  onClose,
  session,
  existingAddenda,
  onAddAddendum,
}) => {
  const { isRtl } = useLanguage();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [targetTable, setTargetTable] = useState<'sessions' | 'soapNotes'>('soapNotes');
  const [reasonForAmendment, setReasonForAmendment] = useState<AddendumReason>('late_entry');
  const [amendmentText, setAmendmentText] = useState('');
  const [signedByTherapistName, setSignedByTherapistName] = useState('د. المعالج الطبيعي');

  useEffect(() => {
    setReasonForAmendment('late_entry');
    setAmendmentText('');
    setSignedByTherapistName('د. المعالج الطبيعي');
    setError(null);
  }, [isOpen, session]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!amendmentText.trim()) {
      setError('نص الملحق أو التصحيح السريري إلزامي.');
      return;
    }
    if (!signedByTherapistName.trim()) {
      setError('اسم وتوقيع المعالج إلزامي لاعتماد الملحق.');
      return;
    }

    setSubmitting(true);
    try {
      await onAddAddendum(targetTable, session.id, {
        reasonForAmendment,
        amendmentText: amendmentText.trim(),
        signedByTherapistName: signedByTherapistName.trim(),
      });
      onClose();
    } catch (err: any) {
      console.error('Failed to create addendum:', err);
      setError(err?.message || 'فشل حفظ الملحق السريري.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden my-4 max-h-[90vh] flex flex-col">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-950 via-slate-900 to-amber-950 text-white flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center">
              <FileEdit className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold">
                إضافة ملحق وتصحيح سريري (Clinical Addendum)
              </h3>
              <p className="text-xs text-amber-200/80">
                للجلسة المعتمدة #{session.sessionNumber} بتاريخ {session.sessionDate}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          
          {/* Legal & Architectural Context Notice */}
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 leading-relaxed flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
            <div>
              <strong>مبدأ سلامة السجلات السريرية:</strong> الملاحق السريرية ترتبط بالسجل المعتمد بشكل تتابعي آمن ومؤرخ دون استبدال أو مسح أي بيانات سابقة، لضمان الحفاظ على التسلسل الزمني والمسؤولية المهنية.
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Target Table Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                السجل المستهدف بالإلحاق والتصحيح:
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTargetTable('soapNotes')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center ${
                    targetTable === 'soapNotes'
                      ? 'border-primary-600 bg-primary-50 text-primary-900 shadow-2xs'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  توثيق SOAP السريري
                </button>
                <button
                  type="button"
                  onClick={() => setTargetTable('sessions')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all text-center ${
                    targetTable === 'sessions'
                      ? 'border-primary-600 bg-primary-50 text-primary-900 shadow-2xs'
                      : 'border-slate-200 bg-white text-slate-600'
                  }`}
                >
                  بيانات الجلسة الإدارية
                </button>
              </div>
            </div>

            {/* Reason for Amendment */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                سبب الإضافة أو التصحيح (Reason for Amendment) <span className="text-rose-500">*</span>
              </label>
              <select
                value={reasonForAmendment}
                onChange={(e) => setReasonForAmendment(e.target.value as AddendumReason)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-500 bg-white"
              >
                {(Object.keys(ADDENDUM_REASONS) as AddendumReason[]).map((rKey) => (
                  <option key={rKey} value={rKey}>
                    {ADDENDUM_REASONS[rKey].ar} ({ADDENDUM_REASONS[rKey].en})
                  </option>
                ))}
              </select>
            </div>

            {/* Amendment Text */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                نص الإضافة أو التصحيح السريري (Amendment / Clarification Text) <span className="text-rose-500">*</span>
              </label>
              <textarea
                value={amendmentText}
                onChange={(e) => setAmendmentText(e.target.value)}
                placeholder="وضح ما الذي تم تصحيحه أو إضافته، وتفاصيل الملاحظة السريرية الملحقة..."
                rows={4}
                required
                className="w-full px-3.5 py-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:outline-hidden"
              />
            </div>

            {/* Therapist Name */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                  <span>اسم وتوقيع المعالج المعتمد للملحق</span>
                </span>
              </label>
              <input
                type="text"
                value={signedByTherapistName}
                onChange={(e) => setSignedByTherapistName(e.target.value)}
                required
                placeholder="اسم المعالج الموثق..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={submitting || !amendmentText.trim()}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 shadow-sm disabled:opacity-50 transition-all"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{submitting ? 'جاري الاعتماد المشفر...' : 'اعتماد وحفظ الملحق السريري'}</span>
              </button>
            </div>

          </form>

          {/* History of Previous Addenda for this session */}
          {existingAddenda.length > 0 && (
            <div className="pt-6 border-t border-slate-200">
              <div className="flex items-center gap-2 mb-3">
                <History className="w-4 h-4 text-slate-500" />
                <h4 className="text-xs font-bold text-slate-800">
                  سجل الملاحق والتصحيحات السابقة لهذه الجلسة ({existingAddenda.length})
                </h4>
              </div>

              <div className="space-y-2.5">
                {existingAddenda.map((addendum) => {
                  const ad = addendum.data;
                  const reasonInfo = ADDENDUM_REASONS[ad.reasonForAmendment] || { ar: ad.reasonForAmendment, en: '' };

                  return (
                    <div
                      key={addendum.id}
                      className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span className="font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                          {reasonInfo.ar}
                        </span>
                        <span className="font-mono">{addendum.createdAt}</span>
                      </div>
                      <p className="text-slate-800 whitespace-pre-line leading-relaxed">
                        {ad.amendmentText}
                      </p>
                      <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-200 flex items-center justify-between">
                        <span>الموقع: <strong>{ad.signedByTherapistName}</strong></span>
                        <span className="font-mono text-slate-400">ID: {addendum.id.substring(0, 8)}...</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
