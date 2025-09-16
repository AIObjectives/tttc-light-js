import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Worker, Job } from "bullmq";
import Redis from "ioredis";
import * as firebase from "../Firebase";
import { setupWorkers } from "../workers";
import { PipelineJob } from "../jobs/pipeline";

// Mock dependencies
vi.mock("bullmq", () => ({
  Worker: vi.fn(),
  Job: vi.fn(),
}));

vi.mock("ioredis", () => ({
  default: vi.fn(),
}));

vi.mock("../Firebase", () => ({
  updateReportRefStatusWithRetry: vi.fn(),
  JobNotFoundError: class JobNotFoundError extends Error {
    constructor() {
      super("Job not found");
      this.name = "JobNotFoundError";
    }
  },
}));

vi.mock("tttc-common/logger", () => ({
  logger: {
    child: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    })),
  },
}));

describe("Workers", () => {
  let mockWorker: any;
  let mockConnection: Redis;
  let failureHandler: (job: Job<PipelineJob>, error: Error) => Promise<void>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create a mock worker that captures the failure handler
    mockWorker = {
      on: vi.fn((event, handler) => {
        if (event === "failed") {
          failureHandler = handler;
        }
      }),
    };

    vi.mocked(Worker).mockImplementation(() => mockWorker);
    mockConnection = {} as Redis;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("setupWorkers", () => {
    it("should create a pipeline worker with correct configuration", () => {
      const queueName = "test-queue";

      setupWorkers(mockConnection, queueName);

      expect(Worker).toHaveBeenCalledWith(queueName, expect.any(Function), {
        connection: mockConnection,
        stalledInterval: 3000000,
        skipStalledCheck: true,
      });
    });

    it("should register a failure handler", () => {
      setupWorkers(mockConnection, "test-queue");

      expect(mockWorker.on).toHaveBeenCalledWith(
        "failed",
        expect.any(Function),
      );
    });
  });

  describe("Pipeline Worker Failure Handler", () => {
    beforeEach(() => {
      setupWorkers(mockConnection, "test-queue");
    });

    it("should update REPORT_REF on failure", async () => {
      const mockJob = {
        id: "job-123",
        data: {
          config: {
            firebaseDetails: {
              firebaseJobId: "firebase-job-123",
              reportId: "report-456",
            },
          },
        },
      } as Job<PipelineJob>;

      const mockError = new Error("Processing failed");

      vi.mocked(firebase.updateReportRefStatusWithRetry).mockResolvedValue();

      await failureHandler(mockJob, mockError);

      expect(firebase.updateReportRefStatusWithRetry).toHaveBeenCalledWith(
        "report-456",
        "failed",
        { errorMessage: "Processing failed" },
      );
    });

    it("should handle missing reportId by falling back to firebaseJobId", async () => {
      const mockJob = {
        id: "job-123",
        data: {
          config: {
            firebaseDetails: {
              firebaseJobId: "firebase-job-123",
              // reportId is missing
            },
          },
        },
      } as Job<PipelineJob>;

      const mockError = new Error("Processing failed");

      vi.mocked(firebase.updateReportRefStatusWithRetry).mockResolvedValue();

      await failureHandler(mockJob, mockError);

      expect(firebase.updateReportRefStatusWithRetry).toHaveBeenCalledWith(
        "firebase-job-123", // Should use firebaseJobId as fallback
        "failed",
        { errorMessage: "Processing failed" },
      );
    });

    it("should handle non-Error objects gracefully", async () => {
      const mockJob = {
        id: "job-123",
        data: {
          config: {
            firebaseDetails: {
              firebaseJobId: "firebase-job-123",
              reportId: "report-456",
            },
          },
        },
      } as Job<PipelineJob>;

      const mockError = "String error message";

      vi.mocked(firebase.updateReportRefStatusWithRetry).mockResolvedValue();

      await failureHandler(mockJob, mockError as any);

      expect(firebase.updateReportRefStatusWithRetry).toHaveBeenCalledWith(
        "report-456",
        "failed",
        { errorMessage: "String error message" },
      );
    });

    it("should not throw on JobNotFoundError", async () => {
      const mockJob = {
        id: "job-123",
        data: {
          config: {
            firebaseDetails: {
              firebaseJobId: "firebase-job-123",
              reportId: "report-456",
            },
          },
        },
      } as Job<PipelineJob>;

      const mockError = new Error("Processing failed");

      vi.mocked(firebase.updateReportRefStatusWithRetry).mockRejectedValue(
        new firebase.JobNotFoundError(),
      );

      // Should not throw
      await expect(failureHandler(mockJob, mockError)).resolves.not.toThrow();
    });

    it("should handle missing firebaseDetails gracefully", async () => {
      const mockJob = {
        id: "job-123",
        data: {
          config: {
            // firebaseDetails is missing
          },
        },
      } as Job<PipelineJob>;

      const mockError = new Error("Processing failed");

      // Should not throw even with missing firebaseDetails
      await expect(failureHandler(mockJob, mockError)).resolves.not.toThrow();

      // Should not call update functions
      expect(firebase.updateReportRefStatusWithRetry).not.toHaveBeenCalled();
    });

    it("should handle partial update failures gracefully", async () => {
      const mockJob = {
        id: "job-123",
        data: {
          config: {
            firebaseDetails: {
              firebaseJobId: "firebase-job-123",
              reportId: "report-456",
            },
          },
        },
      } as Job<PipelineJob>;

      const mockError = new Error("Processing failed");

      // Update fails
      vi.mocked(firebase.updateReportRefStatusWithRetry).mockRejectedValue(
        new Error("Update failed"),
      );

      // Should not throw even if update fails
      await expect(failureHandler(mockJob, mockError)).resolves.not.toThrow();
    });

    it("should handle update timing correctly", async () => {
      const mockJob = {
        id: "job-123",
        data: {
          config: {
            firebaseDetails: {
              firebaseJobId: "firebase-job-123",
              reportId: "report-456",
            },
          },
        },
      } as Job<PipelineJob>;

      const mockError = new Error("Processing failed");

      let updateReportRefStatusCalled = false;

      vi.mocked(firebase.updateReportRefStatusWithRetry).mockImplementation(
        async () => {
          updateReportRefStatusCalled = true;
          await new Promise((resolve) => setTimeout(resolve, 10));
        },
      );

      const startTime = Date.now();
      await failureHandler(mockJob, mockError);
      const endTime = Date.now();

      // Should have been called
      expect(updateReportRefStatusCalled).toBe(true);

      // Should complete in reasonable time (allowing for CI slowness)
      expect(endTime - startTime).toBeLessThan(200);
    });

    it("should handle null job gracefully", async () => {
      const mockError = new Error("Processing failed");

      // Should not throw with null job
      await expect(
        failureHandler(null as any, mockError),
      ).resolves.not.toThrow();

      expect(firebase.updateReportRefStatusWithRetry).not.toHaveBeenCalled();
    });
  });
});
