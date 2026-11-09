// =======================================================================
// PhysioRecord — Session Scheduling Slide-over Drawer
// =======================================================================

import React, { useState, useEffect } from 'react';
import { Drawer } from '../layout/Drawer';
import { useVault } from '../../context/VaultContext';
import { useLanguage } from '../../context/LanguageContext';
import { SessionService } from '../../services/sessionService';
import type { SessionClinicalData, SessionRecord, SessionType, AttendanceStatus } from '../../types/clinical';
import { localDate } from '../../utils/date';
import { Save } from 'lucide-react';

interface SessionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  episodeId: string;
  nextSessionNumber: number;
  onSessionCreated: (session: SessionRecord) => void;
}

export const SessionDrawer: React.FC<SessionDrawerProps> = ({
  isOpen,
  onClose,
  patientId,
  episodeId,
  nextSessionNumber,
  onSessionCreated,
}) => {
  const { dek } = useVault();
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const [sessionDate, setSessionDate] = useState(localDate());
  const [sessionType, setSessionType] = useState<SessionType>(
    nextSessionNumber === 1 ? 'initial_evaluation' : 'follow_up'
  );
  const [durationMinutes, setDurationMinutes] = useState<number>(45);
  const [painVasScore, setPainVasScore] = useState<number>(5);
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>('attended');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSessionDate(localDate());
    setSessionType(nextSessionNumber === 1 ? 'initial_evaluation' : 'follow_up');
    setDurationMinutes(45);
    setPainVasScore(5);
    setAttendanceStatus('attended');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, episodeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dek) return;

    setSaving(true);
    setError(null);

    try {
      const payload: Partial<SessionClinicalData> = {
        sessionNumber: nextSessionNumber,
        sessionDate,
        sessionType,
        sessionDurationMinutes: durationMinutes,
        status: 'draft',
        attendanceStatus,
      };

      const created = await SessionService.createSession(patientId, episodeId, payload, dek);
      onSessionCreated(created);
      onClose();
    } catch (err: unknown) {
      console.error('Failed to create session:', err);
      setError(err instanceof Error ? err.message : 'Error creating clinical session');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title={isAr ? `تسجيل جلسة سريرية جديدة (#${nextSessionNumber})` : `New Clinical Session (#${nextSessionNumber})`}
      subtitle={isAr ? 'حدد موعد الجلسة ونوعها ومؤشر الألم المبدئي' : 'Specify session date, modality, and baseline pain'}
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
            className="px-5 py-2 text-xs font-bold bg-teal-600 hover:bg-teal-500 text-white rounded-xl shadow-xs flex items-center gap-2 transition-all cursor-pointer"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            <span>{isAr ? 'بدء وتوثيق الجلسة' : 'Create & Open Session'}</span>
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

        {/* Date & Time */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
              {isAr ? 'تاريخ الجلسة *' : 'Session Date *'}
            </label>
            <input
              type="date"
              required
              value={sessionDate}
              onChange={(e) => setSessionDate(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-750 text-slate-900 dark:text-white tabular-nums"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
              {isAr ? 'مدة الجلسة (بالدقائق)' : 'Duration (minutes)'}
            </label>
            <input
              type="number"
              min="15"
              max="180"
              step="5"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-750 text-slate-900 dark:text-white font-mono tabular-nums"
            />
          </div>
        </div>

        {/* Session Type */}
        <div>
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
            {isAr ? 'نوع الجلسة السريرية' : 'Session Clinical Type'}
          </label>
          <select
            value={sessionType}
            onChange={(e) => setSessionType(e.target.value as SessionType)}
            className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-750 text-slate-900 dark:text-white font-medium"
          >
            <option value="initial_evaluation">
              {isAr ? 'تقييم أولي شامل (Initial Evaluation)' : 'Initial Evaluation'}
            </option>
            <option value="follow_up">
              {isAr ? 'جلسة علاجية ومتابعة مستمرة (Follow-up Session)' : 'Follow-up Session'}
            </option>
            <option value="re_evaluation">
              {isAr ? 'إعادة تقييم وقياس مرحلي (Re-evaluation)' : 'Re-evaluation'}
            </option>
            <option value="discharge_summary">
              {isAr ? 'جلسة تخريج وإنهاء الخطة (Discharge Summary)' : 'Discharge Summary'}
            </option>
          </select>
        </div>

        {/* Attendance Status */}
        <div>
          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 block mb-1">
            {isAr ? 'حالة الحضور للجلسة' : 'Attendance Status'}
          </label>
          <select
            value={attendanceStatus}
            onChange={(e) => setAttendanceStatus(e.target.value as AttendanceStatus)}
            className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-750 text-slate-900 dark:text-white font-medium"
          >
            <option value="attended">{isAr ? 'حضر وتلقى العلاج (Attended)' : 'Attended'}</option>
            <option value="cancelled_patient">{isAr ? 'ألغيت من قبل المريض' : 'Cancelled by Patient'}</option>
            <option value="cancelled_clinic">{isAr ? 'ألغيت من قبل العيادة' : 'Cancelled by Clinic'}</option>
            <option value="no_show">{isAr ? 'تغيب دون إشعار (No Show)' : 'No Show'}</option>
          </select>
        </div>

        {/* Baseline Pain VAS */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs font-bold tabular-nums">
            <span className="text-slate-800 dark:text-slate-200">
              {isAr ? 'مؤشر الألم المبدئي عند بدء الجلسة (VAS 0-10):' : 'Baseline Pain Rating (VAS 0-10):'}
            </span>
            <span
              className={`px-2 py-0.5 rounded text-xs font-mono font-bold text-white ${
                painVasScore >= 7
                  ? 'bg-rose-600'
                  : painVasScore >= 4
                  ? 'bg-amber-500'
                  : 'bg-emerald-600'
              }`}
            >
              {painVasScore} / 10
            </span>
          </div>

          <input
            type="range"
            min="0"
            max="10"
            value={painVasScore}
            onChange={(e) => setPainVasScore(Number(e.target.value))}
            className="w-full accent-teal-600 cursor-pointer"
          />

          <div className="flex justify-between text-[10px] text-slate-500 font-bold tabular-nums">
            <span>{isAr ? '0: لا ألم إطلاقاً' : '0: No Pain'}</span>
            <span>{isAr ? '5: ألم متوسط' : '5: Moderate'}</span>
            <span>{isAr ? '10: أشد ألم ممكن' : '10: Worst Pain'}</span>
          </div>
        </div>
      </form>
    </Drawer>
  );
};
