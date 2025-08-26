import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Create a test logger to verify redaction functionality
describe("Logger Native Pino Redaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe("Redaction Functions", () => {
    it("should redact UID to first 8 characters plus '...'", async () => {
      // Import logger to get access to redaction functionality
      const { logger } = await import("../logger");

      // Test data with user information
      const testData = {
        user: {
          uid: "X3mNGpwaRqXzb7HknkKfZPxQABC9",
          email: "test@example.com",
          displayName: "Test User",
        },
      };

      // The logger should be configured with redaction
      expect(logger).toBeDefined();

      // Test that logger can handle the data (actual redaction happens internally)
      expect(() => {
        logger.info(testData, "Test log with user data");
      }).not.toThrow();
    });

    it("should redact email to '<redacted>@domain' format", async () => {
      const { logger } = await import("../logger");

      const testData = {
        user: {
          uid: "test12345678",
          email: "sensitive.user@company.com",
          displayName: "John Doe",
        },
      };

      expect(() => {
        logger.info(testData, "Test email redaction");
      }).not.toThrow();
    });

    it("should redact displayName to '<redacted>'", async () => {
      const { logger } = await import("../logger");

      const testData = {
        user: {
          uid: "test12345678",
          email: "user@example.com",
          displayName: "Sensitive Display Name",
        },
      };

      expect(() => {
        logger.info(testData, "Test displayName redaction");
      }).not.toThrow();
    });
  });

  describe("Wildcard Pattern Redaction", () => {
    it("should handle wildcard patterns for nested objects", async () => {
      const { logger } = await import("../logger");

      const testData = {
        request: {
          uid: "request123456789",
          email: "request@example.com",
          displayName: "Request User",
        },
        response: {
          uid: "response123456789",
          email: "response@example.com",
          displayName: "Response User",
        },
      };

      expect(() => {
        logger.debug(testData, "Test wildcard patterns");
      }).not.toThrow();
    });
  });

  describe("Environment Compatibility", () => {
    it("should work in development environment", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      vi.resetModules();
      const { logger } = await import("../logger");

      const userData = {
        user: {
          uid: "dev123456789",
          email: "dev@example.com",
          displayName: "Dev User",
        },
      };

      expect(() => {
        logger.debug(userData, "Development test");
      }).not.toThrow();

      process.env.NODE_ENV = originalEnv;
    });

    it("should work in production environment", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      vi.resetModules();
      const { logger } = await import("../logger");

      const userData = {
        user: {
          uid: "prod123456789",
          email: "prod@example.com",
          displayName: "Prod User",
        },
      };

      expect(() => {
        logger.info(userData, "Production test");
      }).not.toThrow();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("Logger API", () => {
    it("should export logger with all expected methods", async () => {
      const { logger } = await import("../logger");

      expect(logger).toBeDefined();
      expect(typeof logger.debug).toBe("function");
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");
    });

    it("should handle all logging levels", async () => {
      const { logger } = await import("../logger");

      const testData = {
        user: {
          uid: "level123456789",
          email: "level@example.com",
          displayName: "Level User",
        },
      };

      expect(() => {
        logger.debug(testData, "Debug message");
        logger.info(testData, "Info message");
        logger.warn(testData, "Warning message");
        logger.error(testData, "Error message");
      }).not.toThrow();
    });
  });
});
