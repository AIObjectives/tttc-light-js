import { describe, expect, it } from "vitest";
import {
  COLLECTIONS,
  convertTimestamps,
  getCollectionName,
  getUrlFormat,
} from "../firestore";

describe("firestore CLI utilities", () => {
  describe("COLLECTIONS", () => {
    it("should have correct collection names", () => {
      expect(COLLECTIONS.REPORT_REF).toBe("reportRef");
      expect(COLLECTIONS.REPORT_JOB).toBe("reportJob");
      expect(COLLECTIONS.USERS).toBe("users");
      expect(COLLECTIONS.FEEDBACK).toBe("feedback");
    });
  });

  describe("getCollectionName", () => {
    it("should return base name for prod environment", () => {
      expect(getCollectionName("REPORT_REF", "prod")).toBe("reportRef");
      expect(getCollectionName("REPORT_JOB", "prod")).toBe("reportJob");
      expect(getCollectionName("USERS", "prod")).toBe("users");
      expect(getCollectionName("FEEDBACK", "prod")).toBe("feedback");
    });

    it("should append _dev suffix for dev environment", () => {
      expect(getCollectionName("REPORT_REF", "dev")).toBe("reportRef_dev");
      expect(getCollectionName("REPORT_JOB", "dev")).toBe("reportJob_dev");
      expect(getCollectionName("USERS", "dev")).toBe("users_dev");
      expect(getCollectionName("FEEDBACK", "dev")).toBe("feedback_dev");
    });
  });

  describe("getUrlFormat", () => {
    it("should return 'legacy' for undefined URI", () => {
      expect(getUrlFormat(undefined)).toBe("legacy");
    });

    it("should return 'legacy' for empty string", () => {
      expect(getUrlFormat("")).toBe("legacy");
    });

    it("should return 'id:v1' for 20-char alphanumeric filename", () => {
      // 20-char alphanumeric Firestore IDs
      expect(
        getUrlFormat(
          "https://storage.googleapis.com/bucket/abc123def456ghi789jk.json",
        ),
      ).toBe("id:v1");
      expect(
        getUrlFormat(
          "https://storage.googleapis.com/bucket/ABCDEFGHIJ1234567890.json",
        ),
      ).toBe("id:v1");
    });

    it("should return 'legacy' for non-standard filenames", () => {
      // Legacy filenames (not 20-char alphanumeric)
      expect(
        getUrlFormat("https://storage.googleapis.com/bucket/my-report.json"),
      ).toBe("legacy");
      expect(
        getUrlFormat(
          "https://storage.googleapis.com/bucket/report-2024-01-01.json",
        ),
      ).toBe("legacy");
      expect(
        getUrlFormat("https://storage.googleapis.com/bucket/short.json"),
      ).toBe("legacy");
      // Too long
      expect(
        getUrlFormat(
          "https://storage.googleapis.com/bucket/abc123def456ghi789jk1.json",
        ),
      ).toBe("legacy");
      // Contains special characters
      expect(
        getUrlFormat(
          "https://storage.googleapis.com/bucket/abc123def456ghi789j-.json",
        ),
      ).toBe("legacy");
    });
  });

  describe("convertTimestamps", () => {
    it("should pass through primitive values unchanged", () => {
      const input = {
        string: "hello",
        number: 42,
        boolean: true,
        null: null,
      };
      expect(convertTimestamps(input)).toEqual(input);
    });

    it("should handle nested objects", () => {
      const input = {
        outer: {
          inner: {
            value: "test",
          },
        },
      };
      expect(convertTimestamps(input)).toEqual(input);
    });

    it("should handle arrays of primitives", () => {
      const input = {
        tags: ["tag1", "tag2", "tag3"],
        numbers: [1, 2, 3],
      };
      expect(convertTimestamps(input)).toEqual(input);
    });

    it("should handle arrays of objects", () => {
      const input = {
        items: [
          { name: "item1", value: 1 },
          { name: "item2", value: 2 },
        ],
      };
      expect(convertTimestamps(input)).toEqual(input);
    });

    it("should handle empty objects and arrays", () => {
      const input = {
        emptyObj: {},
        emptyArr: [],
      };
      expect(convertTimestamps(input)).toEqual(input);
    });

    // Note: Firestore Timestamp conversion is tested implicitly through integration
    // since we can't easily mock admin.firestore.Timestamp in unit tests
  });
});
