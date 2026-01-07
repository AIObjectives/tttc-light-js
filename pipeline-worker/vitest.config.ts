import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../vitest.shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Pipeline worker vitest configuration.
 *
 * Extended timeout for pipeline processing tests that may involve:
 * - Large data transformations
 * - LLM API calls (in integration tests)
 * - Pub/Sub message processing
 */
export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      name: "pipeline-worker",
      // Extended timeout for pipeline processing tests
      testTimeout: 1000000,
      // Shared setup: console interception, mock cleanup, env defaults
      setupFiles: ["tttc-common/test-utils/setup/server"],
    },
    resolve: {
      alias: {
        // Point to source files for better mocking support
        "tttc-common": path.resolve(__dirname, "../common"),
        // Some code imports via 'common/*' pattern
        common: path.resolve(__dirname, "../common"),
      },
    },
  }),
);
