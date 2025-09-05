import { describe, it, expect, vi, beforeEach } from "vitest";
import { Response } from "express";
import { RequestWithLogger } from "../../types/request";
import { getUserLimits } from "../user";
import { createMinimalTestEnv } from "../../__tests__/helpers";

// Mock Firebase module
vi.mock("../../Firebase", () => ({
  verifyUser: vi.fn(),
  db: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn(),
      })),
    })),
  },
  getCollectionName: vi.fn((name: string) => `${name}_test`),
}));

// Mock permissions module
vi.mock("tttc-common/permissions", () => {
  const LARGE_UPLOAD_LIMIT = 2 * 1024 * 1024; // 2MB
  const DEFAULT_LIMIT = 150 * 1024; // 150KB

  return {
    getUserCapabilities: vi.fn((roles: string[]) => ({
      csvSizeLimit: roles.includes("large_uploads")
        ? LARGE_UPLOAD_LIMIT
        : DEFAULT_LIMIT,
    })),
  };
});

// Mock feature flags module
vi.mock("../../featureFlags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(false),
}));

// Mock logger
vi.mock("tttc-common/logger", () => ({
  logger: {
    child: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

describe("getUserLimits", () => {
  let mockReq: RequestWithLogger;
  let mockRes: Response;
  let mockFirebase: any;
  let mockPermissions: any;

  // Helper factories for test setup
  const createMockUser = (
    uid = "test-user-id",
    email = "test@example.com",
  ) => ({
    uid,
    email,
  });

  const createMockUserDoc = (roles: string[] = [], exists = true) => ({
    exists,
    data: () => ({ email: "test@example.com", roles }),
  });

  const setupUserVerification = (user = createMockUser()) => {
    mockFirebase.verifyUser.mockResolvedValue(user);
  };

  const setupUserDocument = (roles: string[] = [], exists = true) => {
    const mockUserDoc = createMockUserDoc(roles, exists);
    const mockGet = vi.fn().mockResolvedValue(mockUserDoc);
    const mockDoc = vi.fn().mockReturnValue({ get: mockGet });
    const mockCollection = vi.fn().mockReturnValue({ doc: mockDoc });
    mockFirebase.db.collection = mockCollection;
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Setup mocks
    mockFirebase = vi.mocked(await import("../../Firebase.js"));
    mockPermissions = vi.mocked(await import("tttc-common/permissions"));

    // Create mock request with logger
    mockReq = {
      headers: {
        authorization: "Bearer test-token",
      },
      context: { env: createMinimalTestEnv() },
      log: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      },
    } as unknown as RequestWithLogger;

    // Create mock response
    mockRes = {
      status: vi.fn(() => mockRes),
      json: vi.fn(),
    } as unknown as Response;
  });

  it("should return default limits for user without roles", async () => {
    setupUserVerification();
    setupUserDocument(); // Empty roles array by default

    await getUserLimits(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({
      csvSizeLimit: 153600, // 150KB default
    });
  });

  it("should return enhanced limits for user with large_uploads role", async () => {
    setupUserVerification();
    setupUserDocument(["large_uploads"]);

    await getUserLimits(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({
      csvSizeLimit: 2097152, // 2MB for large_uploads role
    });
  });

  it("should return 401 when no authorization token provided", async () => {
    mockReq.headers = {};

    await getUserLimits(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: {
        message: "No authorization token provided",
      },
    });
  });

  it("should return 401 when token is invalid", async () => {
    mockFirebase.verifyUser.mockResolvedValue(null);

    await getUserLimits(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: {
        message: "Invalid authorization token",
      },
    });
  });

  it("should handle user document not existing", async () => {
    setupUserVerification();
    setupUserDocument([], false); // Document doesn't exist

    await getUserLimits(mockReq, mockRes);

    // Should still return default capabilities
    expect(mockRes.json).toHaveBeenCalledWith({
      csvSizeLimit: 153600, // Default limit
    });
  });

  it("should handle errors gracefully", async () => {
    mockFirebase.verifyUser.mockRejectedValue(new Error("Database error"));

    await getUserLimits(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: {
        message: "Failed to retrieve user limits",
      },
    });
  });

  it("should extract Bearer token correctly", async () => {
    mockReq.headers.authorization = "Bearer   test-token-with-spaces";
    setupUserVerification();
    setupUserDocument();

    await getUserLimits(mockReq, mockRes);

    expect(mockFirebase.verifyUser).toHaveBeenCalledWith(
      "  test-token-with-spaces",
    );
  });
});
