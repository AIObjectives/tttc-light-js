import { defineConfig } from "vitest/config";
import path from "node:path";
export default defineConfig({
  test: {
    testTimeout: 1000000,
  },
  resolve: {
    alias: {
      // Point to source files for better mocking support in tests
      "tttc-common": path.resolve(__dirname, "../common"),
    },
  },
});
