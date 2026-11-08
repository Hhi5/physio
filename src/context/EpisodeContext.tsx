// =======================================================================
// PhysioRecord — Episode Context (Phase 2B.1)
// Reactive State Management & Strict Memory Scrubbing on Vault Lock
// =======================================================================

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useVault } from './VaultContext';
import { EpisodeService } from '../services/episodeService';
import type { EpisodeRecord, EpisodeClinicalData, EpisodeStatus } from '../types/clinical';

interface EpisodeContextType {
  episodes: EpisodeRecord[];
  loadingEpisodes: boolean;
  activePatientId: string | null;
  loadEpisodesForPatient: (patientId: string) => Promise<EpisodeRecord[]>;
  createEpisode: (patientId: string, data: EpisodeClinicalData) => Promise<EpisodeRecord>;
  updateEpisode: (episodeId: string, data: EpisodeClinicalData) => Promise<EpisodeRecord>;
  setEpisodeStatus: (episodeId: string, status: EpisodeStatus, notes?: string) => Promise<EpisodeRecord>;
  closeEpisode: (
    episodeId: string,
    dischargeInfo: {
      endDate: string;
      dischargeSummary: string;
      dischargeCriteriaSummary?: string;
    }
  ) => Promise<EpisodeRecord>;
  archiveEpisode: (episodeId: string) => Promise<void>;
  unarchiveEpisode: (episodeId: string) => Promise<void>;
  deleteEpisodeSafeguarded: (episodeId: string) => Promise<void>;
  clearEpisodes: () => void;
}

const EpisodeContext = createContext<EpisodeContextType | null>(null);

export const EpisodeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLocked, dek } = useVault();
  const [episodes, setEpisodes] = useState<EpisodeRecord[]>([]);
  const [activePatientId, setActivePatientId] = useState<string | null>(null);
  const [loadingEpisodes, setLoadingEpisodes] = useState(false);

  // Synchronization refs for sensitive memory protection
  const isLockedRef = useRef(isLocked);
  isLockedRef.current = isLocked;
  const dekRef = useRef(dek);
  dekRef.current = dek;

  const clearEpisodes = useCallback(() => {
    setEpisodes([]);
    setActivePatientId(null);
  }, []);

  // Scrub memory when vault is locked
  useEffect(() => {
    if (isLocked) {
      clearEpisodes();
    }
  }, [isLocked, clearEpisodes]);

  const loadEpisodesForPatient = useCallback(
    async (patientId: string): Promise<EpisodeRecord[]> => {
      if (isLockedRef.current || !dekRef.current) {
        clearEpisodes();
        return [];
      }

      setLoadingEpisodes(true);
      setActivePatientId(patientId);

      try {
        const records = await EpisodeService.getEpisodesByPatient(patientId, dekRef.current);
        if (isLockedRef.current || !dekRef.current) {
          clearEpisodes();
          return [];
        }
        setEpisodes(records);
        return records;
      } catch (err) {
        console.error('Failed to load episodes for patient:', err);
        setEpisodes([]);
        return [];
      } finally {
        setLoadingEpisodes(false);
      }
    },
    [clearEpisodes]
  );

  const createEpisode = async (
    patientId: string,
    data: EpisodeClinicalData
  ): Promise<EpisodeRecord> => {
    if (isLocked || !dek) throw new Error('الخزينة مقفلة');

    const created = await EpisodeService.createEpisode(patientId, data, dek);
    setEpisodes(prev => [created, ...prev]);
    return created;
  };

  const updateEpisode = async (
    episodeId: string,
    data: EpisodeClinicalData
  ): Promise<EpisodeRecord> => {
    if (isLocked || !dek) throw new Error('الخزينة مقفلة');

    const updated = await EpisodeService.updateEpisode(episodeId, data, dek);
    setEpisodes(prev => prev.map(ep => (ep.id === episodeId ? updated : ep)));
    return updated;
  };

  const setEpisodeStatus = async (
    episodeId: string,
    status: EpisodeStatus,
    notes?: string
  ): Promise<EpisodeRecord> => {
    if (isLocked || !dek) throw new Error('الخزينة مقفلة');

    const updated = await EpisodeService.setEpisodeStatus(episodeId, status, dek, notes);
    setEpisodes(prev => prev.map(ep => (ep.id === episodeId ? updated : ep)));
    return updated;
  };

  const closeEpisode = async (
    episodeId: string,
    dischargeInfo: {
      endDate: string;
      dischargeSummary: string;
      dischargeCriteriaSummary?: string;
    }
  ): Promise<EpisodeRecord> => {
    if (isLocked || !dek) throw new Error('الخزينة مقفلة');

    const updated = await EpisodeService.closeEpisode(episodeId, dischargeInfo, dek);
    setEpisodes(prev => prev.map(ep => (ep.id === episodeId ? updated : ep)));
    return updated;
  };

  const archiveEpisode = async (episodeId: string): Promise<void> => {
    if (isLocked || !dek) throw new Error('الخزينة مقفلة');

    const updated = await EpisodeService.archiveEpisode(episodeId, dek);
    setEpisodes(prev =>
      prev.map(ep => (ep.id === episodeId ? updated : ep))
    );
  };

  const unarchiveEpisode = async (episodeId: string): Promise<void> => {
    if (isLocked || !dek) throw new Error('الخزينة مقفلة');

    const updated = await EpisodeService.unarchiveEpisode(episodeId, dek);
    setEpisodes(prev =>
      prev.map(ep => (ep.id === episodeId ? updated : ep))
    );
  };

  const deleteEpisodeSafeguarded = async (episodeId: string): Promise<void> => {
    if (isLocked || !dek) throw new Error('الخزينة مقفلة');

    await EpisodeService.deleteEpisodeSafeguarded(episodeId);
    setEpisodes(prev => prev.filter(ep => ep.id !== episodeId));
  };

  return (
    <EpisodeContext.Provider
      value={{
        episodes,
        loadingEpisodes,
        activePatientId,
        loadEpisodesForPatient,
        createEpisode,
        updateEpisode,
        setEpisodeStatus,
        closeEpisode,
        archiveEpisode,
        unarchiveEpisode,
        deleteEpisodeSafeguarded,
        clearEpisodes,
      }}
    >
      {children}
    </EpisodeContext.Provider>
  );
};

export const useEpisodes = (): EpisodeContextType => {
  const context = useContext(EpisodeContext);
  if (!context) {
    throw new Error('useEpisodes must be used within an EpisodeProvider');
  }
  return context;
};
