import { describe, it, expect } from "vitest";
import {
  getUserCsvSizeLimit,
  getUserCapabilities,
  CAPABILITIES,
  DEFAULT_LIMITS,
} from "../index";

describe("Permission System", () => {
  describe("getUserCsvSizeLimit", () => {
    it("should return default limit for users with no roles", () => {
      const limit = getUserCsvSizeLimit([]);
      expect(limit).toBe(DEFAULT_LIMITS.csvSizeLimit);
    });

    it("should return default limit for users with unrelated roles", () => {
      const limit = getUserCsvSizeLimit(["some_other_role", "another_role"]);
      expect(limit).toBe(DEFAULT_LIMITS.csvSizeLimit);
    });

    it("should return default limit for users with large_uploads role but no feature flag", () => {
      const limit = getUserCsvSizeLimit(["large_uploads"], false);
      expect(limit).toBe(DEFAULT_LIMITS.csvSizeLimit);
    });

    it("should return 2MB limit for users with large_uploads role AND feature flag enabled", () => {
      const limit = getUserCsvSizeLimit(["large_uploads"], true);
      expect(limit).toBe(CAPABILITIES.large_uploads.csvSizeLimit);
    });

    it("should return 2MB limit even with multiple roles including large_uploads when feature flag enabled", () => {
      const limit = getUserCsvSizeLimit(
        ["some_role", "large_uploads", "another_role"],
        true,
      );
      expect(limit).toBe(CAPABILITIES.large_uploads.csvSizeLimit);
    });

    it("should return default limit even with multiple roles including large_uploads when feature flag disabled", () => {
      const limit = getUserCsvSizeLimit(
        ["some_role", "large_uploads", "another_role"],
        false,
      );
      expect(limit).toBe(DEFAULT_LIMITS.csvSizeLimit);
    });

    it("should handle empty roles array gracefully", () => {
      const limit = getUserCsvSizeLimit([]);
      expect(limit).toBeDefined();
      expect(limit).toBeGreaterThan(0);
    });
  });

  describe("getUserCapabilities", () => {
    it("should return default capabilities for users with no roles", () => {
      const capabilities = getUserCapabilities([]);
      expect(capabilities).toEqual({
        csvSizeLimit: DEFAULT_LIMITS.csvSizeLimit,
      });
    });

    it("should return default capabilities for users with large_uploads role (feature flag not considered)", () => {
      const capabilities = getUserCapabilities(["large_uploads"]);
      expect(capabilities).toEqual({
        csvSizeLimit: DEFAULT_LIMITS.csvSizeLimit,
      });
    });

    it("should be extensible for future capabilities", () => {
      const capabilities = getUserCapabilities(["large_uploads"]);
      expect(capabilities).toHaveProperty("csvSizeLimit");
      // Future capabilities would be added here
    });
  });
});
