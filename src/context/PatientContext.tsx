// =======================================================================
// PhysioRecord — Patient Data Context (Envelope Encryption v1.1)
// =======================================================================

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { db } from '../db/db';
import { useVault } from './VaultContext';
import {
  encryptRecordWithMandatoryReservation,
  decryptRecordPayload,
  CURRENT_RECORD_CRYPTO_VERSION,
  CURRENT_DEK_VERSION,
} from '../crypto/vault';
import type { PatientRecord, PatientClinicalData, EncryptedPatientEntity } from '../types/clinical';

interface PatientContextType {
  patients: PatientRecord[];
  activePatients: PatientRecord[];
  archivedPatients: PatientRecord[];
  loading: boolean;
  savePatient: (data: PatientClinicalData, existingId?: string) => Promise<PatientRecord>;
  archivePatient: (id: string) => Promise<void>;
  unarchivePatient: (id: string) => Promise<void>;
  deletePatientPermanently: (
    id: string,
    backupProof?: { verifiedBackupString: string; bypassForTest?: boolean }
  ) => Promise<void>;
  refreshPatients: () => Promise<void>;
}

const PatientContext = createContext<PatientContextType | null>(null);

export const PatientProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isLocked, dek } = useVault();
  const [patients, setPatients] = useState<PatientRecord[]>([]);
  const [loading, setLoading] = useState(false);

  // Synchronization refs to eliminate asynchronous state leakage on vault lock
  const isLockedRef = useRef(isLocked);
  isLockedRef.current = isLocked;

  const dekRef = useRef<CryptoKey | null>(dek);
  dekRef.current = dek;

  const fetchGenerationRef = useRef(0);

  // Load and decrypt all patients using DEK and verifying AAD
  const refreshPatients = useCallback(async () => {
    if (isLocked || !dek) {
      setPatients([]);
      return;
    }

    const currentGeneration = ++fetchGenerationRef.current;
    setLoading(true);
    try {
      const encryptedEntities = await db.patients.toArray();
      const decryptedList: PatientRecord[] = [];

      for (const entity of encryptedEntities) {
        // Abort immediately if the vault was locked while async decryption was running!
        if (isLockedRef.current || !dekRef.current || fetchGenerationRef.current !== currentGeneration) {
          return;
        }

        try {
          // Decrypt with DEK and verify AAD binding (including dekVersion)
          const decryptedData = await decryptRecordPayload<PatientClinicalData>(
            dekRef.current,
            'patients',
            entity.id,
            [], // patients table has no parent IDs
            entity.iv,
            entity.ciphertext,
            entity.recordCryptoVersion || CURRENT_RECORD_CRYPTO_VERSION,
            entity.dekVersion || CURRENT_DEK_VERSION
          );

          decryptedList.push({
            id: entity.id,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
            isArchived: entity.isArchived ?? 0,
            data: decryptedData,
          });
        } catch (decryptErr) {
          console.error(`Failed to decrypt patient record ${entity.id} (AAD or Auth Tag failure):`, decryptErr);
        }
      }

      // Check again before committing to React state
      if (isLockedRef.current || !dekRef.current || fetchGenerationRef.current !== currentGeneration) {
        return;
      }

      // Sort by newest updated
      decryptedList.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setPatients(decryptedList);
    } catch (err) {
      console.error('Error fetching patients from local database:', err);
    } finally {
      if (fetchGenerationRef.current === currentGeneration) {
        setLoading(false);
      }
    }
  }, [isLocked, dek]);

  // Sync with vault lock status
  useEffect(() => {
    if (!isLocked && dek) {
      refreshPatients();
    } else {
      setPatients([]); // Best-effort sensitive memory cleanup on lock
    }
  }, [isLocked, dek, refreshPatients]);

  // Create or Update Patient Record
  const savePatient = async (data: PatientClinicalData, existingId?: string): Promise<PatientRecord> => {
    if (!dek || isLocked) throw new Error('الخزينة مقفلة');

    const now = new Date().toISOString();
    const id = existingId || crypto.randomUUID();
    const existingPatient = existingId ? patients.find(p => p.id === existingId) : null;
    const isArchived = existingPatient?.isArchived ?? 0;
    const createdAt = existingPatient?.createdAt || now;

    // Get active dekVersion
    const meta = await db.vaultMeta.get('auth');
    const activeDekVersion = meta?.dekVersion || CURRENT_DEK_VERSION;

    // Centralized encryption with MANDATORY invocation counter reservation
    // Atomically reserves counter on database.vaultMeta first, then encrypts with Web Crypto outside Dexie transaction
    const { iv, ciphertext } = await encryptRecordWithMandatoryReservation(
      db,
      dek,
      'patients',
      id,
      [],
      data,
      CURRENT_RECORD_CRYPTO_VERSION,
      activeDekVersion
    );

    const entity: EncryptedPatientEntity = {
      id,
      createdAt,
      updatedAt: now,
      isArchived,
      recordCryptoVersion: CURRENT_RECORD_CRYPTO_VERSION,
      dekVersion: activeDekVersion,
      iv,
      ciphertext,
    };

    // Atomic Dexie write
    await db.patients.put(entity);

    const record: PatientRecord = {
      id,
      createdAt,
      updatedAt: now,
      isArchived,
      data,
    };

    setPatients(prev => {
      // If locked in the meantime, do not retain decrypted state
      if (isLockedRef.current || !dekRef.current) return [];
      const filtered = prev.filter(p => p.id !== id);
      return [record, ...filtered];
    });

    return record;
  };

  // Soft-archive patient (Default safe clinical operation)
  const archivePatient = async (id: string): Promise<void> => {
    await db.archivePatient(id);
    setPatients(prev =>
      prev.map(p => (p.id === id ? { ...p, isArchived: 1, updatedAt: new Date().toISOString() } : p))
    );
  };

  // Restore archived patient
  const unarchivePatient = async (id: string): Promise<void> => {
    await db.unarchivePatient(id);
    setPatients(prev =>
      prev.map(p => (p.id === id ? { ...p, isArchived: 0, updatedAt: new Date().toISOString() } : p))
    );
  };

  // Permanent physical deletion (Safeguarded with Safety Gate & Backup Proof)
  const deletePatientPermanently = async (
    id: string,
    backupProof?: { verifiedBackupString: string; bypassForTest?: boolean }
  ): Promise<void> => {
    await db.deletePatientPermanently(id, backupProof);
    setPatients(prev => prev.filter(p => p.id !== id));
  };

  const activePatients = patients.filter(p => !p.isArchived);
  const archivedPatients = patients.filter(p => p.isArchived === 1);

  return (
    <PatientContext.Provider
      value={{
        patients,
        activePatients,
        archivedPatients,
        loading,
        savePatient,
        archivePatient,
        unarchivePatient,
        deletePatientPermanently,
        refreshPatients,
      }}
    >
      {children}
    </PatientContext.Provider>
  );
};

export const usePatients = () => {
  const context = useContext(PatientContext);
  if (!context) throw new Error('usePatients must be used within a PatientProvider');
  return context;
};
