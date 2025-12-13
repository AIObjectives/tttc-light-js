import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
