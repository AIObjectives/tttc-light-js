import { describe, it, expect, vi, beforeEach } from "vitest";
import { checkPyserverHealth } from "../healthCheck";
import {
  PyserverOOMError,
  PyserverUnresponsiveError,
  PyserverHungError,
} from "../errors";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe("checkPyserverHealth", () => {
  const testPyserverUrl = "http://localhost:8000";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Healthy responses", () => {
    it("should return health data when pyserver is healthy", async () => {
      const healthyResponse = {
        status: "idle",
        health: "healthy",
        active_requests: 0,
        progress: {
          total_comments: 0,
          completed_comments: 0,
          progress_percentage: 0,
        },
        performance: {
          concurrency_enabled: true,
          concurrency_limit: 25,
          memory_usage_mb: 500,
          memory_percent: 50,
          memory_limit_mb: 1600,
        },
        cache: {},
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => healthyResponse,
      });

      const result = await checkPyserverHealth({
        pyserverUrl: testPyserverUrl,
      });

      expect(result).toEqual(healthyResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        `${testPyserverUrl}/health/processing`,
        expect.objectContaining({
          signal: expect.any(AbortSignal),
        }),
      );
    });

    it("should return health data when processing with low memory", async () => {
      const processingResponse = {
        status: "processing",
        health: "healthy",
        active_requests: 5,
        progress: {
          total_comments: 100,
          completed_comments: 50,
          progress_percentage: 50,
        },
        performance: {
          concurrency_enabled: true,
          concurrency_limit: 25,
          memory_usage_mb: 1200,
          memory_percent: 75,
          memory_limit_mb: 1600,
        },
        cache: { hit_rate: 0.85 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => processingResponse,
      });

      const result = await checkPyserverHealth({
        pyserverUrl: testPyserverUrl,
      });

      expect(result).toEqual(processingResponse);
    });

    it("should allow memory_warning status if below 90% threshold", async () => {
      const warningResponse = {
        status: "processing",
        health: "memory_warning",
        active_requests: 3,
        progress: {
          total_comments: 100,
          completed_comments: 80,
          progress_percentage: 80,
        },
        performance: {
          concurrency_enabled: true,
          concurrency_limit: 25,
          memory_usage_mb: 1400,
          memory_percent: 85, // Above pyserver warning (80%) but below bail threshold (90%)
          memory_limit_mb: 1600,
        },
        cache: {},
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => warningResponse,
      });

      const result = await checkPyserverHealth({
        pyserverUrl: testPyserverUrl,
      });

      expect(result).toEqual(warningResponse);
    });
  });

  describe("OOM detection", () => {
    it("should throw PyserverOOMError when memory exceeds 90%", async () => {
      const oomResponse = {
        status: "processing",
        health: "memory_warning",
        active_requests: 2,
        progress: {
          total_comments: 100,
          completed_comments: 90,
          progress_percentage: 90,
        },
        performance: {
          concurrency_enabled: true,
          concurrency_limit: 25,
          memory_usage_mb: 1500,
          memory_percent: 95,
          memory_limit_mb: 1600,
        },
        cache: {},
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => oomResponse,
      });

      await expect(
        checkPyserverHealth({ pyserverUrl: testPyserverUrl }),
      ).rejects.toThrow(PyserverOOMError);

      await expect(
        checkPyserverHealth({ pyserverUrl: testPyserverUrl }),
      ).rejects.toThrow(/95%.*1500MB.*exceeds 90% threshold/);
    });

    it("should throw PyserverOOMError at exactly 90%", async () => {
      const oomResponse = {
        status: "processing",
        health: "memory_warning",
        active_requests: 1,
        progress: {
          total_comments: 50,
          completed_comments: 45,
          progress_percentage: 90,
        },
        performance: {
          concurrency_enabled: true,
          concurrency_limit: 25,
          memory_usage_mb: 1440,
          memory_percent: 90,
          memory_limit_mb: 1600,
        },
        cache: {},
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => oomResponse,
      });

      await expect(
        checkPyserverHealth({ pyserverUrl: testPyserverUrl }),
      ).rejects.toThrow(PyserverOOMError);
    });
  });

  describe("Hung request detection", () => {
    it("should throw PyserverHungError when request exceeds threshold", async () => {
      const now = Date.now();
      const requestStartTime = now - 2500000; // 41 minutes ago (exceeds 40min threshold)

      const processingResponse = {
        status: "processing",
        health: "healthy",
        active_requests: 1,
        progress: {
          total_comments: 100,
          completed_comments: 10,
          progress_percentage: 10,
        },
        performance: {
          concurrency_enabled: true,
          concurrency_limit: 25,
          memory_usage_mb: 800,
          memory_percent: 50,
          memory_limit_mb: 1600,
        },
        cache: {},
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => processingResponse,
      });

      await expect(
        checkPyserverHealth({
          pyserverUrl: testPyserverUrl,
          requestStartTime,
        }),
      ).rejects.toThrow(PyserverHungError);

      await expect(
        checkPyserverHealth({
          pyserverUrl: testPyserverUrl,
          requestStartTime,
        }),
      ).rejects.toThrow(/1 active request.*stuck for.*2500s/);
    });

    it("should not throw PyserverHungError if no active requests", async () => {
      const now = Date.now();
      const requestStartTime = now - 2500000; // 41 minutes ago

      const idleResponse = {
        status: "idle",
        health: "healthy",
        active_requests: 0, // No active requests
        progress: {
          total_comments: 0,
          completed_comments: 0,
          progress_percentage: 0,
        },
        performance: {
          concurrency_enabled: true,
          concurrency_limit: 25,
          memory_usage_mb: 500,
          memory_percent: 30,
          memory_limit_mb: 1600,
        },
        cache: {},
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => idleResponse,
      });

      const result = await checkPyserverHealth({
        pyserverUrl: testPyserverUrl,
        requestStartTime,
      });

      expect(result).toEqual(idleResponse);
    });

    it("should not throw PyserverHungError if request under threshold", async () => {
      const now = Date.now();
      const requestStartTime = now - 1200000; // 20 minutes ago (under 40min threshold)

      const processingResponse = {
        status: "processing",
        health: "healthy",
        active_requests: 2,
        progress: {
          total_comments: 100,
          completed_comments: 50,
          progress_percentage: 50,
        },
        performance: {
          concurrency_enabled: true,
          concurrency_limit: 25,
          memory_usage_mb: 900,
          memory_percent: 55,
          memory_limit_mb: 1600,
        },
        cache: {},
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => processingResponse,
      });

      const result = await checkPyserverHealth({
        pyserverUrl: testPyserverUrl,
        requestStartTime,
      });

      expect(result).toEqual(processingResponse);
    });
  });

  describe("Unresponsive detection", () => {
    it("should throw PyserverUnresponsiveError on non-ok response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(
        checkPyserverHealth({ pyserverUrl: testPyserverUrl }),
      ).rejects.toThrow(PyserverUnresponsiveError);

      await expect(
        checkPyserverHealth({ pyserverUrl: testPyserverUrl }),
      ).rejects.toThrow(/Health check failed with status 500/);
    });

    it("should throw PyserverUnresponsiveError on timeout", async () => {
      const timeoutError = new Error("The operation was aborted");
      timeoutError.name = "TimeoutError";

      mockFetch.mockRejectedValue(timeoutError);

      await expect(
        checkPyserverHealth({ pyserverUrl: testPyserverUrl }),
      ).rejects.toThrow(PyserverUnresponsiveError);

      await expect(
        checkPyserverHealth({ pyserverUrl: testPyserverUrl }),
      ).rejects.toThrow(/Health check timed out after 10000ms/);
    });

    it("should throw PyserverUnresponsiveError on network error", async () => {
      mockFetch.mockRejectedValue(new Error("ECONNREFUSED"));

      await expect(
        checkPyserverHealth({ pyserverUrl: testPyserverUrl }),
      ).rejects.toThrow(PyserverUnresponsiveError);

      await expect(
        checkPyserverHealth({ pyserverUrl: testPyserverUrl }),
      ).rejects.toThrow(/Health check failed: ECONNREFUSED/);
    });

    it("should throw PyserverUnresponsiveError on invalid JSON", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      });

      await expect(
        checkPyserverHealth({ pyserverUrl: testPyserverUrl }),
      ).rejects.toThrow(PyserverUnresponsiveError);
    });
  });

  describe("Schema validation", () => {
    it("should throw PyserverUnresponsiveError on invalid schema", async () => {
      const invalidResponse = {
        status: "invalid_status", // Not in enum
        health: "healthy",
        // Missing required fields
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => invalidResponse,
      });

      await expect(
        checkPyserverHealth({ pyserverUrl: testPyserverUrl }),
      ).rejects.toThrow(PyserverUnresponsiveError);
    });

    it("should handle missing optional requestStartTime", async () => {
      const healthyResponse = {
        status: "idle",
        health: "healthy",
        active_requests: 0,
        progress: {
          total_comments: 0,
          completed_comments: 0,
          progress_percentage: 0,
        },
        performance: {
          concurrency_enabled: true,
          concurrency_limit: 25,
          memory_usage_mb: 500,
          memory_percent: 50,
          memory_limit_mb: 1600,
        },
        cache: {},
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => healthyResponse,
      });

      // Should not check for hung requests without requestStartTime
      const result = await checkPyserverHealth({
        pyserverUrl: testPyserverUrl,
        // requestStartTime not provided
      });

      expect(result).toEqual(healthyResponse);
    });
  });
});
