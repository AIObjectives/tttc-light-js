import { describe, expect, it } from "vitest";
import {
  CAPABILITIES,
  DEFAULT_LIMITS,
  getUserCapabilities,
  getUserCsvSizeLimit,
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

    it("should return 2MB limit for users with large_uploads role", () => {
      const limit = getUserCsvSizeLimit(["large_uploads"]);
      expect(limit).toBe(CAPABILITIES.large_uploads.csvSizeLimit);
    });

    it("should return 2MB limit even with multiple roles including large_uploads", () => {
      const limit = getUserCsvSizeLimit([
        "some_role",
        "large_uploads",
        "another_role",
      ]);
      expect(limit).toBe(CAPABILITIES.large_uploads.csvSizeLimit);
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

    it("should return large upload capabilities for users with large_uploads role", () => {
      const capabilities = getUserCapabilities(["large_uploads"]);
      expect(capabilities).toEqual({
        csvSizeLimit: CAPABILITIES.large_uploads.csvSizeLimit,
      });
    });

    it("should be extensible for future capabilities", () => {
      const capabilities = getUserCapabilities(["large_uploads"]);
      expect(capabilities).toHaveProperty("csvSizeLimit");
      // Future capabilities would be added here
    });
  });
});
