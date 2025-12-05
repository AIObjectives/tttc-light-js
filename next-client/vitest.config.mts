import { resolve } from "path";
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./__tests__/setup/vitest.setup.ts"],
    alias: [{ find: "@src", replacement: resolve(__dirname, "./src") }],
    include: ["**/*.test.t*"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      stories: path.resolve(__dirname, "./stories"),
      __tests__: path.resolve(__dirname, "./__tests__"),
      // Point to source files for better mocking support in tests
      "tttc-common": path.resolve(__dirname, "../common"),
    },
  },
});
