// =======================================================================
// PhysioRecord — Patient Workspace (Responsive 3-Device Split-Pane)
// Desktop (xl+): Permanent Summary Sidebar + Main Chart
// Mobile & Tablet (< xl): Full-Width Main Chart + Slide-Over Episodes/Sessions Drawer
// =======================================================================

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { useVault } from '../../context/VaultContext';
import { EpisodeService } from '../../services/episodeService';
import { SessionService } from '../../services/sessionService';
import type { PatientRecord, EpisodeRecord, SessionRecord } from '../../types/clinical';
import { PatientSummarySidebar } from './PatientSummarySidebar';
import { MasterPatientChart } from './MasterPatientChart';
import { TreatmentSessionView } from './TreatmentSessionView';
import { EpisodeDrawer } from '../drawers/EpisodeDrawer';
import { SessionDrawer } from '../drawers/SessionDrawer';
import { FolderOpen, Plus, X, Activity } from 'lucide-react';

interface PatientWorkspaceProps {
  patient: PatientRecord;
  onBackToDirectory: () => void;
}

export const PatientWorkspace: React.FC<PatientWorkspaceProps> = ({
  patient,
  onBackToDirectory,
}) => {
  const { language, isRtl } = useLanguage();
  const isAr = language === 'ar';
  const { dek } = useVault();

  const [episodes, setEpisodes] = useState<EpisodeRecord[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [isMobileSummaryOpen, setIsMobileSummaryOpen] = useState(false);

  // Drawers
  const [isEpisodeDrawerOpen, setIsEpisodeDrawerOpen] = useState(false);
  const [isSessionDrawerOpen, setIsSessionDrawerOpen] = useState(false);

  const loadPatientClinicalData = async () => {
    if (!dek || !patient.id) return;
    try {
      const epList = await EpisodeService.getEpisodesByPatient(patient.id, dek);
      setEpisodes(epList);

      let activeEpId = selectedEpisodeId;
      if (!activeEpId && epList.length > 0) {
        const firstActive = epList.find((e) => e.data.status === 'active') || epList[0];
        activeEpId = firstActive.id;
        setSelectedEpisodeId(activeEpId);
      }

      const allSessions: SessionRecord[] = [];
      for (const ep of epList) {
        const epSessions = await SessionService.getSessionsByEpisode(ep.id, dek);
        allSessions.push(...epSessions);
      }
      setSessions(allSessions);
    } catch (err) {
      console.error('Failed to load patient clinical data:', err);
    }
  };

  useEffect(() => {
    loadPatientClinicalData();
  }, [patient.id, dek]);

  const activeEpisode = episodes.find((e) => e.id === selectedEpisodeId) || episodes[0];
  const activeSession = sessions.find((s) => s.id === selectedSessionId);

  const episodeSessions = activeEpisode
    ? sessions.filter((s) => s.episodeId === activeEpisode.id)
    : sessions;

  return (
    <div className="flex-1 flex flex-col xl:flex-row h-full overflow-hidden bg-slate-50 dark:bg-slate-950 transition-colors relative">
      {/* Mobile & Tablet Compact Episode & Session Quick Bar (< 1280px) */}
      <div className="xl:hidden px-3 sm:px-6 py-2 bg-slate-100/90 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
        <button
          type="button"
          onClick={() => setIsMobileSummaryOpen(true)}
          className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2 cursor-pointer"
        >
          <FolderOpen className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0" />
          <span className="truncate max-w-[200px] sm:max-w-xs">
            {isAr ? 'حلقات الرعاية والجلسات' : 'Episodes & Sessions'} ({episodes.length} / {episodeSessions.length})
          </span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsEpisodeDrawerOpen(true)}
            className="min-h-[36px] px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-teal-700 dark:text-teal-300 cursor-pointer whitespace-nowrap"
          >
            {isAr ? '+ حالة جديدة' : '+ Episode'}
          </button>
          {activeEpisode && (
            <button
              type="button"
              onClick={() => setIsSessionDrawerOpen(true)}
              className="min-h-[36px] px-2.5 py-1 rounded-lg bg-teal-600 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3 h-3" />
              <span>{isAr ? 'جلسة جديدة' : 'Session'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Desktop Permanent Patient Summary Sidebar (xl: 1280px+) */}
      <div className="hidden xl:flex h-full shrink-0">
        <PatientSummarySidebar
          patient={patient}
          episodes={episodes}
          sessions={sessions}
          selectedEpisodeId={selectedEpisodeId}
          onSelectEpisode={(epId) => {
            setSelectedEpisodeId(epId);
            setSelectedSessionId(null);
          }}
          selectedSessionId={selectedSessionId}
          onSelectSession={(sessId) => setSelectedSessionId(sessId)}
          onOpenNewEpisode={() => setIsEpisodeDrawerOpen(true)}
          onOpenNewSession={() => setIsSessionDrawerOpen(true)}
        />
      </div>

      {/* Mobile & Tablet Slide-Over Patient Summary Sidebar Drawer (< 1280px) */}
      {isMobileSummaryOpen && (
        <div className="xl:hidden fixed inset-0 z-40 flex" dir={isRtl ? 'rtl' : 'ltr'}>
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs"
            onClick={() => setIsMobileSummaryOpen(false)}
          />
          <div className="relative z-10 flex h-full max-w-[88vw] bg-white dark:bg-slate-900 shadow-2xl">
            <PatientSummarySidebar
              patient={patient}
              episodes={episodes}
              sessions={sessions}
              selectedEpisodeId={selectedEpisodeId}
              onSelectEpisode={(epId) => {
                setSelectedEpisodeId(epId);
                setSelectedSessionId(null);
                setIsMobileSummaryOpen(false);
              }}
              selectedSessionId={selectedSessionId}
              onSelectSession={(sessId) => {
                setSelectedSessionId(sessId);
                setIsMobileSummaryOpen(false);
              }}
              onOpenNewEpisode={() => {
                setIsMobileSummaryOpen(false);
                setIsEpisodeDrawerOpen(true);
              }}
              onOpenNewSession={() => {
                setIsMobileSummaryOpen(false);
                setIsSessionDrawerOpen(true);
              }}
              onCloseMobileDrawer={() => setIsMobileSummaryOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main Clinical Documentation Canvas (100% Width on Mobile/Tablet, Flex-1 on Desktop) */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-950">
        {activeSession ? (
          <TreatmentSessionView
            session={activeSession}
            patientId={patient.id}
            patientName={patient.data.fullName}
            episodeTitle={
              activeEpisode?.data.title || activeEpisode?.data.medicalDiagnosis || 'Episode'
            }
            onBack={() => setSelectedSessionId(null)}
            onOpenMasterChart={() => setSelectedSessionId(null)}
            onSessionUpdated={loadPatientClinicalData}
          />
        ) : (
          <MasterPatientChart
            patient={patient}
            episodes={episodes}
            sessions={sessions}
            selectedEpisodeId={selectedEpisodeId}
            onSelectEpisode={(epId) => setSelectedEpisodeId(epId)}
            onOpenSession={(sessId) => setSelectedSessionId(sessId)}
            onOpenNewSession={() => setIsSessionDrawerOpen(true)}
            onOpenNewEpisode={() => setIsEpisodeDrawerOpen(true)}
            onBackToDirectory={onBackToDirectory}
            onPatientUpdated={loadPatientClinicalData}
          />
        )}
      </div>

      {/* Episode Creation Drawer */}
      <EpisodeDrawer
        isOpen={isEpisodeDrawerOpen}
        onClose={() => setIsEpisodeDrawerOpen(false)}
        patientId={patient.id}
        patientName={patient.data.fullName}
        onEpisodeCreated={(newEp) => {
          setEpisodes((prev) => [newEp, ...prev]);
          setSelectedEpisodeId(newEp.id);
        }}
      />

      {/* Session Creation Drawer */}
      <SessionDrawer
        isOpen={isSessionDrawerOpen}
        onClose={() => setIsSessionDrawerOpen(false)}
        patientId={patient.id}
        episodeId={selectedEpisodeId || activeEpisode?.id || ''}
        nextSessionNumber={SessionService.computeNextSessionNumber(episodeSessions)}
        onSessionCreated={(newSess) => {
          setSessions((prev) => [newSess, ...prev]);
          setSelectedSessionId(newSess.id);
        }}
      />
    </div>
  );
};
