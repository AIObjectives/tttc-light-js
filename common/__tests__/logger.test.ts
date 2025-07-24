import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("Secure Logger", () => {
  let consoleSpy: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Set environment to development for tests
    process.env.NODE_ENV = "development";

    // Reset module to pick up new environment
    vi.resetModules();

    // Mock console methods
    consoleSpy = {
      log: vi.spyOn(console, "log").mockImplementation(() => {}),
      warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    consoleSpy.log.mockRestore();
    consoleSpy.warn.mockRestore();
    consoleSpy.error.mockRestore();
  });

  describe("Client-side logging", () => {
    it("should sanitize user data in debug logs", async () => {
      // Arrange
      const { logger } = await import("../logger");
      const userData = {
        uid: "X3mNGpwaRqXzb7HknkKfZPxQABC9",
        email: "user@example.com",
        displayName: "Test User",
      };

      // Act
      logger.debug("User action performed", userData);

      // Assert
      expect(consoleSpy.log).toHaveBeenCalledWith(
        "[UserAccount] User action performed - uid=X3mNGpwa... domain=example.com",
      );
    });

    it("should handle null user data gracefully", async () => {
      // Arrange
      const { logger } = await import("../logger");

      // Act
      logger.debug("No user data");

      // Assert
      expect(consoleSpy.log).toHaveBeenCalledWith("[UserAccount] No user data");
    });

    it("should handle simple UID strings", async () => {
      // Arrange
      const { logger } = await import("../logger");

      // Act
      logger.info("User updated", "X3mNGpwaRqXzb7HknkKfZPxQABC9");

      // Assert
      expect(consoleSpy.log).toHaveBeenCalledWith(
        "[UserAccount] User updated - uid=X3mNGpwa...",
      );
    });

    it("should protect email addresses by showing only domain", async () => {
      // Arrange
      const { logger } = await import("../logger");
      const userData = {
        uid: "test-uid",
        email: "sensitive.user@company.com",
      };

      // Act
      logger.info("User authenticated", userData);

      // Assert
      expect(consoleSpy.log).toHaveBeenCalledWith(
        "[UserAccount] User authenticated - uid=test-uid... domain=company.com displayName=no",
      );
    });

    it("should handle missing email gracefully", async () => {
      // Arrange
      const { logger } = await import("../logger");
      const userData = {
        uid: "test-uid-no-email",
      };

      // Act
      logger.debug("User with no email", userData);

      // Assert
      expect(consoleSpy.log).toHaveBeenCalledWith(
        "[UserAccount] User with no email - uid=test-uid... domain=unknown displayName=no",
      );
    });
  });

  describe("Server-side logging", () => {
    it("should log with individual parameters", async () => {
      // Arrange
      const { logger } = await import("../logger");

      // Act
      logger.info("User document created", {
        uid: "test-uid-123",
        email: "user@example.com",
        displayName: "Test User",
      });

      // Assert
      expect(consoleSpy.log).toHaveBeenCalledWith(
        "[UserAccount] User document created - uid=test-uid... domain=example.com displayName=yes",
      );
    });

    it("should handle decoded user objects", async () => {
      // Arrange
      const { logger } = await import("../logger");
      const decodedUser = {
        uid: "decoded-uid-456",
        email: "decoded@example.com",
        name: "Decoded User",
      };

      // Act
      logger.info("Token verified", decodedUser);

      // Assert
      expect(consoleSpy.log).toHaveBeenCalledWith(
        "[UserAccount] Token verified - uid=decoded-... domain=example.com displayName=yes",
      );
    });

    it("should handle null decoded user", async () => {
      // Arrange
      const { logger } = await import("../logger");

      // Act
      logger.error("Token verification failed", null);

      // Assert
      expect(consoleSpy.log).toHaveBeenCalledWith(
        "[UserAccount] Token verification failed - null",
      );
    });

    it("should log structured authentication events", async () => {
      // Arrange
      const { logger } = await import("../logger");
      const mockDate = new Date("2024-01-15T10:30:00.000Z");
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);

      // Act
      logger.auth("signin", "auth-uid-789", "auth@example.com");

      // Assert
      expect(consoleSpy.log).toHaveBeenCalledWith(
        "🔐 [AUTH] USER_SIGNIN uid=auth-uid-789 domain=example.com time=2024-01-15T10:30:00.000Z",
      );

      vi.useRealTimers();
    });

    it("should log signout events without UID", async () => {
      // Arrange
      const { logger } = await import("../logger");
      const mockDate = new Date("2024-01-15T10:35:00.000Z");
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);

      // Act
      logger.auth("signout");

      // Assert
      expect(consoleSpy.log).toHaveBeenCalledWith(
        "🔓 [AUTH] USER_SIGNOUT time=2024-01-15T10:35:00.000Z",
      );

      vi.useRealTimers();
    });

    it("should log token verification events", async () => {
      // Arrange
      const { logger } = await import("../logger");
      const mockDate = new Date("2024-01-15T10:32:00.000Z");
      vi.useFakeTimers();
      vi.setSystemTime(mockDate);

      // Act
      logger.auth("verify", "verify-uid-101", "verify@example.com");

      // Assert
      expect(consoleSpy.log).toHaveBeenCalledWith(
        "🔑 [AUTH] TOKEN_VERIFIED uid=verify-uid-101 time=2024-01-15T10:32:00.000Z",
      );

      vi.useRealTimers();
    });
  });

  describe("Error and warning logging", () => {
    it("should log warnings without sanitization", async () => {
      // Arrange
      const { logger } = await import("../logger");
      const warningMessage = "Something might be wrong";
      const warningData = { code: "WARN_001" };

      // Act
      logger.warn(warningMessage, warningData);

      // Assert
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        "[UserAccount] Something might be wrong",
        warningData,
      );
    });

    it("should log errors without sanitization", async () => {
      // Arrange
      const { logger } = await import("../logger");
      const errorMessage = "Critical failure";
      const error = new Error("Database connection lost");

      // Act
      logger.error(errorMessage, error);

      // Assert
      expect(consoleSpy.error).toHaveBeenCalledWith(
        "[UserAccount] Critical failure",
        error,
      );
    });
  });

  describe("Environment awareness", () => {
    it("should respect debug log levels in production", async () => {
      // Arrange
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      // Re-import logger to pick up new environment
      vi.resetModules();
      const { logger: prodLogger } = await import("../logger");

      // Act
      prodLogger.debug("Debug message");
      prodLogger.info("Info message");

      // Assert
      expect(consoleSpy.log).toHaveBeenCalledTimes(1); // Only info should log
      expect(consoleSpy.log).toHaveBeenCalledWith("[UserAccount] Info message");

      // Cleanup
      process.env.NODE_ENV = originalEnv;
    });
  });
});
