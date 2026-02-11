import { describe, expect, it } from "vitest";
import {
  CAPABILITIES,
  DEFAULT_LIMITS,
  getUserCapabilities,
  getUserCsvSizeLimit,
  isEventOrganizer,
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

  describe("isEventOrganizer", () => {
    it("should return false for users with no roles", () => {
      const result = isEventOrganizer([]);
      expect(result).toBe(false);
    });

    it("should return false for users with unrelated roles", () => {
      const result = isEventOrganizer(["large_uploads", "other_role"]);
      expect(result).toBe(false);
    });

    it("should return true for users with event_organizer role", () => {
      const result = isEventOrganizer(["event_organizer"]);
      expect(result).toBe(true);
    });

    it("should return true when event_organizer is among multiple roles", () => {
      const result = isEventOrganizer([
        "large_uploads",
        "event_organizer",
        "other_role",
      ]);
      expect(result).toBe(true);
    });
  });

  describe("getUserCapabilities", () => {
    it("should return default capabilities for users with no roles", () => {
      const capabilities = getUserCapabilities([]);
      expect(capabilities).toEqual({
        csvSizeLimit: DEFAULT_LIMITS.csvSizeLimit,
        canViewElicitationTracking: false,
      });
    });

    it("should return large upload capabilities for users with large_uploads role", () => {
      const capabilities = getUserCapabilities(["large_uploads"]);
      expect(capabilities).toEqual({
        csvSizeLimit: CAPABILITIES.large_uploads.csvSizeLimit,
        canViewElicitationTracking: false,
      });
    });

    it("should return elicitation tracking capability for event organizers", () => {
      const capabilities = getUserCapabilities(["event_organizer"]);
      expect(capabilities).toEqual({
        csvSizeLimit: DEFAULT_LIMITS.csvSizeLimit,
        canViewElicitationTracking: true,
      });
    });

    it("should combine capabilities from multiple roles", () => {
      const capabilities = getUserCapabilities([
        "large_uploads",
        "event_organizer",
      ]);
      expect(capabilities).toEqual({
        csvSizeLimit: CAPABILITIES.large_uploads.csvSizeLimit,
        canViewElicitationTracking: true,
      });
    });

    it("should be extensible for future capabilities", () => {
      const capabilities = getUserCapabilities(["large_uploads"]);
      expect(capabilities).toHaveProperty("csvSizeLimit");
      expect(capabilities).toHaveProperty("canViewElicitationTracking");
      // Future capabilities would be added here
    });
  });
});
