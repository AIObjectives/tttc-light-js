import type * as api from "tttc-common/api";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { handleResponseData } from "../handleResponseData";

// Mock server setup for integration testing
const TEST_EXPRESS_URL = "http://localhost:8080";

describe("handleResponseData - Integration Tests", () => {
  // Mock the environment variable that handleResponseData uses
  beforeAll(() => {
    process.env.PIPELINE_EXPRESS_URL = TEST_EXPRESS_URL;
  });

  afterAll(() => {
    delete process.env.PIPELINE_EXPRESS_URL;
  });

  describe("Endpoint URL Validation", () => {
    it("should construct correct unified endpoint URL for legacy reports", async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      // Mock a successful response
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ status: "finished" }),
      });

      const waitingMessage = { message: "Processing..." };
      const legacyIdentifier = "bucket/legacy-report.json";

      await handleResponseData(waitingMessage, legacyIdentifier, true);

      // Verify the correct unified endpoint was called (with headers for correlation ID)
      expect(mockFetch).toHaveBeenCalledWith(
        `${TEST_EXPRESS_URL}/report/${encodeURIComponent(legacyIdentifier)}`,
        expect.objectContaining({
          headers: expect.any(Headers),
        }),
      );
    });

    it("should construct correct unified endpoint URL for Firebase ID reports", async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      // Mock a successful response
      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ status: "processing" }),
      });

      const waitingMessage = { message: "Processing..." };
      const firebaseId = "AbCdEfGhIjKlMnOpQrSt";

      await handleResponseData(waitingMessage, firebaseId, false);

      // Verify the correct unified endpoint was called (with headers for correlation ID)
      expect(mockFetch).toHaveBeenCalledWith(
        `${TEST_EXPRESS_URL}/report/${encodeURIComponent(firebaseId)}`,
        expect.objectContaining({
          headers: expect.any(Headers),
        }),
      );
    });

    it("should not use deprecated status endpoints", async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ status: "finished" }),
      });

      const waitingMessage = { message: "Processing..." };
      const identifier = "test-identifier";

      await handleResponseData(waitingMessage, identifier, true);

      // Verify deprecated endpoints are NOT used
      const callUrl = mockFetch.mock.calls[0][0];
      expect(callUrl).not.toContain("/status");
      expect(callUrl).not.toContain("/data");
      expect(callUrl).not.toContain("/metadata");
      expect(callUrl).not.toContain("/api/report/");
    });
  });

  describe("Response Format Validation", () => {
    it("should handle unified response format correctly", async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      // Mock the unified endpoint response format
      const mockUnifiedResponse = {
        status: "finished" as api.ReportJobStatus,
        dataUrl: "https://storage.googleapis.com/bucket/report.json",
        metadata: {
          id: "test-id",
          title: "Test Report",
        },
      };

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockUnifiedResponse),
      });

      const waitingMessage = { message: "Processing..." };
      const result = await handleResponseData(waitingMessage, "test-id");

      expect(result).toEqual({
        tag: "status",
        status: "finished",
      });
    });

    it("should handle processing status correctly", async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      const mockProcessingResponse = {
        status: "clustering" as api.ReportJobStatus,
        metadata: {
          id: "test-id",
          title: "Test Report",
        },
      };

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve(mockProcessingResponse),
      });

      const waitingMessage = { message: "Processing..." };
      const result = await handleResponseData(waitingMessage, "test-id");

      expect(result).toEqual({
        tag: "status",
        status: "clustering",
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle network errors gracefully", async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      // Mock network failure
      mockFetch.mockRejectedValue(new Error("Network error"));

      const waitingMessage = { message: "Processing..." };
      const result = await handleResponseData(waitingMessage, "test-id");

      expect(result).toEqual({
        tag: "error",
        message: "Failed to process response data",
      });
    });

    it("should handle HTTP errors appropriately", async () => {
      const mockFetch = vi.fn();
      global.fetch = mockFetch;

      // Mock HTTP 404
      mockFetch.mockRejectedValue(new Error("HTTP 404"));

      const waitingMessage = { message: "Processing..." };
      const result = await handleResponseData(waitingMessage, "nonexistent-id");

      expect(result).toEqual({
        tag: "error",
        message: "Failed to process response data",
      });
    });
  });

  describe("Legacy Data Format Compatibility", () => {
    it("should handle old schema data correctly", async () => {
      // Mock old llmPipelineOutput schema format
      const oldSchemaData = {
        data: [], // Array of source rows
        title: "Test Report",
        question: "Test Question",
        description: "Test Description",
        systemInstructions: "Test instructions",
        clusteringInstructions: "Test clustering",
        extractionInstructions: "Test extraction",
        dedupInstructions: "Test dedup",
        summariesInstructions: "Test summaries",
        batchSize: 10,
        tree: [], // taxonomy is array of llmTopic
        start: Date.now(),
        costs: 0,
      };

      const result = await handleResponseData(oldSchemaData, "legacy-report");

      // Should transform old data to new format
      expect(result.tag).toBe("report");
    });

    it("should handle unknown data formats gracefully", async () => {
      // Test with truly invalid data that doesn't match any known schema
      const invalidData = {
        randomField: "invalid",
        anotherField: 123,
        completely: "wrong",
      };

      const result = await handleResponseData(invalidData, "invalid-report");

      // Should gracefully handle unknown formats
      expect(result.tag).toBe("error");
      if (result.tag === "error") {
        expect(result.message).toBe("Unknown error");
      }
    });
  });
});
