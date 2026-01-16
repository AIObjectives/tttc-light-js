import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../vitest.shared";

/**
 * Common package vitest configuration.
 *
 * Uses default shared settings. No special aliases needed since
 * this IS the common package.
 */
export default mergeConfig(
  sharedConfig,
  defineConfig({
    test: {
      // Project name for workspace identification
      name: "common",
    },
  }),
);
