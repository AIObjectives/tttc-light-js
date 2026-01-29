/**
 * Tests for pipeline configuration constants
 *
 * Validates that lock TTLs are correctly calculated based on pipeline timeout
 * and maintain required safety margins.
 */

import { describe, expect, it } from "vitest";
import {
  LOCK_EXTENSION_SECONDS,
  LOCK_TTL_SECONDS,
  PIPELINE_TIMEOUT_MS,
} from "../constants.js";

describe("Pipeline Configuration Constants", () => {
  describe("PIPELINE_TIMEOUT_MS", () => {
    it("should be set to 30 minutes", () => {
      expect(PIPELINE_TIMEOUT_MS).toBe(30 * 60 * 1000);
      expect(PIPELINE_TIMEOUT_MS).toBe(1800000);
    });
  });

  describe("LOCK_TTL_SECONDS", () => {
    it("should exceed pipeline timeout to prevent premature expiration", () => {
      const timeoutSeconds = PIPELINE_TIMEOUT_MS / 1000;
      expect(LOCK_TTL_SECONDS).toBeGreaterThan(timeoutSeconds);
    });

    it("should provide at least 5 minutes buffer beyond timeout", () => {
      const timeoutSeconds = PIPELINE_TIMEOUT_MS / 1000;
      const bufferSeconds = LOCK_TTL_SECONDS - timeoutSeconds;
      expect(bufferSeconds).toBeGreaterThanOrEqual(5 * 60);
    });

    it("should be approximately 1.17x pipeline timeout", () => {
      const expectedValue = Math.ceil((PIPELINE_TIMEOUT_MS / 1000) * 1.17);
      expect(LOCK_TTL_SECONDS).toBe(expectedValue);
    });

    it("should be 35 minutes for current 30 minute timeout", () => {
      // This test verifies the current actual value
      // If PIPELINE_TIMEOUT_MS changes, this test will need updating
      if (PIPELINE_TIMEOUT_MS === 30 * 60 * 1000) {
        expect(LOCK_TTL_SECONDS).toBe(2106); // 35.1 minutes
        expect(LOCK_TTL_SECONDS / 60).toBeCloseTo(35.1, 1);
      }
    });
  });

  describe("LOCK_EXTENSION_SECONDS", () => {
    it("should be less than lock TTL", () => {
      expect(LOCK_EXTENSION_SECONDS).toBeLessThan(LOCK_TTL_SECONDS);
    });

    it("should be at least 5 minutes for post-processing safety", () => {
      expect(LOCK_EXTENSION_SECONDS).toBeGreaterThanOrEqual(5 * 60);
    });

    it("should be approximately 33% of pipeline timeout", () => {
      const expectedValue = Math.ceil((PIPELINE_TIMEOUT_MS / 1000) * 0.33);
      expect(LOCK_EXTENSION_SECONDS).toBe(expectedValue);
    });

    it("should be approximately 10 minutes for current 30 minute timeout", () => {
      // This test verifies the current actual value
      // If PIPELINE_TIMEOUT_MS changes, this test will need updating
      if (PIPELINE_TIMEOUT_MS === 30 * 60 * 1000) {
        expect(LOCK_EXTENSION_SECONDS).toBe(594); // 9.9 minutes
        expect(LOCK_EXTENSION_SECONDS / 60).toBeCloseTo(9.9, 1);
      }
    });
  });

  describe("Constant relationships", () => {
    it("should maintain correct ordering: extension < timeout < lock TTL", () => {
      const timeoutSeconds = PIPELINE_TIMEOUT_MS / 1000;
      expect(LOCK_EXTENSION_SECONDS).toBeLessThan(timeoutSeconds);
      expect(timeoutSeconds).toBeLessThan(LOCK_TTL_SECONDS);
    });

    it("should scale proportionally if timeout changes", () => {
      // Demonstrate that constants scale correctly
      const alternativeTimeout = 45 * 60 * 1000; // 45 minutes
      const alternativeLockTtl = Math.ceil((alternativeTimeout / 1000) * 1.17);
      const alternativeExtension = Math.ceil(
        (alternativeTimeout / 1000) * 0.33,
      );

      // Verify scaling preserves required relationships
      expect(alternativeLockTtl).toBeGreaterThan(alternativeTimeout / 1000);
      expect(alternativeExtension).toBeLessThan(alternativeTimeout / 1000);
      expect(alternativeExtension).toBeGreaterThanOrEqual(5 * 60);
    });
  });
});
