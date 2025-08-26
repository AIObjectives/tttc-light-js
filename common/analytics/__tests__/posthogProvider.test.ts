/**
 * Comprehensive tests for PostHogAnalyticsProvider
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  type MockedFunction,
} from "vitest";
import { PostHogAnalyticsProvider } from "../providers/posthogProvider";
import type {
  AnalyticsConfig,
  AnalyticsEvent,
  AnalyticsIdentify,
  AnalyticsContext,
} from "../types";
import { CommonEvents } from "../types";

// Mock the logger
vi.mock("../../logger", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Use vi.hoisted to define mocks before they are used
const { mockPostHogConstructor, createMockPostHogInstance } = vi.hoisted(() => {
  const createMockPostHogInstance = () => ({
    capture: vi.fn(),
    identify: vi.fn(),
    flush: vi.fn(),
    shutdown: vi.fn(),
  });

  const mockPostHogConstructor = vi.fn();

  return {
    mockPostHogConstructor,
    createMockPostHogInstance,
  };
});

let mockPostHogInstance = createMockPostHogInstance();

vi.mock("posthog-node", () => ({
  PostHog: mockPostHogConstructor,
}));

// Mock process for server environment
const mockProcess = {
  versions: { node: "18.0.0" },
  env: {
    NODE_ENV: "test",
  },
};

describe("PostHogAnalyticsProvider", () => {
  let provider: PostHogAnalyticsProvider;
  let config: AnalyticsConfig;

  beforeEach(() => {
    // Setup server environment
    (globalThis as any).process = mockProcess;

    // Ensure we're not in browser environment
    delete (globalThis as any).window;
    delete (globalThis as any).document;

    // Reset all mocks
    vi.clearAllMocks();

    // Recreate mock instance to ensure fresh state
    mockPostHogInstance = createMockPostHogInstance();
    mockPostHogConstructor.mockImplementation(() => mockPostHogInstance);

    // Default config
    config = {
      provider: "posthog",
      apiKey: "test-api-key",
      enabled: true,
      debug: false,
      host: "https://us.i.posthog.com",
      flushAt: 20,
      flushInterval: 10000,
    };
  });

  afterEach(async () => {
    if (provider && provider.isReady()) {
      await provider.shutdown();
    }
  });

  describe("constructor", () => {
    it("should create provider with valid config", () => {
      provider = new PostHogAnalyticsProvider(config);

      expect(provider).toBeInstanceOf(PostHogAnalyticsProvider);
      expect(provider.isReady()).toBe(false);
    });

    it("should throw error when API key is missing", () => {
      config.apiKey = undefined;

      expect(() => {
        new PostHogAnalyticsProvider(config);
      }).toThrow("PostHog API key is required");
    });

    it("should throw error when API key is empty string", () => {
      config.apiKey = "";

      expect(() => {
        new PostHogAnalyticsProvider(config);
      }).toThrow("PostHog API key is required");
    });

    it("should store configuration correctly", () => {
      provider = new PostHogAnalyticsProvider(config);

      expect((provider as any).config).toEqual(config);
    });
  });

  describe("initialization", () => {
    it("should initialize PostHog with correct configuration", async () => {
      provider = new PostHogAnalyticsProvider(config);

      const event: AnalyticsEvent = { name: "test_event" };
      await provider.track(event);

      expect(mockPostHogConstructor).toHaveBeenCalledWith("test-api-key", {
        host: "https://us.i.posthog.com",
        flushAt: 20,
        flushInterval: 10000,
      });
      expect(provider.isReady()).toBe(true);
    });

    it("should use default configuration values", async () => {
      config = {
        provider: "posthog",
        apiKey: "test-api-key",
      };
      provider = new PostHogAnalyticsProvider(config);

      const event: AnalyticsEvent = { name: "test_event" };
      await provider.track(event);

      expect(mockPostHogConstructor).toHaveBeenCalledWith("test-api-key", {
        host: "https://us.i.posthog.com",
        flushAt: 20,
        flushInterval: 10000,
      });
    });

    it("should use custom configuration values", async () => {
      config.host = "https://custom.posthog.com";
      config.flushAt = 50;
      config.flushInterval = 5000;

      provider = new PostHogAnalyticsProvider(config);

      const event: AnalyticsEvent = { name: "test_event" };
      await provider.track(event);

      expect(mockPostHogConstructor).toHaveBeenCalledWith("test-api-key", {
        host: "https://custom.posthog.com",
        flushAt: 50,
        flushInterval: 5000,
      });
    });

    it("should handle PostHog import failure", async () => {
      // Mock PostHog constructor to fail during initialization
      mockPostHogConstructor.mockImplementation(() => {
        throw new Error("PostHog import failed");
      });

      provider = new PostHogAnalyticsProvider(config);

      const event: AnalyticsEvent = { name: "test_event" };

      // This should not throw but should log error
      await expect(provider.track(event)).rejects.toThrow();

      const { logger } = await import("../../logger");
      expect(logger.error).toHaveBeenCalledWith(
        "POSTHOG ANALYTICS ERROR: Failed to initialize provider:",
        expect.any(Error),
      );
    });

    it("should handle PostHog constructor failure", async () => {
      mockPostHogConstructor.mockImplementation(() => {
        throw new Error("PostHog constructor failed");
      });

      provider = new PostHogAnalyticsProvider(config);

      const event: AnalyticsEvent = { name: "test_event" };

      // This should throw an error during track
      await expect(provider.track(event)).rejects.toThrow();

      const { logger } = await import("../../logger");
      expect(logger.error).toHaveBeenCalledWith(
        "POSTHOG ANALYTICS ERROR: Failed to initialize provider:",
        expect.any(Error),
      );
    });

    it("should not reinitialize if already ready", async () => {
      provider = new PostHogAnalyticsProvider(config);

      // First call should initialize
      await provider.track({ name: "event1" });
      expect(mockPostHogConstructor).toHaveBeenCalledTimes(1);

      // Second call should not reinitialize
      await provider.track({ name: "event2" });
      expect(mockPostHogConstructor).toHaveBeenCalledTimes(1);
    });
  });

  describe("track", () => {
    beforeEach(async () => {
      provider = new PostHogAnalyticsProvider(config);
    });

    it("should track event successfully", async () => {
      const event: AnalyticsEvent = {
        name: CommonEvents.USER_SIGNIN,
        properties: {
          method: "firebase",
          provider: "google",
        },
        context: {
          user: {
            userId: "user123",
            email: "user@example.com",
          },
          sessionId: "session456",
          requestId: "req789",
        },
      };

      await provider.track(event);

      expect(mockPostHogInstance.capture).toHaveBeenCalledWith({
        distinctId: "user123",
        event: CommonEvents.USER_SIGNIN,
        properties: expect.objectContaining({
          method: "firebase",
          provider: "google",
          email: "user@example.com",
          $session_id: "session456",
          $request_id: "req789",
          $timestamp: expect.any(String),
        }),
      });
    });

    it("should use anonymous as distinctId when no user ID provided", async () => {
      const event: AnalyticsEvent = {
        name: "anonymous_event",
      };

      await provider.track(event);

      expect(mockPostHogInstance.capture).toHaveBeenCalledWith({
        distinctId: "anonymous",
        event: "anonymous_event",
        properties: expect.objectContaining({
          $timestamp: expect.any(String),
        }),
      });
    });

    it("should build event properties correctly", async () => {
      const timestamp = new Date("2023-01-01T00:00:00Z");
      const event: AnalyticsEvent = {
        name: "test_event",
        properties: {
          customProp: "value",
          numberProp: 42,
          booleanProp: true,
        },
        context: {
          user: {
            userId: "user123",
            email: "user@example.com",
            properties: {
              plan: "premium",
              role: "admin",
            },
          },
          sessionId: "session456",
          requestId: "req789",
          timestamp,
          environment: "production",
          version: "1.2.3",
          platform: "server",
          userAgent: "Server/1.0",
          url: "https://api.example.com/endpoint",
        },
      };

      await provider.track(event);

      expect(mockPostHogInstance.capture).toHaveBeenCalledWith({
        distinctId: "user123",
        event: "test_event",
        properties: expect.objectContaining({
          customProp: "value",
          numberProp: 42,
          booleanProp: true,
          email: "user@example.com",
          plan: "premium",
          role: "admin",
          $session_id: "session456",
          $request_id: "req789",
          $timestamp: "2023-01-01T00:00:00.000Z",
          $environment: "production",
          $app_version: "1.2.3",
          $platform: "server",
          $user_agent: "Server/1.0",
          $current_url: "https://api.example.com/endpoint",
        }),
      });
    });

    it("should clean properties with undefined values", async () => {
      const event: AnalyticsEvent = {
        name: "test_event",
        properties: {
          validProp: "value",
          undefinedProp: undefined,
          nullProp: null,
        },
      };

      await provider.track(event);

      const capturedCall = mockPostHogInstance.capture.mock.calls[0][0];
      expect(capturedCall.properties).toHaveProperty("validProp", "value");
      expect(capturedCall.properties).toHaveProperty("nullProp", null);
      expect(capturedCall.properties).not.toHaveProperty("undefinedProp");
    });

    it("should handle circular references in properties", async () => {
      const circularObj: any = { name: "test" };
      circularObj.self = circularObj;

      const event: AnalyticsEvent = {
        name: "test_event",
        properties: {
          circular: circularObj,
        },
      };

      await provider.track(event);

      const capturedCall = mockPostHogInstance.capture.mock.calls[0][0];
      expect(typeof capturedCall.properties.circular).toBe("string");
    });

    it("should implement retry logic on track failure", async () => {
      mockPostHogInstance.capture
        .mockRejectedValueOnce(new Error("First attempt failed"))
        .mockResolvedValueOnce(undefined);

      const event: AnalyticsEvent = { name: "test_event" };
      await provider.track(event);

      expect(mockPostHogInstance.capture).toHaveBeenCalledTimes(2);

      const { logger } = await import("../../logger");
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "track operation failed for test_event, retrying...",
        ),
        expect.any(Error),
      );
    });

    it("should handle retry failure", async () => {
      mockPostHogInstance.capture
        .mockRejectedValueOnce(new Error("First attempt failed"))
        .mockRejectedValueOnce(new Error("Second attempt failed"));

      const event: AnalyticsEvent = { name: "test_event" };
      await provider.track(event);

      expect(mockPostHogInstance.capture).toHaveBeenCalledTimes(2);

      const { logger } = await import("../../logger");
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to track event test_event"),
        expect.any(Error),
      );
    });

    it("should handle track errors gracefully when not initialized", async () => {
      // Create provider but don't initialize it
      const uninitializedProvider = new PostHogAnalyticsProvider(config);
      mockPostHogConstructor.mockImplementation(() => {
        throw new Error("Initialization failed");
      });

      const event: AnalyticsEvent = { name: "test_event" };

      // Should throw during initialization
      await expect(uninitializedProvider.track(event)).rejects.toThrow();

      const { logger } = await import("../../logger");
      expect(logger.error).toHaveBeenCalledWith(
        "POSTHOG ANALYTICS ERROR: Failed to initialize provider:",
        expect.any(Error),
      );
    });
  });

  describe("identify", () => {
    beforeEach(async () => {
      provider = new PostHogAnalyticsProvider(config);
    });

    it("should identify user successfully", async () => {
      const identify: AnalyticsIdentify = {
        userId: "user123",
        traits: {
          name: "John Doe",
          email: "john@example.com",
          plan: "premium",
          age: 30,
          isActive: true,
        },
      };

      await provider.identify(identify);

      expect(mockPostHogInstance.identify).toHaveBeenCalledWith({
        distinctId: "user123",
        properties: {
          name: "John Doe",
          email: "john@example.com",
          plan: "premium",
          age: 30,
          isActive: true,
        },
      });
    });

    it("should identify user with minimal data", async () => {
      const identify: AnalyticsIdentify = {
        userId: "user123",
      };

      await provider.identify(identify);

      expect(mockPostHogInstance.identify).toHaveBeenCalledWith({
        distinctId: "user123",
        properties: {},
      });
    });

    it("should clean traits properties", async () => {
      const identify: AnalyticsIdentify = {
        userId: "user123",
        traits: {
          name: "John",
          undefinedTrait: undefined,
          nullTrait: null,
        },
      };

      await provider.identify(identify);

      const identifyCall = mockPostHogInstance.identify.mock.calls[0][0];
      expect(identifyCall.properties).toHaveProperty("name", "John");
      expect(identifyCall.properties).toHaveProperty("nullTrait", null);
      expect(identifyCall.properties).not.toHaveProperty("undefinedTrait");
    });

    it("should implement retry logic on identify failure", async () => {
      mockPostHogInstance.identify
        .mockRejectedValueOnce(new Error("First attempt failed"))
        .mockResolvedValueOnce(undefined);

      const identify: AnalyticsIdentify = { userId: "user123" };
      await provider.identify(identify);

      expect(mockPostHogInstance.identify).toHaveBeenCalledTimes(2);

      const { logger } = await import("../../logger");
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "identify operation failed for user123, retrying...",
        ),
        expect.any(Error),
      );
    });

    it("should handle retry failure for identify", async () => {
      mockPostHogInstance.identify
        .mockRejectedValueOnce(new Error("First attempt failed"))
        .mockRejectedValueOnce(new Error("Second attempt failed"));

      const identify: AnalyticsIdentify = { userId: "user123" };
      await provider.identify(identify);

      expect(mockPostHogInstance.identify).toHaveBeenCalledTimes(2);

      const { logger } = await import("../../logger");
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to identify user user123"),
        expect.any(Error),
      );
    });
  });

  describe("page", () => {
    beforeEach(async () => {
      provider = new PostHogAnalyticsProvider(config);
    });

    it("should track page view successfully", async () => {
      const context: AnalyticsContext = {
        user: { userId: "user123" },
        url: "https://api.example.com/dashboard",
      };

      await provider.page("Dashboard API", { section: "analytics" }, context);

      expect(mockPostHogInstance.capture).toHaveBeenCalledWith({
        distinctId: "user123",
        event: "$pageview",
        properties: expect.objectContaining({
          $current_url: "https://api.example.com/dashboard",
          page_name: "Dashboard API",
          section: "analytics",
        }),
      });
    });

    it("should use page name as URL when no URL in context", async () => {
      await provider.page("API Home");

      expect(mockPostHogInstance.capture).toHaveBeenCalledWith({
        distinctId: "anonymous",
        event: "$pageview",
        properties: expect.objectContaining({
          $current_url: "API Home",
          page_name: "API Home",
        }),
      });
    });

    it("should handle page tracking with retry logic", async () => {
      mockPostHogInstance.capture
        .mockRejectedValueOnce(new Error("First attempt failed"))
        .mockResolvedValueOnce(undefined);

      await provider.page("Test Page");

      expect(mockPostHogInstance.capture).toHaveBeenCalledTimes(2);

      const { logger } = await import("../../logger");
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "page operation failed for Test Page, retrying...",
        ),
        expect.any(Error),
      );
    });

    it("should handle page tracking errors gracefully", async () => {
      mockPostHogInstance.capture
        .mockRejectedValueOnce(new Error("First attempt failed"))
        .mockRejectedValueOnce(new Error("Second attempt failed"));

      await provider.page("Error Page");

      const { logger } = await import("../../logger");
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to track page view Error Page"),
        expect.any(Error),
      );
    });
  });

  describe("flush", () => {
    beforeEach(async () => {
      provider = new PostHogAnalyticsProvider(config);
      // Initialize the provider
      await provider.track({ name: "init_event" });
    });

    it("should flush successfully", async () => {
      mockPostHogInstance.flush.mockResolvedValue(undefined);

      await provider.flush();

      expect(mockPostHogInstance.flush).toHaveBeenCalled();
    });

    it("should handle flush errors gracefully", async () => {
      mockPostHogInstance.flush.mockRejectedValue(new Error("Flush failed"));

      await provider.flush();

      const { logger } = await import("../../logger");
      expect(logger.error).toHaveBeenCalledWith(
        "POSTHOG ANALYTICS ERROR: Failed to flush data:",
        expect.any(Error),
      );
    });

    it("should handle flush when provider is not initialized", async () => {
      const uninitializedProvider = new PostHogAnalyticsProvider(config);

      await uninitializedProvider.flush();

      expect(mockPostHogInstance.flush).not.toHaveBeenCalled();
    });
  });

  describe("shutdown", () => {
    beforeEach(async () => {
      provider = new PostHogAnalyticsProvider(config);
      // Initialize the provider
      await provider.track({ name: "init_event" });
    });

    it("should shutdown successfully", async () => {
      mockPostHogInstance.shutdown.mockResolvedValue(undefined);
      expect(provider.isReady()).toBe(true);

      await provider.shutdown();

      expect(mockPostHogInstance.shutdown).toHaveBeenCalled();
      expect(provider.isReady()).toBe(false);
      expect((provider as any).posthog).toBeNull();
    });

    it("should handle shutdown errors gracefully", async () => {
      mockPostHogInstance.shutdown.mockRejectedValue(
        new Error("Shutdown failed"),
      );

      await provider.shutdown();

      const { logger } = await import("../../logger");
      expect(logger.error).toHaveBeenCalledWith(
        "POSTHOG ANALYTICS ERROR: Failed to shutdown PostHog:",
        expect.any(Error),
      );
    });

    it("should handle shutdown when provider is not initialized", async () => {
      const uninitializedProvider = new PostHogAnalyticsProvider(config);

      await uninitializedProvider.shutdown();

      expect(mockPostHogInstance.shutdown).not.toHaveBeenCalled();
    });

    it("should handle multiple shutdown calls", async () => {
      mockPostHogInstance.shutdown.mockResolvedValue(undefined);

      await provider.shutdown();
      await provider.shutdown();

      // Should only call shutdown once on the PostHog instance
      expect(mockPostHogInstance.shutdown).toHaveBeenCalledTimes(1);
    });
  });

  describe("isReady", () => {
    it("should return false when not initialized", () => {
      provider = new PostHogAnalyticsProvider(config);
      expect(provider.isReady()).toBe(false);
    });

    it("should return true after successful initialization", async () => {
      provider = new PostHogAnalyticsProvider(config);
      await provider.track({ name: "test_event" });
      expect(provider.isReady()).toBe(true);
    });

    it("should return false after shutdown", async () => {
      provider = new PostHogAnalyticsProvider(config);
      await provider.track({ name: "test_event" });
      expect(provider.isReady()).toBe(true);

      mockPostHogInstance.shutdown.mockResolvedValue(undefined);
      await provider.shutdown();
      expect(provider.isReady()).toBe(false);
    });

    it("should return false when PostHog instance is null", async () => {
      provider = new PostHogAnalyticsProvider(config);
      await provider.track({ name: "test_event" });

      // Manually set posthog to null
      (provider as any).posthog = null;
      expect(provider.isReady()).toBe(false);
    });
  });

  describe("concurrent operations", () => {
    beforeEach(async () => {
      provider = new PostHogAnalyticsProvider(config);
    });

    it("should handle concurrent track operations", async () => {
      const events = [
        { name: "event1" },
        { name: "event2" },
        { name: "event3" },
      ];

      const promises = events.map((event) => provider.track(event));
      await Promise.all(promises);

      expect(mockPostHogInstance.capture).toHaveBeenCalledTimes(3);
    });

    it("should handle concurrent initialization attempts", async () => {
      const promises = [
        provider.track({ name: "event1" }),
        provider.track({ name: "event2" }),
        provider.identify({ userId: "user1" }),
      ];

      await Promise.all(promises);

      // Should only initialize once
      expect(mockPostHogConstructor).toHaveBeenCalledTimes(1);
    });
  });

  describe("edge cases", () => {
    beforeEach(async () => {
      provider = new PostHogAnalyticsProvider(config);
    });

    it("should handle events with very large properties", async () => {
      const largeProperty = "x".repeat(10000);
      const event: AnalyticsEvent = {
        name: "large_event",
        properties: {
          large: largeProperty,
        },
      };

      await provider.track(event);

      expect(mockPostHogInstance.capture).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            large: largeProperty,
          }),
        }),
      );
    });

    it("should handle events with special characters in names", async () => {
      const specialEvents = [
        "特殊字符事件",
        "événement_spécial",
        "событие_с_символами",
        "event-with-dashes",
        "event.with.dots",
        "event with spaces",
      ];

      for (const eventName of specialEvents) {
        await provider.track({ name: eventName });

        expect(mockPostHogInstance.capture).toHaveBeenCalledWith(
          expect.objectContaining({
            event: eventName,
          }),
        );
      }
    });

    it("should handle empty properties and context", async () => {
      const event: AnalyticsEvent = {
        name: "empty_event",
        properties: {},
        context: {},
      };

      await provider.track(event);

      expect(mockPostHogInstance.capture).toHaveBeenCalledWith({
        distinctId: "anonymous",
        event: "empty_event",
        properties: expect.objectContaining({
          $timestamp: expect.any(String),
        }),
      });
    });
  });
});
