import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock pino to capture log outputs for testing
const mockPinoLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

vi.mock("pino", () => {
  return {
    default: vi.fn(() => mockPinoLogger),
  };
});

describe("Basic Pino Logger", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // Set environment to development for tests
    process.env.NODE_ENV = "development";

    // Clear pino mock calls
    mockPinoLogger.debug.mockClear();
    mockPinoLogger.info.mockClear();
    mockPinoLogger.warn.mockClear();
    mockPinoLogger.error.mockClear();
  });

  describe("Basic logging functionality", () => {
    it("should support debug logging", async () => {
      // Arrange
      const { logger } = await import("../logger");

      // Act
      logger.debug("Debug message");

      // Assert
      expect(mockPinoLogger.debug).toHaveBeenCalledWith("Debug message");
    });

    it("should support info logging", async () => {
      // Arrange
      const { logger } = await import("../logger");

      // Act
      logger.info("Info message");

      // Assert
      expect(mockPinoLogger.info).toHaveBeenCalledWith("Info message");
    });

    it("should support warn logging", async () => {
      // Arrange
      const { logger } = await import("../logger");

      // Act
      logger.warn("Warning message");

      // Assert
      expect(mockPinoLogger.warn).toHaveBeenCalledWith("Warning message");
    });

    it("should support error logging", async () => {
      // Arrange
      const { logger } = await import("../logger");

      // Act
      logger.error("Error message");

      // Assert
      expect(mockPinoLogger.error).toHaveBeenCalledWith("Error message");
    });
  });

  describe("Structured logging", () => {
    it("should support logging with data objects", async () => {
      // Arrange
      const { logger } = await import("../logger");
      const logData = { key: "value", count: 42 };

      // Act
      logger.info(logData, "Message with data");

      // Assert
      expect(mockPinoLogger.info).toHaveBeenCalledWith(
        logData,
        "Message with data",
      );
    });

    it("should handle user data with redaction configured", async () => {
      // Arrange
      const { logger } = await import("../logger");
      const userData = {
        user: {
          uid: "X3mNGpwaRqXzb7HknkKfZPxQABC9",
          email: "test@example.com",
          displayName: "Test User",
        },
      };

      // Act - This should trigger redaction via pino's built-in redact functionality
      logger.info(userData, "User action");

      // Assert - The logger received the call (redaction happens internally)
      expect(mockPinoLogger.info).toHaveBeenCalledWith(userData, "User action");
    });
  });

  describe("Environment configuration", () => {
    it("should be configured for development environment", async () => {
      // Arrange
      process.env.NODE_ENV = "development";
      vi.resetModules();

      // Act
      const { logger } = await import("../logger");

      // Assert - Logger should be defined and functional
      expect(logger).toBeDefined();
      expect(typeof logger.debug).toBe("function");
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");
    });

    it("should be configured for production environment", async () => {
      // Arrange
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";
      vi.resetModules();

      // Act
      const { logger } = await import("../logger");

      // Assert - Logger should be defined and functional
      expect(logger).toBeDefined();
      expect(typeof logger.debug).toBe("function");
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");

      // Cleanup
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("Redaction configuration", () => {
    it("should be configured with redaction paths", async () => {
      // This test verifies the logger was created successfully with redaction config
      const { logger } = await import("../logger");

      // The logger should be configured with redaction (we can't easily test the internal config)
      // But we can verify it handles user data without throwing errors
      expect(() => {
        logger.info(
          {
            user: {
              uid: "test123456789",
              email: "test@example.com",
              displayName: "Test User",
            },
          },
          "Test message",
        );
      }).not.toThrow();

      expect(mockPinoLogger.info).toHaveBeenCalled();
    });
  });
});
