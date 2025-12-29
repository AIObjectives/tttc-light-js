/**
 * Shared test utilities for the monorepo.
 *
 * Usage:
 *   import { createMinimalTestEnv } from 'tttc-common/test-utils';
 *
 * These utilities are designed to be used across all packages
 * to ensure consistent test patterns and reduce duplication.
 */

export {
  createIntegrationTestEnv,
  createMinimalTestEnv,
  createSecurityTestEnv,
  type TestEnv,
} from "./environments";
