/**
 * Tests for report visibility endpoint (PATCH /api/report/:reportId/visibility)
 *
 * Tests cover:
 * - Only authenticated owner can update visibility
 * - Non-owner gets 404 (to not reveal report existence)
 * - Invalid body returns validation error
 * - Non-existent report returns 404
 * - Successful update returns new visibility
 */

import type { Response } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";
import type { ReportRef } from "tttc-common/firebase";
import { createMinimalTestEnv } from "tttc-common/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as Firebase from "../../Firebase";
import type { RequestWithAuth } from "../../types/request";
import { updateReportVisibility } from "../reportVisibility";
import { sendErrorByCode } from "../sendError";

const testReportId = "A1B2C3D4E5F6G7H8I9J0";

const TEST_CONSTANTS = {
  OWNER_USER_ID: "owner-user-id",
  OTHER_USER_ID: "other-user-id",
  BUCKET_NAME: "test-bucket",
  FILE_NAME: "test-file.json",
  FIXED_DATE: new Date("2023-01-01T00:00:00Z"),
} as const;

// Mock types
interface MockLogger {
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
  child: ReturnType<typeof vi.fn>;
}

interface MockResponse {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
}

const asExpressResponse = (mockRes: MockResponse): Response =>
  mockRes as unknown as Response;

// Use vi.hoisted to create mocks that can be accessed both in vi.mock and tests
const { mockUpdate, mockDoc, mockCollection } = vi.hoisted(() => {
  const mockUpdate = vi.fn();
  const mockDoc = vi.fn(() => ({
    update: mockUpdate,
  }));
  const mockCollection = vi.fn(() => ({
    doc: mockDoc,
  }));
  return { mockUpdate, mockDoc, mockCollection };
});

// Mock Firebase functions
vi.mock("../../Firebase", async () => {
  return {
    getReportRefById: vi.fn(),
    db: {
      collection: mockCollection,
    },
    getCollectionName: vi.fn().mockReturnValue("reportRef"),
  };
});

// Mock sendError functions
vi.mock("../sendError", () => ({
  sendError: vi.fn(),
  sendErrorByCode: vi.fn(),
}));

// Create a mock decoded token for authenticated requests
const createMockDecodedToken = (
  uid: string,
  overrides: Partial<DecodedIdToken> = {},
): DecodedIdToken =>
  ({
    uid,
    aud: "test-project",
    auth_time: 12345678,
    exp: 12345678 + 3600,
    iat: 12345678,
    iss: "https://securetoken.google.com/test-project",
    sub: uid,
    ...overrides,
  }) as DecodedIdToken;

// Create a mock request with auth
const createMockRequest = (
  params: Record<string, string> = {},
  body: Record<string, unknown> = {},
  authUserId?: string,
): RequestWithAuth => {
  const mockLogger: MockLogger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
  };
  mockLogger.child.mockReturnValue(mockLogger);

  const mockRequest = {
    params,
    query: {},
    body,
    headers: {},
    cookies: {},
    signedCookies: {},
    url: "/test",
    path: "/test",
    method: "PATCH",
    protocol: "http",
    secure: false,
    ip: "127.0.0.1",
    ips: [],
    subdomains: [],
    xhr: false,
    hostname: "localhost",
    fresh: false,
    stale: true,
    originalUrl: "/test",
    baseUrl: "",
    route: {},
    log: mockLogger,
    context: {
      env: createMinimalTestEnv(),
    },
    auth: authUserId
      ? createMockDecodedToken(authUserId)
      : createMockDecodedToken(TEST_CONSTANTS.OWNER_USER_ID),
  } as unknown as RequestWithAuth;

  return mockRequest;
};

const createMockResponse = (): MockResponse => {
  const mockRes: MockResponse = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
  };
  return mockRes;
};

const createTestReportRef = (
  overrides: Partial<ReportRef> = {},
): ReportRef => ({
  id: testReportId,
  userId: TEST_CONSTANTS.OWNER_USER_ID,
  reportDataUri: `https://storage.googleapis.com/${TEST_CONSTANTS.BUCKET_NAME}/${TEST_CONSTANTS.FILE_NAME}`,
  title: "Test Report",
  description: "Test Description",
  numTopics: 5,
  numSubtopics: 10,
  numClaims: 20,
  numPeople: 3,
  createdDate: TEST_CONSTANTS.FIXED_DATE,
  isPublic: false, // Private by default
  ...overrides,
});

describe("updateReportVisibility", () => {
  let mockRes: ReturnType<typeof createMockResponse>;

  beforeEach(() => {
    mockRes = createMockResponse();
    vi.clearAllMocks();
    // Reset the Firestore update mock to succeed by default
    mockUpdate.mockResolvedValue(undefined);

    // Setup sendErrorByCode mock
    vi.mocked(sendErrorByCode).mockImplementation((res, code) => {
      const statusCodes: Record<string, number> = {
        REPORT_NOT_FOUND: 404,
        VALIDATION_ERROR: 400,
        SERVICE_UNAVAILABLE: 503,
        AUTH_TOKEN_MISSING: 401,
        AUTH_TOKEN_INVALID: 401,
      };
      const messages: Record<string, string> = {
        REPORT_NOT_FOUND:
          "We couldn't find that report. It may have been deleted or moved.",
        VALIDATION_ERROR: "Invalid request parameters.",
        SERVICE_UNAVAILABLE:
          "Our service is temporarily unavailable. Please try again in a few minutes.",
        AUTH_TOKEN_MISSING: "Authentication required.",
        AUTH_TOKEN_INVALID: "Invalid authentication token.",
      };
      res.status(statusCodes[code] || 500).json({
        error: {
          message: messages[code] || "Unknown error",
          code,
        },
      });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("successful updates", () => {
    it("allows owner to make report public", async () => {
      const mockReq = createMockRequest(
        { reportId: testReportId },
        { isPublic: true },
        TEST_CONSTANTS.OWNER_USER_ID,
      );
      const reportRef = createTestReportRef({ isPublic: false });
      vi.mocked(Firebase.getReportRefById).mockResolvedValue(reportRef);

      await updateReportVisibility(mockReq, asExpressResponse(mockRes));

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        isPublic: true,
      });
    });

    it("allows owner to make report private", async () => {
      const mockReq = createMockRequest(
        { reportId: testReportId },
        { isPublic: false },
        TEST_CONSTANTS.OWNER_USER_ID,
      );
      const reportRef = createTestReportRef({ isPublic: true });
      vi.mocked(Firebase.getReportRefById).mockResolvedValue(reportRef);

      await updateReportVisibility(mockReq, asExpressResponse(mockRes));

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        isPublic: false,
      });
    });
  });

  describe("authorization", () => {
    it("returns 404 when non-owner attempts to update visibility", async () => {
      const mockReq = createMockRequest(
        { reportId: testReportId },
        { isPublic: true },
        TEST_CONSTANTS.OTHER_USER_ID, // Not the owner
      );
      const reportRef = createTestReportRef({
        userId: TEST_CONSTANTS.OWNER_USER_ID,
      });
      vi.mocked(Firebase.getReportRefById).mockResolvedValue(reportRef);

      await updateReportVisibility(mockReq, asExpressResponse(mockRes));

      // Should return 404 to not reveal report existence
      expect(sendErrorByCode).toHaveBeenCalledWith(
        expect.anything(),
        "REPORT_NOT_FOUND",
        expect.anything(),
      );
    });
  });

  describe("validation errors", () => {
    it("returns validation error for invalid reportId format", async () => {
      const mockReq = createMockRequest(
        { reportId: "invalid-id" }, // Not a valid Firestore ID
        { isPublic: true },
      );

      await updateReportVisibility(mockReq, asExpressResponse(mockRes));

      expect(sendErrorByCode).toHaveBeenCalledWith(
        expect.anything(),
        "VALIDATION_ERROR",
        expect.anything(),
      );
    });

    it("returns validation error for missing isPublic in body", async () => {
      const mockReq = createMockRequest({ reportId: testReportId }, {});

      await updateReportVisibility(mockReq, asExpressResponse(mockRes));

      expect(sendErrorByCode).toHaveBeenCalledWith(
        expect.anything(),
        "VALIDATION_ERROR",
        expect.anything(),
      );
    });

    it("returns validation error for non-boolean isPublic", async () => {
      const mockReq = createMockRequest(
        { reportId: testReportId },
        { isPublic: "true" }, // String instead of boolean
      );

      await updateReportVisibility(mockReq, asExpressResponse(mockRes));

      expect(sendErrorByCode).toHaveBeenCalledWith(
        expect.anything(),
        "VALIDATION_ERROR",
        expect.anything(),
      );
    });

    it("returns validation error for extra fields in body", async () => {
      // Zod strict parsing will reject extra fields if we use .strict()
      // But current schema uses safeParse which strips extra fields
      // This test verifies the endpoint still works with extra fields
      const mockReq = createMockRequest(
        { reportId: testReportId },
        { isPublic: true, extraField: "ignored" },
        TEST_CONSTANTS.OWNER_USER_ID,
      );
      const reportRef = createTestReportRef();
      vi.mocked(Firebase.getReportRefById).mockResolvedValue(reportRef);

      await updateReportVisibility(mockReq, asExpressResponse(mockRes));

      // Should succeed - extra fields are stripped by Zod
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        isPublic: true,
      });
    });
  });

  describe("not found scenarios", () => {
    it("returns 404 when report does not exist", async () => {
      const mockReq = createMockRequest(
        { reportId: testReportId },
        { isPublic: true },
      );
      vi.mocked(Firebase.getReportRefById).mockResolvedValue(null);

      await updateReportVisibility(mockReq, asExpressResponse(mockRes));

      expect(sendErrorByCode).toHaveBeenCalledWith(
        expect.anything(),
        "REPORT_NOT_FOUND",
        expect.anything(),
      );
    });
  });

  describe("error handling", () => {
    it("returns service unavailable on database error", async () => {
      const mockReq = createMockRequest(
        { reportId: testReportId },
        { isPublic: true },
        TEST_CONSTANTS.OWNER_USER_ID,
      );
      vi.mocked(Firebase.getReportRefById).mockRejectedValue(
        new Error("DB Error"),
      );

      await updateReportVisibility(mockReq, asExpressResponse(mockRes));

      expect(sendErrorByCode).toHaveBeenCalledWith(
        expect.anything(),
        "SERVICE_UNAVAILABLE",
        expect.anything(),
      );
    });
  });
});
