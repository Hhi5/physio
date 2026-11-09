// =======================================================================
// PhysioRecord — Production Test Hooks Security Isolation
// Strictly guarantees that no sensitive crypto keys, database instances,
// or test bypass hooks are EVER exposed on window in production builds.
// =======================================================================

export interface TestEnvConfig {
  MODE?: string;
  DEV?: boolean;
  VITE_ENABLE_TEST_HOOKS?: string;
}

/**
 * Determine whether test hooks should be exposed.
 * In a standard production build (import.meta.env.MODE === 'production'),
 * this returns false unconditionally.
 * Returns true ONLY for MODE === 'test', or in DEV when explicit VITE_ENABLE_TEST_HOOKS === 'true'.
 */
export const isTestEnvironment = (envOverride?: TestEnvConfig): boolean => {
  const mode = envOverride ? envOverride.MODE : import.meta.env.MODE;
  const dev = envOverride ? envOverride.DEV : import.meta.env.DEV;
  const flag = envOverride
    ? envOverride.VITE_ENABLE_TEST_HOOKS
    : import.meta.env.VITE_ENABLE_TEST_HOOKS;

  // In production builds, test hooks are strictly disabled!
  if (mode === 'production') {
    return false;
  }

  if (mode === 'test') {
    return true;
  }

  // Dev mode requires explicit opt-in via VITE_ENABLE_TEST_HOOKS === 'true'
  return Boolean(dev && flag === 'true');
};

interface WindowWithTestHooks extends Window {
  __physioRecordTestHooks?: Record<string, unknown>;
}

/**
 * Safely register test hooks onto window only in test environments.
 * Never exposes the `db` instance on `window` outside `MODE === 'test'`.
 */
export const registerTestHooks = (
  hooks: Record<string, unknown>,
  envOverride?: TestEnvConfig
): void => {
  const mode = envOverride ? envOverride.MODE : import.meta.env.MODE;
  if (typeof window === 'undefined' || mode === 'production' || !isTestEnvironment(envOverride)) {
    return;
  }

  const filteredHooks: Record<string, unknown> = { ...hooks };
  if (mode !== 'test' && 'db' in filteredHooks) {
    delete filteredHooks.db;
  }
  if (Object.keys(filteredHooks).length === 0) {
    return;
  }

  const win = window as WindowWithTestHooks;
  win.__physioRecordTestHooks = {
    ...(win.__physioRecordTestHooks || {}),
    ...filteredHooks,
  };
};
