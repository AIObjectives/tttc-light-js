import { describe, it, expect } from "vitest";
import { createAnalyticsConfig } from "../config";
import { Env } from "../../types/context";

describe("Analytics Configuration", () => {
  const createMockEnv = (overrides: Partial<Env> = {}): Env => ({
    // Required fields (not related to analytics)
    OPENAI_API_KEY: "test-key",
    GCLOUD_STORAGE_BUCKET: "test-bucket",
    GOOGLE_CREDENTIALS_ENCODED: "test-credentials",
    FIREBASE_CREDENTIALS_ENCODED: "test-firebase-creds",
    CLIENT_BASE_URL: "https://test-client.com",
    PYSERVER_URL: "https://test-pyserver.com",
    NODE_ENV: "development" as const,
    REDIS_URL: "redis://localhost:6379",
    ALLOWED_GCS_BUCKETS: ["bucket1", "bucket2"],
    REDIS_QUEUE_NAME: "test-queue",
    ALLOWED_ORIGINS: ["https://test.com"],
    
    // Feature flags (existing)
    FEATURE_FLAG_PROVIDER: "local" as const,
    FEATURE_FLAG_HOST: "https://app.posthog.com",
    
    // Analytics defaults
    ANALYTICS_PROVIDER: "local" as const,
    ANALYTICS_HOST: "https://app.posthog.com",
    ANALYTICS_FLUSH_AT: 20,
    ANALYTICS_FLUSH_INTERVAL: 10000,
    ANALYTICS_DEBUG: false,
    ANALYTICS_ENABLED: true,
    
    ...overrides,
  });

  describe("Local Provider Configuration", () => {
    it("should create local analytics config with defaults", () => {
      const env = createMockEnv();
      const config = createAnalyticsConfig(env);

      expect(config).toEqual({
        provider: "local",
        apiKey: undefined,
        host: "https://app.posthog.com",
        flushAt: 20,
        flushInterval: 10000,
        debug: false,
        enabled: true,
      });
    });

    it("should create local analytics config with custom settings", () => {
      const env = createMockEnv({
        ANALYTICS_PROVIDER: "local",
        ANALYTICS_FLUSH_AT: 50,
        ANALYTICS_FLUSH_INTERVAL: 5000,
        ANALYTICS_DEBUG: true,
        ANALYTICS_ENABLED: false,
      });
      const config = createAnalyticsConfig(env);

      expect(config).toEqual({
        provider: "local",
        apiKey: undefined,
        host: "https://app.posthog.com",
        flushAt: 50,
        flushInterval: 5000,
        debug: true,
        enabled: false,
      });
    });

    it("should work without API key for local provider", () => {
      const env = createMockEnv({
        ANALYTICS_PROVIDER: "local",
        ANALYTICS_API_KEY: undefined,
      });

      expect(() => createAnalyticsConfig(env)).not.toThrow();
      
      const config = createAnalyticsConfig(env);
      expect(config.provider).toBe("local");
      expect(config.apiKey).toBeUndefined();
    });
  });

  describe("PostHog Provider Configuration", () => {
    it("should create PostHog analytics config with API key", () => {
      const env = createMockEnv({
        ANALYTICS_PROVIDER: "posthog",
        ANALYTICS_API_KEY: "phc_test123456789",
        ANALYTICS_HOST: "https://eu.posthog.com",
        ANALYTICS_FLUSH_AT: 25,
        ANALYTICS_FLUSH_INTERVAL: 8000,
        ANALYTICS_DEBUG: true,
        ANALYTICS_ENABLED: true,
      });
      const config = createAnalyticsConfig(env);

      expect(config).toEqual({
        provider: "posthog",
        apiKey: "phc_test123456789",
        host: "https://eu.posthog.com",
        flushAt: 25,
        flushInterval: 8000,
        debug: true,
        enabled: true,
      });
    });

    it("should use default host for PostHog when not specified", () => {
      const env = createMockEnv({
        ANALYTICS_PROVIDER: "posthog",
        ANALYTICS_API_KEY: "phc_test123456789",
      });
      const config = createAnalyticsConfig(env);

      expect(config.host).toBe("https://app.posthog.com");
    });

    it("should throw error when PostHog provider lacks API key", () => {
      const env = createMockEnv({
        ANALYTICS_PROVIDER: "posthog",
        ANALYTICS_API_KEY: undefined,
      });

      expect(() => createAnalyticsConfig(env)).toThrow(
        'ANALYTICS_API_KEY is required when ANALYTICS_PROVIDER is set to "posthog"'
      );
    });

    it("should throw error when PostHog provider has empty API key", () => {
      const env = createMockEnv({
        ANALYTICS_PROVIDER: "posthog",
        ANALYTICS_API_KEY: "",
      });

      expect(() => createAnalyticsConfig(env)).toThrow(
        'ANALYTICS_API_KEY is required when ANALYTICS_PROVIDER is set to "posthog"'
      );
    });

    it("should work with disabled PostHog provider", () => {
      const env = createMockEnv({
        ANALYTICS_PROVIDER: "posthog",
        ANALYTICS_API_KEY: "phc_test123456789",
        ANALYTICS_ENABLED: false,
      });

      const config = createAnalyticsConfig(env);
      
      expect(config.provider).toBe("posthog");
      expect(config.enabled).toBe(false);
      expect(config.apiKey).toBe("phc_test123456789");
    });
  });

  describe("Configuration Edge Cases", () => {
    it("should handle all boolean string variations for debug", () => {
      const testCases = [
        { input: true, expected: true },
        { input: false, expected: false },
      ];

      testCases.forEach(({ input, expected }) => {
        const env = createMockEnv({
          ANALYTICS_DEBUG: input,
        });
        const config = createAnalyticsConfig(env);
        expect(config.debug).toBe(expected);
      });
    });

    it("should handle all boolean string variations for enabled", () => {
      const testCases = [
        { input: true, expected: true },
        { input: false, expected: false },
      ];

      testCases.forEach(({ input, expected }) => {
        const env = createMockEnv({
          ANALYTICS_ENABLED: input,
        });
        const config = createAnalyticsConfig(env);
        expect(config.enabled).toBe(expected);
      });
    });

    it("should handle numeric edge cases for flush settings", () => {
      const env = createMockEnv({
        ANALYTICS_FLUSH_AT: 1,
        ANALYTICS_FLUSH_INTERVAL: 1000,
      });
      const config = createAnalyticsConfig(env);

      expect(config.flushAt).toBe(1);
      expect(config.flushInterval).toBe(1000);
    });

    it("should handle large numeric values for flush settings", () => {
      const env = createMockEnv({
        ANALYTICS_FLUSH_AT: 1000,
        ANALYTICS_FLUSH_INTERVAL: 300000,
      });
      const config = createAnalyticsConfig(env);

      expect(config.flushAt).toBe(1000);
      expect(config.flushInterval).toBe(300000);
    });
  });

  describe("Multiple Providers Configuration", () => {
    it("should handle switching between providers", () => {
      // Test local config
      const localEnv = createMockEnv({
        ANALYTICS_PROVIDER: "local",
      });
      const localConfig = createAnalyticsConfig(localEnv);
      expect(localConfig.provider).toBe("local");

      // Test PostHog config
      const posthogEnv = createMockEnv({
        ANALYTICS_PROVIDER: "posthog",
        ANALYTICS_API_KEY: "phc_test123456789",
      });
      const posthogConfig = createAnalyticsConfig(posthogEnv);
      expect(posthogConfig.provider).toBe("posthog");
    });

    it("should maintain independent configuration between providers", () => {
      const localConfig = createAnalyticsConfig(createMockEnv({
        ANALYTICS_PROVIDER: "local",
        ANALYTICS_DEBUG: true,
        ANALYTICS_ENABLED: false,
      }));

      const posthogConfig = createAnalyticsConfig(createMockEnv({
        ANALYTICS_PROVIDER: "posthog",
        ANALYTICS_API_KEY: "phc_test123456789",
        ANALYTICS_DEBUG: false,
        ANALYTICS_ENABLED: true,
        ANALYTICS_HOST: "https://eu.posthog.com",
      }));

      // Local config
      expect(localConfig.provider).toBe("local");
      expect(localConfig.debug).toBe(true);
      expect(localConfig.enabled).toBe(false);
      expect(localConfig.apiKey).toBeUndefined();

      // PostHog config
      expect(posthogConfig.provider).toBe("posthog");
      expect(posthogConfig.debug).toBe(false);
      expect(posthogConfig.enabled).toBe(true);
      expect(posthogConfig.apiKey).toBe("phc_test123456789");
      expect(posthogConfig.host).toBe("https://eu.posthog.com");
    });
  });

  describe("Production-like Configurations", () => {
    it("should create production PostHog configuration", () => {
      const env = createMockEnv({
        NODE_ENV: "production",
        ANALYTICS_PROVIDER: "posthog",
        ANALYTICS_API_KEY: "phc_production_key_123456789",
        ANALYTICS_HOST: "https://app.posthog.com",
        ANALYTICS_FLUSH_AT: 50,
        ANALYTICS_FLUSH_INTERVAL: 5000,
        ANALYTICS_DEBUG: false,
        ANALYTICS_ENABLED: true,
      });

      const config = createAnalyticsConfig(env);

      expect(config).toEqual({
        provider: "posthog",
        apiKey: "phc_production_key_123456789",
        host: "https://app.posthog.com",
        flushAt: 50,
        flushInterval: 5000,
        debug: false,
        enabled: true,
      });
    });

    it("should create development local configuration", () => {
      const env = createMockEnv({
        NODE_ENV: "development",
        ANALYTICS_PROVIDER: "local",
        ANALYTICS_DEBUG: true,
        ANALYTICS_ENABLED: true,
      });

      const config = createAnalyticsConfig(env);

      expect(config).toEqual({
        provider: "local",
        apiKey: undefined,
        host: "https://app.posthog.com",
        flushAt: 20,
        flushInterval: 10000,
        debug: true,
        enabled: true,
      });
    });

    it("should create test environment configuration with disabled analytics", () => {
      const env = createMockEnv({
        NODE_ENV: "development",
        ANALYTICS_PROVIDER: "local",
        ANALYTICS_DEBUG: false,
        ANALYTICS_ENABLED: false,
      });

      const config = createAnalyticsConfig(env);

      expect(config).toEqual({
        provider: "local",
        apiKey: undefined,
        host: "https://app.posthog.com",
        flushAt: 20,
        flushInterval: 10000,
        debug: false,
        enabled: false,
      });
    });
  });
});