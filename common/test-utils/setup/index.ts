/**
 * Vitest setup file exports.
 *
 * These are designed to be used as setupFiles in vitest.config.ts:
 *
 * @example Server packages (express-server, pipeline-worker)
 * ```typescript
 * test: {
 *   setupFiles: ['tttc-common/test-utils/setup/server'],
 * }
 * ```
 *
 * @example Browser packages (next-client)
 * ```typescript
 * test: {
 *   setupFiles: ['tttc-common/test-utils/setup/browser', './matchers.ts'],
 * }
 * ```
 *
 * Note: Import individual setup files directly in your vitest config.
 * This index exports the helper functions for use in test files.
 */

// Export console expectation helpers (useful in test files)
export { expectConsoleError, expectConsoleWarn } from "./base";

// Export server cleanup helper
export { registerCleanup } from "./server";
