import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Request, Response } from "express";
import authEvents from "../authEvents";
import { verifyUser } from "../../Firebase";
import { sendError } from "../sendError.js";

// Mock Firebase functions
vi.mock("../../Firebase", () => ({
  verifyUser: vi.fn(),
}));

// Mock sendError utility
vi.mock("../sendError.js", () => ({
  sendError: vi.fn(),
}));

// Mock logger
vi.mock("tttc-common/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    auth: vi.fn(),
  },
}));

describe("Auth Events Route", () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockVerifyUser: any;
  let mockSendError: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockVerifyUser = vi.mocked(verifyUser);
    mockSendError = vi.mocked(sendError);

    mockRequest = {
      body: {},
    };

    mockResponse = {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("POST /auth-events", () => {
    it("should handle signin events with valid token", async () => {
      // Arrange
      const mockDecodedUser = {
        uid: "test-uid-123",
        email: "test@example.com",
        name: "Test User",
      };

      mockRequest.body = {
        event: "signin",
        firebaseAuthToken: "valid-token",
        clientTimestamp: "2024-01-15T10:30:00.000Z",
      };

      mockVerifyUser.mockResolvedValue(mockDecodedUser);

      // Act
      await authEvents(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockVerifyUser).toHaveBeenCalledWith("valid-token");
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: "Sign in event logged",
        uid: "test-uid-123",
      });
    });

    it("should handle signout events without token", async () => {
      // Arrange
      mockRequest.body = {
        event: "signout",
        clientTimestamp: "2024-01-15T10:35:00.000Z",
      };

      // Act
      await authEvents(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockVerifyUser).not.toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: "Sign out event logged",
      });
    });

    it("should reject invalid event types", async () => {
      // Arrange
      mockRequest.body = {
        event: "invalid-event",
        clientTimestamp: "2024-01-15T10:30:00.000Z",
      };

      // Act
      await authEvents(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockSendError).toHaveBeenCalledWith(
        mockResponse,
        400,
        "Invalid request format",
        "ValidationError",
      );
    });

    it("should reject signin events without token", async () => {
      // Arrange
      mockRequest.body = {
        event: "signin",
        clientTimestamp: "2024-01-15T10:30:00.000Z",
      };

      // Act
      await authEvents(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockSendError).toHaveBeenCalledWith(
        mockResponse,
        400,
        "Invalid event or missing token",
        "ValidationError",
      );
    });

    it("should handle invalid Firebase tokens", async () => {
      // Arrange
      mockRequest.body = {
        event: "signin",
        firebaseAuthToken: "invalid-token",
        clientTimestamp: "2024-01-15T10:30:00.000Z",
      };

      const authError = new Error("Invalid token");
      mockVerifyUser.mockRejectedValue(authError);

      // Act
      await authEvents(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockSendError).toHaveBeenCalledWith(
        mockResponse,
        500,
        "Invalid token",
        "AuthEventError",
      );
    });

    it("should handle malformed request bodies", async () => {
      // Arrange
      mockRequest.body = {
        invalidField: "test",
      };

      // Act
      await authEvents(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockSendError).toHaveBeenCalledWith(
        mockResponse,
        400,
        "Invalid request format",
        "ValidationError",
      );
    });

    it("should log structured auth events for monitoring", async () => {
      // Arrange
      const mockDecodedUser = {
        uid: "test-uid-monitoring",
        email: "monitor@example.com",
        name: "Monitor User",
      };

      mockRequest.body = {
        event: "signin",
        firebaseAuthToken: "valid-token",
        clientTimestamp: "2024-01-15T10:30:00.000Z",
      };

      mockVerifyUser.mockResolvedValue(mockDecodedUser);

      const { logger } = await import("tttc-common/logger");
      const mockLogger = vi.mocked(logger);

      // Act
      await authEvents(mockRequest as Request, mockResponse as Response);

      // Assert
      expect(mockLogger.auth).toHaveBeenCalledWith(
        "signin",
        "test-uid-monitoring",
        "monitor@example.com",
      );
    });
  });
});
