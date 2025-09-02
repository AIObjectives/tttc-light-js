import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Response } from "express";
import { RequestWithLogger } from "../../types/request";
import authEvents from "../authEvents";
import { verifyUser } from "../../Firebase";
import { sendError } from "../sendError.js";
import { Logger } from "pino";

// Mock Firebase functions
vi.mock("../../Firebase", () => ({
  verifyUser: vi.fn(),
}));

// Mock sendError utility
vi.mock("../sendError.js", () => ({
  sendError: vi.fn(),
}));

// Mock logger
vi.mock("tttc-common/logger", () => {
  const mockLogger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    auth: vi.fn(),
    child: vi.fn(),
  };
  mockLogger.child.mockReturnValue(mockLogger);
  return {
    logger: mockLogger,
  };
});

describe("Auth Events Route", () => {
  let mockVerifyUser: any;
  let mockSendError: any;
  let mockLogger: Logger;

  const createMockRequest = (body: any = {}): RequestWithLogger => {
    return {
      body,
      log: mockLogger,
    } as RequestWithLogger;
  };

  const createMockResponse = (): Partial<Response> => {
    return {
      json: vi.fn(),
      status: vi.fn().mockReturnThis(),
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockVerifyUser = vi.mocked(verifyUser);
    mockSendError = vi.mocked(sendError);

    mockLogger = {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      trace: vi.fn(),
      fatal: vi.fn(),
      child: vi.fn(),
      level: "info",
      silent: false,
    } as any;
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

      const mockRequest = createMockRequest({
        event: "signin",
        firebaseAuthToken: "valid-token",
        clientTimestamp: "2024-01-15T10:30:00.000Z",
      });
      const mockResponse = createMockResponse();

      mockVerifyUser.mockResolvedValue(mockDecodedUser);

      // Act
      await authEvents(mockRequest, mockResponse as Response);

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
      const mockRequest = createMockRequest({
        event: "signout",
        clientTimestamp: "2024-01-15T10:35:00.000Z",
      });
      const mockResponse = createMockResponse();

      // Act
      await authEvents(mockRequest, mockResponse as Response);

      // Assert
      expect(mockVerifyUser).not.toHaveBeenCalled();
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: "Sign out event logged",
      });
    });

    it("should reject invalid event types", async () => {
      // Arrange
      const mockRequest = createMockRequest({
        event: "invalid-event",
        clientTimestamp: "2024-01-15T10:30:00.000Z",
      });
      const mockResponse = createMockResponse();

      // Act
      await authEvents(mockRequest, mockResponse as Response);

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
      const mockRequest = createMockRequest({
        event: "signin",
        clientTimestamp: "2024-01-15T10:30:00.000Z",
      });
      const mockResponse = createMockResponse();

      // Act
      await authEvents(mockRequest, mockResponse as Response);

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
      const mockRequest = createMockRequest({
        event: "signin",
        firebaseAuthToken: "invalid-token",
        clientTimestamp: "2024-01-15T10:30:00.000Z",
      });
      const mockResponse = createMockResponse();

      const authError = new Error("Invalid token");
      mockVerifyUser.mockRejectedValue(authError);

      // Act
      await authEvents(mockRequest, mockResponse as Response);

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
      const mockRequest = createMockRequest({
        invalidField: "test",
      });
      const mockResponse = createMockResponse();

      // Act
      await authEvents(mockRequest, mockResponse as Response);

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

      const mockRequest = createMockRequest({
        event: "signin",
        firebaseAuthToken: "valid-token",
        clientTimestamp: "2024-01-15T10:30:00.000Z",
      });
      const mockResponse = createMockResponse();

      mockVerifyUser.mockResolvedValue(mockDecodedUser);

      // Act
      await authEvents(mockRequest, mockResponse as Response);

      // Assert
      expect(mockLogger.info).toHaveBeenCalledWith(
        { uid: "test-uid-monitoring", email: "monitor@example.com" },
        "User signing in",
      );
    });
  });
});
