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
  getAllFeatureFlags,
  shutdownFeatureFlags,
} from "../index";
import { LocalFeatureFlagProvider } from "../providers/localProvider";
import { PostHogFeatureFlagProvider } from "../providers/posthogProvider";

// Mock PostHog
const mockPostHogInstance = {
  isFeatureEnabled: vi.fn(),
  getFeatureFlag: vi.fn(),
  getAllFlags: vi.fn(),
  shutdown: vi.fn(),
};

vi.mock("posthog-node", () => {
  return {
    PostHog: vi.fn().mockImplementation(() => mockPostHogInstance),
  };
});

// Mock logger
vi.mock("tttc-common/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Feature Flags", () => {
  // Mock environment for tests
  const createMockEnv = (
    provider = "local",
    apiKey?: string,
    localFlags?: Record<string, boolean | string>,
    host?: string,
  ) =>
    ({
      FEATURE_FLAG_PROVIDER: provider as "local" | "posthog",
      FEATURE_FLAG_API_KEY: apiKey,
      FEATURE_FLAG_HOST: host || "https://test.posthog.com",
      LOCAL_FLAGS: localFlags,
    }) as any;

  beforeAll(async () => {
    await shutdownFeatureFlags();
  });

  afterEach(async () => {
    await shutdownFeatureFlags();
  });

  describe("Local Provider", () => {
    it("should initialize with local provider", () => {
      const provider = initializeFeatureFlags(
        createMockEnv("local", undefined, {
          testFlag: true,
          stringFlag: "variant-a",
          disabledFlag: false,
        }),
      );

      expect(provider).toBeInstanceOf(LocalFeatureFlagProvider);
    });

    it("should check if feature is enabled", async () => {
      initializeFeatureFlags(
        createMockEnv("local", undefined, {
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
        createMockEnv("local", undefined, {
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

    it("should get all feature flags", async () => {
      const flags = {
        flag1: true,
        flag2: "test-value",
        flag3: false,
      };

      initializeFeatureFlags(createMockEnv("local", undefined, flags));

      const allFlags = await getAllFeatureFlags();
      expect(allFlags).toEqual(flags);
    });

    it("should handle context parameters (ignored by local provider)", async () => {
      initializeFeatureFlags(
        createMockEnv("local", undefined, {
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

    it("should return empty object when getting all flags without initialization", async () => {
      const result = await getAllFeatureFlags();
      expect(result).toEqual({});
    });

    it("should throw error for unknown provider", () => {
      expect(() => {
        initializeFeatureFlags(createMockEnv("unknown" as any));
      }).toThrow("Unknown feature flag provider: unknown");
    });
  });

  describe("PostHog Provider", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("should throw error when PostHog provider lacks API key", () => {
      expect(() => {
        initializeFeatureFlags(createMockEnv("posthog"));
      }).toThrow("PostHog API key is required for PostHog provider");
    });

    it("should initialize with PostHog provider", () => {
      const provider = initializeFeatureFlags(
        createMockEnv(
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

      initializeFeatureFlags(createMockEnv("posthog", "test-api-key"));

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

      initializeFeatureFlags(createMockEnv("posthog", "test-api-key"));

      const booleanValue = await getFeatureFlag("boolean-flag");
      const stringValue = await getFeatureFlag("string-flag");
      const falseValue = await getFeatureFlag("false-flag");
      const nullValue = await getFeatureFlag("null-flag");

      expect(booleanValue).toBe(true);
      expect(stringValue).toBe("variant-a");
      expect(falseValue).toBe(false);
      expect(nullValue).toBe(null);
    });

    it("should get all feature flags via PostHog", async () => {
      const mockFlags = {
        flag1: true,
        flag2: "variant-b",
        flag3: false,
      };
      mockPostHogInstance.getAllFlags.mockResolvedValue(mockFlags);

      initializeFeatureFlags(createMockEnv("posthog", "test-api-key"));

      const allFlags = await getAllFeatureFlags({
        userId: "user456",
        properties: { plan: "premium" },
      });

      expect(allFlags).toEqual(mockFlags);
      expect(mockPostHogInstance.getAllFlags).toHaveBeenCalledWith("user456", {
        groups: undefined,
        personProperties: { plan: "premium" },
      });
    });

    it("should handle PostHog errors gracefully", async () => {
      mockPostHogInstance.isFeatureEnabled.mockRejectedValue(
        new Error("PostHog API error"),
      );
      mockPostHogInstance.getFeatureFlag.mockRejectedValue(
        new Error("PostHog API error"),
      );
      mockPostHogInstance.getAllFlags.mockRejectedValue(
        new Error("PostHog API error"),
      );

      initializeFeatureFlags(createMockEnv("posthog", "test-api-key"));

      const enabledResult = await isFeatureEnabled("error-flag");
      const flagValue = await getFeatureFlag("error-flag");
      const allFlags = await getAllFeatureFlags();

      expect(enabledResult).toBe(false);
      expect(flagValue).toBe(null);
      expect(allFlags).toEqual({});
    });

    it("should handle invalid return types from PostHog", async () => {
      // Test invalid return type (number)
      mockPostHogInstance.getFeatureFlag.mockResolvedValue(123);

      initializeFeatureFlags(createMockEnv("posthog", "test-api-key"));

      const result = await getFeatureFlag("invalid-type-flag");
      expect(result).toBe(null);
    });

    it("should properly shutdown PostHog connection", async () => {
      initializeFeatureFlags(createMockEnv("posthog", "test-api-key"));

      await shutdownFeatureFlags();
      expect(mockPostHogInstance.shutdown).toHaveBeenCalled();
    });

    it("should use anonymous user when no userId provided", async () => {
      mockPostHogInstance.isFeatureEnabled.mockResolvedValue(true);

      initializeFeatureFlags(createMockEnv("posthog", "test-api-key"));

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

      initializeFeatureFlags(createMockEnv("posthog", "test-api-key"));

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
