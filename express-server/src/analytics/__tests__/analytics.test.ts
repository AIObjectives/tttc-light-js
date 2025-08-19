import {
  describe,
  it,
  expect,
  beforeAll,
  afterEach,
  vi,
  beforeEach,
  afterAll,
} from "vitest";
import {
  initializeAnalytics,
  trackEvent,
  identifyUser,
  trackPage,
  flushAnalytics,
  shutdownAnalytics,
} from "../index";
import { LocalAnalyticsProvider } from "../providers/localProvider";
import { PostHogAnalyticsProvider } from "../providers/posthogProvider";
import {
  AnalyticsEvent,
  AnalyticsIdentify,
  AnalyticsContext,
  CommonEvents,
  AnalyticsError,
} from "../types";

// Mock PostHog
const mockPostHogInstance = {
  capture: vi.fn(),
  identify: vi.fn(),
  alias: vi.fn(),
  page: vi.fn(),
  flush: vi.fn(),
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
    debug: vi.fn(),
  },
}));

// Mock console methods for local provider testing
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

describe("Analytics Module", () => {
  // Mock environment for tests
  const createMockConfig = (
    provider = "local" as const,
    apiKey?: string,
    host?: string,
    debug = false,
    enabled = true,
  ) => ({
    provider,
    apiKey,
    host: host || "https://app.posthog.com",
    flushAt: 20,
    flushInterval: 10000,
    debug,
    enabled,
  });

  beforeAll(() => {
    // Mock console methods
    console.log = vi.fn();
    console.info = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();
  });

  afterAll(() => {
    // Restore console methods
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    await shutdownAnalytics();
  });

  describe("Initialization", () => {
    it("should initialize with local provider by default", () => {
      const provider = initializeAnalytics(createMockConfig("local"));
      expect(provider).toBeInstanceOf(LocalAnalyticsProvider);
    });

    it("should initialize with PostHog provider when configured", () => {
      const provider = initializeAnalytics(
        createMockConfig("posthog", "test-api-key")
      );
      expect(provider).toBeInstanceOf(PostHogAnalyticsProvider);
    });

    it("should throw error when PostHog provider lacks API key", () => {
      expect(() => {
        initializeAnalytics(createMockConfig("posthog"));
      }).toThrow("PostHog API key is required for PostHog provider");
    });

    it("should throw error for unknown provider", () => {
      expect(() => {
        initializeAnalytics({
          ...createMockConfig("local"),
          provider: "unknown" as any,
        });
      }).toThrow("Unknown analytics provider: unknown");
    });

    it("should handle disabled analytics gracefully", () => {
      const provider = initializeAnalytics(createMockConfig("local", undefined, undefined, false, false));
      expect(provider).toBeInstanceOf(LocalAnalyticsProvider);
    });
  });

  describe("Local Provider", () => {
    beforeEach(() => {
      initializeAnalytics(createMockConfig("local", undefined, undefined, true));
    });

    it("should track events to console", async () => {
      const event: AnalyticsEvent = {
        name: CommonEvents.USER_SIGNIN,
        properties: {
          method: "firebase",
          timestamp: "2023-01-01T00:00:00Z",
        },
        context: {
          user: {
            userId: "user123",
            email: "test@example.com",
          },
          sessionId: "session456",
          environment: "test",
        },
      };

      await trackEvent(event);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("[ANALYTICS:LOCAL] Event tracked:")
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.objectContaining({
          name: CommonEvents.USER_SIGNIN,
          properties: event.properties,
          context: expect.objectContaining(event.context),
        })
      );
    });

    it("should identify users", async () => {
      const identify: AnalyticsIdentify = {
        userId: "user123",
        traits: {
          name: "John Doe",
          email: "john@example.com",
          plan: "premium",
        },
        context: {
          sessionId: "session456",
          environment: "test",
        },
      };

      await identifyUser(identify);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("[ANALYTICS:LOCAL] User identified:")
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user123",
          traits: identify.traits,
          context: expect.objectContaining(identify.context),
        })
      );
    });

    it("should track page views", async () => {
      await trackPage("Dashboard", { section: "reports" }, {
        user: { userId: "user123" },
        sessionId: "session456",
      });

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("[ANALYTICS:LOCAL] Page tracked:")
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.objectContaining({
          page: "Dashboard",
          properties: { section: "reports" },
          context: expect.objectContaining({
            user: { userId: "user123" },
            sessionId: "session456",
          }),
        })
      );
    });

    it("should handle flush gracefully", async () => {
      await flushAnalytics();
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("[ANALYTICS:LOCAL] Flush requested")
      );
    });

    it("should handle disabled analytics", async () => {
      await shutdownAnalytics();
      initializeAnalytics(createMockConfig("local", undefined, undefined, false, false));

      const event: AnalyticsEvent = {
        name: CommonEvents.USER_SIGNIN,
        properties: { method: "firebase" },
      };

      await trackEvent(event);

      // Should not log when disabled
      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining("[ANALYTICS:LOCAL] Event tracked:")
      );
    });
  });

  describe("PostHog Provider", () => {
    beforeEach(() => {
      initializeAnalytics(createMockConfig("posthog", "test-api-key"));
    });

    it("should track events via PostHog", async () => {
      const event: AnalyticsEvent = {
        name: CommonEvents.REPORT_CREATED,
        properties: {
          reportId: "report123",
          size: 1500,
          processingTime: 45000,
        },
        context: {
          user: {
            userId: "user123",
            email: "test@example.com",
          },
          sessionId: "session456",
          requestId: "req789",
        },
      };

      await trackEvent(event);

      expect(mockPostHogInstance.capture).toHaveBeenCalledWith({
        distinctId: "user123",
        event: CommonEvents.REPORT_CREATED,
        properties: expect.objectContaining({
          reportId: "report123",
          size: 1500,
          processingTime: 45000,
          $session_id: "session456",
          $request_id: "req789",
          email: "test@example.com",
          $timestamp: expect.any(String),
        }),
      });
    });

    it("should handle anonymous users", async () => {
      const event: AnalyticsEvent = {
        name: CommonEvents.API_REQUEST,
        properties: { endpoint: "/api/reports" },
        context: {
          sessionId: "session456",
        },
      };

      await trackEvent(event);

      expect(mockPostHogInstance.capture).toHaveBeenCalledWith({
        distinctId: "anonymous",
        event: CommonEvents.API_REQUEST,
        properties: expect.objectContaining({
          endpoint: "/api/reports",
          $session_id: "session456",
          $timestamp: expect.any(String),
        }),
      });
    });

    it("should identify users via PostHog", async () => {
      const identify: AnalyticsIdentify = {
        userId: "user123",
        traits: {
          name: "Jane Doe",
          email: "jane@example.com",
          plan: "enterprise",
          createdAt: "2023-01-01",
        },
      };

      await identifyUser(identify);

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

    it("should track page views via PostHog", async () => {
      await trackPage("Report View", { reportId: "report123" }, {
        user: { userId: "user123" },
        sessionId: "session456",
      });

      expect(mockPostHogInstance.capture).toHaveBeenCalledWith({
        distinctId: "user123",
        event: "$pageview",
        properties: expect.objectContaining({
          $current_url: "Report View",
          reportId: "report123",
          $session_id: "session456",
          $timestamp: expect.any(String),
        }),
      });
    });

    it("should flush PostHog data", async () => {
      await flushAnalytics();
      expect(mockPostHogInstance.flush).toHaveBeenCalled();
    });

    it("should shutdown PostHog connection", async () => {
      await shutdownAnalytics();
      expect(mockPostHogInstance.shutdown).toHaveBeenCalled();
    });

    it("should handle PostHog errors gracefully", async () => {
      mockPostHogInstance.capture.mockRejectedValue(new Error("PostHog API error"));

      const event: AnalyticsEvent = {
        name: CommonEvents.ERROR_OCCURRED,
        properties: { error: "test error" },
      };

      // Should not throw
      await expect(trackEvent(event)).resolves.toBeUndefined();
    });

    it("should retry failed events", async () => {
      mockPostHogInstance.capture
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce(undefined);

      const event: AnalyticsEvent = {
        name: CommonEvents.USER_SIGNIN,
        properties: { method: "firebase" },
      };

      await trackEvent(event);

      // Should have been called twice (initial + retry)
      expect(mockPostHogInstance.capture).toHaveBeenCalledTimes(2);
    });
  });

  describe("Error Handling", () => {
    it("should handle operations when analytics not initialized", async () => {
      // Test without initializing analytics
      await expect(trackEvent({ name: "test" })).resolves.toBeUndefined();
      await expect(identifyUser({ userId: "test" })).resolves.toBeUndefined();
      await expect(trackPage("test")).resolves.toBeUndefined();
      await expect(flushAnalytics()).resolves.toBeUndefined();
    });

    it("should handle invalid event data gracefully", async () => {
      initializeAnalytics(createMockConfig("local"));

      const invalidEvent = {
        name: "",
        properties: null,
      } as any;

      await expect(trackEvent(invalidEvent)).resolves.toBeUndefined();
    });

    it("should create proper AnalyticsError instances", () => {
      const originalError = new Error("Original error");
      const analyticsError = new AnalyticsError(
        "Analytics operation failed",
        "posthog",
        "track",
        originalError
      );

      expect(analyticsError).toBeInstanceOf(AnalyticsError);
      expect(analyticsError.message).toBe("Analytics operation failed");
      expect(analyticsError.provider).toBe("posthog");
      expect(analyticsError.operation).toBe("track");
      expect(analyticsError.originalError).toBe(originalError);
      expect(analyticsError.name).toBe("AnalyticsError");
    });
  });

  describe("Common Events", () => {
    beforeEach(() => {
      initializeAnalytics(createMockConfig("local"));
    });

    it("should track user authentication events", async () => {
      await trackEvent({
        name: CommonEvents.USER_SIGNIN,
        properties: {
          method: "firebase",
          provider: "google",
        },
        context: {
          user: { userId: "user123", email: "test@example.com" },
        },
      });

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("user_signin")
      );
    });

    it("should track pipeline events", async () => {
      const pipelineStartEvent: AnalyticsEvent = {
        name: CommonEvents.PIPELINE_STARTED,
        properties: {
          pipelineId: "pipeline123",
          inputSize: 1500,
          estimatedDuration: 300,
        },
      };

      const pipelineCompleteEvent: AnalyticsEvent = {
        name: CommonEvents.PIPELINE_COMPLETED,
        properties: {
          pipelineId: "pipeline123",
          duration: 285,
          tokensUsed: 15000,
          cost: 0.75,
        },
      };

      await trackEvent(pipelineStartEvent);
      await trackEvent(pipelineCompleteEvent);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("pipeline_started")
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("pipeline_completed")
      );
    });

    it("should track report events", async () => {
      await trackEvent({
        name: CommonEvents.REPORT_VIEWED,
        properties: {
          reportId: "report123",
          reportType: "analysis",
          viewDuration: 45,
        },
        context: {
          user: { userId: "user123" },
          sessionId: "session456",
        },
      });

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("report_viewed")
      );
    });

    it("should track error events", async () => {
      await trackEvent({
        name: CommonEvents.ERROR_OCCURRED,
        properties: {
          errorType: "ValidationError",
          errorMessage: "Invalid input format",
          endpoint: "/api/create",
          statusCode: 400,
        },
        context: {
          requestId: "req789",
          user: { userId: "user123" },
        },
      });

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("error_occurred")
      );
    });
  });

  describe("Context Handling", () => {
    beforeEach(() => {
      initializeAnalytics(createMockConfig("posthog", "test-api-key"));
    });

    it("should merge context with event properties", async () => {
      const context: AnalyticsContext = {
        user: { userId: "user123", email: "test@example.com" },
        sessionId: "session456",
        requestId: "req789",
        environment: "production",
        version: "1.2.3",
      };

      await trackEvent({
        name: CommonEvents.FEATURE_USED,
        properties: { feature: "dashboard" },
        context,
      });

      expect(mockPostHogInstance.capture).toHaveBeenCalledWith({
        distinctId: "user123",
        event: CommonEvents.FEATURE_USED,
        properties: expect.objectContaining({
          feature: "dashboard",
          $session_id: "session456",
          $request_id: "req789",
          email: "test@example.com",
          $app_version: "1.2.3",
          $environment: "production",
          $timestamp: expect.any(String),
        }),
      });
    });

    it("should handle missing context gracefully", async () => {
      await trackEvent({
        name: CommonEvents.API_REQUEST,
        properties: { endpoint: "/api/test" },
      });

      expect(mockPostHogInstance.capture).toHaveBeenCalledWith({
        distinctId: "anonymous",
        event: CommonEvents.API_REQUEST,
        properties: expect.objectContaining({
          endpoint: "/api/test",
          $timestamp: expect.any(String),
        }),
      });
    });

    it("should add timestamps automatically", async () => {
      const beforeTime = new Date();
      
      await trackEvent({
        name: CommonEvents.USER_SIGNIN,
        properties: { method: "firebase" },
      });

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
});