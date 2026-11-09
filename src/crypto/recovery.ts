// =======================================================================
// PhysioRecord — Emergency Recovery Architecture (v1.1)
// 
// Dual Recovery Strategy:
// 1. External Encrypted Emergency Backup (.ptbackup outside browser storage)
// 2. Internal Logical Recovery Database (PhysioRecordEmergencyRecoveryDB)
// =======================================================================

import Dexie, { type Table } from 'dexie';
import type { PhysioRecordDatabase } from '../db/db';
import type { VaultMetaEntity } from '../types/clinical';
import { CLINICAL_STORES_REGISTRY } from '../db/registry';
import {
  exportBackupPackage,
  restoreBackupPackage,
  buildCanonicalBackupHeaderAAD,
  type ExportedBackupPackage,
} from './backup';
import {
  subtle,
  deriveBackupKeys,
  unwrapDEKFromBackup,
  decryptBackupPayload,
  validateBackupHeaderPreDerivation,
  decryptRecordPayload,
  CURRENT_DEK_VERSION,
  CURRENT_RECORD_CRYPTO_VERSION,
} from './vault';

export interface EmergencyRecoverySnapshotEntity {
  id: string; // Primary key: e.g. 'pre_restore_2026-11-06T14-30-00Z'
  createdAt: string; // ISO 8601
  note: string;
  patientCount: number;
  sessionCount: number;
  packageJson: string; // Full encrypted .ptbackup JSON string (NO PLAINTEXT PASSWORD!)
}

/**
 * ARCHITECTURAL CLARIFICATION ON RECOVERY ISOLATION:
 * 
 * 1. Internal Logical Recovery Database (PhysioRecordEmergencyRecoveryDB):
 *    - This is a distinct Dexie/IndexedDB database within the SAME browser origin storage environment.
 *    - It provides LOGICAL isolation: application-level clear/bulkPut/restore operations on
 *      `PhysioRecordDB` will not touch or delete records in `PhysioRecordEmergencyRecoveryDB`.
 *    - LIMITATIONS: Because it shares the browser origin, it DOES NOT guarantee recovery from:
 *      (a) User or system clearing browser browsing data / site storage.
 *      (b) Origin-wide storage eviction under disk pressure.
 *      (c) Browser profile deletion or corruption.
 *      (d) Device loss or physical hardware storage failure.
 *    - It is therefore categorized as an INTERNAL safety net, NOT an external physical backup.
 * 
 * 2. External Encrypted Emergency Backup (.ptbackup):
 *    - A standalone, fully encrypted .ptbackup artifact saved outside browser storage to the host OS.
 *    - Provides TRUE physical independence from browser profile wipes and site data clearing.
 *    - Protected by PBKDF2-HMAC-SHA256 (600,000 iter) + HKDF-SHA256 (32-byte salt) + AES-256-GCM.
 *    - The plaintext password is NEVER persisted in IndexedDB, localStorage, or sessionStorage.
 */
export class PhysioRecordEmergencyRecoveryDatabase extends Dexie {
  recoverySnapshots!: Table<EmergencyRecoverySnapshotEntity, string>;

  constructor() {
    super('PhysioRecordEmergencyRecoveryDB');
    this.version(1).stores({
      recoverySnapshots: '&id, createdAt',
    });
  }
}

export const recoveryDb = new PhysioRecordEmergencyRecoveryDatabase();

export interface DurableRecoveryResult {
  snapshotId: string;
  createdAt: string;
  patientCount: number;
  sessionCount: number;
  backupPackageStr: string;
}

export interface ExternalSaveResult {
  method: 'fs-access' | 'download-fallback';
  confirmedSaved: boolean;
  fileName: string;
}

/**
 * Creates and persists the pre-restore emergency recovery backup.
 * 
 * Guarantees:
 * 1. Contains 100% of current clinical records.
 * 2. Contains a backup-protected recovery path for the currently active DEK.
 * 3. Pre-validated via in-memory preview before destructive restoration proceeds.
 * 4. Stored in internal logical recovery database (`PhysioRecordEmergencyRecoveryDB`).
 * 5. Plaintext password is NEVER stored in IndexedDB, localStorage, or sessionStorage!
 */
export const createDurablePreRestoreRecoveryBackup = async (
  targetDatabase: PhysioRecordDatabase,
  currentVaultMeta: VaultMetaEntity,
  currentVaultKek: CryptoKey,
  recoveryPassword: string,
  note = 'نسخة تعافٍ طارئة قبل استبدال قاعدة البيانات'
): Promise<DurableRecoveryResult> => {
  if (!recoveryPassword || recoveryPassword.length < 6) {
    throw new Error('يجب ألا تقل كلمة مرور حماية نسخة التعافي عن 6 خانات.');
  }

  // 1. Export full encrypted .ptbackup package of current clinical database
  const backupPackageStr = await exportBackupPackage(
    targetDatabase,
    currentVaultMeta,
    currentVaultKek,
    recoveryPassword
  );

  // 2. Mathematically prove 100% full decryptability and integrity of the emergency recovery package
  let pkg: ExportedBackupPackage;
  try {
    pkg = JSON.parse(backupPackageStr) as ExportedBackupPackage;
  } catch {
    throw new Error('فشلت معالجة حزمة نسخة التعافي الطارئة: JSON معطوب.');
  }

  validateBackupHeaderPreDerivation(pkg.header);

  const header = pkg.header;
  const backupSalt = new Uint8Array(header.backupSalt);
  const hkdfSalt = new Uint8Array(header.hkdfSalt);
  const backupDekIv = new Uint8Array(header.backupDekIv);
  const backupWrappedDek = new Uint8Array(header.backupWrappedDek);
  const backupDataIv = new Uint8Array(header.backupDataIv);
  const payloadCiphertext = new Uint8Array(pkg.payloadCiphertext);

  const { backupDekWrapKey, backupPayloadEncKey } = await deriveBackupKeys(
    recoveryPassword,
    backupSalt,
    hkdfSalt,
    header.kdfIterations
  );

  // A. Prove unwrapping of the DEK (authenticated tag verified)
  const recoveredRawDek = await unwrapDEKFromBackup(
    backupWrappedDek,
    backupDekIv,
    backupDekWrapKey
  );

  // B. Prove decryption of payload with canonical header AAD
  const headerAad = buildCanonicalBackupHeaderAAD(header);
  const decryptedPayloadJson = await decryptBackupPayload(
    backupPayloadEncKey,
    headerAad,
    backupDataIv,
    payloadCiphertext
  );

  interface SerializedRecoveryRecord {
    id: string;
    iv: number[];
    ciphertext: number[];
    recordCryptoVersion?: number;
    dekVersion?: number;
    [key: string]: unknown;
  }

  let snapshot: Record<string, SerializedRecoveryRecord[]>;
  try {
    snapshot = JSON.parse(decryptedPayloadJson) as Record<string, SerializedRecoveryRecord[]>;
  } catch {
    throw new Error('فشل قراءة حمولة نسخة التعافي الطارئة بعد فك التشفير.');
  }

  // C. Prove that the recovered DEK can cleanly decrypt EVERY record across ALL clinical stores
  const testDek = await subtle.importKey(
    'raw',
    recoveredRawDek,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // Zero raw DEK copy
  recoveredRawDek.fill(0);

  for (const storeDef of Object.values(CLINICAL_STORES_REGISTRY)) {
    const records = snapshot[storeDef.name];
    if (Array.isArray(records)) {
      for (const r of records) {
        const parentIds = storeDef.parentKeys
          .map((k) => r[k])
          .filter((v): v is string => typeof v === 'string' && Boolean(v));
        const sourceDekVersion = r.dekVersion || header.dekVersion || CURRENT_DEK_VERSION;
        await decryptRecordPayload(
          testDek,
          storeDef.name,
          r.id,
          parentIds,
          new Uint8Array(r.iv),
          new Uint8Array(r.ciphertext),
          r.recordCryptoVersion || CURRENT_RECORD_CRYPTO_VERSION,
          sourceDekVersion
        );
      }
    }
  }

  // 3. Persist into the internal logical recovery database
  const snapshotId = `pre_restore_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const createdAt = new Date().toISOString();
  const patientCount = Array.isArray(snapshot.patients) ? snapshot.patients.length : 0;
  const sessionCount = Array.isArray(snapshot.sessions) ? snapshot.sessions.length : 0;

  await recoveryDb.recoverySnapshots.put({
    id: snapshotId,
    createdAt,
    note,
    patientCount,
    sessionCount,
    packageJson: backupPackageStr,
  });

  // Verify write persistence in recovery database
  const confirmed = await recoveryDb.recoverySnapshots.get(snapshotId);
  if (!confirmed || !confirmed.packageJson) {
    throw new Error('فشل حفظ وتأكيد وجود لقطة التعافي في قاعدة بيانات الطوارئ (PhysioRecordEmergencyRecoveryDB).');
  }

  // Secondary internal redundancy: cache encrypted package in localStorage (if quota permits)
  try {
    localStorage.setItem('physiorecord_pre_restore_safety_backup', backupPackageStr);
  } catch {
    // Quota exceeded; ignored
  }

  return {
    snapshotId,
    createdAt,
    patientCount,
    sessionCount,
    backupPackageStr,
  };
};

/**
 * Saves external recovery backup file outside the browser origin storage.
 * 
 * Uses File System Access API (window.showSaveFilePicker) when supported for
 * confirmed physical disk write. Falls back to standard browser download otherwise.
 */
export const saveExternalRecoveryBackupFile = async (
  backupPackageStr: string,
  suggestedDateStr: string = new Date().toISOString().replace(/[:.]/g, '-')
): Promise<ExternalSaveResult> => {
  const fileName = `physiorecord_pre_restore_emergency_${suggestedDateStr}.ptbackup`;

  // 1. Attempt File System Access API (Chromium Desktop native save dialog)
  interface SaveFilePickerWindow extends Window {
    showSaveFilePicker?: (options: {
      suggestedName: string;
      types: Array<{ description: string; accept: Record<string, string[]> }>;
    }) => Promise<{
      createWritable: () => Promise<{
        write: (data: string) => Promise<void>;
        close: () => Promise<void>;
      }>;
    }>;
  }

  const pickerWin = typeof window !== 'undefined' ? (window as SaveFilePickerWindow) : undefined;
  if (pickerWin && typeof pickerWin.showSaveFilePicker === 'function') {
    try {
      const handle = await pickerWin.showSaveFilePicker({
        suggestedName: fileName,
        types: [
          {
            description: 'PhysioRecord Encrypted Backup (.ptbackup)',
            accept: {
              'application/json': ['.ptbackup', '.json'],
            },
          },
        ],
      });

      const writable = await handle.createWritable();
      await writable.write(backupPackageStr);
      await writable.close();

      return {
        method: 'fs-access',
        confirmedSaved: true, // Directly confirmed write to physical filesystem
        fileName,
      };
    } catch (fsErr: unknown) {
      if (fsErr instanceof Error && fsErr.name === 'AbortError') {
        throw new Error('تم إلغاء حفظ ملف التعافي الخارجي من قبل المستخدم.');
      }
      // If other FS error, proceed to fallback
      console.warn('File System Access API failed, switching to download fallback:', fsErr);
    }
  }

  // 2. Download Fallback (<a download>)
  // Note: Browser triggers a download, but we CANNOT confirm whether the user accepted
  // or where it was stored. Thus confirmedSaved is false.
  if (typeof document !== 'undefined') {
    const blob = new Blob([backupPackageStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return {
    method: 'download-fallback',
    confirmedSaved: false, // Dispatched, but physical disk persistence cannot be verified by JS
    fileName,
  };
};

/**
 * Restore an emergency recovery snapshot from internal logical recovery database
 */
export const restoreFromEmergencySnapshot = async (
  snapshotId: string,
  recoveryPassword: string,
  newVaultPassword: string,
  targetDatabase: PhysioRecordDatabase
) => {
  const snapshot = await recoveryDb.recoverySnapshots.get(snapshotId);
  if (!snapshot) {
    throw new Error(`لم يتم العثور على لقطة التعافي بالمعرف: ${snapshotId}`);
  }

  return await restoreBackupPackage(
    snapshot.packageJson,
    recoveryPassword,
    newVaultPassword,
    targetDatabase
  );
};
