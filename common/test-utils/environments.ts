/**
 * Test environment factory functions.
 *
 * These helpers create mock environment configurations for testing.
 * The returned objects match the shape expected by the express-server Env type
 * after Zod transformations are applied.
 */

/**
 * Base test environment with all required fields.
 * Use this for most unit tests that need a valid environment.
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
    NODE_ENV: "test" as const,
    REDIS_URL: "redis://localhost:6379",

    // Transformed arrays (post-Zod transformation shape)
    ALLOWED_ORIGINS: ["http://localhost:3000"],
    ALLOWED_GCS_BUCKETS: ["test-bucket", "another-bucket"],

    // Optional fields with defaults
    REDIS_QUEUE_NAME: "test-queue",
    PUBSUB_TOPIC_NAME: "test-topic",
    PUBSUB_SUBSCRIPTION_NAME: "test-subscription",
    FEATURE_FLAG_PROVIDER: "local" as const,
    ANALYTICS_PROVIDER: "local" as const,
    ANALYTICS_ENABLED: false,
    ANALYTICS_DEBUG: false,
    ANALYTICS_FLUSH_AT: 20,
    ANALYTICS_FLUSH_INTERVAL: 10000,
    RATE_LIMIT_PREFIX: "test",
    PYSERVER_MAX_CONCURRENCY: 5,
    FEATURE_FLAG_HOST: "https://us.i.posthog.com",
    ANALYTICS_HOST: "https://app.posthog.com",
  };
}

/**
 * Extended test environment for security-focused tests.
 * Includes additional fields commonly needed for auth/security testing.
 */
export function createSecurityTestEnv() {
  return {
    ...createMinimalTestEnv(),
    // Security tests may need specific origins
    ALLOWED_ORIGINS: ["http://localhost:3000", "http://localhost:8080"],
  };
}

/**
 * Test environment for integration tests that need more realistic config.
 */
export function createIntegrationTestEnv() {
  return {
    ...createMinimalTestEnv(),
    NODE_ENV: "development" as const,
    // Integration tests may need actual-looking credentials
    GOOGLE_CLOUD_PROJECT_ID: "test-project-id",
  };
}

/** Type helper - infers the shape of the minimal test environment */
export type TestEnv = ReturnType<typeof createMinimalTestEnv>;
