import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock PostHog
const mockPostHogInstance = vi.hoisted(() => ({
  capture: vi.fn(),
  identify: vi.fn(),
  alias: vi.fn(),
  page: vi.fn(),
  flush: vi.fn(),
  shutdown: vi.fn(),
}));

vi.mock("posthog-node", () => {
  return {
    PostHog: vi.fn().mockImplementation(() => mockPostHogInstance),
  };
});

// Mock logger
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("tttc-common/logger", () => ({
  logger: mockLogger,
}));

import { PostHogAnalyticsProvider } from "../providers/posthogProvider";
import {
  AnalyticsEvent,
  AnalyticsIdentify,
  AnalyticsContext,
  CommonEvents,
  AnalyticsConfig,
} from "../types";

describe("PostHogAnalyticsProvider", () => {
  let provider: PostHogAnalyticsProvider;
  
  const defaultConfig: AnalyticsConfig = {
    provider: "posthog",
    apiKey: "test-api-key",
    host: "https://app.posthog.com",
    flushAt: 20,
    flushInterval: 10000,
    debug: false,
    enabled: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new PostHogAnalyticsProvider(defaultConfig);
  });

  describe("Configuration", () => {
    it("should initialize with default configuration", () => {
      expect(provider).toBeInstanceOf(PostHogAnalyticsProvider);
    });

    it("should initialize with custom host", () => {
      const customConfig = {
        ...defaultConfig,
        host: "https://eu.posthog.com",
      };
      
      const customProvider = new PostHogAnalyticsProvider(customConfig);
      expect(customProvider).toBeInstanceOf(PostHogAnalyticsProvider);
    });

    it("should initialize with custom flush settings", () => {
      const customConfig = {
        ...defaultConfig,
        flushAt: 50,
        flushInterval: 5000,
      };
      
      const customProvider = new PostHogAnalyticsProvider(customConfig);
      expect(customProvider).toBeInstanceOf(PostHogAnalyticsProvider);
    });

    it("should respect debug configuration", () => {
      const debugConfig = {
        ...defaultConfig,
        debug: true,
      };
      
      const debugProvider = new PostHogAnalyticsProvider(debugConfig);
      expect(debugProvider).toBeInstanceOf(PostHogAnalyticsProvider);
    });
  });

  describe("Event Tracking", () => {
    it("should track simple events", async () => {
      const event: AnalyticsEvent = {
        name: CommonEvents.USER_SIGNIN,
        properties: {
          method: "firebase",
          provider: "google",
        },
      };

      await provider.track(event);

      expect(mockPostHogInstance.capture).toHaveBeenCalledWith({
        distinctId: "anonymous",
        event: CommonEvents.USER_SIGNIN,
        properties: expect.objectContaining({
          method: "firebase",
          provider: "google",
          $timestamp: expect.any(String),
        }),
      });
    });

    it("should track events with user context", async () => {
      const event: AnalyticsEvent = {
        name: CommonEvents.REPORT_CREATED,
        properties: {
          reportId: "report123",
          size: 1500,
        },
        context: {
          user: {
            userId: "user123",
            email: "test@example.com",
            properties: { plan: "premium" },
          },
          sessionId: "session456",
          requestId: "req789",
        },
      };

      await provider.track(event);

      expect(mockPostHogInstance.capture).toHaveBeenCalledWith({
        distinctId: "user123",
        event: CommonEvents.REPORT_CREATED,
        properties: expect.objectContaining({
          reportId: "report123",
          size: 1500,
          email: "test@example.com",
          plan: "premium",
          $session_id: "session456",
          $request_id: "req789",
          $timestamp: expect.any(String),
        }),
      });
    });

    it("should handle anonymous users", async () => {
      const event: AnalyticsEvent = {
        name: CommonEvents.API_REQUEST,
        properties: {
          endpoint: "/api/reports",
          method: "GET",
        },
        context: {
          sessionId: "session456",
        },
      };

      await provider.track(event);

      expect(mockPostHogInstance.capture).toHaveBeenCalledWith({
        distinctId: "anonymous",
        event: CommonEvents.API_REQUEST,
        properties: expect.objectContaining({
          endpoint: "/api/reports",
          method: "GET",
          $session_id: "session456",
          $timestamp: expect.any(String),
        }),
      });
    });

    it("should add environment and version context", async () => {
      const event: AnalyticsEvent = {
        name: CommonEvents.FEATURE_USED,
        properties: { feature: "dashboard" },
        context: {
          user: { userId: "user123" },
          environment: "production",
          version: "1.2.3",
        },
      };

      await provider.track(event);

      expect(mockPostHogInstance.capture).toHaveBeenCalledWith({
        distinctId: "user123",
        event: CommonEvents.FEATURE_USED,
        properties: expect.objectContaining({
          feature: "dashboard",
          $environment: "production",
          $app_version: "1.2.3",
          $timestamp: expect.any(String),
        }),
      });
    });

    it("should handle null and undefined properties", async () => {
      const event: AnalyticsEvent = {
        name: CommonEvents.ERROR_OCCURRED,
        properties: {
          errorType: "ValidationError",
          userId: null,
          metadata: undefined,
          count: 0,
          isValid: false,
        },
      };

      await provider.track(event);

      expect(mockPostHogInstance.capture).toHaveBeenCalledWith({
        distinctId: "anonymous",
        event: CommonEvents.ERROR_OCCURRED,
        properties: expect.objectContaining({
          errorType: "ValidationError",
          userId: null,
          count: 0,
          isValid: false,
          $timestamp: expect.any(String),
          // undefined properties should be filtered out
        }),
      });
    });

    it("should not track when disabled", async () => {
      const disabledProvider = new PostHogAnalyticsProvider({
        ...defaultConfig,
        enabled: false,
      });

      const event: AnalyticsEvent = {
        name: CommonEvents.USER_SIGNIN,
        properties: { method: "firebase" },
      };

      await disabledProvider.track(event);

      expect(mockPostHogInstance.capture).not.toHaveBeenCalled();
    });

    it("should add timestamp automatically", async () => {
      const beforeTime = new Date();

      const event: AnalyticsEvent = {
        name: CommonEvents.USER_SIGNIN,
        properties: { method: "firebase" },
      };

      await provider.track(event);

      const afterTime = new Date();

      expect(mockPostHogInstance.capture).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            $timestamp: expect.any(String),
          }),
        })
      );

      const captureCall = mockPostHogInstance.capture.mock.calls[0][0];
      const eventTime = new Date(captureCall.properties.$timestamp);

      expect(eventTime.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(eventTime.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe("User Identification", () => {
    it("should identify users", async () => {
      const identify: AnalyticsIdentify = {
        userId: "user123",
        traits: {
          name: "Jane Doe",
          email: "jane@example.com",
          plan: "enterprise",
          createdAt: "2023-01-01",
        },
      };

      await provider.identify(identify);

      expect(mockPostHogInstance.identify).toHaveBeenCalledWith({
        distinctId: "user123",
        properties: {
          name: "Jane Doe",
          email: "jane@example.com",
          plan: "enterprise",
          createdAt: "2023-01-01",
        },
      });
    });

    it("should identify users without traits", async () => {
      const identify: AnalyticsIdentify = {
        userId: "user456",
      };

      await provider.identify(identify);

      expect(mockPostHogInstance.identify).toHaveBeenCalledWith({
        distinctId: "user456",
        properties: {},
      });
    });

    it("should not identify when disabled", async () => {
      const disabledProvider = new PostHogAnalyticsProvider({
        ...defaultConfig,
        enabled: false,
      });

      const identify: AnalyticsIdentify = {
        userId: "user123",
        traits: { name: "John Doe" },
      };

      await disabledProvider.identify(identify);

      expect(mockPostHogInstance.identify).not.toHaveBeenCalled();
    });
  });

  describe("Page Tracking", () => {
    it("should track page views", async () => {
      const context: AnalyticsContext = {
        user: { userId: "user123" },
        sessionId: "session456",
      };

      await provider.page("Dashboard", { section: "reports" }, context);

      expect(mockPostHogInstance.capture).toHaveBeenCalledWith({
        distinctId: "user123",
        event: "$pageview",
        properties: expect.objectContaining({
          $current_url: "Dashboard",
          section: "reports",
          $session_id: "session456",
          $timestamp: expect.any(String),
        }),
      });
    });

    it("should track page views without properties", async () => {
      await provider.page("Home");

      expect(mockPostHogInstance.capture).toHaveBeenCalledWith({
        distinctId: "anonymous",
        event: "$pageview",
        properties: expect.objectContaining({
          $current_url: "Home",
          $timestamp: expect.any(String),
        }),
      });
    });

    it("should not track pages when disabled", async () => {
      const disabledProvider = new PostHogAnalyticsProvider({
        ...defaultConfig,
        enabled: false,
      });

      await disabledProvider.page("Dashboard");

      expect(mockPostHogInstance.capture).not.toHaveBeenCalled();
    });
  });

  describe("Flush and Shutdown", () => {
    it("should flush PostHog data", async () => {
      await provider.flush();
      expect(mockPostHogInstance.flush).toHaveBeenCalled();
    });

    it("should shutdown PostHog connection", async () => {
      await provider.shutdown();
      expect(mockPostHogInstance.shutdown).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("should handle PostHog capture errors gracefully", async () => {
      mockPostHogInstance.capture.mockRejectedValue(new Error("PostHog API error"));

      const event: AnalyticsEvent = {
        name: CommonEvents.ERROR_OCCURRED,
        properties: { error: "test error" },
      };

      await expect(provider.track(event)).resolves.toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("POSTHOG ANALYTICS ERROR"),
        expect.any(Error)
      );
    });

    it("should handle PostHog identify errors gracefully", async () => {
      mockPostHogInstance.identify.mockRejectedValue(new Error("PostHog API error"));

      const identify: AnalyticsIdentify = {
        userId: "user123",
        traits: { name: "John Doe" },
      };

      await expect(provider.identify(identify)).resolves.toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("POSTHOG ANALYTICS ERROR"),
        expect.any(Error)
      );
    });

    it("should handle PostHog flush errors gracefully", async () => {
      mockPostHogInstance.flush.mockRejectedValue(new Error("PostHog flush error"));

      await expect(provider.flush()).resolves.toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("POSTHOG ANALYTICS ERROR"),
        expect.any(Error)
      );
    });

    it("should handle PostHog shutdown errors gracefully", async () => {
      mockPostHogInstance.shutdown.mockRejectedValue(new Error("PostHog shutdown error"));

      await expect(provider.shutdown()).resolves.toBeUndefined();
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("POSTHOG ANALYTICS ERROR"),
        expect.any(Error)
      );
    });

    it("should handle malformed event data", async () => {
      const malformedEvent = {
        name: null,
        properties: "invalid",
      } as any;

      await expect(provider.track(malformedEvent)).resolves.toBeUndefined();
      expect(mockPostHogInstance.capture).toHaveBeenCalledWith(
        expect.objectContaining({
          distinctId: "anonymous",
          event: null,
          properties: expect.objectContaining({
            $timestamp: expect.any(String),
          }),
        })
      );
    });

    it("should handle circular references in properties", async () => {
      const circularObj: any = { name: "test" };
      circularObj.self = circularObj;

      const event: AnalyticsEvent = {
        name: CommonEvents.ERROR_OCCURRED,
        properties: {
          circular: circularObj,
        },
      };

      await expect(provider.track(event)).resolves.toBeUndefined();
      // PostHog should receive the event with properties that can be serialized
      expect(mockPostHogInstance.capture).toHaveBeenCalled();
    });
  });

  describe("Retry Logic", () => {
    it("should retry failed events once", async () => {
      mockPostHogInstance.capture
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce(undefined);

      const event: AnalyticsEvent = {
        name: CommonEvents.USER_SIGNIN,
        properties: { method: "firebase" },
      };

      await provider.track(event);

      expect(mockPostHogInstance.capture).toHaveBeenCalledTimes(2);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("POSTHOG ANALYTICS RETRY"),
        expect.any(Error)
      );
    });

    it("should not retry more than once", async () => {
      mockPostHogInstance.capture
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Network error again"));

      const event: AnalyticsEvent = {
        name: CommonEvents.USER_SIGNIN,
        properties: { method: "firebase" },
      };

      await provider.track(event);

      expect(mockPostHogInstance.capture).toHaveBeenCalledTimes(2);
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining("POSTHOG ANALYTICS ERROR"),
        expect.any(Error)
      );
    });

    it("should retry identify operations", async () => {
      mockPostHogInstance.identify
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce(undefined);

      const identify: AnalyticsIdentify = {
        userId: "user123",
        traits: { name: "John Doe" },
      };

      await provider.identify(identify);

      expect(mockPostHogInstance.identify).toHaveBeenCalledTimes(2);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining("POSTHOG ANALYTICS RETRY"),
        expect.any(Error)
      );
    });
  });

  describe("Debug Mode", () => {
    it("should log debug information when enabled", async () => {
      const debugProvider = new PostHogAnalyticsProvider({
        ...defaultConfig,
        debug: true,
      });

      const event: AnalyticsEvent = {
        name: CommonEvents.USER_SIGNIN,
        properties: { method: "firebase" },
      };

      await debugProvider.track(event);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining("POSTHOG ANALYTICS DEBUG"),
        expect.any(Object)
      );
    });

    it("should not log debug information when disabled", async () => {
      const nonDebugProvider = new PostHogAnalyticsProvider({
        ...defaultConfig,
        debug: false,
      });

      const event: AnalyticsEvent = {
        name: CommonEvents.USER_SIGNIN,
        properties: { method: "firebase" },
      };

      await nonDebugProvider.track(event);

      expect(mockLogger.debug).not.toHaveBeenCalled();
    });
  });
});