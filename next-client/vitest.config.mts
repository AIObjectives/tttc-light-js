import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../vitest.shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Next.js client vitest configuration.
 *
 * Uses jsdom environment for React component testing.
 * Custom setup file extends expect with @testing-library/jest-dom matchers.
 */
export default mergeConfig(
  sharedConfig,
  defineConfig({
    esbuild: {
      // Required for JSX in test files
      jsx: "automatic",
    },
    test: {
      name: "next-client",
      // Browser-like environment for React component testing
      environment: "jsdom",
      // Extends expect with jest-dom matchers and custom matchers
      setupFiles: ["./__tests__/setup/vitest.setup.ts"],
      // Override include to support both .ts and .tsx (matches existing pattern)
      include: ["**/*.test.t*"],
      // Additional test-specific alias
      alias: [{ find: "@src", replacement: path.resolve(__dirname, "./src") }],
    },
    resolve: {
      alias: {
        // Next.js path alias
        "@": path.resolve(__dirname, "./src"),
        // Test helper paths
        stories: path.resolve(__dirname, "./stories"),
        __tests__: path.resolve(__dirname, "./__tests__"),
        // Common package source for mocking
        "tttc-common": path.resolve(__dirname, "../common"),
      },
    },
  }),
);
