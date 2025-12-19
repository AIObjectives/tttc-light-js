import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getFeatureFlag,
  getFeatureFlagProvider,
  initializeFeatureFlags,
  isFeatureEnabled,
  shutdownFeatureFlags,
} from "../featureFlags.server";

// Mock logger to avoid console output during tests
vi.mock("tttc-common/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

// Mock PostHog Node
const { mockPostHogInstance } = vi.hoisted(() => ({
  mockPostHogInstance: {
    isFeatureEnabled: vi.fn(),
    getFeatureFlag: vi.fn(),
    shutdown: vi.fn(),
  },
}));

vi.mock("posthog-node", () => {
  return {
    PostHog: vi.fn().mockImplementation(() => mockPostHogInstance),
  };
});

describe("Next.js Server-Side Feature Flags", () => {
  beforeEach(async () => {
    await shutdownFeatureFlags();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await shutdownFeatureFlags();
  });

  describe("initializeFeatureFlags", () => {
    it("should initialize with local provider from environment", () => {
      const env = {
        FEATURE_FLAG_PROVIDER: "local" as const,
        LOCAL_FLAGS: JSON.stringify({
          "server-feature": true,
          "variant-test": "version-a",
        }),
      };

      const provider = initializeFeatureFlags(env);
      expect(provider).toBeDefined();
      expect(getFeatureFlagProvider()).not.toBeNull();
    });

    it("should default to local provider when not specified", () => {
      const provider = initializeFeatureFlags({});
      expect(provider).toBeDefined();
      expect(getFeatureFlagProvider()).not.toBeNull();
    });

    it("should handle invalid JSON in LOCAL_FLAGS gracefully", () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const env = {
        FEATURE_FLAG_PROVIDER: "local" as const,
        LOCAL_FLAGS: "invalid json",
      };

      const provider = initializeFeatureFlags(env);
      expect(provider).toBeDefined();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it("should initialize with PostHog provider", () => {
      const env = {
        FEATURE_FLAG_PROVIDER: "posthog" as const,
        FEATURE_FLAG_API_KEY: "test-api-key",
        FEATURE_FLAG_HOST: "https://test.posthog.com",
      };

      const provider = initializeFeatureFlags(env);
      expect(provider).toBeDefined();
      expect(getFeatureFlagProvider()).not.toBeNull();
    });
  });

  describe("Feature flag operations", () => {
    beforeEach(() => {
      const env = {
        FEATURE_FLAG_PROVIDER: "local" as const,
        LOCAL_FLAGS: JSON.stringify({
          "enabled-feature": true,
          "disabled-feature": false,
          "string-variant": "version-b",
          "numeric-config": 42,
        }),
      };
      initializeFeatureFlags(env);
    });

    it("should check if feature is enabled", async () => {
      const enabled = await isFeatureEnabled("enabled-feature");
      expect(enabled).toBe(true);

      const disabled = await isFeatureEnabled("disabled-feature");
      expect(disabled).toBe(false);

      const nonExistent = await isFeatureEnabled("non-existent");
      expect(nonExistent).toBe(false);
    });

    it("should get feature flag value", async () => {
      const boolValue = await getFeatureFlag("enabled-feature");
      expect(boolValue).toBe(true);

      const stringValue = await getFeatureFlag("string-variant");
      expect(stringValue).toBe("version-b");

      const numericValue = await getFeatureFlag("numeric-config");
      expect(numericValue).toBe(42);

      const nullValue = await getFeatureFlag("non-existent");
      expect(nullValue).toBeNull();
    });

    it("should handle feature flags with context", async () => {
      const context = {
        userId: "user123",
        email: "test@example.com",
        properties: { plan: "premium" },
      };

      const enabled = await isFeatureEnabled("enabled-feature", context);
      expect(enabled).toBe(true);
    });
  });

  describe("PostHog Provider", () => {
    it("should initialize PostHog provider", () => {
      const env = {
        FEATURE_FLAG_PROVIDER: "posthog" as const,
        FEATURE_FLAG_API_KEY: "test-api-key",
        FEATURE_FLAG_HOST: "https://test.posthog.com",
      };

      const provider = initializeFeatureFlags(env);

      // Note: PostHog provider functionality is fully tested in @common unit tests
      // This integration test verifies that the provider can be initialized
      expect(provider).toBeDefined();
      expect(getFeatureFlagProvider()).not.toBeNull();
    });
  });

  describe("Shutdown", () => {
    it("should shutdown provider successfully", async () => {
      initializeFeatureFlags({});
      expect(getFeatureFlagProvider()).not.toBeNull();

      await shutdownFeatureFlags();
      expect(getFeatureFlagProvider()).toBeNull();
    });

    it("should allow re-initialization after shutdown", async () => {
      initializeFeatureFlags({});
      await shutdownFeatureFlags();

      const env = {
        FEATURE_FLAG_PROVIDER: "local" as const,
        LOCAL_FLAGS: JSON.stringify({ "new-feature": true }),
      };
      initializeFeatureFlags(env);

      const enabled = await isFeatureEnabled("new-feature");
      expect(enabled).toBe(true);
    });
  });
});
