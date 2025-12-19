/**
 * Tests for analytics types and enums
 */

import { describe, expect, it } from "vitest";
import type {
  AnalyticsClient,
  AnalyticsConfig,
  AnalyticsContext,
  AnalyticsEvent,
  AnalyticsIdentify,
  AnalyticsProperties,
  AnalyticsProvider,
  AnalyticsUser,
  EnvironmentInfo,
} from "../types";
import { AnalyticsError, CommonEvents } from "../types";

describe("Analytics Types", () => {
  describe("AnalyticsProperties", () => {
    it("should accept valid property types", () => {
      const properties: AnalyticsProperties = {
        stringProp: "string value",
        numberProp: 42,
        booleanProp: true,
        nullProp: null,
        undefinedProp: undefined,
      };

      expect(typeof properties.stringProp).toBe("string");
      expect(typeof properties.numberProp).toBe("number");
      expect(typeof properties.booleanProp).toBe("boolean");
      expect(properties.nullProp).toBeNull();
      expect(properties.undefinedProp).toBeUndefined();
    });
  });

  describe("AnalyticsUser", () => {
    it("should create user with minimal data", () => {
      const user: AnalyticsUser = {
        userId: "user123",
      };

      expect(user.userId).toBe("user123");
      expect(user.email).toBeUndefined();
      expect(user.properties).toBeUndefined();
    });

    it("should create user with complete data", () => {
      const user: AnalyticsUser = {
        userId: "user123",
        email: "user@example.com",
        properties: {
          name: "John Doe",
          plan: "premium",
        },
      };

      expect(user.userId).toBe("user123");
      expect(user.email).toBe("user@example.com");
      expect(user.properties?.name).toBe("John Doe");
      expect(user.properties?.plan).toBe("premium");
    });
  });

  describe("AnalyticsContext", () => {
    it("should create context with minimal data", () => {
      const context: AnalyticsContext = {};

      expect(context.user).toBeUndefined();
      expect(context.sessionId).toBeUndefined();
    });

    it("should create context with complete data", () => {
      const timestamp = new Date();
      const context: AnalyticsContext = {
        user: {
          userId: "user123",
          email: "user@example.com",
        },
        sessionId: "session456",
        requestId: "req789",
        timestamp,
        environment: "production",
        version: "1.0.0",
        platform: "browser",
        url: "https://example.com",
        userAgent: "Mozilla/5.0",
      };

      expect(context.user?.userId).toBe("user123");
      expect(context.sessionId).toBe("session456");
      expect(context.requestId).toBe("req789");
      expect(context.timestamp).toBe(timestamp);
      expect(context.environment).toBe("production");
      expect(context.version).toBe("1.0.0");
      expect(context.platform).toBe("browser");
      expect(context.url).toBe("https://example.com");
      expect(context.userAgent).toBe("Mozilla/5.0");
    });
  });

  describe("AnalyticsEvent", () => {
    it("should create event with minimal data", () => {
      const event: AnalyticsEvent = {
        name: "test_event",
      };

      expect(event.name).toBe("test_event");
      expect(event.properties).toBeUndefined();
      expect(event.context).toBeUndefined();
    });

    it("should create event with complete data", () => {
      const event: AnalyticsEvent = {
        name: CommonEvents.USER_SIGNIN,
        properties: {
          method: "firebase",
          provider: "google",
        },
        context: {
          user: {
            userId: "user123",
          },
          sessionId: "session456",
        },
      };

      expect(event.name).toBe(CommonEvents.USER_SIGNIN);
      expect(event.properties?.method).toBe("firebase");
      expect(event.context?.user?.userId).toBe("user123");
    });
  });

  describe("AnalyticsIdentify", () => {
    it("should create identify with minimal data", () => {
      const identify: AnalyticsIdentify = {
        userId: "user123",
      };

      expect(identify.userId).toBe("user123");
      expect(identify.traits).toBeUndefined();
      expect(identify.context).toBeUndefined();
    });

    it("should create identify with complete data", () => {
      const identify: AnalyticsIdentify = {
        userId: "user123",
        traits: {
          name: "John Doe",
          email: "john@example.com",
          plan: "premium",
        },
        context: {
          sessionId: "session456",
        },
      };

      expect(identify.userId).toBe("user123");
      expect(identify.traits?.name).toBe("John Doe");
      expect(identify.context?.sessionId).toBe("session456");
    });
  });

  describe("AnalyticsConfig", () => {
    it("should create config with minimal data", () => {
      const config: AnalyticsConfig = {
        provider: "local",
      };

      expect(config.provider).toBe("local");
      expect(config.enabled).toBeUndefined();
    });

    it("should create config with complete data", () => {
      const config: AnalyticsConfig = {
        provider: "posthog",
        enabled: true,
        apiKey: "test-key",
        host: "https://api.posthog.com",
        flushAt: 20,
        flushInterval: 10000,
        environment: "production",
        version: "1.0.0",
      };

      expect(config.provider).toBe("posthog");
      expect(config.enabled).toBe(true);
      expect(config.apiKey).toBe("test-key");
      expect(config.host).toBe("https://api.posthog.com");
      expect(config.flushAt).toBe(20);
      expect(config.flushInterval).toBe(10000);
      expect(config.environment).toBe("production");
      expect(config.version).toBe("1.0.0");
    });

    it("should support all provider types", () => {
      const posthogConfig: AnalyticsConfig = { provider: "posthog" };
      const localConfig: AnalyticsConfig = { provider: "local" };

      expect(posthogConfig.provider).toBe("posthog");
      expect(localConfig.provider).toBe("local");
    });
  });

  describe("EnvironmentInfo", () => {
    it("should create environment info for browser", () => {
      const info: EnvironmentInfo = {
        platform: "browser",
        isDevelopment: true,
        userAgent: "Mozilla/5.0",
        url: "https://localhost:3000",
      };

      expect(info.platform).toBe("browser");
      expect(info.isDevelopment).toBe(true);
      expect(info.userAgent).toBe("Mozilla/5.0");
      expect(info.url).toBe("https://localhost:3000");
    });

    it("should create environment info for server", () => {
      const info: EnvironmentInfo = {
        platform: "server",
        isDevelopment: false,
      };

      expect(info.platform).toBe("server");
      expect(info.isDevelopment).toBe(false);
      expect(info.userAgent).toBeUndefined();
      expect(info.url).toBeUndefined();
    });
  });
});

describe("CommonEvents", () => {
  it("should contain all expected event types", () => {
    // User authentication events
    expect(CommonEvents.USER_SIGNIN).toBe("user_signin");
    expect(CommonEvents.USER_SIGNOUT).toBe("user_signout");
    expect(CommonEvents.USER_REGISTRATION).toBe("user_registration");

    // Report-related events
    expect(CommonEvents.REPORT_CREATED).toBe("report_created");
    expect(CommonEvents.REPORT_VIEWED).toBe("report_viewed");
    expect(CommonEvents.REPORT_DOWNLOADED).toBe("report_downloaded");
    expect(CommonEvents.REPORT_SHARED).toBe("report_shared");

    // Pipeline events
    expect(CommonEvents.PIPELINE_STARTED).toBe("pipeline_started");
    expect(CommonEvents.PIPELINE_COMPLETED).toBe("pipeline_completed");
    expect(CommonEvents.PIPELINE_FAILED).toBe("pipeline_failed");

    // Navigation and interaction events
    expect(CommonEvents.PAGE_VIEW).toBe("page_view");
    expect(CommonEvents.BUTTON_CLICKED).toBe("button_clicked");
    expect(CommonEvents.LINK_CLICKED).toBe("link_clicked");
    expect(CommonEvents.FORM_SUBMITTED).toBe("form_submitted");

    // API and system events
    expect(CommonEvents.API_REQUEST).toBe("api_request");
    expect(CommonEvents.ERROR_OCCURRED).toBe("error_occurred");
    expect(CommonEvents.FEATURE_USED).toBe("feature_used");

    // Engagement events
    expect(CommonEvents.SESSION_STARTED).toBe("session_started");
    expect(CommonEvents.SESSION_ENDED).toBe("session_ended");
    expect(CommonEvents.CONTENT_ENGAGEMENT).toBe("content_engagement");

    // Performance events
    expect(CommonEvents.PERFORMANCE_METRIC).toBe("performance_metric");
    expect(CommonEvents.LOAD_TIME).toBe("load_time");
  });

  it("should have unique values for all events", () => {
    const values = Object.values(CommonEvents);
    const uniqueValues = new Set(values);

    expect(values.length).toBe(uniqueValues.size);
  });
});

describe("AnalyticsError", () => {
  it("should create error with all properties", () => {
    const originalError = new Error("Original error");
    const analyticsError = new AnalyticsError(
      "Analytics operation failed",
      "posthog",
      "track",
      originalError,
    );

    expect(analyticsError.message).toBe("Analytics operation failed");
    expect(analyticsError.provider).toBe("posthog");
    expect(analyticsError.operation).toBe("track");
    expect(analyticsError.originalError).toBe(originalError);
    expect(analyticsError.name).toBe("AnalyticsError");
    expect(analyticsError).toBeInstanceOf(Error);
  });

  it("should create error without original error", () => {
    const analyticsError = new AnalyticsError(
      "Analytics operation failed",
      "local",
      "identify",
    );

    expect(analyticsError.message).toBe("Analytics operation failed");
    expect(analyticsError.provider).toBe("local");
    expect(analyticsError.operation).toBe("identify");
    expect(analyticsError.originalError).toBeUndefined();
    expect(analyticsError.name).toBe("AnalyticsError");
  });

  it("should be throwable and catchable", () => {
    const analyticsError = new AnalyticsError("Test error", "test", "test");

    expect(() => {
      throw analyticsError;
    }).toThrow(AnalyticsError);

    try {
      throw analyticsError;
    } catch (error) {
      expect(error).toBeInstanceOf(AnalyticsError);
      expect((error as AnalyticsError).provider).toBe("test");
    }
  });
});
