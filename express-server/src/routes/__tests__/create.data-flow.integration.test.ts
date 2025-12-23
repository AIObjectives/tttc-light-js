/**
 * End-to-End Data Flow Integration Test
 *
 * Tests the complete data transformation pipeline from client submission
 * through server validation to storage, ensuring data integrity at each step.
 */

import type { RequestHandler } from "express";
import express from "express";
import request from "supertest";
import { validateParsedData } from "tttc-common/csv-security";
import type { SourceRow } from "tttc-common/schema";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { authMiddleware } from "../../middleware";
import create from "../create";

// Hoist mocks to avoid initialization errors
const { mockStorageSave, mockQueueEnqueue } = vi.hoisted(() => ({
  mockStorageSave: vi.fn(),
  mockQueueEnqueue: vi.fn(),
}));

// Mock dependencies
vi.mock("tttc-common/csv-security", () => ({
  validateParsedData: vi.fn(),
  detectCSVInjection: vi.fn(() => false), // Default to no injection
}));

vi.mock("../../Firebase", () => ({
  verifyUser: vi
    .fn()
    .mockResolvedValue({ uid: "test-user", email: "test@example.com" }),
  ensureUserDocument: vi.fn().mockResolvedValue(undefined),
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
}));

vi.mock("../../storage", () => ({
  createStorage: vi.fn().mockReturnValue({
    save: mockStorageSave,
  }),
}));

vi.mock("../../server", () => ({
  pipelineQueue: {
    enqueue: mockQueueEnqueue,
  },
}));

describe("End-to-End Data Flow Integration", () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Mock request context
    app.use((req, _res, next) => {
      req.context = {
        env: {
          OPENAI_API_KEY: "sk-test-key",
          CLIENT_BASE_URL: "http://localhost:3000",
          PYSERVER_URL: "http://localhost:8000",
          GCLOUD_STORAGE_BUCKET: "test-bucket",
          GOOGLE_CREDENTIALS_ENCODED: "test-google-creds",
          ALLOWED_GCS_BUCKETS: ["test-bucket"],
          FIREBASE_CREDENTIALS_ENCODED: "test-firebase-creds",
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
          PUBSUB_TOPIC_NAME: "test-topic",
          PUBSUB_SUBSCRIPTION_NAME: "test-sub",
        },
      };
      req.log = {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      } as any;
      next();
    });

    app.post("/create", authMiddleware(), create as unknown as RequestHandler);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageSave.mockResolvedValue({
      tag: "success",
      value: "http://test-url.com",
    });
  });

  describe("CSV Data Flow", () => {
    it("should preserve SourceRow[] format through entire pipeline", async () => {
      // Client sends pre-formatted SourceRow[] data
      const clientFormattedData: SourceRow[] = [
        {
          id: "1",
          comment: "This is a test comment from user 1",
          interview: "Alice",
        },
        {
          id: "2",
          comment: "This is a test comment from user 2",
          interview: "Bob",
          video: "https://example.com/video.mp4",
        },
      ];

      // Mock security validation to succeed
      (validateParsedData as any).mockReturnValue({
        tag: "success",
        value: [],
      });

      const response = await request(app)
        .post("/create")
        .set("Authorization", "Bearer valid-token")
        .send({
          userConfig: {
            title: "Test Report",
            description: "Integration test",
            systemInstructions: "Test system",
            clusteringInstructions: "Test clustering",
            extractionInstructions: "Test extraction",
            dedupInstructions: "Test dedup",
            summariesInstructions: "Test summaries",
            cruxInstructions: "Test crux",
            cruxesEnabled: false,
          },
          data: ["csv", clientFormattedData],
        })
        .expect(200);

      expect(response.body.message).toBe("Request received.");

      // CRITICAL: Verify validation was called with exact data from client
      // This ensures handleCsvData receives SourceRow[] without transformation
      expect(validateParsedData).toHaveBeenCalledWith(clientFormattedData);

      // Verify the data structure is preserved as SourceRow[]
      const calledData = (validateParsedData as any).mock.calls[0][0];
      expect(calledData).toEqual(clientFormattedData);
      expect(calledData[0]).toHaveProperty("id");
      expect(calledData[0]).toHaveProperty("comment");
      expect(calledData[1]).toHaveProperty("video");
    });

    it("should maintain data integrity with optional fields", async () => {
      const dataWithOptionalFields: SourceRow[] = [
        {
          id: "1",
          comment: "Comment without optional fields",
        },
        {
          id: "2",
          comment: "Comment with interview",
          interview: "Charlie",
        },
        {
          id: "3",
          comment: "Comment with all fields",
          interview: "David",
          video: "https://example.com/video2.mp4",
          timestamp: "2025-10-24T00:00:00Z",
        },
      ];

      (validateParsedData as any).mockReturnValue({
        tag: "success",
        value: [],
      });

      await request(app)
        .post("/create")
        .set("Authorization", "Bearer valid-token")
        .send({
          userConfig: {
            title: "Optional Fields Test",
            description: "Test optional field handling",
            systemInstructions: "Test",
            clusteringInstructions: "Test",
            extractionInstructions: "Test",
            dedupInstructions: "Test",
            summariesInstructions: "Test",
            cruxInstructions: "Test",
            cruxesEnabled: false,
          },
          data: ["csv", dataWithOptionalFields],
        })
        .expect(200);

      // Verify validation received exact data with optional fields intact
      expect(validateParsedData).toHaveBeenCalledWith(dataWithOptionalFields);

      const calledData = (validateParsedData as any).mock.calls[0][0];

      // First row: minimal fields
      expect(calledData[0]).toEqual({
        id: "1",
        comment: "Comment without optional fields",
      });

      // Second row: with interview
      expect(calledData[1]).toEqual({
        id: "2",
        comment: "Comment with interview",
        interview: "Charlie",
      });

      // Third row: all fields
      expect(calledData[2]).toEqual({
        id: "3",
        comment: "Comment with all fields",
        interview: "David",
        video: "https://example.com/video2.mp4",
        timestamp: "2025-10-24T00:00:00Z",
      });
    });

    it("should reject data that fails validation without modification", async () => {
      const invalidData: SourceRow[] = [
        {
          id: "1",
          comment: "=SUM(A1:A10)", // Injection attempt
        },
      ];

      (validateParsedData as any).mockReturnValue({
        tag: "failure",
        error: {
          tag: "INJECTION_ATTEMPT",
          message: "Formula injection detected",
        },
      });

      await request(app)
        .post("/create")
        .set("Authorization", "Bearer valid-token")
        .send({
          userConfig: {
            title: "Validation Test",
            description: "Test validation rejection",
            systemInstructions: "Test",
            clusteringInstructions: "Test",
            extractionInstructions: "Test",
            dedupInstructions: "Test",
            summariesInstructions: "Test",
            cruxInstructions: "Test",
            cruxesEnabled: false,
          },
          data: ["csv", invalidData],
        })
        .expect(400); // CSV security violations are client errors (400), not server errors (500)

      // Verify data was validated but NOT stored
      expect(validateParsedData).toHaveBeenCalledWith(invalidData);
      expect(mockStorageSave).not.toHaveBeenCalled();
      expect(mockQueueEnqueue).not.toHaveBeenCalled();
    });
  });

  describe("Data Transformation Guarantees", () => {
    it("should NOT call formatData on already-formatted CSV data", async () => {
      // This test ensures the fix from commit cc8f459 is maintained
      const preFormattedData: SourceRow[] = [
        { id: "1", comment: "Already formatted" },
      ];

      (validateParsedData as any).mockReturnValue({
        tag: "success",
        value: [],
      });

      await request(app)
        .post("/create")
        .set("Authorization", "Bearer valid-token")
        .send({
          userConfig: {
            title: "Format Test",
            description: "Test no double-formatting",
            systemInstructions: "Test",
            clusteringInstructions: "Test",
            extractionInstructions: "Test",
            dedupInstructions: "Test",
            summariesInstructions: "Test",
            cruxInstructions: "Test",
            cruxesEnabled: false,
          },
          data: ["csv", preFormattedData],
        })
        .expect(200);

      // Verify validation received exact data without re-formatting
      expect(validateParsedData).toHaveBeenCalledWith(preFormattedData);

      const calledData = (validateParsedData as any).mock.calls[0][0];
      expect(calledData).toEqual(preFormattedData);
    });

    it("should handle large datasets efficiently", async () => {
      // Generate 1000 rows to test performance
      const largeDataset: SourceRow[] = Array.from(
        { length: 1000 },
        (_, i) => ({
          id: String(i + 1),
          comment: `Test comment number ${i + 1}`,
          interview: `User ${i % 10}`,
        }),
      );

      (validateParsedData as any).mockReturnValue({
        tag: "success",
        value: [],
      });

      const startTime = Date.now();

      await request(app)
        .post("/create")
        .set("Authorization", "Bearer valid-token")
        .send({
          userConfig: {
            title: "Performance Test",
            description: "Large dataset test",
            systemInstructions: "Test",
            clusteringInstructions: "Test",
            extractionInstructions: "Test",
            dedupInstructions: "Test",
            summariesInstructions: "Test",
            cruxInstructions: "Test",
            cruxesEnabled: false,
          },
          data: ["csv", largeDataset],
        })
        .expect(200);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Verify all data was validated without modification
      expect(validateParsedData).toHaveBeenCalledWith(largeDataset);

      const calledData = (validateParsedData as any).mock.calls[0][0];
      expect(calledData).toHaveLength(1000);
      expect(calledData[0]).toEqual(largeDataset[0]);
      expect(calledData[999]).toEqual(largeDataset[999]);

      // Performance observation (non-failing): log duration for monitoring
      // Relaxed threshold to avoid flakiness in CI environments
      if (duration > 10000) {
        console.warn(
          `Large dataset processing took ${duration}ms (>10s threshold)`,
        );
      }
      // Only fail if performance is exceptionally poor (30s+)
      expect(duration).toBeLessThan(30000);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should handle empty dataset gracefully", async () => {
      const emptyDataset: SourceRow[] = [];

      (validateParsedData as any).mockReturnValue({
        tag: "success",
        value: [],
      });

      await request(app)
        .post("/create")
        .set("Authorization", "Bearer valid-token")
        .send({
          userConfig: {
            title: "Empty Dataset Test",
            description: "Test empty data handling",
            systemInstructions: "Test",
            clusteringInstructions: "Test",
            extractionInstructions: "Test",
            dedupInstructions: "Test",
            summariesInstructions: "Test",
            cruxInstructions: "Test",
            cruxesEnabled: false,
          },
          data: ["csv", emptyDataset],
        })
        .expect(200);

      // Verify validation was still called
      expect(validateParsedData).toHaveBeenCalledWith(emptyDataset);
    });

    it("should reject malformed CSV data structure", async () => {
      // Data that will fail Zod validation - missing required userConfig fields
      await request(app)
        .post("/create")
        .set("Authorization", "Bearer valid-token")
        .send({
          userConfig: {
            title: "Invalid Test",
            // Missing required fields
          },
          data: ["csv", []],
        })
        .expect(500); // Zod validation errors return 500

      // Validation should not be called for malformed request
      expect(mockStorageSave).not.toHaveBeenCalled();
    });
  });
});
