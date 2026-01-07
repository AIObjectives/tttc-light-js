/**
 * Server/Node.js vitest setup for express-server and pipeline-worker.
 *
 * Extends base setup with server-specific configuration:
 * - Environment variable defaults for tests
 * - Cleanup hooks for async resources
 *
 * Usage in vitest.config.ts:
 *   setupFiles: ['tttc-common/test-utils/setup/server']
 *
 * Note: This file imports base setup, so you only need to include this one.
 */
import { afterAll, afterEach } from "vitest";

// Import base setup first (order matters - sets up console interception)
import "./base";

// Re-export helpers from base for convenience
export { expectConsoleError, expectConsoleWarn } from "./base";

// Set default test environment variables if not already set
// These match the values in createMinimalTestEnv() for consistency
const testEnvDefaults: Record<string, string> = {
  NODE_ENV: "test",
  // Prevent accidental connections to real services
  REDIS_URL: "redis://localhost:6379",
  PUBSUB_EMULATOR_HOST: "localhost:8085",
};

for (const [key, value] of Object.entries(testEnvDefaults)) {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}

// Track cleanup functions registered by tests
const cleanupFunctions: Array<() => void | Promise<void>> = [];

/**
 * Register a cleanup function to run after each test.
 * Useful for closing connections, clearing caches, etc.
 *
 * @example
 * beforeEach(() => {
 *   const connection = createConnection();
 *   registerCleanup(() => connection.close());
 * });
 */
export function registerCleanup(fn: () => void | Promise<void>): void {
  cleanupFunctions.push(fn);
}

afterEach(async () => {
  // Run all registered cleanup functions
  for (const cleanup of cleanupFunctions) {
    try {
      await cleanup();
    } catch (error) {
      // Log but don't fail - cleanup errors shouldn't mask test failures
      console.debug("Cleanup function failed:", error);
    }
  }
  // Clear for next test
  cleanupFunctions.length = 0;
});

// Final cleanup after all tests complete
afterAll(async () => {
  // Give async operations a moment to complete
  // This helps prevent "unfinished async operation" warnings
  await new Promise((resolve) => setTimeout(resolve, 10));
});
