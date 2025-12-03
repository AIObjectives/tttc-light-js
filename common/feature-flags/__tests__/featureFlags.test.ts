import {
  describe,
  it,
  expect,
  beforeAll,
  afterEach,
  vi,
  beforeEach,
} from "vitest";
import {
  initializeFeatureFlags,
  isFeatureEnabled,
  getFeatureFlag,
  shutdownFeatureFlags,
  FeatureFlagConfig,
} from "../index";
import { LocalFeatureFlagProvider } from "../providers/localProvider";
import { PostHogFeatureFlagProvider } from "../providers/posthogProvider";

// Mock PostHog
const mockPostHogInstance = {
  isFeatureEnabled: vi.fn(),
  getFeatureFlag: vi.fn(),
  shutdown: vi.fn(),
};

vi.mock("posthog-node", () => {
  return {
    PostHog: vi.fn().mockImplementation(() => mockPostHogInstance),
  };
});

// Mock logger
const { mockChildLogger } = vi.hoisted(() => ({
  mockChildLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../../logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => mockChildLogger),
  },
}));

describe("Feature Flags", () => {
  // Helper to create mock config
  const createMockConfig = (
    provider: "local" | "posthog" = "local",
    apiKey?: string,
    localFlags?: Record<string, boolean | string | number>,
    host?: string,
  ): FeatureFlagConfig => ({
    provider,
    apiKey,
    host: host || "https://test.posthog.com",
    localFlags,
  });

  beforeAll(async () => {
    await shutdownFeatureFlags();
  });

  afterEach(async () => {
    await shutdownFeatureFlags();
  });

  describe("Local Provider", () => {
    it("should initialize with local provider", () => {
      const provider = initializeFeatureFlags(
        createMockConfig("local", undefined, {
          testFlag: true,
          stringFlag: "variant-a",
          disabledFlag: false,
        }),
      );

      expect(provider).toBeInstanceOf(LocalFeatureFlagProvider);
    });

    it("should check if feature is enabled", async () => {
      initializeFeatureFlags(
        createMockConfig("local", undefined, {
          enabledFlag: true,
          disabledFlag: false,
        }),
      );

      const enabledResult = await isFeatureEnabled("enabledFlag");
      const disabledResult = await isFeatureEnabled("disabledFlag");
      const nonExistentResult = await isFeatureEnabled("nonExistentFlag");

      expect(enabledResult).toBe(true);
      expect(disabledResult).toBe(false);
      expect(nonExistentResult).toBe(false);
    });

    it("should get feature flag value", async () => {
      initializeFeatureFlags(
        createMockConfig("local", undefined, {
          booleanFlag: true,
          stringFlag: "variant-b",
          disabledFlag: false,
        }),
      );

      const booleanValue = await getFeatureFlag("booleanFlag");
      const stringValue = await getFeatureFlag("stringFlag");
      const disabledValue = await getFeatureFlag("disabledFlag");
      const nonExistentValue = await getFeatureFlag("nonExistentFlag");

      expect(booleanValue).toBe(true);
      expect(stringValue).toBe("variant-b");
      expect(disabledValue).toBe(false);
      expect(nonExistentValue).toBe(null);
    });

    it("should handle context parameters (ignored by local provider)", async () => {
      initializeFeatureFlags(
        createMockConfig("local", undefined, {
          testFlag: true,
        }),
      );

      const result = await isFeatureEnabled("testFlag", {
        userId: "user123",
        email: "test@example.com",
        properties: { plan: "premium" },
      });

      expect(result).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it("should return false when feature flags not initialized", async () => {
      const result = await isFeatureEnabled("testFlag");
      expect(result).toBe(false);
    });

    it("should return null when getting flag value without initialization", async () => {
      const result = await getFeatureFlag("testFlag");
      expect(result).toBe(null);
    });

    it("should throw error for unknown provider", () => {
      expect(() => {
        initializeFeatureFlags(createMockConfig("unknown" as any));
      }).toThrow("Unknown feature flag provider: unknown");
    });
  });

  describe("PostHog Provider", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should throw error when PostHog provider lacks API key", () => {
      expect(() => {
        initializeFeatureFlags(createMockConfig("posthog"));
      }).toThrow("PostHog API key is required for PostHog provider");
    });

    it("should initialize with PostHog provider", () => {
      const provider = initializeFeatureFlags(
        createMockConfig(
          "posthog",
          "test-api-key",
          undefined,
          "https://test.posthog.com",
        ),
      );

      expect(provider).toBeInstanceOf(PostHogFeatureFlagProvider);
    });

    it("should check if feature is enabled via PostHog", async () => {
      mockPostHogInstance.isFeatureEnabled
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      initializeFeatureFlags(createMockConfig("posthog", "test-api-key"));

      const enabledResult = await isFeatureEnabled("test-flag", {
        userId: "user123",
        email: "test@example.com",
      });
      const disabledResult = await isFeatureEnabled("disabled-flag");

      expect(enabledResult).toBe(true);
      expect(disabledResult).toBe(false);
      expect(mockPostHogInstance.isFeatureEnabled).toHaveBeenCalledWith(
        "test-flag",
        "user123",
        {
          groups: undefined,
          personProperties: undefined,
        },
      );
      expect(mockPostHogInstance.isFeatureEnabled).toHaveBeenCalledWith(
        "disabled-flag",
        "anonymous",
        {
          groups: undefined,
          personProperties: undefined,
        },
      );
    });

    it("should get feature flag value via PostHog", async () => {
      mockPostHogInstance.getFeatureFlag
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce("variant-a")
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(null);

      initializeFeatureFlags(createMockConfig("posthog", "test-api-key"));

      const booleanValue = await getFeatureFlag("boolean-flag");
      const stringValue = await getFeatureFlag("string-flag");
      const falseValue = await getFeatureFlag("false-flag");
      const nullValue = await getFeatureFlag("null-flag");

      expect(booleanValue).toBe(true);
      expect(stringValue).toBe("variant-a");
      expect(falseValue).toBe(false);
      expect(nullValue).toBe(null);
    });

    it("should handle PostHog errors gracefully", async () => {
      mockPostHogInstance.isFeatureEnabled.mockRejectedValue(
        new Error("PostHog API error"),
      );
      mockPostHogInstance.getFeatureFlag.mockRejectedValue(
        new Error("PostHog API error"),
      );

      initializeFeatureFlags(createMockConfig("posthog", "test-api-key"));

      const enabledResult = await isFeatureEnabled("error-flag");
      const flagValue = await getFeatureFlag("error-flag");

      expect(enabledResult).toBe(false);
      expect(flagValue).toBe(null);
    });

    it("should handle invalid return types from PostHog", async () => {
      // Test invalid return type (number)
      mockPostHogInstance.getFeatureFlag.mockResolvedValue(123);

      initializeFeatureFlags(createMockConfig("posthog", "test-api-key"));

      const result = await getFeatureFlag("invalid-type-flag");
      expect(result).toBe(null);
    });

    it("should properly shutdown PostHog connection", async () => {
      initializeFeatureFlags(createMockConfig("posthog", "test-api-key"));

      await shutdownFeatureFlags();
      expect(mockPostHogInstance.shutdown).toHaveBeenCalled();
    });

    it("should use anonymous user when no userId provided", async () => {
      mockPostHogInstance.isFeatureEnabled.mockResolvedValue(true);

      initializeFeatureFlags(createMockConfig("posthog", "test-api-key"));

      await isFeatureEnabled("test-flag", {});

      expect(mockPostHogInstance.isFeatureEnabled).toHaveBeenCalledWith(
        "test-flag",
        "anonymous",
        {
          groups: undefined,
          personProperties: undefined,
        },
      );
    });

    it("should pass groups and properties to PostHog", async () => {
      mockPostHogInstance.isFeatureEnabled.mockResolvedValue(true);

      initializeFeatureFlags(createMockConfig("posthog", "test-api-key"));

      await isFeatureEnabled("test-flag", {
        userId: "user123",
        groups: { company: "acme-corp" },
        properties: { plan: "enterprise", region: "us-east" },
      });

      expect(mockPostHogInstance.isFeatureEnabled).toHaveBeenCalledWith(
        "test-flag",
        "user123",
        {
          groups: { company: "acme-corp" },
          personProperties: { plan: "enterprise", region: "us-east" },
        },
      );
    });
  });
});
