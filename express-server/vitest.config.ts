import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../vitest.shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Express server vitest configuration.
 *
 * Extended timeout for integration tests that interact with:
 * - Firebase
 * - Google Cloud Storage
 * - Redis
 * - External APIs (Perspective, OpenAI)
 */
export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      name: "express-server",
      // Extended timeout for integration tests with external services
      testTimeout: 1000000,
      // Shared setup: console interception, mock cleanup, env defaults
      setupFiles: ["tttc-common/test-utils/setup/server"],
    },
    resolve: {
      alias: {
        // Point to source files for better mocking support in tests
        // Enables: vi.mock('tttc-common/schema', () => ...)
        "tttc-common": path.resolve(__dirname, "../common"),
      },
    },
  }),
);
