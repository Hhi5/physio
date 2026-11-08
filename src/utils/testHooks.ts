// =======================================================================
// PhysioRecord — Production Test Hooks Security Isolation
// Strictly guarantees that no sensitive crypto keys, database instances,
// or test bypass hooks are EVER exposed on window in production builds.
// =======================================================================

/**
 * Determine whether test hooks should be exposed.
 * In a standard production build (import.meta.env.MODE === 'production'),
 * this returns false unconditionally.
 */
export const isTestEnvironment = (): boolean => {
  if (typeof window === 'undefined') return false;

  // In production builds, test hooks are strictly disabled!
  if (import.meta.env.MODE === 'production') {
    return false;
  }

  // Only permit when explicitly running in test mode or development
  return Boolean(
    import.meta.env.DEV ||
    import.meta.env.MODE === 'test' ||
    import.meta.env.VITE_ENABLE_TEST_HOOKS === 'true'
  );
};

/**
 * Safely register test hooks onto window only in test environments.
 * No-op in production.
 */
export const registerTestHooks = (hooks: Record<string, any>): void => {
  if (import.meta.env.MODE === 'production' || !isTestEnvironment()) return;

  const key = '__physioRecordTestHooks';
  (window as any)[key] = {
    ...((window as any)[key] || {}),
    ...hooks,
  };
};
