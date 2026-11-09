// =======================================================================
// PhysioRecord — Episode Discharge / Closing Modal (Phase 2B.1)
// Clinical discharge documentation, final outcome summary, and end date
// =======================================================================

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';
import type { EpisodeRecord } from '../types/clinical';
import { localDate } from '../utils/date';
import { X, CheckCircle, AlertTriangle } from 'lucide-react';

interface EpisodeDischargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  episode: EpisodeRecord;
  onConfirmDischarge: (dischargeInfo: {
    endDate: string;
    dischargeSummary: string;
    dischargeCriteriaSummary?: string;
  }) => Promise<void>;
}

export const EpisodeDischargeModal: React.FC<EpisodeDischargeModalProps> = ({
  isOpen,
  onClose,
  episode,
  onConfirmDischarge,
}) => {
  const { isRtl, bi } = useLanguage();
  const [endDate, setEndDate] = useState(localDate());
  const [dischargeReason, setDischargeReason] = useState('goals_met');
  const [dischargeSummary, setDischargeSummary] = useState('');
  const [dischargeCriteriaSummary, setDischargeCriteriaSummary] = useState(
    episode.data.dischargeCriteriaSummary || ''
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setEndDate(localDate());
    setDischargeReason('goals_met');
    setDischargeSummary('');
    setDischargeCriteriaSummary(episode.data.dischargeCriteriaSummary || '');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, episode.id]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!dischargeSummary.trim()) {
      setError('يرجى كتابة ملخص الخروج والنتائج السريرية المحققة.');
      return;
    }

    setSubmitting(true);
    try {
      const fullSummary = `[سبب الخروج: ${getReasonLabel(dischargeReason)}]\n${dischargeSummary.trim()}`;
      await onConfirmDischarge({
        endDate,
        dischargeSummary: fullSummary,
        dischargeCriteriaSummary: dischargeCriteriaSummary.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      console.error('Failed to close episode:', err);
      setError(err instanceof Error ? err.message : 'حدث خطأ أثناء إغلاق حلقة الرعاية.');
    } finally {
      setSubmitting(false);
    }
  };

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case 'goals_met':
        return 'تحقق الأهداف التأهيلية المخططة بالكامل (Goals Met)';
      case 'maximum_medical_improvement':
        return 'الوصول للحد الأقصى للتحسن السريري (MMI)';
      case 'patient_self_discharged':
        return bi('خروج بطلب المريض أو انقطاع طوعي', 'Patient Self-Discharged');
      case 'referred_other':
        return bi('إحالة إلى تخصص أو مركز آخر', 'Referred to Other Specialist');
      default:
        return 'أخرى';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4" dir={isRtl ? 'rtl' : 'ltr'}>
      <div className="bg-white rounded-xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-700 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold">{bi('إغلاق وتخريج حلقة الرعاية السريرية', 'Discharge & Close Episode of Care')}</h2>
              <p className="text-xs text-blue-100">{episode.data.title}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 flex-1 overflow-y-auto">
          
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* End Date & Discharge Reason */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                تاريخ انتهاء / تخريج الحلقة <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                required
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                سبب التخريج (Discharge Reason)
              </label>
              <select
                value={dischargeReason}
                onChange={(e) => setDischargeReason(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs font-medium focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="goals_met">تحقق الأهداف العلاجية (Goals Met)</option>
                <option value="maximum_medical_improvement">أقصى تحسن سريري ممكن (MMI)</option>
                <option value="patient_self_discharged">انقطاع أو خروج بطلب المريض</option>
                <option value="referred_other">إحالة إلى استشاري / تخصص آخر</option>
              </select>
            </div>
          </div>

          {/* Discharge Summary Narrative */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ملخص الخروج والنتائج السريرية المحققة (Discharge Summary) <span className="text-rose-500">*</span>
            </label>
            <textarea
              required
              rows={4}
              value={dischargeSummary}
              onChange={(e) => setDischargeSummary(e.target.value)}
              placeholder="اكتب خلاصة الاستجابة للعلاج، التحسن في مقياس الألم VAS، استعادة المدى الحركي والقوة العضلية، والتوصيات للبرنامج المنزلي المستمر..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-blue-500 leading-relaxed"
            />
          </div>

          {/* Discharge Criteria Check */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              معايير الخروج المكتملة (Criteria Achievement)
            </label>
            <input
              type="text"
              value={dischargeCriteriaSummary}
              onChange={(e) => setDischargeCriteriaSummary(e.target.value)}
              placeholder="مثال: تحقيق 130 درجة ثني الركبة، قوة عضلية 5/5، وعدم وجود ألم أثناء المشي."
              className="w-full px-3.5 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-2xl text-[11px] text-blue-900 leading-relaxed">
            بإغلاق هذه الحلقة، سيتم تحديث حالتها إلى <strong>"مكتملة / Completed"</strong>، وسيبقى كامل سجلها السريري وتاريخ جلساتها محفوظاً ومشفرة ضمن السجل التاريخي للمريض.
          </div>

        </form>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-100"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 shadow-sm"
          >
            <CheckCircle className="w-4 h-4" />
            <span>{submitting ? 'جاري الإغلاق...' : 'تأكيد التخريج وإغلاق الحلقة'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
