/**
 * Test helper utilities for creating mock environments
 */

export function createMinimalTestEnv() {
  return {
    // Required fields
    OPENAI_API_KEY: "sk-test-key-123",
    GCLOUD_STORAGE_BUCKET: "test-bucket",
    GOOGLE_CREDENTIALS_ENCODED: "dGVzdA==",
    FIREBASE_CREDENTIALS_ENCODED: "dGVzdA==",
    CLIENT_BASE_URL: "http://localhost:3000",
    PYSERVER_URL: "http://localhost:8000",
    NODE_ENV: "development" as const,
    REDIS_URL: "redis://localhost:6379",
    ALLOWED_ORIGINS: "http://localhost:3000",
    ALLOWED_GCS_BUCKETS: "test-bucket,another-bucket",

    // Optional fields with defaults
    REDIS_QUEUE_NAME: "test-queue",
    FEATURE_FLAG_PROVIDER: "local" as const,
    ANALYTICS_PROVIDER: "local" as const,
    ANALYTICS_ENABLED: "false",
    RATE_LIMIT_PREFIX: "test",
  };
}
