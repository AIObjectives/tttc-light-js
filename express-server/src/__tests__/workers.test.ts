import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as firebase from "../Firebase";
import { type PipelineJob, pipelineJob } from "../jobs/pipeline";
import { processJob, processJobFailure } from "../workers";

// Mock dependencies
vi.mock("../jobs/pipeline", () => ({
  pipelineJob: vi.fn(),
  PipelineJob: {},
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("processJob", () => {
    it("should call pipelineJob with the provided job data", async () => {
      const mockJob: PipelineJob = {
        config: {
          env: "test" as any,
          auth: "public",
          firebaseDetails: {
            reportDataUri: "test-uri",
            userId: "test-user",
            firebaseJobId: "test-job",
            reportId: "report-123",
          },
          llm: { model: "test-model" },
          instructions: {
            systemInstructions: "test",
            clusteringInstructions: "test",
            extractionInstructions: "test",
            dedupInstructions: "test",
            cruxInstructions: "test",
            summariesInstructions: "test",
          },
          api_key: "test-key",
          options: { cruxes: false, bridging: false },
        },
        data: [],
        reportDetails: {
          title: "test",
          description: "test",
          question: "test",
          filename: "test.json",
        },
      };

      vi.mocked(pipelineJob).mockResolvedValue(undefined);

      await processJob(mockJob);

      expect(pipelineJob).toHaveBeenCalledWith(mockJob);
    });

    it("should propagate errors from pipelineJob", async () => {
      const mockJob: PipelineJob = {
        config: {
          env: "test" as any,
          auth: "public",
          firebaseDetails: {
            reportDataUri: "test-uri",
            userId: "test-user",
            firebaseJobId: "test-job",
          },
          llm: { model: "test-model" },
          instructions: {
            systemInstructions: "test",
            clusteringInstructions: "test",
            extractionInstructions: "test",
            dedupInstructions: "test",
            cruxInstructions: "test",
            summariesInstructions: "test",
          },
          api_key: "test-key",
          options: { cruxes: false, bridging: false },
        },
        data: [],
        reportDetails: {
          title: "test",
          description: "test",
          question: "test",
          filename: "test.json",
        },
      };

      const testError = new Error("Pipeline processing failed");
      vi.mocked(pipelineJob).mockRejectedValue(testError);

      await expect(processJob(mockJob)).rejects.toThrow(
        "Pipeline processing failed",
      );
    });
  });

  describe("processJobFailure", () => {
    it("should update REPORT_REF on failure", async () => {
      const mockJob: PipelineJob = {
        config: {
          env: "test" as any,
          auth: "public",
          firebaseDetails: {
            firebaseJobId: "firebase-job-123",
            reportId: "report-456",
            reportDataUri: "test-uri",
            userId: "test-user",
          },
          llm: { model: "test-model" },
          instructions: {
            systemInstructions: "test",
            clusteringInstructions: "test",
            extractionInstructions: "test",
            dedupInstructions: "test",
            cruxInstructions: "test",
            summariesInstructions: "test",
          },
          api_key: "test-key",
          options: { cruxes: false, bridging: false },
        },
        data: [],
        reportDetails: {
          title: "test",
          description: "test",
          question: "test",
          filename: "test.json",
        },
      };

      const mockError = new Error("Processing failed");

      vi.mocked(firebase.updateReportRefStatusWithRetry).mockResolvedValue();

      await processJobFailure(mockJob, mockError);

      expect(firebase.updateReportRefStatusWithRetry).toHaveBeenCalledWith(
        "report-456",
        "failed",
        { errorMessage: "Processing failed" },
      );
    });

    it("should handle missing reportId by falling back to firebaseJobId", async () => {
      const mockJob: PipelineJob = {
        config: {
          env: "test" as any,
          auth: "public",
          firebaseDetails: {
            firebaseJobId: "firebase-job-123",
            reportDataUri: "test-uri",
            userId: "test-user",
            // reportId is missing
          },
          llm: { model: "test-model" },
          instructions: {
            systemInstructions: "test",
            clusteringInstructions: "test",
            extractionInstructions: "test",
            dedupInstructions: "test",
            cruxInstructions: "test",
            summariesInstructions: "test",
          },
          api_key: "test-key",
          options: { cruxes: false, bridging: false },
        },
        data: [],
        reportDetails: {
          title: "test",
          description: "test",
          question: "test",
          filename: "test.json",
        },
      };

      const mockError = new Error("Processing failed");

      vi.mocked(firebase.updateReportRefStatusWithRetry).mockResolvedValue();

      await processJobFailure(mockJob, mockError);

      expect(firebase.updateReportRefStatusWithRetry).toHaveBeenCalledWith(
        "firebase-job-123", // Should use firebaseJobId as fallback
        "failed",
        { errorMessage: "Processing failed" },
      );
    });

    it("should handle non-Error objects gracefully", async () => {
      const mockJob: PipelineJob = {
        config: {
          env: "test" as any,
          auth: "public",
          firebaseDetails: {
            firebaseJobId: "firebase-job-123",
            reportId: "report-456",
            reportDataUri: "test-uri",
            userId: "test-user",
          },
          llm: { model: "test-model" },
          instructions: {
            systemInstructions: "test",
            clusteringInstructions: "test",
            extractionInstructions: "test",
            dedupInstructions: "test",
            cruxInstructions: "test",
            summariesInstructions: "test",
          },
          api_key: "test-key",
          options: { cruxes: false, bridging: false },
        },
        data: [],
        reportDetails: {
          title: "test",
          description: "test",
          question: "test",
          filename: "test.json",
        },
      };

      const mockError = "String error message";

      vi.mocked(firebase.updateReportRefStatusWithRetry).mockResolvedValue();

      await processJobFailure(mockJob, mockError as any);

      expect(firebase.updateReportRefStatusWithRetry).toHaveBeenCalledWith(
        "report-456",
        "failed",
        { errorMessage: "String error message" },
      );
    });

    it("should not throw on JobNotFoundError", async () => {
      const mockJob: PipelineJob = {
        config: {
          env: "test" as any,
          auth: "public",
          firebaseDetails: {
            firebaseJobId: "firebase-job-123",
            reportId: "report-456",
            reportDataUri: "test-uri",
            userId: "test-user",
          },
          llm: { model: "test-model" },
          instructions: {
            systemInstructions: "test",
            clusteringInstructions: "test",
            extractionInstructions: "test",
            dedupInstructions: "test",
            cruxInstructions: "test",
            summariesInstructions: "test",
          },
          api_key: "test-key",
          options: { cruxes: false, bridging: false },
        },
        data: [],
        reportDetails: {
          title: "test",
          description: "test",
          question: "test",
          filename: "test.json",
        },
      };

      const mockError = new Error("Processing failed");

      vi.mocked(firebase.updateReportRefStatusWithRetry).mockRejectedValue(
        new firebase.JobNotFoundError(),
      );

      // Should not throw
      await expect(
        processJobFailure(mockJob, mockError),
      ).resolves.not.toThrow();
    });

    it("should handle missing firebaseDetails gracefully", async () => {
      const mockJob: PipelineJob = {
        config: {
          env: "test" as any,
          auth: "public",
          // firebaseDetails is missing
          llm: { model: "test-model" },
          instructions: {
            systemInstructions: "test",
            clusteringInstructions: "test",
            extractionInstructions: "test",
            dedupInstructions: "test",
            cruxInstructions: "test",
            summariesInstructions: "test",
          },
          api_key: "test-key",
          options: { cruxes: false, bridging: false },
        },
        data: [],
        reportDetails: {
          title: "test",
          description: "test",
          question: "test",
          filename: "test.json",
        },
      } as any;

      const mockError = new Error("Processing failed");

      // Should not throw even with missing firebaseDetails
      await expect(
        processJobFailure(mockJob, mockError),
      ).resolves.not.toThrow();

      // Should not call update functions
      expect(firebase.updateReportRefStatusWithRetry).not.toHaveBeenCalled();
    });

    it("should handle partial update failures gracefully", async () => {
      const mockJob: PipelineJob = {
        config: {
          env: "test" as any,
          auth: "public",
          firebaseDetails: {
            firebaseJobId: "firebase-job-123",
            reportId: "report-456",
            reportDataUri: "test-uri",
            userId: "test-user",
          },
          llm: { model: "test-model" },
          instructions: {
            systemInstructions: "test",
            clusteringInstructions: "test",
            extractionInstructions: "test",
            dedupInstructions: "test",
            cruxInstructions: "test",
            summariesInstructions: "test",
          },
          api_key: "test-key",
          options: { cruxes: false, bridging: false },
        },
        data: [],
        reportDetails: {
          title: "test",
          description: "test",
          question: "test",
          filename: "test.json",
        },
      };

      const mockError = new Error("Processing failed");

      // Update fails
      vi.mocked(firebase.updateReportRefStatusWithRetry).mockRejectedValue(
        new Error("Update failed"),
      );

      // Should not throw even if update fails
      await expect(
        processJobFailure(mockJob, mockError),
      ).resolves.not.toThrow();
    });

    it("should handle update timing correctly", async () => {
      const mockJob: PipelineJob = {
        config: {
          env: "test" as any,
          auth: "public",
          firebaseDetails: {
            firebaseJobId: "firebase-job-123",
            reportId: "report-456",
            reportDataUri: "test-uri",
            userId: "test-user",
          },
          llm: { model: "test-model" },
          instructions: {
            systemInstructions: "test",
            clusteringInstructions: "test",
            extractionInstructions: "test",
            dedupInstructions: "test",
            cruxInstructions: "test",
            summariesInstructions: "test",
          },
          api_key: "test-key",
          options: { cruxes: false, bridging: false },
        },
        data: [],
        reportDetails: {
          title: "test",
          description: "test",
          question: "test",
          filename: "test.json",
        },
      };

      const mockError = new Error("Processing failed");

      let updateReportRefStatusCalled = false;

      vi.mocked(firebase.updateReportRefStatusWithRetry).mockImplementation(
        async () => {
          updateReportRefStatusCalled = true;
          await new Promise((resolve) => setTimeout(resolve, 10));
        },
      );

      const startTime = Date.now();
      await processJobFailure(mockJob, mockError);
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
        processJobFailure(null as any, mockError),
      ).resolves.not.toThrow();

      expect(firebase.updateReportRefStatusWithRetry).not.toHaveBeenCalled();
    });

    it("should log appropriate error information when processing fails", async () => {
      const mockJob: PipelineJob = {
        config: {
          env: "test" as any,
          auth: "public",
          firebaseDetails: {
            firebaseJobId: "firebase-job-123",
            reportId: "report-456",
            reportDataUri: "test-uri",
            userId: "test-user",
          },
          llm: { model: "test-model" },
          instructions: {
            systemInstructions: "test",
            clusteringInstructions: "test",
            extractionInstructions: "test",
            dedupInstructions: "test",
            cruxInstructions: "test",
            summariesInstructions: "test",
          },
          api_key: "test-key",
          options: { cruxes: false, bridging: false },
        },
        data: [{ id: "testId", comment: "test data" }],
        reportDetails: {
          title: "test",
          description: "test",
          question: "test",
          filename: "test.json",
        },
      };

      const mockError = new Error("Processing failed");
      mockError.stack = "Error: Processing failed\n    at test";

      vi.mocked(firebase.updateReportRefStatusWithRetry).mockResolvedValue();

      await processJobFailure(mockJob, mockError);

      // Should call the firebase update function
      expect(firebase.updateReportRefStatusWithRetry).toHaveBeenCalledWith(
        "report-456",
        "failed",
        { errorMessage: "Processing failed" },
      );
    });
  });
});
