import path from "node:path";
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    testTimeout: 1000000,
  },
  resolve: {
    alias: {
      "tttc-common": path.resolve(__dirname, "../common/dist"),
      common: path.resolve(__dirname, "../common"),
    },
  },
});
