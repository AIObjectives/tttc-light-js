import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['dotenv/config'],
  },
  resolve: {
    alias: {
      'tttc-common': path.resolve(__dirname, '../common/src'),
      '@': path.resolve(__dirname, './src'),
      'test_cases.json': path.resolve(__dirname, '../common/test_cases.json')
    }
  }
});
