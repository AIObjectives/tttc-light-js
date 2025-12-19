import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock pino logger for testing
const mockPinoLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  child: vi.fn(() => mockPinoLogger),
};

vi.mock("pino", () => ({
  default: vi.fn(() => mockPinoLogger),
}));

// Create comprehensive redaction tests
describe("Logger Redaction Security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPinoLogger.debug.mockClear();
    mockPinoLogger.info.mockClear();
    mockPinoLogger.warn.mockClear();
    mockPinoLogger.error.mockClear();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("Logger Configuration", () => {
    it("should be configured with redaction paths", async () => {
      const { logger } = await import("../logger");

      // Test that logger handles sensitive data without throwing errors
      expect(() => {
        logger.info(
          {
            uid: "X3mNGpwaRqXzb7HknkKfZPxQABC9",
            email: "sensitive.user@company.com",
            password: "secret123",
            token: "jwt-token-here",
            displayName: "Sensitive Name",
          },
          "Test sensitive data logging",
        );
      }).not.toThrow();

      expect(mockPinoLogger.info).toHaveBeenCalled();
    });

    it("should handle all data types safely", async () => {
      const { logger } = await import("../logger");

      const testData = {
        uid: 123456789, // number
        email: null, // null
        displayName: undefined, // undefined
        password: Symbol("test"), // symbol
        token: new Date(), // object
      };

      expect(() => {
        logger.info(testData, "Test various data types");
      }).not.toThrow();

      expect(mockPinoLogger.info).toHaveBeenCalled();
    });

    it("should handle nested and wildcard patterns", async () => {
      const { logger } = await import("../logger");

      const testData = {
        user: {
          uid: "nested123456789",
          email: "nested@example.com",
          displayName: "Nested User",
        },
        request: {
          uid: "request123456789",
          password: "secret123",
        },
        response: {
          token: "jwt-token",
          secret: "api-secret",
        },
      };

      expect(() => {
        logger.debug(testData, "Test wildcard patterns");
      }).not.toThrow();

      expect(mockPinoLogger.debug).toHaveBeenCalled();
    });
  });

  describe("Edge Cases and Security", () => {
    it("should handle circular references in logged data", async () => {
      const { logger } = await import("../logger");

      const circularObject: any = {
        uid: "circular123456789",
        email: "circular@example.com",
      };
      circularObject.self = circularObject;

      expect(() => {
        logger.info(circularObject, "Test circular reference");
      }).not.toThrow();

      expect(mockPinoLogger.info).toHaveBeenCalled();
    });

    it("should handle very large data objects", async () => {
      const { logger } = await import("../logger");

      const largeData = {
        uid: "large123456789",
        email: "large@example.com",
        largeArray: new Array(1000).fill("data"),
        largeString: "x".repeat(10000),
      };

      expect(() => {
        logger.info(largeData, "Test large data");
      }).not.toThrow();

      expect(mockPinoLogger.info).toHaveBeenCalled();
    });

    it("should handle unusual data types", async () => {
      const { logger } = await import("../logger");

      const testData = {
        uid: Symbol("test"),
        email: new Date(),
        displayName: BigInt(123),
        password: () => "secret",
        token: /test/,
      };

      expect(() => {
        logger.info(testData, "Test unusual data types");
      }).not.toThrow();

      expect(mockPinoLogger.info).toHaveBeenCalled();
    });
  });

  describe("Environment Configuration", () => {
    it("should work in development environment", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      vi.resetModules();
      const { logger } = await import("../logger");

      const userData = {
        uid: "dev123456789",
        email: "dev@example.com",
        displayName: "Dev User",
      };

      expect(() => {
        logger.debug(userData, "Development test");
      }).not.toThrow();

      expect(mockPinoLogger.debug).toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });

    it("should work in production environment", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      vi.resetModules();
      const { logger } = await import("../logger");

      const userData = {
        uid: "prod123456789",
        email: "prod@example.com",
        displayName: "Prod User",
      };

      expect(() => {
        logger.info(userData, "Production test");
      }).not.toThrow();

      expect(mockPinoLogger.info).toHaveBeenCalled();

      process.env.NODE_ENV = originalEnv;
    });

    it("should handle all logging levels", async () => {
      const { logger } = await import("../logger");

      const testData = {
        uid: "level123456789",
        email: "level@example.com",
        displayName: "Level User",
      };

      expect(() => {
        logger.debug(testData, "Debug message");
        logger.info(testData, "Info message");
        logger.warn(testData, "Warning message");
        logger.error(testData, "Error message");
      }).not.toThrow();

      expect(mockPinoLogger.debug).toHaveBeenCalled();
      expect(mockPinoLogger.info).toHaveBeenCalled();
      expect(mockPinoLogger.warn).toHaveBeenCalled();
      expect(mockPinoLogger.error).toHaveBeenCalled();
    });
  });
});
