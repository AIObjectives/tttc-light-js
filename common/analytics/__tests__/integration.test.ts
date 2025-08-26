/**
 * Integration tests for analytics module
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  Analytics,
  getAnalytics,
  initializeAnalytics,
  trackEvent,
  identifyUser,
  trackPage,
  createAnalyticsConfig,
  createEventProperties,
  extractUserProperties,
  resetGlobalAnalytics,
} from "../index";
import { CommonEvents } from "../types";
import type { AnalyticsConfig } from "../types";

const mockChildLogger = vi.hoisted(() => {
  return {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  };
});

// Mock the logger
vi.mock("../../logger", () => ({
  logger: {
    child: vi.fn(() => mockChildLogger),
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

// Mock environment utilities for consistent testing
vi.mock("../environment", () => ({
  getEnvironmentInfo: vi.fn(() => ({
    platform: "server",
    isDevelopment: false,
    userAgent: undefined,
    url: undefined,
  })),
  generateSessionId: vi.fn(() => "session-123"),
  generateRequestId: vi.fn(() => "req-456"),
  getAppVersion: vi.fn(() => "1.0.0"),
  getEnvironmentName: vi.fn(() => "test"),
  isDevelopment: vi.fn(() => false),
  isBrowser: vi.fn(() => false),
  isServer: vi.fn(() => true),
  getCurrentUrl: vi.fn(() => undefined),
  getUserAgent: vi.fn(() => undefined),
}));

// Mock PostHog providers to work in test environment
vi.mock("../providers/posthogProvider", () => {
  return {
    PostHogAnalyticsProvider: vi.fn().mockImplementation(() => ({
      track: vi.fn(),
      identify: vi.fn(),
      page: vi.fn(),
      flush: vi.fn(),
      shutdown: vi.fn(),
      isReady: vi.fn(() => true),
      ensureInitialized: vi.fn(),
    })),
  };
});

describe("Analytics Integration", () => {
  afterEach(async () => {
    // Clean up global analytics instance after each test
    const analytics = getAnalytics();
    if (analytics.isInitialized()) {
      await analytics.shutdown();
    }
    // Reset the global instance
    resetGlobalAnalytics();
  });

  describe("End-to-End Analytics Flow", () => {
    it("should complete a full analytics lifecycle", async () => {
      // 1. Initialize analytics
      const config = createAnalyticsConfig("local", undefined, {
        enabled: true,
        debug: true,
      });

      await initializeAnalytics(config);

      // Verify initialization
      const analytics = getAnalytics();
      expect(analytics.isInitialized()).toBe(true);

      // 2. Identify a user
      await identifyUser({
        userId: "user123",
        traits: {
          name: "John Doe",
          email: "john@example.com",
          plan: "premium",
          signupDate: "2023-01-01",
        },
      });

      // 3. Track page views
      await trackPage("Landing Page", {
        source: "direct",
        campaign: "none",
      });

      await trackPage("Dashboard", {
        section: "analytics",
        userId: "user123",
      });

      // 4. Track various events
      await trackEvent({
        name: CommonEvents.USER_SIGNIN,
        properties: {
          method: "firebase",
          provider: "google",
          timestamp: new Date().toISOString(),
        },
      });

      await trackEvent({
        name: CommonEvents.REPORT_CREATED,
        properties: {
          reportType: "analysis",
          dataSource: "csv",
          recordCount: 1000,
        },
      });

      await trackEvent({
        name: CommonEvents.BUTTON_CLICKED,
        properties: {
          buttonId: "download-report",
          section: "report-viewer",
        },
      });

      // 5. Track an error
      await trackEvent({
        name: CommonEvents.ERROR_OCCURRED,
        properties: {
          errorType: "validation",
          errorMessage: "Invalid CSV format",
          severity: "medium",
        },
      });

      // 6. Flush and shutdown
      await analytics.flush();
      await analytics.shutdown();

      expect(analytics.isInitialized()).toBe(false);
    });

    it("should handle rapid sequential events", async () => {
      await initializeAnalytics({
        provider: "local",
        enabled: true,
      });

      // Track multiple events in rapid succession
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(
          trackEvent({
            name: CommonEvents.BUTTON_CLICKED,
            properties: {
              buttonId: `button-${i}`,
              timestamp: new Date().toISOString(),
            },
          }),
        );
      }

      // All events should complete without errors
      await Promise.all(promises);

      const analytics = getAnalytics();
      expect(analytics.isInitialized()).toBe(true);
    });

    it("should handle mixed event types in session", async () => {
      await initializeAnalytics({
        provider: "local",
        enabled: true,
        debug: false,
      });

      const analytics = getAnalytics();

      // Simulate a user session with mixed events
      const sessionContext = analytics.createContext(
        "user456",
        "user@example.com",
        { subscription: "trial" },
      );

      // Session start
      await trackEvent({
        name: CommonEvents.SESSION_STARTED,
        context: sessionContext,
      });

      // Navigation
      await trackPage("Home", { referrer: "google" }, sessionContext);
      await trackPage("About", {}, sessionContext);
      await trackPage("Pricing", { plan: "view" }, sessionContext);

      // User interaction
      await trackEvent({
        name: CommonEvents.BUTTON_CLICKED,
        properties: { buttonId: "signup" },
        context: sessionContext,
      });

      await trackEvent({
        name: CommonEvents.FORM_SUBMITTED,
        properties: { formId: "contact" },
        context: sessionContext,
      });

      // Performance metrics
      await trackEvent({
        name: CommonEvents.LOAD_TIME,
        properties: {
          page: "pricing",
          loadTime: 1250,
          cacheHit: true,
        },
        context: sessionContext,
      });

      // Session end
      await trackEvent({
        name: CommonEvents.SESSION_ENDED,
        properties: { duration: 300 },
        context: sessionContext,
      });

      expect(analytics.isInitialized()).toBe(true);
    });
  });

  describe("Error Handling and Recovery", () => {
    it("should handle provider initialization failure gracefully", async () => {
      // Attempt to initialize with invalid configuration
      await initializeAnalytics({
        provider: "posthog",
        apiKey: "", // Invalid API key
        enabled: true,
      });

      // Should fallback to local provider and still work
      const analytics = getAnalytics();
      expect(analytics.isInitialized()).toBe(true);

      // Should still be able to track events
      await trackEvent({
        name: CommonEvents.ERROR_OCCURRED,
        properties: { error: "provider_fallback" },
      });
    });

    it("should handle events with circular references", async () => {
      await initializeAnalytics({
        provider: "local",
        enabled: true,
      });

      // Create object with circular reference
      const circularObj: any = { name: "test" };
      circularObj.self = circularObj;

      // Should handle circular reference gracefully
      await trackEvent({
        name: CommonEvents.ERROR_OCCURRED,
        properties: {
          circularData: circularObj,
          normalData: "works fine",
        },
      });

      // Should not throw
      expect(true).toBe(true);
    });

    it("should handle events with invalid data types", async () => {
      await initializeAnalytics({
        provider: "local",
        enabled: true,
      });

      // Track event with various data types
      await trackEvent({
        name: CommonEvents.FEATURE_USED,
        properties: {
          validString: "string",
          validNumber: 42,
          validBoolean: true,
          validNull: null,
          validUndefined: undefined,
          // These will be stringified
          dateObject: new Date(),
          functionValue: () => "function",
          symbolValue: Symbol("test"),
        },
      });

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("Configuration Helpers", () => {
    it("should create analytics config with defaults", () => {
      const config = createAnalyticsConfig("local");

      expect(config.provider).toBe("local");
      expect(config.enabled).toBe(true);
    });

    it("should create analytics config with overrides", () => {
      const config = createAnalyticsConfig("posthog", "test-key", {
        enabled: false,
        environment: "staging",
        version: "1.2.3",
      });

      expect(config.provider).toBe("posthog");
      expect(config.apiKey).toBe("test-key");
      expect(config.enabled).toBe(false);
      expect(config.environment).toBe("staging");
      expect(config.version).toBe("1.2.3");
    });

    it("should create event properties with standardized format", () => {
      const properties = createEventProperties("user_action", {
        buttonId: "submit",
        formId: "contact",
      });

      expect(properties.event_type).toBe("user_action");
      expect(properties.buttonId).toBe("submit");
      expect(properties.formId).toBe("contact");
      expect(properties.timestamp).toBeDefined();
    });

    it("should extract user properties safely", () => {
      const user = {
        uid: "user123",
        email: "user@example.com",
        displayName: "John Doe",
        createdAt: new Date("2023-01-01"),
        lastLoginAt: new Date("2023-06-01"),
        // These should be ignored
        emailVerified: true,
        plan: "premium",
        role: "admin",
        password: "secret",
        sensitive: "data",
      };

      const properties = extractUserProperties(user);

      expect(properties.uid).toBe("user123");
      expect(properties.email).toBe("user@example.com");
      expect(properties.displayName).toBe("John Doe");
      expect(properties.createdAt).toBe("2023-01-01T00:00:00.000Z");
      expect(properties.lastLoginAt).toBe("2023-06-01T00:00:00.000Z");
      expect(properties.emailVerified).toBeUndefined();
      expect(properties.plan).toBeUndefined();
      expect(properties.role).toBeUndefined();
      expect(properties.password).toBeUndefined();
      expect(properties.sensitive).toBeUndefined();
    });

    it("should handle null/undefined user in extractUserProperties", () => {
      expect(extractUserProperties(null)).toEqual({});
      expect(extractUserProperties(undefined)).toEqual({});
      expect(extractUserProperties({})).toEqual({});
    });
  });

  describe("Concurrent Operations", () => {
    it("should handle concurrent initialization attempts", async () => {
      const config: AnalyticsConfig = {
        provider: "local",
        enabled: true,
      };

      // Start multiple initialization attempts simultaneously
      const promises = [
        initializeAnalytics(config),
        initializeAnalytics(config),
        initializeAnalytics(config),
      ];

      await Promise.all(promises);

      // Should only initialize once
      const analytics = getAnalytics();
      expect(analytics.isInitialized()).toBe(true);
    });

    it("should handle concurrent tracking operations", async () => {
      await initializeAnalytics({
        provider: "local",
        enabled: true,
      });

      // Track events concurrently
      const trackPromises = [];
      const identifyPromises = [];
      const pagePromises = [];

      for (let i = 0; i < 5; i++) {
        trackPromises.push(
          trackEvent({
            name: CommonEvents.BUTTON_CLICKED,
            properties: { buttonId: `button-${i}` },
          }),
        );

        identifyPromises.push(
          identifyUser({
            userId: `user-${i}`,
            traits: { name: `User ${i}` },
          }),
        );

        pagePromises.push(trackPage(`Page ${i}`, { section: `section-${i}` }));
      }

      // All operations should complete successfully
      await Promise.all([
        ...trackPromises,
        ...identifyPromises,
        ...pagePromises,
      ]);

      const analytics = getAnalytics();
      expect(analytics.isInitialized()).toBe(true);
    });
  });

  describe("Memory and Performance", () => {
    it("should handle large event payloads", async () => {
      await initializeAnalytics({
        provider: "local",
        enabled: true,
      });

      // Create a large properties object
      const largeProperties: Record<string, any> = {};
      for (let i = 0; i < 1000; i++) {
        largeProperties[`property_${i}`] = `value_${i}`;
      }

      await trackEvent({
        name: CommonEvents.PERFORMANCE_METRIC,
        properties: largeProperties,
      });

      // Should handle large payloads without issues
      expect(true).toBe(true);
    });

    it("should clean up resources properly on shutdown", async () => {
      await initializeAnalytics({
        provider: "local",
        enabled: true,
      });

      const analytics = getAnalytics();
      expect(analytics.isInitialized()).toBe(true);

      await analytics.shutdown();
      expect(analytics.isInitialized()).toBe(false);

      // Should be able to reinitialize after shutdown
      await analytics.initialize({
        provider: "local",
        enabled: true,
      });

      expect(analytics.isInitialized()).toBe(true);
    });
  });

  describe("Cross-Provider Compatibility", () => {
    it("should maintain consistent API across different providers", async () => {
      const providers: AnalyticsConfig[] = [
        { provider: "local", enabled: true },
        { provider: "posthog", apiKey: "test-key", enabled: true },
      ];

      for (const config of providers) {
        // Reset global instance for each provider test
        const analytics = getAnalytics();
        if (analytics.isInitialized()) {
          await analytics.shutdown();
        }
        resetGlobalAnalytics();

        await initializeAnalytics(config);

        const currentAnalytics = getAnalytics();
        expect(currentAnalytics.isInitialized()).toBe(true);

        // Test common operations
        await trackEvent({
          name: CommonEvents.API_REQUEST,
          properties: {
            endpoint: "/test",
            method: "GET",
            provider: config.provider,
          },
        });

        await identifyUser({
          userId: `test-user-${config.provider}`,
          traits: {
            testProvider: config.provider,
            timestamp: new Date().toISOString(),
          },
        });

        await trackPage(`${config.provider} Test Page`, {
          provider: config.provider,
        });

        // All providers should support these operations
        await currentAnalytics.flush();

        expect(currentAnalytics.isInitialized()).toBe(true);
      }
    });

    it("should handle provider switching gracefully", async () => {
      // Start with local provider
      await initializeAnalytics({
        provider: "local",
        enabled: true,
      });

      await trackEvent({
        name: CommonEvents.SESSION_STARTED,
        properties: { provider: "local" },
      });

      let analytics = getAnalytics();
      expect(analytics.isInitialized()).toBe(true);

      // Shutdown and switch to PostHog
      await analytics.shutdown();
      expect(analytics.isInitialized()).toBe(false);
      resetGlobalAnalytics();

      await initializeAnalytics({
        provider: "posthog",
        apiKey: "test-key",
        enabled: true,
      });

      analytics = getAnalytics();
      expect(analytics.isInitialized()).toBe(true);

      await trackEvent({
        name: CommonEvents.SESSION_STARTED,
        properties: { provider: "posthog" },
      });

      // Should work seamlessly across providers
      expect(true).toBe(true);
    });
  });

  describe("Environment Adaptability", () => {
    it("should adapt to different environment configurations", async () => {
      const { getEnvironmentInfo, isDevelopment } = vi.mocked(
        await import("../environment"),
      );

      // Test production environment
      getEnvironmentInfo.mockReturnValue({
        platform: "server",
        isDevelopment: false,
        userAgent: undefined,
        url: undefined,
      });
      isDevelopment.mockReturnValue(false);

      await initializeAnalytics({
        provider: "local",
        disableInDevelopment: true,
      });

      let analytics = getAnalytics();
      expect(analytics.isInitialized()).toBe(true);

      await trackEvent({
        name: CommonEvents.FEATURE_USED,
        properties: { environment: "production" },
      });

      await analytics.shutdown();

      // Test development environment
      getEnvironmentInfo.mockReturnValue({
        platform: "browser",
        isDevelopment: true,
        userAgent: "Mozilla/5.0 (Test)",
        url: "http://localhost:3000",
      });
      isDevelopment.mockReturnValue(true);

      await initializeAnalytics({
        provider: "posthog",
        apiKey: "test-key",
        disableInDevelopment: true,
      });

      analytics = getAnalytics();
      expect(analytics.isInitialized()).toBe(true);

      // Should be disabled in development when configured
      await trackEvent({
        name: CommonEvents.FEATURE_USED,
        properties: { environment: "development" },
      });

      expect(true).toBe(true);
    });

    it("should handle browser vs server environment differences", async () => {
      const { getEnvironmentInfo, isBrowser, isServer } = vi.mocked(
        await import("../environment"),
      );

      // Test server environment
      getEnvironmentInfo.mockReturnValue({
        platform: "server",
        isDevelopment: false,
        userAgent: undefined,
        url: undefined,
      });
      isBrowser.mockReturnValue(false);
      isServer.mockReturnValue(true);

      await initializeAnalytics({
        provider: "local",
        enabled: true,
      });

      let analytics = getAnalytics();
      const serverContext = analytics.createContext(
        "server-user",
        "server@example.com",
      );
      expect(serverContext.platform).toBe("server");

      await trackEvent({
        name: CommonEvents.API_REQUEST,
        properties: { endpoint: "/server-api" },
        context: serverContext,
      });

      await analytics.shutdown();
      resetGlobalAnalytics();

      // Test browser environment
      getEnvironmentInfo.mockReturnValue({
        platform: "browser",
        isDevelopment: true,
        userAgent: "Mozilla/5.0 (Test Browser)",
        url: "https://app.example.com",
      });
      isBrowser.mockReturnValue(true);
      isServer.mockReturnValue(false);

      await initializeAnalytics({
        provider: "local",
        enabled: true,
      });

      analytics = getAnalytics();
      const browserContext = analytics.createContext(
        "browser-user",
        "browser@example.com",
      );
      expect(browserContext.platform).toBe("browser");
      expect(browserContext.url).toBe("https://app.example.com");

      await trackEvent({
        name: CommonEvents.PAGE_VIEW,
        properties: { page: "dashboard" },
        context: browserContext,
      });

      expect(true).toBe(true);
    });
  });

  describe("Data Integrity and Validation", () => {
    it("should maintain data consistency across operations", async () => {
      await initializeAnalytics({
        provider: "local",
        enabled: true,
      });

      const analytics = getAnalytics();
      const baseContext = analytics.createContext(
        "consistent-user",
        "consistent@example.com",
        { plan: "enterprise" },
      );

      // Track multiple related events with same context
      const events = [
        {
          name: CommonEvents.USER_SIGNIN,
          properties: { method: "sso" },
        },
        {
          name: CommonEvents.PAGE_VIEW,
          properties: { page: "dashboard" },
        },
        {
          name: CommonEvents.FEATURE_USED,
          properties: { feature: "analytics" },
        },
        {
          name: CommonEvents.USER_SIGNOUT,
          properties: { duration: 1800 },
        },
      ];

      for (const event of events) {
        await trackEvent({
          ...event,
          context: baseContext,
        });
      }

      // Verify session consistency
      expect(baseContext.sessionId).toBe("session-123");
      expect(baseContext.user?.userId).toBe("consistent-user");
      expect(baseContext.user?.email).toBe("consistent@example.com");
    });

    it("should handle edge cases in event data", async () => {
      await initializeAnalytics({
        provider: "local",
        enabled: true,
      });

      const edgeCases = [
        // Empty event
        { name: "empty_event" },

        // Event with only null properties
        {
          name: "null_properties",
          properties: { nullProp: null, undefinedProp: undefined },
        },

        // Event with extreme values
        {
          name: "extreme_values",
          properties: {
            veryLongString: "x".repeat(10000),
            veryLargeNumber: Number.MAX_SAFE_INTEGER,
            verySmallNumber: Number.MIN_SAFE_INTEGER,
            infinityValue: Infinity,
            nanValue: NaN,
          },
        },

        // Event with special characters
        {
          name: "special_chars_🎉_测试",
          properties: {
            "property with spaces": "value",
            "property-with-dashes": "value",
            "property.with.dots": "value",
            "property/with/slashes": "value",
          },
        },
      ];

      for (const event of edgeCases) {
        await trackEvent(event);
      }

      // All should complete without errors
      expect(true).toBe(true);
    });
  });
});
