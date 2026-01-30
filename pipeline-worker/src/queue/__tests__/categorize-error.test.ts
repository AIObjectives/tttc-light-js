import { describe, expect, it } from "vitest";
import { categorizeError } from "../handler";

describe("categorizeError", () => {
  describe("GCS HTTP status code errors (numeric codes)", () => {
    it("should categorize transient errors as retryable", () => {
      const transientCodes = [408, 429, 500, 503, 504, 599];

      for (const code of transientCodes) {
        const error = new Error(`HTTP ${code} error`) as Error & {
          code: number;
        };
        error.code = code;
        expect(categorizeError(error)).toBe(true);
      }
    });

    it("should categorize permission errors as non-retryable", () => {
      const permissionCodes = [401, 403];

      for (const code of permissionCodes) {
        const error = new Error(`HTTP ${code} error`) as Error & {
          code: number;
        };
        error.code = code;
        expect(categorizeError(error)).toBe(false);
      }
    });

    it("should categorize not found errors as non-retryable", () => {
      const notFoundCodes = [404, 410];

      for (const code of notFoundCodes) {
        const error = new Error(`HTTP ${code} error`) as Error & {
          code: number;
        };
        error.code = code;
        expect(categorizeError(error)).toBe(false);
      }
    });

    it("should categorize other 4xx client errors as non-retryable", () => {
      const clientErrorCodes = [400, 405, 409, 422];

      for (const code of clientErrorCodes) {
        const error = new Error(`HTTP ${code} error`) as Error & {
          code: number;
        };
        error.code = code;
        expect(categorizeError(error)).toBe(false);
      }
    });
  });

  describe("Firestore string code errors", () => {
    it("should categorize transient Firestore errors as retryable", () => {
      const transientCodes = [
        "unavailable",
        "deadline-exceeded",
        "resource-exhausted",
        "aborted",
        "cancelled",
        "internal",
      ];

      for (const code of transientCodes) {
        const error = new Error(`Firestore error: ${code}`) as Error & {
          code: string;
        };
        error.code = code;
        expect(categorizeError(error)).toBe(true);
      }
    });

    it("should categorize permanent Firestore errors as non-retryable", () => {
      const permanentCodes = [
        "permission-denied",
        "unauthenticated",
        "not-found",
        "already-exists",
        "failed-precondition",
        "invalid-argument",
        "out-of-range",
        "unimplemented",
        "data-loss",
      ];

      for (const code of permanentCodes) {
        const error = new Error(`Firestore error: ${code}`) as Error & {
          code: string;
        };
        error.code = code;
        expect(categorizeError(error)).toBe(false);
      }
    });

    it("should handle case-insensitive Firestore error codes", () => {
      const uppercaseError = new Error("UNAVAILABLE") as Error & {
        code: string;
      };
      uppercaseError.code = "UNAVAILABLE";
      expect(categorizeError(uppercaseError)).toBe(true);

      const mixedCaseError = new Error("Permission-Denied") as Error & {
        code: string;
      };
      mixedCaseError.code = "Permission-Denied";
      expect(categorizeError(mixedCaseError)).toBe(false);
    });
  });

  describe("String pattern matching fallback", () => {
    it("should detect transient errors from message patterns", () => {
      const transientPatterns = [
        "Connection timeout occurred",
        "Error: ETIMEDOUT",
        "ECONNREFUSED",
        "ECONNRESET",
        "Service unavailable",
        "Server returned 503",
        "Gateway timeout 504",
        "Rate limit 429",
        "deadline exceeded",
      ];

      for (const pattern of transientPatterns) {
        const error = new Error(pattern);
        expect(categorizeError(error)).toBe(true);
      }
    });

    it("should detect permanent errors from message patterns", () => {
      const permanentPatterns = [
        "Permission denied",
        "Access denied to resource",
        "Unauthorized access",
        "Forbidden operation",
        "Resource not found",
        "No such object exists",
        "Invalid argument provided",
        "Error 403",
        "Error 401",
        "Error 404",
      ];

      for (const pattern of permanentPatterns) {
        const error = new Error(pattern);
        expect(categorizeError(error)).toBe(false);
      }
    });

    it("should handle case-insensitive pattern matching", () => {
      expect(categorizeError(new Error("TIMEOUT ERROR"))).toBe(true);
      expect(categorizeError(new Error("permission DENIED"))).toBe(false);
    });
  });

  describe("Unknown and edge cases", () => {
    it("should default unknown errors to non-retryable", () => {
      const unknownError = new Error("Some random error");
      expect(categorizeError(unknownError)).toBe(false);
    });

    it("should handle non-Error objects", () => {
      expect(categorizeError("string error")).toBe(false);
      expect(categorizeError(null)).toBe(false);
      expect(categorizeError(undefined)).toBe(false);
      expect(categorizeError({ message: "object error" })).toBe(false);
    });

    it("should handle errors with numeric code but outside known ranges", () => {
      const error = new Error("HTTP 200 OK") as Error & { code: number };
      error.code = 200;
      expect(categorizeError(error)).toBe(false);
    });

    it("should handle errors with unknown string codes", () => {
      const error = new Error("Unknown error") as Error & { code: string };
      error.code = "unknown-error-code";
      expect(categorizeError(error)).toBe(false);
    });
  });

  describe("Real-world error scenarios", () => {
    it("should correctly categorize GCS ApiError with 403", () => {
      const gcsError = new Error("Forbidden") as Error & {
        code: number;
        errors?: unknown[];
      };
      gcsError.code = 403;
      gcsError.errors = [{ reason: "forbidden" }];
      expect(categorizeError(gcsError)).toBe(false);
    });

    it("should correctly categorize Firestore permission-denied", () => {
      const firestoreError = new Error(
        "Missing or insufficient permissions",
      ) as Error & { code: string };
      firestoreError.code = "permission-denied";
      expect(categorizeError(firestoreError)).toBe(false);
    });

    it("should correctly categorize transient network timeout", () => {
      const timeoutError = new Error("Request timeout") as Error & {
        code: number;
      };
      timeoutError.code = 504;
      expect(categorizeError(timeoutError)).toBe(true);
    });

    it("should correctly categorize Firestore unavailable error", () => {
      const unavailableError = new Error(
        "The service is currently unavailable",
      ) as Error & { code: string };
      unavailableError.code = "unavailable";
      expect(categorizeError(unavailableError)).toBe(true);
    });
  });
});
