/**
 * Integration tests for the analytics client using the common analytics package
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAnalyticsClient,
  initializeAnalyticsClient,
  isAnalyticsClientInitialized,
  shutdownAnalyticsClient,
} from "../analytics";
import type { Env } from "../types/context";

// Mock child logger
const childLogger = vi.hoisted(() => {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
});

// Mock logger
vi.mock("tttc-common/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => childLogger),
  },
}));

describe("Analytics Integration with Common Package", () => {
  // Helper function to create mock environment
  const createMockEnv = (overrides: Partial<Env> = {}): Env => ({
    OPENAI_API_KEY: "test-openai-key",
    OPENAI_API_KEY_PASSWORD: undefined,
    GCLOUD_STORAGE_BUCKET: "test-bucket",
    GOOGLE_CREDENTIALS_ENCODED: "test-google-creds",
    FIREBASE_CREDENTIALS_ENCODED: "test-firebase-creds",
    CLIENT_BASE_URL: "https://client.example.com",
    PYSERVER_URL: "https://pyserver.example.com",
    NODE_ENV: "development",
    REDIS_URL: "redis://localhost:6379",
    ALLOWED_GCS_BUCKETS: ["test-bucket"],
    REDIS_QUEUE_NAME: "test-queue",
    ALLOWED_ORIGINS: ["https://example.com"],
    FEATURE_FLAG_PROVIDER: "local",
    FEATURE_FLAG_API_KEY: undefined,
    FEATURE_FLAG_HOST: "https://app.posthog.com",
    ANALYTICS_PROVIDER: "local",
    ANALYTICS_API_KEY: undefined,
    ANALYTICS_HOST: "https://app.posthog.com",
    ANALYTICS_FLUSH_AT: 20,
    ANALYTICS_FLUSH_INTERVAL: 10000,
    ANALYTICS_ENABLED: true,
    ANALYTICS_DEBUG: false,
    FIREBASE_ADMIN_PROJECT_ID: undefined,
    RATE_LIMIT_PREFIX: "test",
    PYSERVER_MAX_CONCURRENCY: 5,
    PUBSUB_TOPIC_NAME: "test-topic",
    PUBSUB_SUBSCRIPTION_NAME: "test-sub",
    ...overrides,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up any initialized analytics
    try {
      await shutdownAnalyticsClient();
    } catch {
      // Ignore errors during cleanup
    }
  });

  it("should initialize analytics with local provider successfully", async () => {
    const env = createMockEnv({
      ANALYTICS_PROVIDER: "local",
      ANALYTICS_ENABLED: true,
    });

    await expect(initializeAnalyticsClient(env)).resolves.toBeUndefined();

    // Should not throw when checking if initialized
    expect(() => isAnalyticsClientInitialized()).not.toThrow();
  });

  it("should handle disabled analytics gracefully", async () => {
    const env = createMockEnv({
      ANALYTICS_PROVIDER: "local",
      ANALYTICS_ENABLED: false,
    });

    await expect(initializeAnalyticsClient(env)).resolves.toBeUndefined();
  });

  it("should handle shutdown gracefully", async () => {
    const env = createMockEnv({
      ANALYTICS_PROVIDER: "local",
      ANALYTICS_ENABLED: true,
    });

    await initializeAnalyticsClient(env);
    await expect(shutdownAnalyticsClient()).resolves.toBeUndefined();
  });

  it("should handle shutdown when not initialized", async () => {
    await expect(shutdownAnalyticsClient()).resolves.toBeUndefined();
  });

  it("should not throw when getting analytics client", () => {
    expect(() => getAnalyticsClient()).not.toThrow();
    expect(() => isAnalyticsClientInitialized()).not.toThrow();
  });

  it("should work with PostHog provider configuration", async () => {
    const env = createMockEnv({
      ANALYTICS_PROVIDER: "posthog",
      ANALYTICS_API_KEY: "test-api-key",
      ANALYTICS_ENABLED: true,
    });

    // Should not throw even if PostHog initialization fails
    await expect(initializeAnalyticsClient(env)).resolves.toBeUndefined();
  });

  it("should be non-blocking - initialization errors should not throw", async () => {
    const env = createMockEnv({
      ANALYTICS_PROVIDER: "invalid-provider" as any,
      ANALYTICS_ENABLED: true,
    });

    // Should not throw even with invalid configuration
    await expect(initializeAnalyticsClient(env)).resolves.toBeUndefined();
  });
});
