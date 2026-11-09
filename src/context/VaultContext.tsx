// =======================================================================
// PhysioRecord — Vault & Authentication Context (Envelope Encryption v1.1)
// =======================================================================

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { db, requestPersistentStorage } from '../db/db';
import {
  generateAndWrapOperationalDEK,
  unwrapOperationalDEK,
  decryptRawDEKForBackup,
  wrapDEK,
  deriveKEK,
  generateVerifier,
  checkVerifier,
  randomBytes,
  bindDekToGeneration,
  CONSTANTS,
  CURRENT_DEK_VERSION,
} from '../crypto/vault';
import { subscribeToVaultEvents, broadcastVaultEvent } from '../utils/vaultEvents';
import { SessionService } from '../services/sessionService';
import { LocalStorageMigrationService, type LocalStorageMigrationResult } from '../services/localStorageMigrationService';

export interface VaultRepairSummary {
  repairedCount: number;
  skippedCount: number;
  repairedSessionIds: string[];
  skippedSessionIds: string[];
  repairedSessions: Array<{
    sessionId: string;
    episodeId: string;
    patientId: string;
  }>;
}

interface VaultContextType {
  ready: boolean;
  isInitialized: boolean;
  isLocked: boolean;
  dek: CryptoKey | null; // Operational non-extractable DEK
  vaultKek: CryptoKey | null; // Active Vault KEK held only while unlocked
  vaultGeneration: number | null; // Technical epoch/generation bound to in-memory DEK
  persistenceGranted: boolean;
  lastRepairSummary: VaultRepairSummary | null;
  repairError: string | null;
  lastMigrationResult: LocalStorageMigrationResult | null;
  dismissRepairNotice: () => void;
  setupPassword: (password: string) => Promise<void>;
  unlock: (password: string) => Promise<boolean>;
  changeVaultPassword: (oldPass: string, newPass: string) => Promise<void>;
  lock: () => void;
  wipeDatabase: () => Promise<void>;
}

const VaultContext = createContext<VaultContextType | null>(null);

const AUTO_LOCK_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes of inactivity

export const VaultProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLocked, setIsLocked] = useState(true);
  const [dek, setDek] = useState<CryptoKey | null>(null);
  const [vaultKek, setVaultKek] = useState<CryptoKey | null>(null);
  const [vaultGeneration, setVaultGeneration] = useState<number | null>(null);
  const [persistenceGranted, setPersistenceGranted] = useState(false);
  const [lastRepairSummary, setLastRepairSummary] = useState<VaultRepairSummary | null>(null);
  const [repairError, setRepairError] = useState<string | null>(null);
  const [lastMigrationResult, setLastMigrationResult] = useState<LocalStorageMigrationResult | null>(null);

  const lastActivityRef = useRef<number>(Date.now());
  const autoLockTimerRef = useRef<NodeJS.Timeout | null>(null);

  const dismissRepairNotice = useCallback(() => {
    setLastRepairSummary(null);
    setRepairError(null);
  }, []);

  // Best-effort sensitive memory cleanup and lock
  const lock = useCallback(() => {
    setDek(null);
    setVaultKek(null);
    setVaultGeneration(null);
    setIsLocked(true);
    if (autoLockTimerRef.current) {
      clearTimeout(autoLockTimerRef.current);
      autoLockTimerRef.current = null;
    }
  }, []);

  // Update activity timestamp
  const updateActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Multi-tier Inactivity Monitor: Event Listener + VisibilityChange + Heartbeat
  useEffect(() => {
    if (isLocked) return;

    const handleUserInteraction = () => {
      updateActivity();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastActivityRef.current;
        if (elapsed >= AUTO_LOCK_TIMEOUT_MS) {
          console.warn('PhysioRecord: Auto-locking vault on resume (exceeded 30 minutes in background)');
          lock();
        }
      } else {
        // App went to background
        updateActivity();
      }
    };

    // Periodic heartbeat check every 60 seconds
    const heartbeat = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= AUTO_LOCK_TIMEOUT_MS) {
        console.warn('PhysioRecord: Auto-locking vault (heartbeat inactivity trigger)');
        lock();
      }
    }, 60 * 1000);

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(evt => window.addEventListener(evt, handleUserInteraction, { passive: true }));
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      events.forEach(evt => window.removeEventListener(evt, handleUserInteraction));
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearInterval(heartbeat);
      if (autoLockTimerRef.current) {
        clearTimeout(autoLockTimerRef.current);
      }
    };
  }, [isLocked, lock, updateActivity]);

  // Initial boot check
  useEffect(() => {
    const initCheck = async () => {
      try {
        const meta = await db.vaultMeta.get('auth');
        setIsInitialized(!!meta);
        const persistent = await requestPersistentStorage();
        setPersistenceGranted(persistent);
      } catch (err) {
        console.error('Failed to read vault metadata:', err);
      } finally {
        setReady(true);
      }
    };
    initCheck();
  }, []);

  // Setup Vault with Envelope Encryption (Non-extractable DEK + Vault KEK)
  const setupPassword = useCallback(async (password: string) => {
    if (password.length < 6) {
      throw new Error('يجب ألا تقل كلمة المرور عن 6 خانات.');
    }

    // 1. Derive Vault KEK from password
    const salt = randomBytes(CONSTANTS.SALT_BYTES);
    const kek = await deriveKEK(password, salt, CONSTANTS.DEFAULT_PBKDF2_ITERATIONS);

    // 2. Generate random 256-bit DEK, wrap under KEK, and import as NON-EXTRACTABLE
    const gen = 1;
    const { operationalDek, wrappedDek, wrappedDekIv } = await generateAndWrapOperationalDEK(kek, gen);
    bindDekToGeneration(operationalDek, gen);

    // 3. Generate verifier token
    const { verifierIv, verifierCiphertext } = await generateVerifier(kek);

    // 4. Store in vaultMeta
    await db.vaultMeta.put({
      id: 'auth',
      salt,
      wrappedDek,
      wrappedDekIv,
      verifierIv,
      verifierCiphertext,
      schemaVersion: 1,
      kdfAlgorithm: 'PBKDF2-HMAC-SHA256',
      kdfIterations: CONSTANTS.DEFAULT_PBKDF2_ITERATIONS,
      dekVersion: CURRENT_DEK_VERSION,
      encryptionInvocationCount: 0,
      vaultGeneration: gen,
    });

    setDek(operationalDek);
    setVaultKek(kek);
    setVaultGeneration(gen);
    setIsInitialized(true);
    setIsLocked(false);
    updateActivity();
  }, [updateActivity]);

  // Unlock Vault: Verify KEK -> Unwrap DEK as NON-EXTRACTABLE into volatile memory
  // -> Run idempotent repair for any pre-1A-i.5 half-finalized sessions and surface result/errors to UI
  const unlock = useCallback(async (password: string): Promise<boolean> => {
    const meta = await db.vaultMeta.get('auth');
    if (!meta) throw new Error('الخزينة غير مهيأة بعد');

    const candidateKek = await deriveKEK(
      password,
      meta.salt,
      meta.kdfIterations || CONSTANTS.DEFAULT_PBKDF2_ITERATIONS
    );

    const isValid = await checkVerifier(candidateKek, meta.verifierIv, meta.verifierCiphertext);
    if (!isValid) return false;

    // Unwrap DEK as non-extractable CryptoKey and bind to active vaultGeneration
    const gen = meta.vaultGeneration ?? 1;
    const recoveredDek = await unwrapOperationalDEK(meta.wrappedDek, meta.wrappedDekIv, candidateKek, gen);
    bindDekToGeneration(recoveredDek, gen);

    try {
      const repairResult = await SessionService.repairHalfFinalizedSessions(recoveredDek, db);
      setRepairError(null);
      if (repairResult.repairedCount > 0 || repairResult.skippedCount > 0) {
        setLastRepairSummary({
          repairedCount: repairResult.repairedCount,
          skippedCount: repairResult.skippedCount,
          repairedSessionIds: repairResult.repairedSessionIds,
          skippedSessionIds: repairResult.skippedSessionIds,
          repairedSessions: repairResult.repairedSessions,
        });
      } else {
        setLastRepairSummary(null);
      }

      const migrationResult = await LocalStorageMigrationService.runMigration(recoveredDek, db);
      setLastMigrationResult(migrationResult);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'فشل فحص وإصلاح حالة قفل الملاحظات السريرية بعد فتح الخزينة.';
      setRepairError(msg);
    }

    setDek(recoveredDek);
    setVaultKek(candidateKek);
    setVaultGeneration(gen);
    setIsLocked(false);
    updateActivity();
    return true;
  }, [updateActivity]);

  // Change Vault Password in O(1) without re-encrypting records
  const changeVaultPassword = useCallback(async (oldPass: string, newPass: string) => {
    const meta = await db.vaultMeta.get('auth');
    if (!meta) throw new Error('الخزينة غير مهيأة');
    if (!dek) throw new Error('الخزينة مقفلة');

    // Verify old password
    const oldKek = await deriveKEK(oldPass, meta.salt, meta.kdfIterations);
    const isValid = await checkVerifier(oldKek, meta.verifierIv, meta.verifierCiphertext);
    if (!isValid) {
      throw new Error('كلمة المرور الحالية غير صحيحة.');
    }

    // Derive new KEK with fresh salt
    const newSalt = randomBytes(CONSTANTS.SALT_BYTES);
    const newKek = await deriveKEK(newPass, newSalt, CONSTANTS.DEFAULT_PBKDF2_ITERATIONS);

    // Temporarily recover raw DEK bytes via oldKek and re-wrap under newKek
    const rawDekBytes = await decryptRawDEKForBackup(meta.wrappedDek, meta.wrappedDekIv, oldKek);
    const { wrappedDek, wrappedDekIv } = await wrapDEK(rawDekBytes, newKek);
    rawDekBytes.fill(0); // Immediately zero transient raw buffer

    const { verifierIv, verifierCiphertext } = await generateVerifier(newKek);

    const currentGen = meta.vaultGeneration ?? 1;

    // Update vaultMeta
    await db.vaultMeta.put({
      id: 'auth',
      salt: newSalt,
      wrappedDek,
      wrappedDekIv,
      verifierIv,
      verifierCiphertext,
      schemaVersion: meta.schemaVersion,
      kdfAlgorithm: 'PBKDF2-HMAC-SHA256',
      kdfIterations: CONSTANTS.DEFAULT_PBKDF2_ITERATIONS,
      dekVersion: meta.dekVersion || CURRENT_DEK_VERSION,
      encryptionInvocationCount: meta.encryptionInvocationCount || 0,
      vaultGeneration: currentGen,
    });

    bindDekToGeneration(dek, currentGen);
    setVaultKek(newKek);
    setVaultGeneration(currentGen);
    updateActivity();

    // Broadcast password change to other open tabs
    broadcastVaultEvent({
      type: 'VAULT_PASSWORD_CHANGED',
      generation: currentGen,
    });
  }, [dek, updateActivity]);

  // Cross-Tab Vault Synchronization:
  // When another tab performs Full Restore or rotates credentials, immediately lock and wipe memory
  useEffect(() => {
    const unsubscribe = subscribeToVaultEvents((event) => {
      if (event.type === 'VAULT_GENERATION_CHANGED' || event.type === 'VAULT_PASSWORD_CHANGED') {
        console.warn(`PhysioRecord: Cross-tab ${event.type} event received. Locking vault.`);
        lock();
      }
    });
    return unsubscribe;
  }, [lock]);

  // Wipe database completely
  const wipeDatabase = useCallback(async () => {
    lock();
    await db.delete();
    await db.open();
    setIsInitialized(false);
    setIsLocked(true);
  }, [lock]);

  return (
    <VaultContext.Provider
      value={{
        ready,
        isInitialized,
        isLocked,
        dek,
        vaultKek,
        vaultGeneration,
        persistenceGranted,
        lastRepairSummary,
        repairError,
        lastMigrationResult,
        dismissRepairNotice,
        setupPassword,
        unlock,
        changeVaultPassword,
        lock,
        wipeDatabase,
      }}
    >
      {children}
    </VaultContext.Provider>
  );
};

export const useVault = () => {
  const context = useContext(VaultContext);
  if (!context) throw new Error('useVault must be used within a VaultProvider');
  return context;
};
