import type { NextFunction, Response } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authMiddleware } from "../middleware";
import type { RequestWithAuth, RequestWithLogger } from "../types/request";

// Mock Firebase module
vi.mock("../Firebase", () => ({
  verifyUser: vi.fn(),
}));

// Mock sendError module
vi.mock("../routes/sendError", () => ({
  sendErrorByCode: vi.fn(),
}));

describe("authMiddleware", () => {
  let mockReq: RequestWithLogger;
  let mockRes: Response;
  let mockNext: NextFunction;
  let mockVerifyUser: ReturnType<typeof vi.fn>;
  let mockSendErrorByCode: ReturnType<typeof vi.fn>;

  const createMockDecodedToken = (
    uid = "test-uid",
    email = "test@example.com",
  ): DecodedIdToken =>
    ({
      uid,
      email,
      aud: "test-project",
      auth_time: Date.now(),
      exp: Date.now() + 3600,
      iat: Date.now(),
      iss: "https://securetoken.google.com/test-project",
      sub: uid,
    }) as DecodedIdToken;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Get mocked functions
    const firebase = await import("../Firebase");
    mockVerifyUser = vi.mocked(firebase.verifyUser);

    const sendError = await import("../routes/sendError");
    mockSendErrorByCode = vi.mocked(sendError.sendErrorByCode);

    // Create mock request with logger
    mockReq = {
      headers: {},
      body: {},
      log: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      },
    } as unknown as RequestWithLogger;

    // Create mock response
    mockRes = {
      status: vi.fn(() => mockRes),
      json: vi.fn(),
    } as unknown as Response;

    // Create mock next function
    mockNext = vi.fn();
  });

  describe("token extraction", () => {
    it("should extract Bearer token from Authorization header", async () => {
      mockReq.headers.authorization = "Bearer valid-token";
      mockVerifyUser.mockResolvedValue(createMockDecodedToken());

      const middleware = authMiddleware();
      await middleware(mockReq, mockRes, mockNext);

      expect(mockVerifyUser).toHaveBeenCalledWith("valid-token");
      expect(mockNext).toHaveBeenCalled();
    });

    it("should trim extra spaces after Bearer", async () => {
      mockReq.headers.authorization = "Bearer   token-with-spaces";
      mockVerifyUser.mockResolvedValue(createMockDecodedToken());

      const middleware = authMiddleware();
      await middleware(mockReq, mockRes, mockNext);

      // Trims leading/trailing whitespace per RFC 6750
      expect(mockVerifyUser).toHaveBeenCalledWith("token-with-spaces");
    });

    it("should reject missing Authorization header", async () => {
      mockReq.headers.authorization = undefined;

      const middleware = authMiddleware();
      await middleware(mockReq, mockRes, mockNext);

      expect(mockSendErrorByCode).toHaveBeenCalledWith(
        mockRes,
        "AUTH_TOKEN_MISSING",
        mockReq.log,
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject non-Bearer authorization", async () => {
      mockReq.headers.authorization = "Basic dXNlcjpwYXNz";

      const middleware = authMiddleware();
      await middleware(mockReq, mockRes, mockNext);

      expect(mockSendErrorByCode).toHaveBeenCalledWith(
        mockRes,
        "AUTH_TOKEN_MISSING",
        mockReq.log,
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject Bearer with no token", async () => {
      mockReq.headers.authorization = "Bearer ";

      const middleware = authMiddleware();
      await middleware(mockReq, mockRes, mockNext);

      expect(mockSendErrorByCode).toHaveBeenCalledWith(
        mockRes,
        "AUTH_TOKEN_MISSING",
        mockReq.log,
      );
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe("token verification", () => {
    it("should attach decoded user to req.auth on success", async () => {
      const decodedToken = createMockDecodedToken("user-123", "user@test.com");
      mockReq.headers.authorization = "Bearer valid-token";
      mockVerifyUser.mockResolvedValue(decodedToken);

      const middleware = authMiddleware();
      await middleware(mockReq, mockRes, mockNext);

      expect((mockReq as RequestWithAuth).auth).toEqual(decodedToken);
      expect((mockReq as RequestWithAuth).auth.uid).toBe("user-123");
      expect((mockReq as RequestWithAuth).auth.email).toBe("user@test.com");
    });

    it("should return AUTH_TOKEN_INVALID when verification fails", async () => {
      mockReq.headers.authorization = "Bearer invalid-token";
      mockVerifyUser.mockRejectedValue(new Error("Token expired"));

      const middleware = authMiddleware();
      await middleware(mockReq, mockRes, mockNext);

      expect(mockSendErrorByCode).toHaveBeenCalledWith(
        mockRes,
        "AUTH_TOKEN_INVALID",
        mockReq.log,
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should log warning when verification fails", async () => {
      const tokenError = new Error("Firebase auth error");
      mockReq.headers.authorization = "Bearer bad-token";
      mockVerifyUser.mockRejectedValue(tokenError);

      const middleware = authMiddleware();
      await middleware(mockReq, mockRes, mockNext);

      expect(mockReq.log.warn).toHaveBeenCalledWith(
        { error: tokenError },
        "Token verification failed",
      );
    });
  });

  describe("logging", () => {
    it("should log warning when token is missing", async () => {
      mockReq.headers.authorization = undefined;

      const middleware = authMiddleware();
      await middleware(mockReq, mockRes, mockNext);

      expect(mockReq.log.warn).toHaveBeenCalledWith("Auth token missing");
    });
  });
});
