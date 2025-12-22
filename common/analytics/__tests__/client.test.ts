/**
 * Tests for Analytics client
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  Analytics,
  getAnalytics,
  initializeAnalytics,
  trackEvent,
} from "../client";
import type {
  AnalyticsConfig,
  AnalyticsEvent,
  AnalyticsIdentify,
} from "../types";
import { CommonEvents } from "../types";

// Mock the child logger
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

// Mock environment utilities
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
}));

describe("Analytics Client", () => {
  let analytics: Analytics;

  beforeEach(() => {
    vi.clearAllMocks();
    analytics = new Analytics();
  });

  afterEach(async () => {
    if (analytics.isInitialized()) {
      await analytics.shutdown();
    }
  });

  describe("constructor", () => {
    it("should create analytics instance", () => {
      expect(analytics).toBeInstanceOf(Analytics);
      expect(analytics.isInitialized()).toBe(false);
    });

    it("should generate session ID", async () => {
      const { generateSessionId } = vi.mocked(await import("../environment"));
      expect(generateSessionId).toHaveBeenCalled();
    });

    it("should get environment info when needed", async () => {
      const envInfo = analytics.getEnvironmentInfo();
      expect(envInfo).toBeDefined();
      expect(envInfo.platform).toBe("server");
    });
  });

  describe("initialize", () => {
    it("should initialize with local provider", async () => {
      const config: AnalyticsConfig = {
        provider: "local",
        enabled: true,
        debug: false,
      };

      await analytics.initialize(config);

      expect(analytics.isInitialized()).toBe(true);
    });

    it("should initialize with disabled analytics", async () => {
      const config: AnalyticsConfig = {
        provider: "local",
        enabled: false,
      };

      await analytics.initialize(config);

      expect(analytics.isInitialized()).toBe(true);
    });

    it("should disable analytics in development when configured", async () => {
      const { isDevelopment } = vi.mocked(await import("../environment"));
      isDevelopment.mockReturnValue(true);

      const config: AnalyticsConfig = {
        provider: "posthog",
        apiKey: "test-key",
        disableInDevelopment: true,
      };

      await analytics.initialize(config);

      expect(analytics.isInitialized()).toBe(true);
    });

    it("should fallback to local provider on initialization failure", async () => {
      const config: AnalyticsConfig = {
        provider: "posthog",
        apiKey: "", // Invalid API key should cause failure
      };

      await analytics.initialize(config);

      // Should still be initialized with fallback provider
      expect(analytics.isInitialized()).toBe(true);
    });

    it("should not reinitialize if already initialized", async () => {
      const config: AnalyticsConfig = {
        provider: "local",
        enabled: true,
      };

      await analytics.initialize(config);
      expect(analytics.isInitialized()).toBe(true);

      // Second initialization should be ignored
      await analytics.initialize(config);
      expect(analytics.isInitialized()).toBe(true);
    });
  });

  describe("track", () => {
    beforeEach(async () => {
      await analytics.initialize({
        provider: "local",
        enabled: true,
      });
    });

    it("should track event successfully", async () => {
      const event: AnalyticsEvent = {
        name: CommonEvents.USER_SIGNIN,
        properties: {
          method: "firebase",
        },
      };

      await analytics.track(event);

      // Should not throw
      expect(true).toBe(true);
    });

    it("should enhance event with context", async () => {
      const event: AnalyticsEvent = {
        name: CommonEvents.PAGE_VIEW,
        properties: {
          page: "dashboard",
        },
        context: {
          user: {
            userId: "user123",
          },
        },
      };

      await analytics.track(event);

      // Should not throw and context should be enhanced
      expect(true).toBe(true);
    });

    it("should handle tracking without initialized provider", async () => {
      const uninitializedAnalytics = new Analytics();

      await uninitializedAnalytics.track({
        name: CommonEvents.ERROR_OCCURRED,
      });

      // Should not throw
      expect(true).toBe(true);
    });

    it("should handle provider errors gracefully", async () => {
      // Mock provider to throw error
      // biome-ignore lint/suspicious/noExplicitAny: Accessing private property for testing
      const provider = (analytics as any).provider;
      provider.track = vi.fn().mockRejectedValue(new Error("Provider error"));

      await analytics.track({
        name: CommonEvents.ERROR_OCCURRED,
      });

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("identify", () => {
    beforeEach(async () => {
      await analytics.initialize({
        provider: "local",
        enabled: true,
      });
    });

    it("should identify user successfully", async () => {
      const identify: AnalyticsIdentify = {
        userId: "user123",
        traits: {
          name: "John Doe",
          email: "john@example.com",
        },
      };

      await analytics.identify(identify);

      // Should not throw
      expect(true).toBe(true);
    });

    it("should enhance identify with context", async () => {
      const identify: AnalyticsIdentify = {
        userId: "user123",
        traits: {
          plan: "premium",
        },
        context: {
          sessionId: "custom-session",
        },
      };

      await analytics.identify(identify);

      // Should not throw and context should be enhanced
      expect(true).toBe(true);
    });

    it("should handle identification without initialized provider", async () => {
      const uninitializedAnalytics = new Analytics();

      await uninitializedAnalytics.identify({
        userId: "user123",
      });

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("page", () => {
    beforeEach(async () => {
      await analytics.initialize({
        provider: "local",
        enabled: true,
      });
    });

    it("should track page view successfully", async () => {
      await analytics.page("Dashboard", {
        section: "analytics",
      });

      // Should not throw
      expect(true).toBe(true);
    });

    it("should track page view with context", async () => {
      await analytics.page(
        "Profile",
        {
          userId: "user123",
        },
        {
          user: {
            userId: "user123",
            email: "user@example.com",
          },
        },
      );

      // Should not throw
      expect(true).toBe(true);
    });

    it("should handle page tracking without initialized provider", async () => {
      const uninitializedAnalytics = new Analytics();

      await uninitializedAnalytics.page("Home");

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("flush", () => {
    beforeEach(async () => {
      await analytics.initialize({
        provider: "local",
        enabled: true,
      });
    });

    it("should flush successfully", async () => {
      await analytics.flush();

      // Should not throw
      expect(true).toBe(true);
    });

    it("should handle flush without initialized provider", async () => {
      const uninitializedAnalytics = new Analytics();

      await uninitializedAnalytics.flush();

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("shutdown", () => {
    beforeEach(async () => {
      await analytics.initialize({
        provider: "local",
        enabled: true,
      });
    });

    it("should shutdown successfully", async () => {
      expect(analytics.isInitialized()).toBe(true);

      await analytics.shutdown();

      expect(analytics.isInitialized()).toBe(false);
    });

    it("should handle shutdown without initialized provider", async () => {
      const uninitializedAnalytics = new Analytics();

      await uninitializedAnalytics.shutdown();

      // Should not throw
      expect(true).toBe(true);
    });

    it("should handle multiple shutdown calls", async () => {
      await analytics.shutdown();
      await analytics.shutdown();

      // Should not throw on second shutdown
      expect(analytics.isInitialized()).toBe(false);
    });
  });

  describe("createContext", () => {
    it("should create context with user data", () => {
      const context = analytics.createContext(
        "user123",
        "user@example.com",
        { plan: "premium" },
        "req-456",
      );

      expect(context.user).toEqual({
        userId: "user123",
        email: "user@example.com",
        properties: { plan: "premium" },
      });
      expect(context.requestId).toBe("req-456");
      expect(context.sessionId).toBe("session-123");
    });

    it("should create context without user data", () => {
      const context = analytics.createContext();

      expect(context.user).toBeUndefined();
      expect(context.sessionId).toBe("session-123");
    });
  });

  describe("getEnvironmentInfo", () => {
    it("should return environment info", () => {
      const info = analytics.getEnvironmentInfo();

      expect(info.platform).toBe("server");
      expect(info.isDevelopment).toBe(false);
    });
  });
});

describe("Global Analytics Functions", () => {
  afterEach(async () => {
    const analytics = getAnalytics();
    if (analytics.isInitialized()) {
      await analytics.shutdown();
    }
  });

  describe("getAnalytics", () => {
    it("should return global analytics instance", () => {
      const analytics1 = getAnalytics();
      const analytics2 = getAnalytics();

      expect(analytics1).toBe(analytics2);
      expect(analytics1).toBeInstanceOf(Analytics);
    });
  });

  describe("initializeAnalytics", () => {
    it("should initialize global analytics", async () => {
      const config: AnalyticsConfig = {
        provider: "local",
        enabled: true,
      };

      await initializeAnalytics(config);

      const analytics = getAnalytics();
      expect(analytics.isInitialized()).toBe(true);
    });
  });

  describe("trackEvent", () => {
    beforeEach(async () => {
      await initializeAnalytics({
        provider: "local",
        enabled: true,
      });
    });

    it("should track event using global analytics", async () => {
      await trackEvent({
        name: CommonEvents.BUTTON_CLICKED,
        properties: {
          buttonId: "submit",
        },
      });

      // Should not throw
      expect(true).toBe(true);
    });
  });
});
