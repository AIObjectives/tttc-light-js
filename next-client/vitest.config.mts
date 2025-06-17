import { resolve } from "path";
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    setupFiles: ["./__tests__/setup/vitest.setup.ts"],
    alias: [{ find: "@src", replacement: resolve(__dirname, "./src") }],
    include: ["**/*.test.t*"]
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  
});
