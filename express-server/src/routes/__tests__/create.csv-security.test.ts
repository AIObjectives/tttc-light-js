/**
 * Server-side CSV security validation tests for create route
 */

import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import request from "supertest";
import express from "express";
import create from "../create";
import {
  validateParsedData,
  detectCSVInjection,
} from "tttc-common/csv-security";

// Mock dependencies
vi.mock("tttc-common/csv-security", () => ({
  validateParsedData: vi.fn(),
  detectCSVInjection: vi.fn(),
}));

vi.mock("../../Firebase", () => ({
  verifyUser: vi
    .fn()
    .mockResolvedValue({ uid: "test-user", email: "test@example.com" }),
  ensureUserDocument: vi.fn().mockResolvedValue(undefined),
  addReportJob: vi.fn().mockResolvedValue("job-id-123"),
  addReportRef: vi.fn().mockResolvedValue("job-id-123"),
  createReportJobAndRef: vi.fn().mockResolvedValue({
    jobId: "job-id-123",
    reportId: "report-id-123",
  }),
  updateReportJobDataUri: vi.fn().mockResolvedValue(undefined),
  updateReportRefDataUri: vi.fn().mockResolvedValue(undefined),
  db: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({
        get: vi.fn(),
        set: vi.fn(),
        update: vi.fn(),
      })),
    })),
  },
  getCollectionName: vi.fn((collection) => `test-${collection.toLowerCase()}`),
  admin: {
    firestore: vi.fn(),
  },
}));

vi.mock("../../storage", () => ({
  createStorage: vi.fn().mockReturnValue({
    save: vi
      .fn()
      .mockResolvedValue({ tag: "success", value: "http://test-url.com" }),
  }),
}));

vi.mock("../../server", () => ({
  pipelineQueue: {
    add: vi.fn(),
  },
}));

describe("CSV Security in Create Route", () => {
  let app: express.Application;

  beforeAll(() => {
    // Setup Express app once for all tests
    app = express();
    app.use(express.json());

    // Mock request context with minimal test env
    app.use((req, _res, next) => {
      req.context = {
        env: {
          OPENAI_API_KEY: "sk-test-key-123",
          CLIENT_BASE_URL: "http://localhost:3000",
          PYSERVER_URL: "http://localhost:8000",
          GCLOUD_STORAGE_BUCKET: "test-bucket",
          GOOGLE_CREDENTIALS_ENCODED: "test-google-credentials",
          ALLOWED_GCS_BUCKETS: ["test-bucket"],
          FIREBASE_CREDENTIALS_ENCODED: "test-firebase-credentials",
          REDIS_URL: "redis://localhost:6379",
          REDIS_QUEUE_NAME: "test-queue",
          ALLOWED_ORIGINS: ["http://localhost:3000"],
          NODE_ENV: "development" as const,
          FEATURE_FLAG_PROVIDER: "local" as const,
          FEATURE_FLAG_HOST: "https://us.i.posthog.com",
          ANALYTICS_PROVIDER: "local" as const,
          ANALYTICS_HOST: "https://app.posthog.com",
          ANALYTICS_ENABLED: false,
          ANALYTICS_FLUSH_AT: 20,
          ANALYTICS_FLUSH_INTERVAL: 10000,
          ANALYTICS_DEBUG: false,
          RATE_LIMIT_PREFIX: "test",
          PYSERVER_MAX_CONCURRENCY: 5,
        },
      };
      // Mock logger for RequestWithLogger interface
      const mockLogger = {
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

      mockLogger.child.mockReturnValue(mockLogger);
      req.log = mockLogger;
      next();
    });

    app.post("/create", create);
  });

  beforeEach(() => {
    // Clear mocks before each test for proper isolation
    vi.clearAllMocks();
  });

  const createValidRequestBody = (csvData: any[]) => ({
    firebaseAuthToken: "valid-token",
    userConfig: {
      title: "Test Report",
      description: "Test Description",
      systemInstructions: "Test System",
      clusteringInstructions: "Test Clustering",
      extractionInstructions: "Test Extraction",
      dedupInstructions: "Test Dedup",
      summariesInstructions: "Test Summaries",
      cruxInstructions: "Test Crux",
      cruxesEnabled: false,
    },
    data: ["csv", csvData],
  });

  const setupSecurityValidationMocks = (
    shouldFailInitialValidation: boolean,
    injectionFieldValues: Record<string, boolean> = {},
  ) => {
    if (shouldFailInitialValidation) {
      (validateParsedData as any).mockReturnValue({
        tag: "failure",
        error: {
          tag: "INJECTION_ATTEMPT",
          message: "Formula injection detected",
        },
      });
    } else {
      (validateParsedData as any).mockReturnValue({
        tag: "success",
        value: [],
      });
    }

    (detectCSVInjection as any).mockImplementation((content: string) => {
      return injectionFieldValues[content] || false;
    });
  };

  it("should reject CSV data with injection attempts", async () => {
    const maliciousData = [
      { comment: "=cmd|calc", id: "1", interview: "Attacker" },
      { comment: "Normal comment", id: "2", interview: "Alice" },
    ];

    setupSecurityValidationMocks(true);

    const response = await request(app)
      .post("/create")
      .send(createValidRequestBody(maliciousData))
      .expect(500);

    expect(response.body.error.message).toContain(
      "CSV security validation failed",
    );
    expect(validateParsedData).toHaveBeenCalledWith(maliciousData);
  });

  it("should reject CSV data with injection in comment field", async () => {
    const maliciousData = [
      { comment: "=SUM(A1:A10)", id: "1", interview: "Alice" },
    ];

    setupSecurityValidationMocks(false, { "=SUM(A1:A10)": true });

    const response = await request(app)
      .post("/create")
      .send(createValidRequestBody(maliciousData))
      .expect(500);

    expect(response.body.error.message).toContain(
      "Potential injection detected in comment field",
    );
    expect(detectCSVInjection).toHaveBeenCalledWith("=SUM(A1:A10)");
  });

  it("should reject CSV data with injection in interview field", async () => {
    const maliciousData = [
      { comment: "Normal comment", id: "1", interview: "javascript:alert(1)" },
    ];

    setupSecurityValidationMocks(false, { "javascript:alert(1)": true });

    const response = await request(app)
      .post("/create")
      .send(createValidRequestBody(maliciousData))
      .expect(500);

    expect(response.body.error.message).toContain(
      "Potential injection detected in interview field",
    );
    expect(detectCSVInjection).toHaveBeenCalledWith("javascript:alert(1)");
  });

  it("should accept clean CSV data", async () => {
    const cleanData = [
      { comment: "This is a normal comment", id: "1", interview: "Alice" },
      { comment: "Another safe comment", id: "2", interview: "Bob" },
    ];

    setupSecurityValidationMocks(false);

    const response = await request(app)
      .post("/create")
      .send(createValidRequestBody(cleanData))
      .expect(200);
    expect(response.body.message).toBe("Request received.");
    expect(validateParsedData).toHaveBeenCalledWith(cleanData);
    expect(detectCSVInjection).toHaveBeenCalledWith("This is a normal comment");
    expect(detectCSVInjection).toHaveBeenCalledWith("Alice");
  });

  it("should handle non-string fields safely", async () => {
    const dataWithNonStrings = [
      { comment: "Normal comment", id: "1", interview: "Alice" },
      { comment: "Another comment", id: "2", interview: "Bob" },
    ];

    setupSecurityValidationMocks(false);

    const response = await request(app)
      .post("/create")
      .send(createValidRequestBody(dataWithNonStrings))
      .expect(200);
    expect(response.body.message).toBe("Request received.");

    // Should call detectCSVInjection for all string values
    expect(detectCSVInjection).toHaveBeenCalledWith("Normal comment");
    expect(detectCSVInjection).toHaveBeenCalledWith("Another comment");
    expect(detectCSVInjection).toHaveBeenCalledWith("Alice");
    expect(detectCSVInjection).toHaveBeenCalledWith("Bob");
  });

  it("should handle validation errors gracefully", async () => {
    const testData = [{ comment: "Test comment", id: "1", interview: "Alice" }];

    (validateParsedData as any).mockReturnValue({
      tag: "failure",
      error: {
        tag: "MALFORMED_STRUCTURE",
        message: "Data is not properly structured",
      },
    });

    const response = await request(app)
      .post("/create")
      .send(createValidRequestBody(testData))
      .expect(500);

    expect(response.body.error.message).toContain(
      "CSV security validation failed",
    );
    expect(response.body.error.message).toContain("MALFORMED_STRUCTURE");
  });
});
