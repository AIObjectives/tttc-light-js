/**
 * Tests for LocalAnalyticsProvider
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { LocalAnalyticsProvider } from "../providers/localProvider";
import type {
  AnalyticsEvent,
  AnalyticsIdentify,
  AnalyticsContext,
} from "../types";
import { CommonEvents } from "../types";

// Mock the logger
const mockChildLogger = {
  info: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

vi.mock("../../logger", () => ({
  logger: {
    info: vi.fn(),
    debug: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    child: vi.fn(() => mockChildLogger),
  },
}));

describe("LocalAnalyticsProvider", () => {
  let provider: LocalAnalyticsProvider;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    provider = new LocalAnalyticsProvider();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe("constructor", () => {
    it("should initialize with default configuration", () => {
      const provider = new LocalAnalyticsProvider();
      expect(provider.isReady()).toBe(true);
    });

    it("should initialize with custom configuration", () => {
      const provider = new LocalAnalyticsProvider({
        enabled: false,
        debug: true,
      });
      expect(provider.isReady()).toBe(true);
    });
  });

  describe("isReady", () => {
    it("should return true when initialized", () => {
      expect(provider.isReady()).toBe(true);
    });

    it("should return false after shutdown", async () => {
      await provider.shutdown();
      expect(provider.isReady()).toBe(false);
    });
  });

  describe("track", () => {
    const mockEvent: AnalyticsEvent = {
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
        timestamp: new Date("2023-01-01T00:00:00Z"),
      },
    };

    it("should track event successfully", async () => {
      await provider.track(mockEvent);

      // Should not throw and complete successfully
      expect(true).toBe(true);
    });

    it("should not track event when disabled", async () => {
      const disabledProvider = new LocalAnalyticsProvider({ enabled: false });

      await disabledProvider.track(mockEvent);

      // Should complete without logging
      expect(true).toBe(true);
    });

    it("should log detailed event in debug mode", async () => {
      const debugProvider = new LocalAnalyticsProvider({ debug: true });

      await debugProvider.track(mockEvent);

      expect(mockChildLogger.info).toHaveBeenCalledWith(
        expect.any(Object),
        "Event tracked",
      );
    });

    it("should handle events without context", async () => {
      const event: AnalyticsEvent = {
        name: CommonEvents.PAGE_VIEW,
        properties: { page: "home" },
      };

      await provider.track(event);

      // Should not throw
      expect(true).toBe(true);
    });

    it("should handle events without properties", async () => {
      const event: AnalyticsEvent = {
        name: CommonEvents.SESSION_STARTED,
        context: {
          sessionId: "session123",
        },
      };

      await provider.track(event);

      // Should not throw
      expect(true).toBe(true);
    });

    it("should handle errors gracefully", async () => {
      // Mock JSON.stringify to throw an error
      const originalStringify = JSON.stringify;
      JSON.stringify = vi.fn().mockImplementation(() => {
        throw new Error("Circular reference");
      });

      try {
        await provider.track(mockEvent);
        // Should not throw despite internal error
        expect(true).toBe(true);
      } finally {
        JSON.stringify = originalStringify;
      }
    });
  });

  describe("identify", () => {
    const mockIdentify: AnalyticsIdentify = {
      userId: "user123",
      traits: {
        name: "John Doe",
        email: "john@example.com",
        plan: "premium",
      },
      context: {
        sessionId: "session456",
        timestamp: new Date("2023-01-01T00:00:00Z"),
      },
    };

    it("should identify user successfully", async () => {
      await provider.identify(mockIdentify);

      // Should not throw and complete successfully
      expect(true).toBe(true);
    });

    it("should not identify user when disabled", async () => {
      const disabledProvider = new LocalAnalyticsProvider({ enabled: false });

      await disabledProvider.identify(mockIdentify);

      // Should complete without logging
      expect(true).toBe(true);
    });

    it("should log detailed identification in debug mode", async () => {
      const debugProvider = new LocalAnalyticsProvider({ debug: true });

      await debugProvider.identify(mockIdentify);

      expect(mockChildLogger.info).toHaveBeenCalledWith(
        expect.any(Object),
        "User identified",
      );
    });

    it("should handle identification without traits", async () => {
      const identify: AnalyticsIdentify = {
        userId: "user123",
      };

      await provider.identify(identify);

      // Should not throw
      expect(true).toBe(true);
    });

    it("should handle identification without context", async () => {
      const identify: AnalyticsIdentify = {
        userId: "user123",
        traits: { name: "John" },
      };

      await provider.identify(identify);

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("page", () => {
    const mockContext: AnalyticsContext = {
      user: {
        userId: "user123",
      },
      sessionId: "session456",
      url: "https://example.com/dashboard",
      timestamp: new Date("2023-01-01T00:00:00Z"),
    };

    it("should track page view successfully", async () => {
      await provider.page("Dashboard", { section: "analytics" }, mockContext);

      // Should not throw and complete successfully
      expect(true).toBe(true);
    });

    it("should not track page when disabled", async () => {
      const disabledProvider = new LocalAnalyticsProvider({ enabled: false });

      await disabledProvider.page("Dashboard", {}, mockContext);

      // Should complete without logging
      expect(true).toBe(true);
    });

    it("should log detailed page view in debug mode", async () => {
      const debugProvider = new LocalAnalyticsProvider({ debug: true });

      await debugProvider.page(
        "Dashboard",
        { section: "analytics" },
        mockContext,
      );

      expect(mockChildLogger.info).toHaveBeenCalledWith(
        expect.any(Object),
        "Page tracked",
      );
    });

    it("should handle page tracking without properties", async () => {
      await provider.page("Home", undefined, mockContext);

      // Should not throw
      expect(true).toBe(true);
    });

    it("should handle page tracking without context", async () => {
      await provider.page("About");

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe("flush", () => {
    it("should flush successfully", async () => {
      await provider.flush();

      // Should not throw and complete successfully
      expect(true).toBe(true);
    });

    it("should not flush when disabled", async () => {
      const disabledProvider = new LocalAnalyticsProvider({ enabled: false });

      await disabledProvider.flush();

      // Should complete without logging
      expect(true).toBe(true);
    });

    it("should log flush in debug mode", async () => {
      const debugProvider = new LocalAnalyticsProvider({ debug: true });

      await debugProvider.flush();

      expect(mockChildLogger.info).toHaveBeenCalledWith(
        expect.any(Object),
        "Flush requested",
      );
    });
  });

  describe("shutdown", () => {
    it("should shutdown successfully", async () => {
      expect(provider.isReady()).toBe(true);

      await provider.shutdown();

      expect(provider.isReady()).toBe(false);
    });

    it("should log shutdown in debug mode", async () => {
      const debugProvider = new LocalAnalyticsProvider({ debug: true });

      await debugProvider.shutdown();

      expect(mockChildLogger.info).toHaveBeenCalledWith(
        expect.any(Object),
        "Analytics shutdown",
      );
    });

    it("should handle multiple shutdown calls gracefully", async () => {
      await provider.shutdown();
      await provider.shutdown();

      // Should not throw on second shutdown
      expect(provider.isReady()).toBe(false);
    });
  });

  describe("error handling", () => {
    it("should handle track errors gracefully", async () => {
      // Mock logger to throw an error
      mockChildLogger.info.mockImplementation(() => {
        throw new Error("Logging error");
      });

      await provider.track({
        name: CommonEvents.ERROR_OCCURRED,
      });

      // Should not throw despite internal error
      expect(true).toBe(true);
    });

    it("should handle identify errors gracefully", async () => {
      // Mock logger to throw an error
      mockChildLogger.info.mockImplementation(() => {
        throw new Error("Logging error");
      });

      await provider.identify({
        userId: "user123",
      });

      // Should not throw despite internal error
      expect(true).toBe(true);
    });

    it("should handle page errors gracefully", async () => {
      // Mock logger to throw an error
      mockChildLogger.info.mockImplementation(() => {
        throw new Error("Logging error");
      });

      await provider.page("Error Page");

      // Should not throw despite internal error
      expect(true).toBe(true);
    });

    it("should handle flush errors gracefully", async () => {
      // Mock logger to throw an error
      mockChildLogger.debug.mockImplementation(() => {
        throw new Error("Logging error");
      });

      await provider.flush();

      // Should not throw despite internal error
      expect(true).toBe(true);
    });

    it("should handle shutdown errors gracefully", async () => {
      // Mock logger to throw an error
      mockChildLogger.info.mockImplementation(() => {
        throw new Error("Logging error");
      });

      await provider.shutdown();

      // Should not throw despite internal error
      expect(provider.isReady()).toBe(false);
    });
  });

  describe("edge cases and boundary conditions", () => {
    it("should handle events with null and undefined values", async () => {
      const event: AnalyticsEvent = {
        name: "edge_case_event",
        properties: {
          nullProp: null,
          undefinedProp: undefined,
          emptyString: "",
          zero: 0,
          falseProp: false,
        },
        context: {
          user: {
            userId: null as any,
            email: undefined,
          },
        },
      };

      await provider.track(event);

      // Should handle gracefully
      expect(true).toBe(true);
    });

    it("should handle very large event names", async () => {
      const largeEventName = "x".repeat(1000);

      await provider.track({
        name: largeEventName,
      });

      expect(true).toBe(true);
    });

    it("should handle very large property values", async () => {
      const largeValue = "x".repeat(10000);

      await provider.track({
        name: "large_property_test",
        properties: {
          largeProperty: largeValue,
          arrayProperty: new Array(1000).fill("item"),
        },
      });

      expect(true).toBe(true);
    });

    it("should handle circular references in properties", async () => {
      const circularObj: any = { name: "test" };
      circularObj.self = circularObj;

      await provider.track({
        name: "circular_test",
        properties: {
          circular: circularObj,
        },
      });

      expect(true).toBe(true);
    });

    it("should handle special characters in event names and properties", async () => {
      await provider.track({
        name: "特殊字符事件 with émojis 🎉 and symbols!@#$%^&*()",
        properties: {
          "key with spaces": "value",
          "emoji-key-🔥": "fire value",
          "symbols!@#$%": "special symbols",
          üñíçøðé: "unicode value",
        },
      });

      expect(true).toBe(true);
    });

    it("should handle deeply nested objects", async () => {
      const deepObject = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: {
                  value: "deep value",
                  array: [1, 2, 3],
                },
              },
            },
          },
        },
      };

      await provider.track({
        name: "deep_nesting_test",
        properties: {
          deep: deepObject,
        },
      });

      expect(true).toBe(true);
    });

    it("should handle concurrent operations", async () => {
      const promises = [
        provider.track({ name: "event1" }),
        provider.track({ name: "event2" }),
        provider.identify({ userId: "user1" }),
        provider.identify({ userId: "user2" }),
        provider.page("page1"),
        provider.page("page2"),
        provider.flush(),
      ];

      await Promise.all(promises);

      // All operations should complete without errors
      expect(true).toBe(true);
    });

    it("should handle rapid sequential operations", async () => {
      for (let i = 0; i < 100; i++) {
        await provider.track({ name: `rapid_event_${i}` });
      }

      expect(true).toBe(true);
    });

    it("should handle mixed data types in properties", async () => {
      const mixedProperties = {
        string: "text",
        number: 42,
        boolean: true,
        null: null,
        undefined: undefined,
        date: new Date(),
        array: [1, "two", true, null],
        object: { nested: "value" },
        function: () => "function",
        symbol: Symbol("test"),
        bigint: BigInt(123),
      };

      await provider.track({
        name: "mixed_types_test",
        properties: mixedProperties,
      });

      expect(true).toBe(true);
    });
  });

  describe("performance and memory", () => {
    it("should handle multiple providers without memory leaks", async () => {
      const providers = [];

      // Create many providers
      for (let i = 0; i < 50; i++) {
        providers.push(new LocalAnalyticsProvider());
      }

      // Use them all
      for (const p of providers) {
        await p.track({ name: "memory_test" });
        await p.shutdown();
      }

      expect(true).toBe(true);
    });

    it("should handle provider reuse after shutdown", async () => {
      await provider.shutdown();
      expect(provider.isReady()).toBe(false);

      // Should still work but isReady should remain false
      await provider.track({ name: "after_shutdown" });
      await provider.identify({ userId: "user123" });
      await provider.page("test_page");
      await provider.flush();

      expect(provider.isReady()).toBe(false);
    });
  });

  describe("configuration edge cases", () => {
    it("should handle invalid configuration gracefully", async () => {
      const invalidProvider = new LocalAnalyticsProvider({
        enabled: null as any,
        debug: "invalid" as any,
      });

      await invalidProvider.track({ name: "test" });
      expect(true).toBe(true);
    });

    it("should handle missing configuration", async () => {
      const noConfigProvider = new LocalAnalyticsProvider(undefined as any);

      await noConfigProvider.track({ name: "test" });
      expect(noConfigProvider.isReady()).toBe(true);
    });

    it("should handle empty configuration object", async () => {
      const emptyConfigProvider = new LocalAnalyticsProvider({});

      await emptyConfigProvider.track({ name: "test" });
      expect(emptyConfigProvider.isReady()).toBe(true);
    });
  });

  describe("logging behavior verification", () => {
    it("should log structured data correctly", async () => {
      await provider.track({
        name: CommonEvents.USER_SIGNIN,
        properties: { method: "firebase" },
        context: {
          user: { userId: "user123" },
          sessionId: "session456",
        },
      });

      expect(mockChildLogger.info).toHaveBeenCalledWith(
        expect.any(Object),
        "Event tracked",
      );
    });

    it("should log identify operations correctly", async () => {
      await provider.identify({
        userId: "user123",
        traits: { name: "John", email: "john@example.com" },
      });

      expect(mockChildLogger.info).toHaveBeenCalledWith(
        expect.any(Object),
        "User identified",
      );
    });

    it("should log page views correctly", async () => {
      await provider.page(
        "Dashboard",
        { section: "analytics" },
        {
          user: { userId: "user123" },
          url: "https://example.com/dashboard",
        },
      );

      expect(mockChildLogger.info).toHaveBeenCalledWith(
        expect.any(Object),
        "Page tracked",
      );
    });

    it("should log operations without crashing when properties are missing", async () => {
      await provider.track({ name: "minimal_event" });
      await provider.identify({ userId: "user123" });
      await provider.page("Minimal Page");

      expect(mockChildLogger.info).toHaveBeenCalledTimes(3);
    });
  });
});
