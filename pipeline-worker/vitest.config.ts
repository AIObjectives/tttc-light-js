import { defineConfig } from "vitest/config";
import path from "node:path";
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
