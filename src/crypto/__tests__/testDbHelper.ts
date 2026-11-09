import { PhysioRecordDatabase } from '../../db/db';
import type { VaultMetaEntity, EpisodeSequenceEntity } from '../../types/clinical';

/**
 * Extracts the declared index specification per version directly from `PhysioRecordDatabase`
 * so tests validate the real `this.version(n).stores({...})` schema definitions in `src/db/db.ts`.
 */
function extractVersionStoreIndexes(targetVerno: number): Record<string, Set<string>> {
  const realDbInstance = new PhysioRecordDatabase(`__schema_inspector_${targetVerno}`);
  const versions = (
    realDbInstance as unknown as {
      _versions?: Array<{
        _cfg?: {
          version?: number;
          storesSource?: Record<string, string | null>;
        };
      }>;
    }
  )._versions || [];

  const accumulatedStores: Record<string, string> = {};
  const sorted = [...versions].sort(
    (a, b) => (a._cfg?.version || 0) - (b._cfg?.version || 0)
  );
  for (const v of sorted) {
    const ver = v._cfg?.version || 0;
    if (ver <= targetVerno && v._cfg?.storesSource) {
      for (const [storeName, spec] of Object.entries(v._cfg.storesSource)) {
        if (spec === null) {
          delete accumulatedStores[storeName];
        } else if (typeof spec === 'string') {
          accumulatedStores[storeName] = spec;
        }
      }
    }
  }

  const indexMap: Record<string, Set<string>> = {};
  for (const [storeName, spec] of Object.entries(accumulatedStores)) {
    const fields = spec
      .split(',')
      .map((token) => token.trim().replace(/^[&*+]+/, ''))
      .filter(Boolean);
    indexMap[storeName] = new Set(fields);
  }
  return indexMap;
}

/**
 * In-memory test double for PhysioRecordDatabase supporting vaultMeta,
 * episodeSequences, and all v5/v6 clinical stores for unit and characterization testing.
 * Enforces unique index constraints and per-version declared index existence from `PhysioRecordDatabase`.
 */
export function createInMemoryDatabase(initialVerno = 6) {
  const stores = new Map<string, Map<string, Record<string, unknown>>>();
  let activeVerno = initialVerno;
  let activeIndexesByStore = extractVersionStoreIndexes(activeVerno);

  const ensureStore = (name: string) => {
    if (!stores.has(name)) {
      stores.set(name, new Map());
    }
    return stores.get(name)!;
  };

  const UNIQUE_INDEXES: Record<string, string[]> = {
    soapNotes: ['sessionId'],
    episodeClinical: ['episodeId'],
  };

  const assertUniqueIndexes = (
    tableName: string,
    primaryKeyField: string,
    store: Map<string, Record<string, unknown>>,
    candidate: Record<string, unknown>
  ) => {
    const uniqueFields = UNIQUE_INDEXES[tableName];
    if (!uniqueFields) return;
    const candidatePk = String(candidate[primaryKeyField]);
    for (const field of uniqueFields) {
      const val = candidate[field];
      if (val === undefined || val === null) continue;
      for (const [existingPk, existingRow] of store.entries()) {
        if (existingPk !== candidatePk && existingRow[field] === val) {
          throw new Error(
            `ConstraintError: Key already exists in the object store (${tableName}.${field} = ${String(val)})`
          );
        }
      }
    }
  };

  const assertIndexExistsInCurrentVersion = (tableName: string, indexField: string) => {
    const storeIndexes = activeIndexesByStore[tableName];
    if (!storeIndexes || !storeIndexes.has(indexField)) {
      throw new Error(
        `SchemaError: KeyPath ${indexField} on object store ${tableName} is not indexed in version ${activeVerno}`
      );
    }
  };

  const makeTable = (name: string, primaryKeyField = 'id') => {
    const store = ensureStore(name);
    return {
      name,
      async get(id: string) {
        const found = store.get(id);
        return found ? structuredClone(found) : undefined;
      },
      async put(item: Record<string, unknown>) {
        assertUniqueIndexes(name, primaryKeyField, store, item);
        const key = String(item[primaryKeyField]);
        store.set(key, structuredClone(item));
        return key;
      },
      async bulkPut(items: Record<string, unknown>[]) {
        for (const item of items) {
          assertUniqueIndexes(name, primaryKeyField, store, item);
          const key = String(item[primaryKeyField]);
          store.set(key, structuredClone(item));
        }
      },
      async update(id: string, changes: Record<string, unknown>) {
        const existing = store.get(id);
        if (!existing) return 0;
        const merged = { ...existing, ...structuredClone(changes) };
        assertUniqueIndexes(name, primaryKeyField, store, merged);
        store.set(id, merged);
        return 1;
      },
      async delete(id: string) {
        store.delete(id);
      },
      async bulkDelete(ids: string[]) {
        for (const id of ids) {
          store.delete(id);
        }
      },
      async clear() {
        store.clear();
      },
      async count() {
        return store.size;
      },
      async toArray() {
        return Array.from(store.values()).map((v) => structuredClone(v));
      },
      where(indexField: string) {
        assertIndexExistsInCurrentVersion(name, indexField);
        return {
          equals(expectedValue: unknown) {
            const matching = () =>
              Array.from(store.values())
                .filter((item) => item[indexField] === expectedValue)
                .map((v) => structuredClone(v));
            return {
              async toArray() {
                return matching();
              },
              async first() {
                return matching()[0];
              },
              async count() {
                return matching().length;
              },
              async delete() {
                const items = matching();
                for (const item of items) {
                  store.delete(String(item[primaryKeyField]));
                }
                return items.length;
              },
            };
          },
          anyOf(expectedValues: unknown[]) {
            const set = new Set(expectedValues);
            const matching = () =>
              Array.from(store.values())
                .filter((item) => set.has(item[indexField]))
                .map((v) => structuredClone(v));
            return {
              async toArray() {
                return matching();
              },
              async count() {
                return matching().length;
              },
              async delete() {
                const items = matching();
                for (const item of items) {
                  store.delete(String(item[primaryKeyField]));
                }
                return items.length;
              },
            };
          },
        };
      },
    };
  };

  const vaultMetaTable = makeTable('vaultMeta', 'id');
  const episodeSequencesTable = makeTable('episodeSequences', 'episodeId');
  const patientsTable = makeTable('patients', 'id');
  const episodesTable = makeTable('episodes', 'id');
  const sessionsTable = makeTable('sessions', 'id');
  const soapNotesTable = makeTable('soapNotes', 'id');
  const clinicalAddendaTable = makeTable('clinicalAddenda', 'id');
  const appointmentsTable = makeTable('appointments', 'id');
  const waitingListTable = makeTable('waitingList', 'id');
  const invoicesTable = makeTable('invoices', 'id');
  const paymentsTable = makeTable('payments', 'id');
  const expensesTable = makeTable('expenses', 'id');
  const auditLogsTable = makeTable('auditLogs', 'id');
  const staffStateTable = makeTable('staffState', 'id');
  const episodeClinicalTable = makeTable('episodeClinical', 'id');
  const customWidgetsTable = makeTable('customWidgets', 'id');
  const migrationReportsTable = makeTable('migrationReports', 'id');
  const migrationStateTable = makeTable('migrationState', 'id');

  const dbHandle: Record<string, unknown> = {
    get verno() {
      return activeVerno;
    },
    upgradeToVersion(nextVerno: number) {
      if (nextVerno < activeVerno) {
        throw new Error(`Cannot downgrade database from v${activeVerno} to v${nextVerno}`);
      }
      activeVerno = nextVerno;
      activeIndexesByStore = extractVersionStoreIndexes(activeVerno);
    },
    getDeclaredIndexesForStore(storeName: string): string[] {
      return Array.from(activeIndexesByStore[storeName] || []);
    },
    vaultMeta: vaultMetaTable,
    episodeSequences: episodeSequencesTable,
    patients: patientsTable,
    episodes: episodesTable,
    sessions: sessionsTable,
    soapNotes: soapNotesTable,
    clinicalAddenda: clinicalAddendaTable,
    appointments: appointmentsTable,
    waitingList: waitingListTable,
    invoices: invoicesTable,
    payments: paymentsTable,
    expenses: expensesTable,
    auditLogs: auditLogsTable,
    staffState: staffStateTable,
    episodeClinical: episodeClinicalTable,
    customWidgets: customWidgetsTable,
    migrationReports: migrationReportsTable,
    migrationState: migrationStateTable,
    table(name: string) {
      if (name === 'vaultMeta') return vaultMetaTable;
      if (name === 'episodeSequences') return episodeSequencesTable;
      return makeTable(name, 'id');
    },
    async transaction(_mode: 'rw', _tables: unknown, scope: () => Promise<unknown>) {
      return await scope();
    },
  };

  dbHandle.archivePatient = PhysioRecordDatabase.prototype.archivePatient.bind(dbHandle);
  dbHandle.unarchivePatient = PhysioRecordDatabase.prototype.unarchivePatient.bind(dbHandle);
  dbHandle.auditPatientDependentRecords =
    PhysioRecordDatabase.prototype.auditPatientDependentRecords.bind(dbHandle);
  dbHandle.deletePatientPermanently =
    PhysioRecordDatabase.prototype.deletePatientPermanently.bind(dbHandle);
  dbHandle.deleteEpisodeCascade =
    PhysioRecordDatabase.prototype.deleteEpisodeCascade.bind(dbHandle);
  dbHandle.deleteSessionCascade =
    PhysioRecordDatabase.prototype.deleteSessionCascade.bind(dbHandle);

  return dbHandle as unknown as PhysioRecordDatabase & {
    upgradeToVersion(nextVerno: number): void;
    getDeclaredIndexesForStore(storeName: string): string[];
    vaultMeta: {
      get(id: string): Promise<VaultMetaEntity | undefined>;
      put(item: VaultMetaEntity): Promise<string>;
      update(id: string, changes: Partial<VaultMetaEntity>): Promise<number>;
      clear(): Promise<void>;
    };
    episodeSequences: {
      get(id: string): Promise<EpisodeSequenceEntity | undefined>;
      toArray(): Promise<EpisodeSequenceEntity[]>;
      clear(): Promise<void>;
      bulkPut(items: EpisodeSequenceEntity[]): Promise<void>;
    };
  };
}
