/**
 * Tests for analytics helper functions from index.ts
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createAnalyticsConfig,
  createEventProperties,
  extractUserProperties,
} from "../index";

describe("Analytics Helper Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createAnalyticsConfig", () => {
    it("should create config with local provider and defaults", () => {
      const config = createAnalyticsConfig("local");

      expect(config).toEqual({
        provider: "local",
        apiKey: undefined,
        enabled: true,
      });
    });

    it("should create config with posthog provider and API key", () => {
      const config = createAnalyticsConfig("posthog", "test-api-key");

      expect(config).toEqual({
        provider: "posthog",
        apiKey: "test-api-key",
        enabled: true,
      });
    });

    it("should create config with posthog provider and custom options", () => {
      const config = createAnalyticsConfig("posthog", "posthog-key", {
        enabled: false,
        environment: "staging",
        version: "2.0.0",
        host: "https://custom.analytics.com",
        flushAt: 50,
        flushInterval: 5000,
      });

      expect(config).toEqual({
        provider: "posthog",
        apiKey: "posthog-key",
        enabled: false,
        environment: "staging",
        version: "2.0.0",
        host: "https://custom.analytics.com",
        flushAt: 50,
        flushInterval: 5000,
      });
    });

    it("should override defaults with provided options", () => {
      const config = createAnalyticsConfig("local", undefined, {
        enabled: false,
        version: "1.2.3",
      });

      expect(config.provider).toBe("local");
      expect(config.apiKey).toBeUndefined();
      expect(config.enabled).toBe(false);
      expect(config.version).toBe("1.2.3");
    });

    it("should handle partial options object", () => {
      const config = createAnalyticsConfig("posthog", "key", {
        host: "https://custom.host.com",
        // Other options not provided
      });

      expect(config).toEqual({
        provider: "posthog",
        apiKey: "key",
        enabled: true, // Default
        host: "https://custom.host.com",
      });
    });

    it("should handle empty options object", () => {
      const config = createAnalyticsConfig("local", "key", {});

      expect(config).toEqual({
        provider: "local",
        apiKey: "key",
        enabled: true,
      });
    });

    it("should work without options parameter", () => {
      const config = createAnalyticsConfig("posthog", "key");

      expect(config).toEqual({
        provider: "posthog",
        apiKey: "key",
        enabled: true,
      });
    });

    it("should work without API key", () => {
      const config = createAnalyticsConfig("local");

      expect(config.provider).toBe("local");
      expect(config.apiKey).toBeUndefined();
    });

    it("should handle all provider types", () => {
      const providers: Array<"posthog" | "local"> = ["posthog", "local"];

      for (const provider of providers) {
        const config = createAnalyticsConfig(provider, "test-key");
        expect(config.provider).toBe(provider);
        expect(config.apiKey).toBe("test-key");
      }
    });
  });

  describe("createEventProperties", () => {
    it("should create basic event properties", () => {
      const properties = createEventProperties("user_action");

      expect(properties.event_type).toBe("user_action");
      expect(properties.timestamp).toBeDefined();
      expect(typeof properties.timestamp).toBe("string");

      // Verify timestamp is valid ISO string
      expect(() => new Date(properties.timestamp as string)).not.toThrow();
    });

    it("should merge additional properties", () => {
      const additionalProps = {
        buttonId: "submit",
        formId: "contact",
        userId: "user123",
        count: 42,
        isActive: true,
      };

      const properties = createEventProperties(
        "form_submission",
        additionalProps,
      );

      expect(properties.event_type).toBe("form_submission");
      expect(properties.buttonId).toBe("submit");
      expect(properties.formId).toBe("contact");
      expect(properties.userId).toBe("user123");
      expect(properties.count).toBe(42);
      expect(properties.isActive).toBe(true);
      expect(properties.timestamp).toBeDefined();
    });

    it("should handle empty additional properties", () => {
      const properties = createEventProperties("test_event", {});

      expect(properties.event_type).toBe("test_event");
      expect(properties.timestamp).toBeDefined();
      expect(Object.keys(properties)).toEqual(["event_type", "timestamp"]);
    });

    it("should handle null/undefined additional properties", () => {
      const properties1 = createEventProperties("test_event", null as any);
      const properties2 = createEventProperties("test_event", undefined as any);

      expect(properties1.event_type).toBe("test_event");
      expect(properties1.timestamp).toBeDefined();
      expect(properties2.event_type).toBe("test_event");
      expect(properties2.timestamp).toBeDefined();
    });

    it("should handle properties with various data types", () => {
      const mixedProps = {
        string: "text",
        number: 42,
        boolean: true,
        null: null,
        undefined: undefined,
        date: new Date("2023-01-01"),
        array: [1, 2, 3],
        object: { nested: "value" },
      };

      const properties = createEventProperties("mixed_types", mixedProps);

      expect(properties.event_type).toBe("mixed_types");
      expect(properties.string).toBe("text");
      expect(properties.number).toBe(42);
      expect(properties.boolean).toBe(true);
      expect(properties.null).toBeNull();
      expect(properties.undefined).toBeUndefined();
      expect(properties.date).toEqual(new Date("2023-01-01"));
      expect(properties.array).toEqual([1, 2, 3]);
      expect(properties.object).toEqual({ nested: "value" });
    });

    it("should not override timestamp if provided in additional properties", () => {
      const customTimestamp = "2023-01-01T00:00:00.000Z";
      const properties = createEventProperties("test_event", {
        timestamp: customTimestamp,
        other: "value",
      });

      // The function should use its own timestamp, not the one in additional properties
      expect(properties.timestamp).not.toBe(customTimestamp);
      expect(properties.timestamp).toBeDefined();
      expect(typeof properties.timestamp).toBe("string");
    });

    it("should handle very long event type names", () => {
      const longEventType = "very_long_event_type_name_".repeat(10);
      const properties = createEventProperties(longEventType);

      expect(properties.event_type).toBe(longEventType);
      expect(properties.timestamp).toBeDefined();
    });

    it("should handle special characters in event type", () => {
      const specialEventType = "event-with.special_chars!@#$%^&*()测试🎉";
      const properties = createEventProperties(specialEventType);

      expect(properties.event_type).toBe(specialEventType);
      expect(properties.timestamp).toBeDefined();
    });

    it("should generate consistent timestamp format", () => {
      const properties = createEventProperties("timestamp_test");
      const timestamp = properties.timestamp as string;

      // Should be valid ISO 8601 format
      expect(timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
      );

      // Should be a recent timestamp (within last minute)
      const timestampDate = new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - timestampDate.getTime();
      expect(diffMs).toBeLessThan(60000); // Less than 1 minute
    });
  });

  describe("extractUserProperties", () => {
    it("should extract common user properties", () => {
      const user = {
        uid: "user123",
        email: "user@example.com",
        displayName: "John Doe",
        emailVerified: true,
        photoURL: "https://example.com/photo.jpg",
        plan: "premium",
        role: "admin",
      };

      const properties = extractUserProperties(user);

      expect(properties).toEqual({
        uid: "user123",
        email: "user@example.com",
        displayName: "John Doe",
      });
    });

    it("should handle Firebase user object", () => {
      const firebaseUser = {
        uid: "firebase-user-123",
        email: "firebase@example.com",
        displayName: "Firebase User",
        emailVerified: true,
        photoURL: "https://example.com/firebase-photo.jpg",
        createdAt: new Date("2023-01-01"),
        lastLoginAt: new Date("2023-06-01"),
      };

      const properties = extractUserProperties(firebaseUser);

      expect(properties.uid).toBe("firebase-user-123");
      expect(properties.email).toBe("firebase@example.com");
      expect(properties.displayName).toBe("Firebase User");
      expect(properties.createdAt).toBe("2023-01-01T00:00:00.000Z");
      expect(properties.lastLoginAt).toBe("2023-06-01T00:00:00.000Z");
    });

    it("should handle custom user object with alternative field names", () => {
      const customUser = {
        uid: "custom-123",
        email: "custom@example.com",
        displayName: "Custom User",
        id: "custom-123",
        userId: "user-456",
        name: "Custom User",
        avatar: "https://example.com/avatar.jpg",
        subscription: "enterprise",
        permissions: ["read", "write"],
      };

      const properties = extractUserProperties(customUser);

      expect(properties.uid).toBe("custom-123");
      expect(properties.email).toBe("custom@example.com");
      expect(properties.displayName).toBe("Custom User");
      expect(properties).not.toHaveProperty("id");
      expect(properties).not.toHaveProperty("userId");
      expect(properties).not.toHaveProperty("name");
      expect(properties).not.toHaveProperty("avatar");
      expect(properties).not.toHaveProperty("subscription");
      expect(properties).not.toHaveProperty("permissions");
    });

    it("should convert Date objects to ISO strings", () => {
      const user = {
        uid: "user123",
        createdAt: new Date("2023-01-01T12:00:00Z"),
        lastLoginAt: new Date("2023-06-15T14:30:00Z"),
        updatedAt: new Date("2023-07-01T09:15:30Z"), // This should be ignored
      };

      const properties = extractUserProperties(user);

      expect(properties.createdAt).toBe("2023-01-01T12:00:00.000Z");
      expect(properties.lastLoginAt).toBe("2023-06-15T14:30:00.000Z");
      expect(properties).not.toHaveProperty("updatedAt");
    });

    it("should skip undefined and null values", () => {
      const user = {
        uid: "user123",
        email: "user@example.com",
        displayName: null,
        createdAt: undefined,
        lastLoginAt: "",
        plan: "free",
      };

      const properties = extractUserProperties(user);

      expect(properties.uid).toBe("user123");
      expect(properties.email).toBe("user@example.com");
      expect(properties.lastLoginAt).toBe(""); // Empty string should be included
      expect(properties).not.toHaveProperty("displayName");
      expect(properties).not.toHaveProperty("createdAt");
      expect(properties).not.toHaveProperty("plan");
    });

    it("should handle null or undefined user", () => {
      expect(extractUserProperties(null)).toEqual({});
      expect(extractUserProperties(undefined)).toEqual({});
    });

    it("should handle empty user object", () => {
      expect(extractUserProperties({})).toEqual({});
    });

    it("should only extract known user fields", () => {
      const user = {
        uid: "user123",
        email: "user@example.com",
        // Known fields
        displayName: "John",
        createdAt: new Date("2023-01-01"),
        lastLoginAt: new Date("2023-06-01"),
        // Unknown fields (should be ignored)
        plan: "premium",
        unknownField: "should not be included",
        secretData: "sensitive",
        randomProperty: "random",
      };

      const properties = extractUserProperties(user);

      expect(properties.uid).toBe("user123");
      expect(properties.email).toBe("user@example.com");
      expect(properties.displayName).toBe("John");
      expect(properties.createdAt).toBe("2023-01-01T00:00:00.000Z");
      expect(properties.lastLoginAt).toBe("2023-06-01T00:00:00.000Z");
      expect(properties).not.toHaveProperty("plan");
      expect(properties).not.toHaveProperty("unknownField");
      expect(properties).not.toHaveProperty("secretData");
      expect(properties).not.toHaveProperty("randomProperty");
    });

    it("should handle all supported field variations", () => {
      const user = {
        // Supported fields
        uid: "uid-123",
        email: "test@example.com",
        displayName: "Display Name",
        createdAt: new Date("2023-01-01"),
        lastLoginAt: new Date("2023-06-01"),

        // Unsupported fields (should be ignored)
        id: "id-456",
        userId: "userId-789",
        emailVerified: true,
        name: "Regular Name",
        photoURL: "https://example.com/photo.jpg",
        avatar: "https://example.com/avatar.jpg",
        plan: "premium",
        subscription: "enterprise",
        role: "admin",
        permissions: ["read", "write"],
      };

      const properties = extractUserProperties(user);

      // Should include only supported fields
      expect(properties.uid).toBe("uid-123");
      expect(properties.email).toBe("test@example.com");
      expect(properties.displayName).toBe("Display Name");
      expect(properties.createdAt).toBe("2023-01-01T00:00:00.000Z");
      expect(properties.lastLoginAt).toBe("2023-06-01T00:00:00.000Z");

      // Should not include unsupported fields
      expect(properties).not.toHaveProperty("id");
      expect(properties).not.toHaveProperty("userId");
      expect(properties).not.toHaveProperty("emailVerified");
      expect(properties).not.toHaveProperty("name");
      expect(properties).not.toHaveProperty("photoURL");
      expect(properties).not.toHaveProperty("avatar");
      expect(properties).not.toHaveProperty("plan");
      expect(properties).not.toHaveProperty("subscription");
      expect(properties).not.toHaveProperty("role");
      expect(properties).not.toHaveProperty("permissions");
    });

    it("should handle complex user objects with mixed data types", () => {
      const user = {
        uid: "complex-user",
        email: "complex@example.com",
        displayName: "Complex User",
        createdAt: new Date("2023-01-01"),
        lastLoginAt: new Date("2023-06-01"),
        // These should be ignored
        emailVerified: true,
        plan: "premium",
        role: "admin",
        permissions: ["read", "write", "admin"],
        numericField: 42,
        booleanField: false,
        arrayField: [1, 2, 3],
        objectField: { nested: "value" },
      };

      const properties = extractUserProperties(user);

      expect(properties.uid).toBe("complex-user");
      expect(properties.email).toBe("complex@example.com");
      expect(properties.displayName).toBe("Complex User");
      expect(properties.createdAt).toBe("2023-01-01T00:00:00.000Z");
      expect(properties.lastLoginAt).toBe("2023-06-01T00:00:00.000Z");
      // All other fields should not be included
      expect(properties).not.toHaveProperty("emailVerified");
      expect(properties).not.toHaveProperty("plan");
      expect(properties).not.toHaveProperty("role");
      expect(properties).not.toHaveProperty("permissions");
      expect(properties).not.toHaveProperty("numericField");
      expect(properties).not.toHaveProperty("booleanField");
      expect(properties).not.toHaveProperty("arrayField");
      expect(properties).not.toHaveProperty("objectField");
    });
  });

  describe("Edge cases and error handling", () => {
    it("should handle createEventProperties with circular references", () => {
      const circularObj: any = { name: "test" };
      circularObj.self = circularObj;

      const properties = createEventProperties("circular_test", {
        circular: circularObj,
        normal: "value",
      });

      expect(properties.event_type).toBe("circular_test");
      expect(properties.normal).toBe("value");
      expect(properties.circular).toEqual(circularObj);
      expect(properties.timestamp).toBeDefined();
    });

    it("should handle extractUserProperties with circular references", () => {
      const circularUser: any = {
        uid: "circular-user",
        email: "circular@example.com",
        displayName: "Circular User",
      };
      circularUser.self = circularUser;

      const properties = extractUserProperties(circularUser);

      expect(properties.uid).toBe("circular-user");
      expect(properties.email).toBe("circular@example.com");
      expect(properties.displayName).toBe("Circular User");
      // Circular reference should not cause issues
      expect(properties).not.toHaveProperty("self");
    });

    it("should handle very large property values", () => {
      const largeString = "x".repeat(10000);
      const properties = createEventProperties("large_test", {
        largeProperty: largeString,
      });

      expect(properties.event_type).toBe("large_test");
      expect(properties.largeProperty).toBe(largeString);
    });

    it("should handle special characters and unicode", () => {
      const unicodeProps = {
        chinese: "测试数据",
        emoji: "🎉🚀💯",
        arabic: "اختبار",
        russian: "тест",
        special: "!@#$%^&*()[]{}|\\:\";'<>?,./",
      };

      const properties = createEventProperties("unicode_test", unicodeProps);

      expect(properties.event_type).toBe("unicode_test");
      expect(properties.chinese).toBe("测试数据");
      expect(properties.emoji).toBe("🎉🚀💯");
      expect(properties.arabic).toBe("اختبار");
      expect(properties.russian).toBe("тест");
      expect(properties.special).toBe("!@#$%^&*()[]{}|\\:\";'<>?,./");
    });
  });
});
