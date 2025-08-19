import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createAnalyticsConfig } from "../config";
import {
  initializeAnalytics,
  trackEvent,
  identifyUser,
  trackPage,
  flushAnalytics,
  shutdownAnalytics,
  createAnalyticsContext,
  CommonEvents,
} from "../index";
import { Env } from "../../types/context";

// Mock PostHog
const mockPostHogInstance = {
  capture: vi.fn(),
  identify: vi.fn(),
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

// Mock console for local provider testing
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

describe("Analytics Integration Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock console methods
    console.log = vi.fn();
    console.info = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();
  });

  afterEach(async () => {
    await shutdownAnalytics();
    // Restore console methods
    console.log = originalConsole.log;
    console.info = originalConsole.info;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
  });

  const createMockEnv = (
    analyticsProvider = "local" as const,
    apiKey?: string,
    host?: string,
    debug = false,
    enabled = true,
    flushAt = 20,
    flushInterval = 10000
  ): Partial<Env> => ({
    ANALYTICS_PROVIDER: analyticsProvider,
    ANALYTICS_API_KEY: apiKey,
    ANALYTICS_HOST: host || "https://app.posthog.com",
    ANALYTICS_FLUSH_AT: flushAt,
    ANALYTICS_FLUSH_INTERVAL: flushInterval,
    ANALYTICS_DEBUG: debug,
    ANALYTICS_ENABLED: enabled,
    NODE_ENV: "test" as const,
  });

  describe("Configuration Integration", () => {
    it("should create valid local analytics config from environment", () => {
      const mockEnv = createMockEnv("local", undefined, undefined, true, true);
      const config = createAnalyticsConfig(mockEnv as Env);

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

    it("should create valid PostHog analytics config from environment", () => {
      const mockEnv = createMockEnv(
        "posthog",
        "test-api-key",
        "https://eu.posthog.com",
        false,
        true,
        50,
        5000
      );
      const config = createAnalyticsConfig(mockEnv as Env);

      expect(config).toEqual({
        provider: "posthog",
        apiKey: "test-api-key",
        host: "https://eu.posthog.com",
        flushAt: 50,
        flushInterval: 5000,
        debug: false,
        enabled: true,
      });
    });

    it("should throw error for PostHog without API key", () => {
      const mockEnv = createMockEnv("posthog");
      expect(() => createAnalyticsConfig(mockEnv as Env)).toThrow(
        "ANALYTICS_API_KEY is required when ANALYTICS_PROVIDER is set to \"posthog\""
      );
    });
  });

  describe("Full Workflow - Local Provider", () => {
    beforeEach(() => {
      const config = createAnalyticsConfig(createMockEnv("local", undefined, undefined, true) as Env);
      initializeAnalytics(config);
    });

    it("should handle complete user journey", async () => {
      // 1. User signs up
      const signupContext = createAnalyticsContext(
        "user123",
        "session456",
        "req789",
        "john@example.com",
        { source: "google", campaign: "winter2023" }
      );

      await identifyUser({
        userId: "user123",
        traits: {
          name: "John Doe",
          email: "john@example.com",
          plan: "free",
          createdAt: new Date().toISOString(),
        },
        context: signupContext,
      });

      await trackEvent({
        name: CommonEvents.USER_REGISTRATION,
        properties: {
          method: "email",
          source: "google",
          campaign: "winter2023",
        },
        context: signupContext,
      });

      // 2. User navigates to dashboard
      await trackPage("Dashboard", { section: "overview" }, signupContext);

      // 3. User creates a report
      await trackEvent({
        name: CommonEvents.PIPELINE_STARTED,
        properties: {
          reportId: "report123",
          inputSize: 1500,
          estimatedDuration: 300,
        },
        context: signupContext,
      });

      // 4. Pipeline completes
      await trackEvent({
        name: CommonEvents.PIPELINE_COMPLETED,
        properties: {
          reportId: "report123",
          duration: 285,
          tokensUsed: 15000,
          cost: 0.75,
        },
        context: signupContext,
      });

      // 5. User views the report
      await trackEvent({
        name: CommonEvents.REPORT_VIEWED,
        properties: {
          reportId: "report123",
          reportType: "analysis",
          viewDuration: 45,
        },
        context: signupContext,
      });

      // Verify all events were logged
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("[ANALYTICS:LOCAL] User identified:")
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("[ANALYTICS:LOCAL] Event tracked:")
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("[ANALYTICS:LOCAL] Page tracked:")
      );
      // Check for specific event names in the logged data
      const logCalls = (console.log as any).mock.calls;
      const eventNames = logCalls
        .filter((call: any[]) => typeof call[0] === 'object' && call[0].name)
        .map((call: any[]) => call[0].name);
      
      expect(eventNames).toContain("user_registration");
      expect(eventNames).toContain("pipeline_started");
      expect(eventNames).toContain("pipeline_completed");
      expect(eventNames).toContain("report_viewed");
    });

    it("should handle error scenarios gracefully", async () => {
      // Track an error event
      await trackEvent({
        name: CommonEvents.ERROR_OCCURRED,
        properties: {
          errorType: "ValidationError",
          errorMessage: "Invalid input format",
          endpoint: "/api/create",
          statusCode: 400,
        },
        context: createAnalyticsContext("user123", "session456", "req789"),
      });

      // Should log the error event without throwing
      const logCalls = (console.log as any).mock.calls;
      const eventNames = logCalls
        .filter((call: any[]) => typeof call[0] === 'object' && call[0].name)
        .map((call: any[]) => call[0].name);
      
      expect(eventNames).toContain("error_occurred");
    });

    it("should flush and shutdown cleanly", async () => {
      await flushAnalytics();
      await shutdownAnalytics();

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("[ANALYTICS:LOCAL] Flush requested")
      );
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("[ANALYTICS:LOCAL] Analytics shutdown")
      );
    });
  });

  describe("Full Workflow - PostHog Provider", () => {
    beforeEach(() => {
      const config = createAnalyticsConfig(
        createMockEnv("posthog", "test-api-key", undefined, true) as Env
      );
      initializeAnalytics(config);
    });

    it("should handle complete user journey with PostHog", async () => {
      // 1. User authentication
      const authContext = createAnalyticsContext(
        "user456",
        "session789",
        "req101",
        "jane@example.com",
        { plan: "premium" },
        "production",
        "1.2.3"
      );

      await identifyUser({
        userId: "user456",
        traits: {
          name: "Jane Smith",
          email: "jane@example.com",
          plan: "premium",
          company: "Acme Corp",
        },
        context: authContext,
      });

      await trackEvent({
        name: CommonEvents.USER_SIGNIN,
        properties: {
          method: "firebase",
          provider: "google",
        },
        context: authContext,
      });

      // 2. Feature usage
      await trackEvent({
        name: CommonEvents.FEATURE_USED,
        properties: {
          feature: "advanced-analytics",
          planRequired: "premium",
        },
        context: authContext,
      });

      // 3. API request tracking
      await trackEvent({
        name: CommonEvents.API_REQUEST,
        properties: {
          endpoint: "/api/reports",
          method: "POST",
          responseTime: 234,
          statusCode: 201,
        },
        context: authContext,
      });

      // Verify PostHog calls
      expect(mockPostHogInstance.identify).toHaveBeenCalledWith({
        distinctId: "user456",
        properties: {
          name: "Jane Smith",
          email: "jane@example.com",
          plan: "premium",
          company: "Acme Corp",
        },
      });

      expect(mockPostHogInstance.capture).toHaveBeenCalledWith({
        distinctId: "user456",
        event: CommonEvents.USER_SIGNIN,
        properties: expect.objectContaining({
          method: "firebase",
          provider: "google",
          email: "jane@example.com",
          plan: "premium",
          $session_id: "session789",
          $request_id: "req101",
          $environment: "production",
          $app_version: "1.2.3",
          $timestamp: expect.any(String),
        }),
      });

      expect(mockPostHogInstance.capture).toHaveBeenCalledWith({
        distinctId: "user456",
        event: CommonEvents.FEATURE_USED,
        properties: expect.objectContaining({
          feature: "advanced-analytics",
          planRequired: "premium",
          email: "jane@example.com",
          plan: "premium",
          $session_id: "session789",
          $request_id: "req101",
          $environment: "production",
          $app_version: "1.2.3",
        }),
      });

      expect(mockPostHogInstance.capture).toHaveBeenCalledWith({
        distinctId: "user456",
        event: CommonEvents.API_REQUEST,
        properties: expect.objectContaining({
          endpoint: "/api/reports",
          method: "POST",
          responseTime: 234,
          statusCode: 201,
        }),
      });
    });

    it("should handle PostHog errors gracefully in complete workflow", async () => {
      // Simulate PostHog API errors
      mockPostHogInstance.capture.mockRejectedValue(new Error("PostHog API error"));
      mockPostHogInstance.identify.mockRejectedValue(new Error("PostHog API error"));

      const context = createAnalyticsContext("user789", "session999");

      // These should not throw errors
      await identifyUser({
        userId: "user789",
        traits: { name: "Test User" },
        context,
      });

      await trackEvent({
        name: CommonEvents.ERROR_OCCURRED,
        properties: { error: "test error" },
        context,
      });

      await trackPage("Error Page", { errorCode: 500 }, context);

      // Should have logged errors but not thrown
      // Note: We're not testing the specific logger mock calls in integration tests
      // as those are covered in unit tests
    });

    it("should flush and shutdown PostHog cleanly", async () => {
      await flushAnalytics();
      await shutdownAnalytics();

      expect(mockPostHogInstance.flush).toHaveBeenCalled();
      expect(mockPostHogInstance.shutdown).toHaveBeenCalled();
    });
  });

  describe("Context Helper Functions", () => {
    it("should create comprehensive analytics context", () => {
      const context = createAnalyticsContext(
        "user123",
        "session456",
        "req789",
        "test@example.com",
        { plan: "premium", role: "admin" },
        "production",
        "2.1.0"
      );

      expect(context).toEqual({
        user: {
          userId: "user123",
          email: "test@example.com",
          properties: {
            plan: "premium",
            role: "admin",
          },
        },
        sessionId: "session456",
        requestId: "req789",
        timestamp: expect.any(Date),
        environment: "production",
        version: "2.1.0",
      });
    });

    it("should create minimal analytics context", () => {
      const context = createAnalyticsContext();

      expect(context).toEqual({
        user: undefined,
        sessionId: undefined,
        requestId: undefined,
        timestamp: expect.any(Date),
        environment: process.env.NODE_ENV,
        version: process.env.APP_VERSION,
      });
    });

    it("should create user context without additional properties", () => {
      const context = createAnalyticsContext(
        "user456",
        undefined,
        undefined,
        "user@example.com"
      );

      expect(context).toEqual({
        user: {
          userId: "user456",
          email: "user@example.com",
          properties: undefined,
        },
        sessionId: undefined,
        requestId: undefined,
        timestamp: expect.any(Date),
        environment: process.env.NODE_ENV,
        version: process.env.APP_VERSION,
      });
    });
  });

  describe("Provider Switching", () => {
    it("should switch from local to PostHog provider", async () => {
      // Start with local provider
      const localConfig = createAnalyticsConfig(createMockEnv("local") as Env);
      initializeAnalytics(localConfig);

      await trackEvent({
        name: CommonEvents.USER_SIGNIN,
        properties: { method: "firebase" },
      });

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("[ANALYTICS:LOCAL] Event:")
      );

      // Switch to PostHog provider
      const posthogConfig = createAnalyticsConfig(
        createMockEnv("posthog", "test-api-key") as Env
      );
      initializeAnalytics(posthogConfig);

      await trackEvent({
        name: CommonEvents.FEATURE_USED,
        properties: { feature: "dashboard" },
        context: { user: { userId: "user123" } },
      });

      expect(mockPostHogInstance.capture).toHaveBeenCalledWith({
        distinctId: "user123",
        event: CommonEvents.FEATURE_USED,
        properties: expect.objectContaining({
          feature: "dashboard",
        }),
      });
    });

    it("should handle disabled analytics", async () => {
      const disabledConfig = createAnalyticsConfig(
        createMockEnv("local", undefined, undefined, false, false) as Env
      );
      initializeAnalytics(disabledConfig);

      await trackEvent({
        name: CommonEvents.USER_SIGNIN,
        properties: { method: "firebase" },
      });

      await identifyUser({
        userId: "user123",
        traits: { name: "John Doe" },
      });

      await trackPage("Dashboard");

      // Should not log anything when disabled
      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining("[ANALYTICS:LOCAL] Event tracked:")
      );
      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining("[ANALYTICS:LOCAL] User identified:")
      );
      expect(console.log).not.toHaveBeenCalledWith(
        expect.stringContaining("[ANALYTICS:LOCAL] Page tracked:")
      );
    });
  });
});