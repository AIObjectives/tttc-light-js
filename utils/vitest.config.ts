import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../vitest.shared";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Utils package vitest configuration.
 *
 * Uses default shared timeout (30s) which is appropriate for
 * utility script testing.
 */
export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      name: "utils",
    },
    resolve: {
      alias: {
        "tttc-common": path.resolve(__dirname, "../common"),
      },
    },
  }),
);
