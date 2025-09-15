import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { Response } from "express";
import { RequestWithLogger } from "../../types/request";
import { getUnifiedReportHandler, migrateReportUrlHandler } from "../report";
import * as Firebase from "../../Firebase";
import { ReportRef } from "tttc-common/firebase";
import { Bucket } from "../../storage";
import { pipelineQueue } from "../../server";
import { sendError } from "../sendError";
import { createMinimalTestEnv } from "../../__tests__/helpers";

const testReportId = "A1B2C3D4E5F6G7H8I9J0";

// Test constants to avoid magic strings
const TEST_CONSTANTS = {
  USER_ID: "test-user",
  BUCKET_NAME: "test-bucket",
  FILE_NAME: "test-file.json",
  LEGACY_FILE: "legacy-file.json",
  SIGNED_URL: "https://signed-url.com",
  LEGACY_SIGNED_URL: "https://legacy-signed-url.com",
  JOB_ID: "test-job-id",
  FIXED_DATE: new Date("2023-01-01T00:00:00Z"), // Fixed date for deterministic tests
} as const;

// Type definitions for mocks
interface MockLogger {
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
  child: ReturnType<typeof vi.fn>;
}

interface MockJob {
  progress: Promise<{ status: string }>;
}

interface MockStorage {
  getUrl: ReturnType<typeof vi.fn>;
  // Add other Bucket methods as needed for testing
  name?: string;
  storage?: unknown;
  bucket?: unknown;
  decodeCredentials?: ReturnType<typeof vi.fn>;
  parseUri?: ReturnType<typeof vi.fn>;
  upload?: ReturnType<typeof vi.fn>;
  delete?: ReturnType<typeof vi.fn>;
}

// Mock response type that implements only the methods used in our handlers
interface MockResponse {
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
}

// Helper to cast mock response as Express Response for testing
// This approach is cleaner than trying to implement all Express Response properties
const asExpressResponse = (mockRes: MockResponse): Response =>
  mockRes as unknown as Response;

// Mock the server pipeline queue import
vi.mock("../../server", () => ({
  pipelineQueue: {
    getJobState: vi.fn(),
    getJob: vi.fn(),
  },
}));

// Create a focused mock request factory for testing
const createMockRequest = (
  params: Record<string, string> = {},
): RequestWithLogger => {
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
    body: {},
    headers: {},
    cookies: {},
    signedCookies: {},
    url: "/test",
    path: "/test",
    method: "GET",
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
  } as unknown as RequestWithLogger;

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

// Mock Firebase functions
vi.mock("../../Firebase", async () => {
  return {
    findReportRefByUri: vi.fn(),
    getReportRefById: vi.fn(),
    getReportVersion: vi.fn(),
  };
});

// Mock Bucket class
vi.mock("../../storage", () => ({
  Bucket: vi.fn(),
}));

// Mock tttc-common/utils for validation functions
vi.mock("tttc-common/utils", () => ({
  FIRESTORE_ID_REGEX: /^[A-Za-z0-9]{20}$/,
}));

// Mock sendError function
vi.mock("../sendError", () => ({
  sendError: vi.fn(),
}));

// Test data factories to reduce duplication
const createTestReportRef = (
  overrides: Partial<ReportRef> = {},
): ReportRef => ({
  id: testReportId,
  userId: TEST_CONSTANTS.USER_ID,
  reportDataUri: `https://storage.googleapis.com/${TEST_CONSTANTS.BUCKET_NAME}/${TEST_CONSTANTS.FILE_NAME}`,
  title: "Test Report",
  description: "Test Description",
  numTopics: 5,
  numSubtopics: 10,
  numClaims: 20,
  numPeople: 3,
  createdDate: TEST_CONSTANTS.FIXED_DATE,
  jobId: TEST_CONSTANTS.JOB_ID,
  ...overrides,
});

const createMockStorage = (
  urlValue: string = TEST_CONSTANTS.SIGNED_URL,
  shouldFail = false,
): MockStorage => ({
  getUrl: vi
    .fn()
    .mockResolvedValue(
      shouldFail
        ? { tag: "failure", error: new Error("Storage service unavailable") }
        : { tag: "success", value: urlValue },
    ),
});

const setupStorageMock = (storage: MockStorage) => {
  vi.mocked(Bucket).mockReturnValue(
    storage as unknown as InstanceType<typeof Bucket>,
  );
};

const setupRequestParams = (
  params: Record<string, string>,
  req: RequestWithLogger,
) => {
  req.params = { ...req.params, ...params };
};

describe("Report Routes", () => {
  let mockReq: RequestWithLogger;
  let mockRes: ReturnType<typeof createMockResponse>;

  beforeEach(() => {
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    vi.clearAllMocks();

    // Setup sendError mock to behave like the real function
    vi.mocked(sendError).mockImplementation(
      (res, status, message, errorCode) => {
        res.status(status).json({
          error: {
            message,
            ...(errorCode ? { code: errorCode } : {}),
          },
        });
      },
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getUnifiedReportHandler", () => {
    it("should handle Firebase ID and return finished report", async () => {
      const testReportRef = createTestReportRef();
      const mockStorage = createMockStorage();

      setupRequestParams({ identifier: testReportId }, mockReq);
      vi.mocked(Firebase.getReportRefById).mockResolvedValue(testReportRef);

      // Mock job status as finished
      const mockJob: MockJob = {
        progress: Promise.resolve({ status: "finished" }),
      };
      vi.mocked(pipelineQueue.getJobState).mockResolvedValue("completed");
      vi.mocked(pipelineQueue.getJob).mockResolvedValue(mockJob);

      setupStorageMock(mockStorage);

      await getUnifiedReportHandler(mockReq, asExpressResponse(mockRes));

      expect(mockRes.json).toHaveBeenCalledWith({
        status: "finished",
        dataUrl: TEST_CONSTANTS.SIGNED_URL,
        metadata: testReportRef,
      });
    });

    it("should handle legacy bucket URL", async () => {
      const legacyIdentifier = `${TEST_CONSTANTS.BUCKET_NAME}/${TEST_CONSTANTS.LEGACY_FILE}`;
      const mockStorage = createMockStorage(TEST_CONSTANTS.LEGACY_SIGNED_URL);

      mockReq.params = {
        identifier: legacyIdentifier,
        reportUri: legacyIdentifier,
      };

      setupStorageMock(mockStorage);

      await getUnifiedReportHandler(mockReq, asExpressResponse(mockRes));

      expect(mockRes.json).toHaveBeenCalledWith({
        status: "finished",
        dataUrl: TEST_CONSTANTS.LEGACY_SIGNED_URL,
      });
    });

    it("should handle processing report", async () => {
      const testReportRef = createTestReportRef({
        reportDataUri: "", // Processing report has no URI yet
        numTopics: 0,
        numSubtopics: 0,
        numClaims: 0,
        numPeople: 0,
      });

      mockReq.params = { identifier: testReportId };
      vi.mocked(Firebase.getReportRefById).mockResolvedValue(testReportRef);

      // Mock job status as processing
      vi.mocked(pipelineQueue.getJobState).mockResolvedValue("active");
      const mockJob: MockJob = {
        progress: Promise.resolve({ status: "clustering" }),
      };
      vi.mocked(pipelineQueue.getJob).mockResolvedValue(mockJob);

      await getUnifiedReportHandler(mockReq, asExpressResponse(mockRes));

      expect(mockRes.json).toHaveBeenCalledWith({
        status: "clustering",
        metadata: testReportRef,
      });
    });

    it("should handle report not found", async () => {
      mockReq.params = { identifier: testReportId };
      vi.mocked(Firebase.getReportRefById).mockResolvedValue(null);

      await getUnifiedReportHandler(mockReq, asExpressResponse(mockRes));

      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          code: "ReportNotFound",
          message: "Report not found",
        },
      });
    });

    it("should handle storage errors gracefully", async () => {
      const testReportRef = createTestReportRef();
      const mockStorage = createMockStorage("", true); // shouldFail = true

      mockReq.params = { identifier: testReportId };
      vi.mocked(Firebase.getReportRefById).mockResolvedValue(testReportRef);

      // Mock job as completed
      vi.mocked(pipelineQueue.getJobState).mockResolvedValue("completed");

      setupStorageMock(mockStorage);

      await getUnifiedReportHandler(mockReq, asExpressResponse(mockRes));

      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          code: "GetUrlError",
          message: "Failed to generate report URL",
        },
      });
    });

    it("should validate Firebase ID format", async () => {
      // Test invalid Firebase ID (too short)
      mockReq.params = { identifier: "invalid-id" };

      await getUnifiedReportHandler(mockReq, asExpressResponse(mockRes));

      // Should be treated as legacy URL and fail parsing
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          code: "ReportNotFound",
          message: "Report not found",
        },
      });
    });

    it("should handle malicious input safely", async () => {
      // Test path traversal attempt
      const maliciousId = "../../../etc/passwd";
      mockReq.params = { identifier: maliciousId };

      await getUnifiedReportHandler(mockReq, asExpressResponse(mockRes));

      // Should fail safely - malicious input is treated as legacy URL and fails parsing
      // This is acceptable as it doesn't expose system paths and fails securely
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          code: "GetUrlError",
          message: "Failed to generate report URL",
        },
      });

      // Ensure Firebase functions are not called with malicious input
      expect(Firebase.getReportRefById).not.toHaveBeenCalled();
    });

    it("should handle XSS attempts in identifiers", async () => {
      const xssAttempt = '<script>alert("xss")</script>';
      mockReq.params = { identifier: xssAttempt };

      await getUnifiedReportHandler(mockReq, asExpressResponse(mockRes));

      // XSS attempt is treated as legacy URL and fails safely
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          code: "GetUrlError",
          message: "Failed to generate report URL",
        },
      });
    });
  });

  describe("Integration Tests", () => {
    it("should handle the transition from Firebase ID to legacy URL fallback", async () => {
      const invalidFirebaseId = "invalid-format";
      const mockStorage = createMockStorage();

      mockReq.params = { identifier: invalidFirebaseId };

      // Mock Firebase to return null (not found) for invalid format
      // This will cause it to fallback to legacy handling
      setupStorageMock(mockStorage);

      await getUnifiedReportHandler(mockReq, asExpressResponse(mockRes));

      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          code: "ReportNotFound",
          message: "Report not found",
        },
      });
    });

    it("should handle route parameter mismatch gracefully", async () => {
      // Test that getBucketAndFileName works with both parameter names
      const testUri = `${TEST_CONSTANTS.BUCKET_NAME}/${TEST_CONSTANTS.FILE_NAME}`;

      // Test with reportUri parameter (migration route)
      mockReq.params = { reportUri: testUri };
      await migrateReportUrlHandler(mockReq, asExpressResponse(mockRes));

      expect(Firebase.findReportRefByUri).toHaveBeenCalled();

      // Reset mocks
      vi.clearAllMocks();
      mockRes = createMockResponse();

      // Test with identifier parameter (unified route)
      mockReq.params = { identifier: testUri };
      const mockStorage = createMockStorage();
      setupStorageMock(mockStorage);

      await getUnifiedReportHandler(mockReq, asExpressResponse(mockRes));

      expect(mockRes.json).toHaveBeenCalledWith({
        status: "finished",
        dataUrl: TEST_CONSTANTS.SIGNED_URL,
      });
    });

    it("should maintain consistent error handling across all endpoints", async () => {
      const testId = testReportId;

      // Test unified handler error
      mockReq.params = { identifier: testId };
      vi.mocked(Firebase.getReportRefById).mockRejectedValue(
        new Error("DB Error"),
      );

      await getUnifiedReportHandler(mockReq, asExpressResponse(mockRes));

      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          code: "ReportServiceError",
          message: "Report service temporarily unavailable",
        },
      });

      // Reset and test migration handler error
      vi.clearAllMocks();
      mockRes = createMockResponse();

      const testUri = `${TEST_CONSTANTS.BUCKET_NAME}/${TEST_CONSTANTS.FILE_NAME}`;
      mockReq.params = { reportUri: testUri };
      vi.mocked(Firebase.findReportRefByUri).mockRejectedValue(
        new Error("DB Error"),
      );

      await migrateReportUrlHandler(mockReq, asExpressResponse(mockRes));

      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          code: "MigrationError",
          message: "Migration service temporarily unavailable",
        },
      });
    });
  });
});
