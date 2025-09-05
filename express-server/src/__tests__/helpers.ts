/**
 * Test helper utilities for creating mock environments
 */

export function createMinimalTestEnv() {
  return {
    ALLOWED_ORIGINS: "http://localhost:3000",
    OPENAI_API_KEY: "test-key",
    NODE_ENV: "test",
  };
}
