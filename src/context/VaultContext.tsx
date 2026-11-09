// =======================================================================
// PhysioRecord — Vault & Authentication Context (Envelope Encryption v1.1)
// Phase 1B: KDF Auto-Upgrade, Emergency Recovery Key, and Bulletproof Auto-Lock
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
  checkNeedsKdfUpgrade,
  autoUpgradeVaultKdf,
  resetVaultPasswordWithRecoveryKey,
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
  autoLockTimeoutMs: number;
  setAutoLockTimeoutMs: (timeoutMs: number) => void;
  dismissRepairNotice: () => void;
  setupPassword: (password: string) => Promise<{ recoveryKeyFormatted: string }>;
  unlock: (password: string) => Promise<boolean>;
  resetPasswordWithRecovery: (recoveryKey: string, newPassword: string) => Promise<{ newRecoveryKeyFormatted: string }>;
  changeVaultPassword: (oldPass: string, newPass: string) => Promise<void>;
  lock: () => void;
  wipeDatabase: () => Promise<void>;
}

const VaultContext = createContext<VaultContextType | null>(null);

const DEFAULT_AUTO_LOCK_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes default (Phase 1B)

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

  // Configurable inactivity auto-lock timeout (Phase 1B)
  const [autoLockTimeoutMs, setAutoLockTimeoutMsState] = useState<number>(() => {
    if (typeof localStorage !== 'undefined') {
      const saved = localStorage.getItem('physiorecord_autolock_timeout_ms');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 60_000) return parsed;
      }
    }
    return DEFAULT_AUTO_LOCK_TIMEOUT_MS;
  });

  const setAutoLockTimeoutMs = useCallback((newMs: number) => {
    const clamped = Math.max(60_000, newMs);
    setAutoLockTimeoutMsState(clamped);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('physiorecord_autolock_timeout_ms', String(clamped));
    }
  }, []);

  const lastActivityRef = useRef<number>(Date.now());
  const hiddenAtRef = useRef<number | null>(null);
  const autoLockTimerRef = useRef<NodeJS.Timeout | null>(null);

  const dismissRepairNotice = useCallback(() => {
    setLastRepairSummary(null);
    setRepairError(null);
  }, []);

  // Best-effort sensitive memory cleanup and lock (Phase 1B)
  // Explicitly clears React state and resets memory references
  const lock = useCallback(() => {
    setDek(null);
    setVaultKek(null);
    setVaultGeneration(null);
    setIsLocked(true);
    hiddenAtRef.current = null;
    if (autoLockTimerRef.current) {
      clearTimeout(autoLockTimerRef.current);
      autoLockTimerRef.current = null;
    }
  }, []);

  // Update activity timestamp ONLY when the tab is visible (Phase 1B requirement: Do NOT update if hidden!)
  const updateActivity = useCallback(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
    lastActivityRef.current = Date.now();
  }, []);

  // Multi-tier Bulletproof Inactivity Monitor (Phase 1B):
  // 1. User interactions when tab is visible update lastActivityRef.
  // 2. Hidden-tab bypass fix: When document.visibilityState becomes 'hidden', record hiddenAt.
  //    When document becomes 'visible', check Date.now() - hiddenAt and Date.now() - lastActivity.
  //    If either exceeds timeout, lock IMMEDIATELY.
  // 3. Heartbeat interval check every 10 seconds.
  useEffect(() => {
    if (isLocked) return;

    const checkInactivityAndLock = () => {
      const now = Date.now();
      const elapsedSinceActivity = now - lastActivityRef.current;
      const elapsedSinceHidden = hiddenAtRef.current !== null ? now - hiddenAtRef.current : 0;

      if (elapsedSinceActivity >= autoLockTimeoutMs || elapsedSinceHidden >= autoLockTimeoutMs) {
        console.warn('PhysioRecord: Inactivity timeout reached. Locking vault.');
        lock();
        return true;
      }
      return false;
    };

    const handleUserInteraction = () => {
      if (document.visibilityState === 'visible') {
        updateActivity();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Tab went to background: record hiddenAt. Do NOT update activity timestamp!
        hiddenAtRef.current = Date.now();
      } else if (document.visibilityState === 'visible') {
        // Tab resumed / became visible: check elapsed duration while hidden
        if (hiddenAtRef.current !== null) {
          const elapsedHidden = Date.now() - hiddenAtRef.current;
          const elapsedActivity = Date.now() - lastActivityRef.current;
          if (elapsedHidden >= autoLockTimeoutMs || elapsedActivity >= autoLockTimeoutMs) {
            console.warn(
              `PhysioRecord: Auto-locking vault on resume (hidden duration: ${elapsedHidden}ms, total inactive: ${elapsedActivity}ms)`
            );
            hiddenAtRef.current = null;
            lock();
            return;
          }
          hiddenAtRef.current = null;
        }
        // If still within allowed timeout, refresh activity timestamp on becoming active
        updateActivity();
      }
    };

    // Periodic heartbeat check every 10 seconds
    const heartbeat = setInterval(() => {
      checkInactivityAndLock();
    }, 10 * 1000);

    const events = ['mousedown', 'keydown', 'touchstart', 'scroll', 'pointerdown'];
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
  }, [isLocked, lock, updateActivity, autoLockTimeoutMs]);

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

  // Setup Vault with Envelope Encryption (Non-extractable DEK + Vault KEK + Emergency Recovery Key)
  const setupPassword = useCallback(async (password: string): Promise<{ recoveryKeyFormatted: string }> => {
    if (password.length < 10) {
      throw new Error('يجب ألا تقل كلمة المرور عن 10 خانات.');
    }

    // 1. Derive Vault KEK from password with 600,000 iterations
    const salt = randomBytes(CONSTANTS.SALT_BYTES);
    const kek = await deriveKEK(password, salt, CONSTANTS.DEFAULT_PBKDF2_ITERATIONS);

    // 2. Generate random 256-bit DEK, wrap under KEK and Emergency Recovery Key, and import as NON-EXTRACTABLE
    const gen = 1;
    const {
      operationalDek,
      wrappedDek,
      wrappedDekIv,
      recoveryKeyFormatted,
      recoveryWrappedDek,
      recoveryWrappedDekIv,
      recoverySalt,
      recoveryKdfIterations,
    } = await generateAndWrapOperationalDEK(kek, gen);
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
      recoveryWrappedDek,
      recoveryWrappedDekIv,
      recoverySalt,
      recoveryKdfIterations,
    });

    setDek(operationalDek);
    setVaultKek(kek);
    setVaultGeneration(gen);
    setIsInitialized(true);
    setIsLocked(false);
    updateActivity();

    return { recoveryKeyFormatted: recoveryKeyFormatted || '' };
  }, [updateActivity]);

  // Unlock Vault: Verify KEK -> Auto-Upgrade KDF if needed -> Unwrap DEK as NON-EXTRACTABLE
  // -> Run repair & migrations -> Refresh storage persistence
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

    // Phase 1B: KDF Auto-Upgrade
    // If vaultMeta indicates kdfIterations < 600000 or salt < 16 bytes, automatically re-derive KEK
    // and re-wrap the EXISTING operational DEK without touching the DEK or clinical records.
    let activeVaultKek = candidateKek;
    if (checkNeedsKdfUpgrade(meta)) {
      try {
        const upgradeResult = await autoUpgradeVaultKdf(db, meta, candidateKek, password);
        if (upgradeResult.upgraded) {
          activeVaultKek = upgradeResult.newVaultKek;
        }
      } catch (upgradeErr) {
        console.warn('Auto KDF upgrade non-fatal error:', upgradeErr);
      }
    }

    // Unwrap DEK as non-extractable CryptoKey and bind to active vaultGeneration
    const gen = meta.vaultGeneration ?? 1;
    const recoveredDek = await unwrapOperationalDEK(meta.wrappedDek, meta.wrappedDekIv, activeVaultKek, gen);
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

    // Refresh persistent storage grant status after user gesture
    try {
      const persistent = await requestPersistentStorage();
      setPersistenceGranted(persistent);
    } catch {
      // ignore
    }

    setDek(recoveredDek);
    setVaultKek(activeVaultKek);
    setVaultGeneration(gen);
    setIsLocked(false);
    updateActivity();
    return true;
  }, [updateActivity]);

  // Emergency Password Reset using Recovery Key (Phase 1B)
  const resetPasswordWithRecovery = useCallback(
    async (recoveryKey: string, newPassword: string): Promise<{ newRecoveryKeyFormatted: string }> => {
      const result = await resetVaultPasswordWithRecoveryKey(db, recoveryKey, newPassword);
      setDek(result.operationalDek);
      setVaultKek(result.newVaultKek);
      const meta = await db.vaultMeta.get('auth');
      const gen = meta?.vaultGeneration ?? 1;
      setVaultGeneration(gen);
      setIsLocked(false);
      updateActivity();
      return { newRecoveryKeyFormatted: result.newRecoveryKeyFormatted };
    },
    [updateActivity]
  );

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
      recoveryWrappedDek: meta.recoveryWrappedDek,
      recoveryWrappedDekIv: meta.recoveryWrappedDekIv,
      recoverySalt: meta.recoverySalt,
      recoveryKdfIterations: meta.recoveryKdfIterations,
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

  // Wipe database completely and purge all local clinical data
  const wipeDatabase = useCallback(async () => {
    lock();
    await db.delete();
    await db.open();

    // Clear ANY remaining physiorecord_* keys from localStorage
    if (typeof localStorage !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('physiorecord_')) {
          keysToRemove.push(k);
        }
      }
      for (const k of keysToRemove) {
        localStorage.removeItem(k);
      }
    }

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
        autoLockTimeoutMs,
        setAutoLockTimeoutMs,
        dismissRepairNotice,
        setupPassword,
        unlock,
        resetPasswordWithRecovery,
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
