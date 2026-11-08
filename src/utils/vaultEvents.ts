// =======================================================================
// PhysioRecord — Cross-Tab Vault Synchronization (BroadcastChannel)
// Provides defense-in-depth notification across browser tabs when vault
// generation or authentication credentials change (e.g. after Full Restore).
// =======================================================================

export interface VaultSyncEvent {
  type: 'VAULT_GENERATION_CHANGED' | 'VAULT_PASSWORD_CHANGED' | 'VAULT_LOCKED';
  generation?: number;
  timestamp: number;
  senderId: string;
}

const TAB_ID = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString();
const CHANNEL_NAME = 'physiorecord_vault_sync';

let channel: BroadcastChannel | null = null;

function getChannel(): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return null;
  }
  if (!channel) {
    try {
      channel = new BroadcastChannel(CHANNEL_NAME);
    } catch (e) {
      console.warn('PhysioRecord: Failed to initialize BroadcastChannel for vault sync:', e);
    }
  }
  return channel;
}

/**
 * Broadcast an event to all other tabs sharing the same origin.
 */
export function broadcastVaultEvent(event: Omit<VaultSyncEvent, 'senderId' | 'timestamp'>): void {
  const ch = getChannel();
  if (ch) {
    try {
      ch.postMessage({
        ...event,
        senderId: TAB_ID,
        timestamp: Date.now(),
      });
    } catch (e) {
      console.warn('PhysioRecord: Failed to broadcast vault event:', e);
    }
  }
}

/**
 * Subscribe to cross-tab vault events. Returns an unsubscribe function.
 */
export function subscribeToVaultEvents(onEvent: (event: VaultSyncEvent) => void): () => void {
  const ch = getChannel();
  if (!ch) return () => {};

  const listener = (msg: MessageEvent<VaultSyncEvent>) => {
    if (msg.data && msg.data.senderId !== TAB_ID) {
      onEvent(msg.data);
    }
  };

  ch.addEventListener('message', listener);
  return () => {
    ch.removeEventListener('message', listener);
  };
}
