// =======================================================================
// PhysioRecord — Patient Summary & Clinical Trajectory Sidebar (Split-Pane Master)
// Responsive across Desktop Split-Pane and Mobile/Tablet Slide-Over Drawer
// =======================================================================

import React from 'react';
import { useLanguage } from '../../context/LanguageContext';
import type { PatientRecord, EpisodeRecord, SessionRecord } from '../../types/clinical';
import {
  Activity,
  Plus,
  FolderOpen,
  Phone,
  ShieldAlert,
  X,
} from 'lucide-react';

interface PatientSummarySidebarProps {
  patient: PatientRecord;
  episodes: EpisodeRecord[];
  sessions: SessionRecord[];
  selectedEpisodeId: string | null;
  onSelectEpisode: (episodeId: string) => void;
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onOpenNewEpisode: () => void;
  onOpenNewSession: () => void;
  onCloseMobileDrawer?: () => void;
}

export const PatientSummarySidebar: React.FC<PatientSummarySidebarProps> = ({
  patient,
  episodes,
  sessions,
  selectedEpisodeId,
  onSelectEpisode,
  selectedSessionId,
  onSelectSession,
  onOpenNewEpisode,
  onOpenNewSession,
  onCloseMobileDrawer,
}) => {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const d = patient.data;

  // Filter sessions for the selected episode
  const activeSessions = selectedEpisodeId
    ? sessions.filter((s) => s.episodeId === selectedEpisodeId)
    : sessions;

  return (
    <div className="w-80 sm:w-88 bg-white dark:bg-slate-900 border-e border-slate-200 dark:border-slate-800 flex flex-col h-full shrink-0 overflow-hidden select-none transition-colors">
      {/* Patient Header Card */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-850/80 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-2xl bg-teal-50 dark:bg-teal-950 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 flex items-center justify-center font-bold text-base shrink-0">
              {d.fullName ? d.fullName.charAt(0) : 'P'}
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                {d.fullName}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                {'MRN: #' + patient.id.slice(0, 8)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
              {patient.isArchived ? (isAr ? 'مؤرشف' : 'Archived') : isAr ? 'نشط' : 'Active'}
            </span>
            {onCloseMobileDrawer && (
              <button
                type="button"
                onClick={onCloseMobileDrawer}
                className="xl:hidden min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 cursor-pointer"
                aria-label="Close drawer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Quick demographics row */}
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-400 font-medium tabular-nums">
          {d.gender && (
            <span>
              {d.gender === 'male' ? (isAr ? 'ذكر' : 'Male') : isAr ? 'أنثى' : 'Female'}
            </span>
          )}
          {d.dateOfBirth && (
            <>
              <span>·</span>
              <span>{d.dateOfBirth}</span>
            </>
          )}
          {d.phoneNumber && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1 font-mono" dir="ltr">
                <Phone className="w-3 h-3 text-slate-400" />
                {d.phoneNumber}
              </span>
            </>
          )}
        </div>

        {/* Medical Alerts / Red Flags Banner */}
        {(d.allergies || d.precautions || d.redFlags || d.contraindications) && (
          <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 flex items-start gap-2 text-xs">
            <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="text-[11px] text-amber-900 dark:text-amber-200 leading-snug">
              <span className="font-bold">{isAr ? 'تنبيه سريري: ' : 'Alert: '}</span>
              <span>{d.redFlags || d.contraindications || d.allergies || d.precautions}</span>
            </div>
          </div>
        )}
      </div>

      {/* Episodes of Care Section */}
      <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            <FolderOpen className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>{isAr ? 'الحالات العلاجية (Episodes)' : 'Episodes of Care'}</span>
          </div>

          <button
            type="button"
            onClick={onOpenNewEpisode}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-teal-600 dark:text-teal-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title={isAr ? 'بدء حالة علاجية جديدة' : 'New episode'}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Episodes List */}
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {episodes.map((ep) => {
            const isSelected = selectedEpisodeId === ep.id;
            return (
              <button
                key={ep.id}
                type="button"
                onClick={() => onSelectEpisode(ep.id)}
                className={`w-full min-h-[44px] text-start p-2.5 rounded-xl text-xs font-medium transition-all flex items-center justify-between gap-2 cursor-pointer border ${
                  isSelected
                    ? 'bg-teal-50/80 dark:bg-teal-950/50 border-teal-500 text-slate-900 dark:text-white'
                    : 'bg-slate-50/70 dark:bg-slate-850/60 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="min-w-0">
                  <p className="font-bold truncate text-xs text-slate-900 dark:text-white">
                    {ep.data.title || ep.data.medicalDiagnosis}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                    {ep.data.startDate || ep.startDate} · {ep.data.status || ep.status}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Sessions Timeline List */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-2.5">
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
            <Activity className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
            <span>{isAr ? 'سجل الجلسات العلاجية' : 'Sessions Timeline'}</span>
          </div>

          <button
            type="button"
            onClick={onOpenNewSession}
            disabled={!selectedEpisodeId}
            className={`min-h-[36px] px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer ${
              selectedEpisodeId
                ? 'bg-teal-600 hover:bg-teal-500 text-white'
                : 'opacity-40 cursor-not-allowed bg-slate-200 dark:bg-slate-800 text-slate-500'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isAr ? 'جلسة جديدة' : 'New'}</span>
          </button>
        </div>

        {activeSessions.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400 italic bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
            {isAr
              ? 'لا توجد جلسات موثقة في هذه الحالة بعد. انقر على "+ جلسة جديدة".'
              : 'No sessions recorded yet. Click "+ New".'}
          </div>
        ) : (
          <div className="space-y-1.5">
            {activeSessions.map((session) => {
              const isSelected = selectedSessionId === session.id;

              return (
                <div
                  key={session.id}
                  onClick={() => onSelectSession(session.id)}
                  className={`p-3 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                    isSelected
                      ? 'bg-teal-50/90 dark:bg-teal-950/40 border-teal-500 ring-1 ring-teal-500/40 text-slate-900 dark:text-white'
                      : 'bg-white dark:bg-slate-850/60 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs tabular-nums">
                    <span className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <span className="text-teal-600 dark:text-teal-400 font-mono">
                        #{session.data.sessionNumber}
                      </span>
                      <span>{session.data.sessionDate}</span>
                    </span>

                    <span className="text-[10px] font-bold font-mono text-slate-500">
                      {session.data.status === 'finalized'
                        ? isAr
                          ? 'معتمدة'
                          : 'Finalized'
                        : session.data.status === 'cancelled'
                        ? isAr
                          ? 'ملغاة'
                          : 'Cancelled'
                        : isAr
                        ? 'مسودة'
                        : 'Draft'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    <span className="truncate max-w-[150px]">
                      {session.data.sessionType === 'initial_evaluation'
                        ? isAr
                          ? 'تقييم أولي'
                          : 'Initial Eval'
                        : session.data.sessionType === 'follow_up'
                        ? isAr
                          ? 'جلسة متابعة'
                          : 'Follow-up'
                        : session.data.sessionType === 're_evaluation'
                        ? isAr
                          ? 'إعادة تقييم'
                          : 'Re-eval'
                        : isAr
                        ? 'تخريج'
                        : 'Discharge'}
                    </span>
                    <span className="text-[10px] font-mono">
                      {session.data.sessionDurationMinutes ? `${session.data.sessionDurationMinutes}m` : '45m'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
