import { renderHook, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { useUnifiedReport } from "../hooks/useUnifiedReport";

/**
 * End-to-End Report Loading Flow Tests
 *
 * These tests simulate the complete flow from frontend component
 * to backend API to verify the full integration works correctly.
 */

describe("End-to-End Report Loading Flow", () => {
  const TEST_EXPRESS_URL = "http://localhost:8080";

  beforeAll(() => {
    process.env.PIPELINE_EXPRESS_URL = TEST_EXPRESS_URL;
  });

  afterAll(() => {
    delete process.env.PIPELINE_EXPRESS_URL;
  });

  describe("Complete Firebase ID Report Flow", () => {
    it("should load a finished Firebase ID report end-to-end", async () => {
      const firebaseId = "AbCdEfGhIjKlMnOpQrSt";
      const mockReportData = {
        topics: [{ id: "1", title: "Test Topic", subtopicIds: ["1.1"] }],
        subtopics: [
          {
            id: "1.1",
            title: "Test Subtopic",
            parentTopicId: "1",
            claimIds: ["c1"],
          },
        ],
        claims: [
          {
            id: "c1",
            title: "Test Claim",
            subtopicId: "1.1",
            supportingEvidence: [],
          },
        ],
        people: [],
      };

      // Mock the complete flow
      const mockFetch = vi.fn().mockImplementation((url) => {
        if (url.includes("/api/report/")) {
          // First call - unified endpoint returns finished status with dataUrl
          const response = {
            status: "finished",
            dataUrl: "https://signed-storage-url.com/report.json",
            metadata: {
              id: firebaseId,
              title: "Test Report",
              numTopics: 1,
              numSubtopics: 1,
              numClaims: 1,
              numPeople: 0,
            },
          };
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(response),
          });
        } else {
          // Second call - fetch actual report data from signed URL
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                version: 2,
                data: [null, mockReportData],
              }),
          });
        }
      });

      global.fetch = mockFetch;

      // Test the useUnifiedReport hook
      const { result } = renderHook(() => useUnifiedReport(firebaseId));

      // Wait for the hook to complete loading
      await waitFor(
        () => {
          expect(result.current.type).toBe("ready");
        },
        { timeout: 5000 },
      );

      // Verify the complete flow - should call unified endpoint
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/report/${encodeURIComponent(firebaseId)}`,
      );

      // Verify final state
      expect(result.current.type).toBe("ready");
      if (result.current.type === "ready") {
        expect(result.current.dataUrl).toBe(
          "https://signed-storage-url.com/report.json",
        );
        expect(result.current.metadata?.id).toBe(firebaseId);
      }
    });

    it("should handle processing Firebase ID report correctly", async () => {
      const firebaseId = "ProcessingReport123";

      const mockFetch = vi.fn().mockImplementation((url) => {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              status: "clustering",
              metadata: {
                id: firebaseId,
                title: "Processing Report",
                numTopics: 0,
                numSubtopics: 0,
                numClaims: 0,
                numPeople: 0,
              },
            }),
        });
      });

      global.fetch = mockFetch;

      const { result } = renderHook(() => useUnifiedReport(firebaseId));

      await waitFor(() => {
        expect(result.current.type).toBe("processing");
      });

      expect(result.current.type).toBe("processing");
      if (result.current.type === "processing") {
        expect(result.current.status).toBe("clustering");
        expect(result.current.metadata?.id).toBe(firebaseId);
      }
    });
  });

  describe("Complete Legacy URL Report Flow", () => {
    it("should load a legacy bucket URL report end-to-end", async () => {
      const legacyUrl = "test-bucket/reports/legacy-report.json";
      const mockReportData = {
        topics: [{ id: "1", title: "Legacy Topic", subtopicIds: [] }],
        subtopics: [],
        claims: [],
        people: [],
      };

      const mockFetch = vi.fn().mockImplementation((url) => {
        // Unified endpoint handles legacy URL and returns finished with dataUrl
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              status: "finished",
              dataUrl: "https://signed-legacy-url.com/legacy-report.json",
              // No metadata for legacy reports
            }),
        });
      });

      global.fetch = mockFetch;

      const { result } = renderHook(() => useUnifiedReport(legacyUrl));

      await waitFor(() => {
        expect(result.current.type).toBe("ready");
      });

      // Verify unified endpoint was called for legacy URL
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        `/api/report/${encodeURIComponent(legacyUrl)}`,
      );

      if (result.current.type === "ready") {
        expect(result.current.dataUrl).toBe(
          "https://signed-legacy-url.com/legacy-report.json",
        );
        expect(result.current.metadata).toBeUndefined(); // Legacy has no metadata
      }
    });
  });

  describe("Error Handling in Complete Flow", () => {
    it("should handle report not found correctly", async () => {
      const nonExistentId = "DoesNotExist1234567";

      const mockFetch = vi.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 404,
          text: () => Promise.resolve("Report not found"),
        });
      });

      global.fetch = mockFetch;

      const { result } = renderHook(() => useUnifiedReport(nonExistentId));

      await waitFor(() => {
        expect(result.current.type).toBe("not-found");
      });

      expect(result.current.type).toBe("not-found");
    });

    it("should handle server errors gracefully", async () => {
      const testId = "ServerErrorTest123";

      const mockFetch = vi.fn().mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          status: 500,
          text: () => Promise.resolve("Internal Server Error"),
        });
      });

      global.fetch = mockFetch;

      const { result } = renderHook(() => useUnifiedReport(testId));

      await waitFor(() => {
        expect(result.current.type).toBe("error");
      });

      if (result.current.type === "error") {
        expect(result.current.message).toContain("500");
      }
    });

    it("should handle network failures", async () => {
      const testId = "NetworkFailTest123";

      const mockFetch = vi.fn().mockRejectedValue(new Error("Network failure"));

      global.fetch = mockFetch;

      const { result } = renderHook(() => useUnifiedReport(testId));

      await waitFor(() => {
        expect(result.current.type).toBe("error");
      });

      if (result.current.type === "error") {
        expect(result.current.message).toContain("Network failure");
      }
    });
  });

  describe("Polling Behavior", () => {
    it("should poll processing reports until completion", async () => {
      const processingId = "PollingTest12345678";

      let callCount = 0;
      const mockFetch = vi.fn().mockImplementation((url) => {
        callCount++;
        if (callCount === 1) {
          // First call - processing
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                status: "processing",
                metadata: { id: processingId, title: "Processing Report" },
              }),
          });
        } else if (callCount === 2) {
          // Second call (after polling) - still processing
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                status: "clustering",
                metadata: { id: processingId, title: "Processing Report" },
              }),
          });
        } else {
          // Third call (after polling) - finished
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () =>
              Promise.resolve({
                status: "finished",
                dataUrl: "https://final-report-url.com/report.json",
                metadata: { id: processingId, title: "Completed Report" },
              }),
          });
        }
      });

      global.fetch = mockFetch;

      const { result } = renderHook(() => useUnifiedReport(processingId));

      // Initially should be loading
      expect(result.current.type).toBe("loading");

      // Should become processing
      await waitFor(() => {
        expect(result.current.type).toBe("processing");
      });

      // Should eventually become ready (after polling)
      await waitFor(
        () => {
          expect(result.current.type).toBe("ready");
        },
        { timeout: 10000 },
      ); // Longer timeout for polling

      // Should have made multiple calls due to polling (at least 3: processing -> clustering -> finished)
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/report/${encodeURIComponent(processingId)}`,
      );
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(3);

      // Verify final state
      expect(result.current.type).toBe("ready");
      if (result.current.type === "ready") {
        expect(result.current.dataUrl).toBe(
          "https://final-report-url.com/report.json",
        );
      }
    });
  });

  describe("URL Endpoint Validation", () => {
    it("should never call deprecated endpoints in the complete flow", async () => {
      const testId = "EndpointValidation123";

      const mockFetch = vi.fn().mockImplementation((url) => {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () =>
            Promise.resolve({
              status: "finished",
              dataUrl: "https://report-data.com/test.json",
              metadata: { id: testId, title: "Test Report" },
            }),
        });
      });

      global.fetch = mockFetch;

      const { result } = renderHook(() => useUnifiedReport(testId));

      await waitFor(() => {
        expect(result.current.type).toBe("ready");
      });

      // Verify NO deprecated endpoints were called
      const allCalls = mockFetch.mock.calls.map((call) => call[0]);

      for (const callUrl of allCalls) {
        expect(callUrl).not.toContain("/status");
        expect(callUrl).not.toContain("/data");
        expect(callUrl).not.toContain("/metadata");
        expect(callUrl).not.toContain("/report/id/");
      }
    });
  });
});
