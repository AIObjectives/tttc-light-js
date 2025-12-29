import { defineConfig } from "vitest/config";

/**
 * Root vitest configuration for running all tests from the monorepo root.
 *
 * Usage:
 *   pnpm test:workspace        # Run all tests across all projects
 *   pnpm vitest --project common   # Run tests for specific project
 *
 * Note: Most developers will continue using `pnpm test` which uses turbo.
 * This root config enables unified test runs when needed.
 */
export default defineConfig({
  test: {
    // Reference each package's vitest config as a project
    projects: [
      "common/vitest.config.ts",
      "express-server/vitest.config.ts",
      "pipeline-worker/vitest.config.ts",
      "next-client/vitest.config.mts",
      "utils/vitest.config.ts",
    ],
  },
});
