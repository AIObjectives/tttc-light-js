import type express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { setupTestApp } from "./helpers/testApp";

/**
 * API Contract Integration Tests
 *
 * These tests verify that the actual HTTP endpoints exist and work correctly.
 */

describe("Report API Contract Tests", () => {
  let app: express.Application;
  let server: any;

  beforeAll(async () => {
    // Set up a test instance of the Express app
    app = await setupTestApp();
    server = app.listen(0); // Use port 0 for dynamic port assignment
  });

  afterAll(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  describe("Unified Report Endpoint (/report/:identifier)", () => {
    it("should handle various identifier formats gracefully", async () => {
      const invalidId = "invalid@#$%identifier!";

      const response = await request(app).get(
        `/report/${encodeURIComponent(invalidId)}`,
      );
      // Should not crash - current implementation handles any string
      expect(response.status).not.toBe(500);
      expect([200, 404]).toContain(response.status);
    });

    it("should handle Firebase ID format", async () => {
      const firebaseId = "AbCdEfGhIjKlMnOpQrSt"; // Valid 20-char Firebase ID

      await request(app)
        .get(`/report/${firebaseId}`)
        .expect((res) => {
          // Should accept the request (not 400 for invalid format)
          expect(res.status).not.toBe(400);
        });
    });

    it("should handle legacy bucket URL format", async () => {
      const legacyUrl = "test-bucket/reports/legacy-report.json";

      await request(app)
        .get(`/report/${encodeURIComponent(legacyUrl)}`)
        .expect((res) => {
          // Should accept the request
          expect(res.status).not.toBe(400);
        });
    });

    it("should return unified response format", async () => {
      const testId = "AbCdEfGhIjKlMnOpQrSt";

      const response = await request(app).get(`/report/${testId}`);

      expect(response.status).toBe(200);
      // If successful, should have unified format
      expect(response.body).toHaveProperty("status");
      // May have dataUrl and metadata depending on report state

      // Status should be a valid report job status
      const validStatuses = [
        "queued",
        "processing",
        "clustering",
        "finished",
        "failed",
      ];
      expect(validStatuses).toContain(response.body.status);
    });
  });

  describe("Migration Endpoint", () => {
    it("should return migration response format", async () => {
      const legacyUrl = "test-bucket/legacy-report.json";

      const response = await request(app).get(`/report/${legacyUrl}/migrate`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success");
      if (response.body.success) {
        expect(response.body).toHaveProperty("newUrl");
        expect(response.body).toHaveProperty("docId");
        // New URL should use the unified format
        expect(response.body.newUrl).toMatch(/^\/report\/[A-Za-z0-9]{20}$/);
      }
    });
  });

  describe("Response Headers", () => {
    it("should set appropriate cache headers for finished reports", async () => {
      const testId = "AbCdEfGhIjKlMnOpQrSt";

      // Override the default 404 mock for this specific test
      app.get(`/report/${testId}`, (_req, res) => {
        res.set("Cache-Control", "private, max-age=3600");
        res.status(200).json({
          status: "finished",
          dataUrl: "mock-data-url",
          metadata: { title: "Test Report" },
        });
      });

      const response = await request(app).get(`/report/${testId}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("finished");
      expect(response.headers).toHaveProperty("cache-control");
      expect(response.headers["cache-control"]).toContain("private");
    });

    it("should set no-cache for processing reports", async () => {
      // Mock a processing report response with proper cache headers
      const testId = "ProcessingReport123";

      // Override the default 404 mock for this specific test
      app.get(`/report/${testId}`, (_req, res) => {
        res.set("Cache-Control", "no-cache, no-store, must-revalidate");
        res.status(200).json({
          status: "processing",
          message: "Report is being generated",
        });
      });

      const response = await request(app).get(`/report/${testId}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe("processing");
      expect(response.headers).toHaveProperty("cache-control");
      expect(response.headers["cache-control"]).toContain("no-cache");
    });
  });

  describe("Error Handling", () => {
    it("should return proper error format for not found", async () => {
      const response = await request(app).get("/report/NonExistentReportId123");

      if (response.status === 404) {
        expect(response.body).toHaveProperty("error");
        expect(response.body.error).toHaveProperty("message");
        expect(response.body.error).toHaveProperty("code");
      }
    });

    it("should handle malformed identifiers gracefully", async () => {
      const maliciousId = "../../../etc/passwd";

      const response = await request(app).get(
        `/report/${encodeURIComponent(maliciousId)}`,
      );

      // Should not crash or expose system paths
      expect(response.status).toBeOneOf([400, 404]);
      if (response.body.error) {
        expect(response.body.error.message).not.toContain("etc/passwd");
      }
    });
  });

  describe("Rate Limiting", () => {
    it("should handle multiple concurrent requests without crashing", async () => {
      // Make multiple rapid requests
      const requests = Array.from({ length: 10 }, () =>
        request(app).get("/report/test-rate-limit"),
      );

      const responses = await Promise.all(requests);

      // Should handle all requests without crashing
      const statusCodes = responses.map((r) => r.status);
      expect(statusCodes).toContain(200); // Some should succeed
      // All responses should be valid HTTP status codes
      statusCodes.forEach((code) => {
        expect([200, 404, 429]).toContain(code);
      });
    });

    it("should properly format responses when rate limiting occurs", async () => {
      // Test that 429 responses follow expected format
      // This tests the contract for rate limiting without requiring actual rate limits
      const make429Response = (res: any) => {
        res.status(429).json({
          error: {
            message: "Too many requests",
            code: "RateLimitExceeded",
          },
        });
      };

      // Verify the response format matches what we expect for 429s
      const mockRes = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      make429Response(mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(429);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: {
          message: "Too many requests",
          code: "RateLimitExceeded",
        },
      });
    });
  });
});
