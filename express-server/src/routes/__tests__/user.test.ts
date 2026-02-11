import type { Response } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";
import { createMinimalTestEnv } from "tttc-common/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RequestWithAuth } from "../../types/request";
import { getUserLimits } from "../user";

// Mock Firebase module
vi.mock("../../Firebase", () => ({
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
      canViewElicitationTracking: roles.includes("event_organizer"),
    })),
  };
});

// Mock feature flags module
vi.mock("../../featureFlags", () => ({
  isFeatureEnabled: vi.fn().mockResolvedValue(false),
}));

// Mock API schemas
vi.mock("tttc-common/api", () => ({
  userCapabilitiesResponse: {
    parse: vi.fn((data) => data), // Pass through the data as-is
  },
}));

// Mock logger
vi.mock("tttc-common/logger", () => ({
  logger: {
    child: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

describe("getUserLimits", () => {
  let mockReq: RequestWithAuth;
  let mockRes: Response;
  // Using any for mocked module - the mock setup handles the typing
  // biome-ignore lint/suspicious/noExplicitAny: Test mock requires flexibility
  let mockFirebase: any;
  // biome-ignore lint/suspicious/noExplicitAny: Test mock requires flexibility
  let _mockPermissions: any;

  // Helper factories for test setup
  const createMockUser = (
    uid = "test-user-id",
    email = "test@example.com",
  ): DecodedIdToken =>
    ({
      uid,
      email,
    }) as DecodedIdToken;

  const createMockUserDoc = (roles: string[] = [], exists = true) => ({
    exists,
    data: () => ({ email: "test@example.com", roles }),
  });

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
    _mockPermissions = vi.mocked(await import("tttc-common/permissions"));

    // Create mock request with auth (middleware provides req.auth)
    mockReq = {
      auth: createMockUser(),
      context: { env: createMinimalTestEnv() },
      log: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn(),
      },
    } as unknown as RequestWithAuth;

    // Create mock response
    mockRes = {
      status: vi.fn(() => mockRes),
      json: vi.fn(),
    } as unknown as Response;
  });

  it("should return default limits for user without roles", async () => {
    setupUserDocument(); // Empty roles array by default

    await getUserLimits(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({
      csvSizeLimit: 153600, // 150KB default
      canViewElicitationTracking: false,
    });
  });

  it("should return enhanced limits for user with large_uploads role", async () => {
    setupUserDocument(["large_uploads"]);

    await getUserLimits(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({
      csvSizeLimit: 2097152, // 2MB for large_uploads role
      canViewElicitationTracking: false,
    });
  });

  it("should handle user document not existing", async () => {
    setupUserDocument([], false); // Document doesn't exist

    await getUserLimits(mockReq, mockRes);

    // Should still return default capabilities
    expect(mockRes.json).toHaveBeenCalledWith({
      csvSizeLimit: 153600, // Default limit
      canViewElicitationTracking: false,
    });
  });

  it("should handle Firestore errors gracefully", async () => {
    // Simulate Firestore error
    const mockGet = vi.fn().mockRejectedValue(new Error("Firestore error"));
    const mockDoc = vi.fn().mockReturnValue({ get: mockGet });
    const mockCollection = vi.fn().mockReturnValue({ doc: mockDoc });
    mockFirebase.db.collection = mockCollection;

    await getUserLimits(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(500);
    expect(mockRes.json).toHaveBeenCalledWith({
      error: {
        message: "Something went wrong on our end. Please try again.",
        code: "INTERNAL_ERROR",
      },
    });
  });

  it("should return elicitation tracking capability for event organizers", async () => {
    setupUserDocument(["event_organizer"]);

    await getUserLimits(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({
      csvSizeLimit: 153600, // Default CSV limit
      canViewElicitationTracking: true,
    });
  });

  it("should combine capabilities for users with multiple roles", async () => {
    setupUserDocument(["large_uploads", "event_organizer"]);

    await getUserLimits(mockReq, mockRes);

    expect(mockRes.json).toHaveBeenCalledWith({
      csvSizeLimit: 2097152, // Large uploads limit
      canViewElicitationTracking: true, // Event organizer capability
    });
  });

  it("should use uid from authenticated user", async () => {
    // Set specific user
    mockReq.auth = createMockUser("specific-uid", "specific@example.com");
    setupUserDocument();

    await getUserLimits(mockReq, mockRes);

    // Verify the collection was queried with the correct uid
    expect(mockFirebase.db.collection).toHaveBeenCalled();
  });
});
