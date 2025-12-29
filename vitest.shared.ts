import { defineConfig } from "vitest/config";

/**
 * Shared vitest configuration for all packages in the monorepo.
 *
 * Each package's vitest.config.ts should import and extend this config:
 *   import { mergeConfig } from 'vitest/config';
 *   import sharedConfig from '../vitest.shared';
 *   export default mergeConfig(sharedConfig, defineConfig({ ... }));
 */
export default defineConfig({
  test: {
    // Reasonable default timeout (packages with integration tests can override)
    testTimeout: 30000,

    // Consistent test pattern across all packages
    include: ["**/*.test.{ts,tsx}"],

    // Exclude build artifacts and node_modules
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"],

    // Use forks for better test isolation
    pool: "forks",

    // Don't fail if a package has no tests yet
    passWithNoTests: true,

    // Basic coverage configuration (can be extended per-package)
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "**/node_modules/**",
        "**/dist/**",
        "**/*.test.*",
        "**/__tests__/**",
        "**/test-utils/**", // Ready for T3C-1025
        "**/stories/**",
      ],
    },
  },
});
