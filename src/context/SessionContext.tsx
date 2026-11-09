// =======================================================================
// PhysioRecord — Clinical Session & SOAP Context (Phase 2B.2)
// Reactive State Management & Strict Memory Scrubbing on Vault Lock
// =======================================================================

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useVault } from './VaultContext';
import { SessionService } from '../services/sessionService';
import { SoapService } from '../services/soapService';
import {
  VaultGenerationChangedError,
  UnboundVaultKeyError,
  type SessionRecord,
  type SessionClinicalData,
  type SoapNoteRecord,
  type SoapNoteData,
  type ClinicalAddendumRecord,
  type AddendumReason,
} from '../types/clinical';

interface SessionContextType {
  sessions: SessionRecord[];
  loadingSessions: boolean;
  activeEpisodeId: string | null;
  loadSessionsForEpisode: (episodeId: string) => Promise<SessionRecord[]>;
  createSession: (
    patientId: string,
    episodeId: string,
    data: Partial<SessionClinicalData>
  ) => Promise<SessionRecord>;
  updateSession: (
    sessionId: string,
    data: Partial<SessionClinicalData>
  ) => Promise<SessionRecord>;
  cancelSession: (
    sessionId: string,
    cancellationReason: string,
    attendanceStatus: 'cancelled_patient' | 'cancelled_clinic' | 'no_show'
  ) => Promise<SessionRecord>;
  finalizeSession: (sessionId: string, therapistName: string) => Promise<SessionRecord>;
  deleteSession: (sessionId: string) => Promise<void>;
  getSoapNote: (sessionId: string) => Promise<SoapNoteRecord | null>;
  saveSoapNote: (
    patientId: string,
    episodeId: string,
    sessionId: string,
    data: SoapNoteData,
    existingSoapId?: string
  ) => Promise<SoapNoteRecord>;
  getAddenda: (sessionId: string) => Promise<ClinicalAddendumRecord[]>;
  addAddendum: (
    sessionId: string,
    targetTable: 'sessions' | 'soapNotes',
    targetId: string,
    data: {
      reasonForAmendment: AddendumReason;
      amendmentText: string;
      signedByTherapistName: string;
    }
  ) => Promise<ClinicalAddendumRecord>;
  clearSessions: () => void;
}

const SessionContext = createContext<SessionContextType | null>(null);

export const SessionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLocked, dek, lock } = useVault();
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [activeEpisodeId, setActiveEpisodeId] = useState<string | null>(null);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Synchronization refs for sensitive memory protection
  const isLockedRef = useRef(isLocked);
  isLockedRef.current = isLocked;
  const dekRef = useRef(dek);
  dekRef.current = dek;

  const clearSessions = useCallback(() => {
    setSessions([]);
    setActiveEpisodeId(null);
  }, []);

  // Scrub memory when vault is locked
  useEffect(() => {
    if (isLocked) {
      clearSessions();
    }
  }, [isLocked, clearSessions]);

  const loadSessionsForEpisode = useCallback(
    async (episodeId: string): Promise<SessionRecord[]> => {
      if (isLockedRef.current || !dekRef.current) {
        clearSessions();
        return [];
      }

      setLoadingSessions(true);
      setActiveEpisodeId(episodeId);

      try {
        const records = await SessionService.getSessionsByEpisode(episodeId, dekRef.current);
        if (isLockedRef.current || !dekRef.current) {
          clearSessions();
          return [];
        }
        setSessions(records);
        return records;
      } catch (err) {
        console.error('Failed to load sessions for episode:', err);
        setSessions([]);
        return [];
      } finally {
        setLoadingSessions(false);
      }
    },
    [clearSessions]
  );

  const createSession = useCallback(
    async (
      patientId: string,
      episodeId: string,
      data: Partial<SessionClinicalData>
    ): Promise<SessionRecord> => {
      if (isLockedRef.current || !dekRef.current) throw new Error('الخزينة مقفلة');

      try {
        const created = await SessionService.createSession(patientId, episodeId, data, dekRef.current);
        setSessions((prev) => [...prev, created]);
        return created;
      } catch (err) {
        if (err instanceof VaultGenerationChangedError || err instanceof UnboundVaultKeyError) {
          console.warn('SessionContext: Generation/Unbound error detected. Locking vault.');
          lock();
        }
        throw err;
      }
    },
    [lock]
  );

  const updateSession = useCallback(
    async (
      sessionId: string,
      data: Partial<SessionClinicalData>
    ): Promise<SessionRecord> => {
      if (isLockedRef.current || !dekRef.current) throw new Error('الخزينة مقفلة');

      const updated = await SessionService.updateSession(sessionId, data, dekRef.current);
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? updated : s)));
      return updated;
    },
    []
  );

  const cancelSession = useCallback(
    async (
      sessionId: string,
      cancellationReason: string,
      attendanceStatus: 'cancelled_patient' | 'cancelled_clinic' | 'no_show'
    ): Promise<SessionRecord> => {
      if (isLockedRef.current || !dekRef.current) throw new Error('الخزينة مقفلة');

      const updated = await SessionService.cancelSession(sessionId, cancellationReason, attendanceStatus, dekRef.current);
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? updated : s)));
      return updated;
    },
    []
  );

  const finalizeSession = useCallback(
    async (sessionId: string, therapistName: string): Promise<SessionRecord> => {
      if (isLockedRef.current || !dekRef.current) throw new Error('الخزينة مقفلة');

      const finalized = await SessionService.finalizeSession(sessionId, therapistName, dekRef.current);
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? finalized : s)));
      return finalized;
    },
    []
  );

  const deleteSession = useCallback(
    async (sessionId: string): Promise<void> => {
      if (isLockedRef.current || !dekRef.current) throw new Error('الخزينة مقفلة');

      await SessionService.deleteSession(sessionId, dekRef.current);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    },
    []
  );

  const getSoapNote = useCallback(
    async (sessionId: string): Promise<SoapNoteRecord | null> => {
      if (isLockedRef.current || !dekRef.current) throw new Error('الخزينة مقفلة');
      return SoapService.getSoapNoteBySession(sessionId, dekRef.current);
    },
    []
  );

  const saveSoapNote = useCallback(
    async (
      patientId: string,
      episodeId: string,
      sessionId: string,
      data: SoapNoteData,
      existingSoapId?: string
    ): Promise<SoapNoteRecord> => {
      if (isLockedRef.current || !dekRef.current) throw new Error('الخزينة مقفلة');

      if (existingSoapId) {
        return SoapService.updateSoapNote(existingSoapId, data, dekRef.current);
      } else {
        // Check if one already exists
        const existing = await SoapService.getSoapNoteBySession(sessionId, dekRef.current);
        if (existing) {
          return SoapService.updateSoapNote(existing.id, data, dekRef.current);
        }
        return SoapService.createSoapNote(patientId, episodeId, sessionId, data, dekRef.current);
      }
    },
    []
  );

  const getAddenda = useCallback(
    async (sessionId: string): Promise<ClinicalAddendumRecord[]> => {
      if (isLockedRef.current || !dekRef.current) throw new Error('الخزينة مقفلة');
      const res = await SoapService.getAddendaBySession(sessionId, dekRef.current);
      return res.records;
    },
    []
  );

  const addAddendum = useCallback(
    async (
      sessionId: string,
      targetTable: 'sessions' | 'soapNotes',
      targetId: string,
      data: {
        reasonForAmendment: AddendumReason;
        amendmentText: string;
        signedByTherapistName: string;
      }
    ): Promise<ClinicalAddendumRecord> => {
      if (isLockedRef.current || !dekRef.current) throw new Error('الخزينة مقفلة');
      return SoapService.addClinicalAddendum(sessionId, targetTable, targetId, data, dekRef.current);
    },
    []
  );

  return (
    <SessionContext.Provider
      value={{
        sessions,
        loadingSessions,
        activeEpisodeId,
        loadSessionsForEpisode,
        createSession,
        updateSession,
        cancelSession,
        finalizeSession,
        deleteSession,
        getSoapNote,
        saveSoapNote,
        getAddenda,
        addAddendum,
        clearSessions,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
};

export const useSessions = (): SessionContextType => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSessions must be used within a SessionProvider');
  }
  return context;
};
