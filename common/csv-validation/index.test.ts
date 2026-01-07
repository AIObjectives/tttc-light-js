import { describe, expect, it } from "vitest";
import {
  COLUMN_MAPPINGS,
  formatData,
  type ValidationError,
  type ValidationSuccess,
  type ValidationWarning,
  validateCSVFormat,
} from "./index";

describe("csv-validation module", () => {
  describe("validateCSVFormat", () => {
    describe("SUCCESS cases - standard format", () => {
      it("should return success for standard column names", () => {
        const data = [
          { id: "1", comment: "Great idea!", interview: "Alice" },
          { id: "2", comment: "I agree", interview: "Bob" },
        ];

        const result = validateCSVFormat(data) as ValidationSuccess;

        expect(result.status).toBe("success");
        expect(result.data).toHaveLength(2);
        expect(result.data[0]).toEqual({
          id: "1",
          comment: "Great idea!",
          interview: "Alice",
        });
        expect(result.mappings.comment.isStandard).toBe(true);
        expect(result.mappings.id.isStandard).toBe(true);
        expect(result.mappings.interview.isStandard).toBe(true);
        expect(result.warnings).toBeUndefined();
      });

      it("should return success with optional video and timestamp columns", () => {
        const data = [
          {
            id: "1",
            comment: "Test",
            interview: "Speaker",
            video: "https://video.url",
            timestamp: "2024-01-01",
          },
        ];

        const result = validateCSVFormat(data) as ValidationSuccess;

        expect(result.status).toBe("success");
        expect(result.data[0].video).toBe("https://video.url");
        expect(result.data[0].timestamp).toBe("2024-01-01");
        expect(result.mappings.video.detected).toBe("video");
        expect(result.mappings.timestamp.detected).toBe("timestamp");
      });

      it("should handle case-insensitive matching for standard names", () => {
        const data = [{ ID: "1", COMMENT: "Text", INTERVIEW: "Speaker" }];

        const result = validateCSVFormat(data) as ValidationSuccess;

        expect(result.status).toBe("success");
        expect(result.mappings.id.detected).toBe("ID");
        expect(result.mappings.comment.detected).toBe("COMMENT");
        expect(result.mappings.interview.detected).toBe("INTERVIEW");
        // Case-insensitive, so still considered standard
        expect(result.mappings.id.isStandard).toBe(true);
        expect(result.mappings.comment.isStandard).toBe(true);
        expect(result.mappings.interview.isStandard).toBe(true);
      });
    });

    describe("WARNING cases - non-standard but mappable", () => {
      it("should return warning for non-standard comment column name", () => {
        const data = [{ id: "1", "comment-body": "Text", interview: "Alice" }];

        const result = validateCSVFormat(data) as ValidationWarning;

        expect(result.status).toBe("warning");
        expect(result.data).toHaveLength(1);
        expect(result.data[0].comment).toBe("Text");
        expect(result.mappings.comment.detected).toBe("comment-body");
        expect(result.mappings.comment.isStandard).toBe(false);
        expect(result.warnings).toContain(
          'Using "comment-body" column for participant comments (non-standard)',
        );
      });

      it("should return warning when ID column is missing (uses row index fallback)", () => {
        const data = [
          { comment: "First comment" },
          { comment: "Second comment" },
        ];

        const result = validateCSVFormat(data) as ValidationWarning;

        expect(result.status).toBe("warning");
        expect(result.data[0].id).toBe("0");
        expect(result.data[1].id).toBe("1");
        expect(result.mappings.id.detected).toBeNull();
        expect(result.mappings.id.usingFallback).toBe(true);
        expect(result.warnings).toContain(
          'No "ID" column detected - row numbers will be used as IDs',
        );
      });

      it("should return warning for WhatsApp format", () => {
        const data = [
          { response: "Hello", extraquestion1: "Speaker A" },
          { response: "World", extraquestion1: "Speaker B" },
        ];

        const result = validateCSVFormat(data) as ValidationWarning;

        expect(result.status).toBe("warning");
        expect(result.data).toHaveLength(2);
        expect(result.data[0].comment).toBe("Hello");
        expect(result.data[0].interview).toBe("Speaker A");
        expect(result.data[0].id).toBe("0"); // Fallback
        expect(result.mappings.comment.detected).toBe("response");
        expect(result.mappings.interview.detected).toBe("extraquestion1");
        expect(result.warnings.length).toBeGreaterThan(0);
      });

      it("should return warning when speaker column is missing", () => {
        const data = [{ id: "1", comment: "Anonymous comment" }];

        const result = validateCSVFormat(data) as ValidationWarning;

        expect(result.status).toBe("warning");
        expect(result.data[0].interview).toBeUndefined();
        expect(result.mappings.interview.detected).toBeNull();
        expect(result.warnings).toContain(
          'No "speaker" column detected - responses will be anonymous',
        );
      });

      it("should handle multiple non-standard columns at once", () => {
        const data = [{ "comment-id": "1", answer: "Text", name: "Speaker" }];

        const result = validateCSVFormat(data) as ValidationWarning;

        expect(result.status).toBe("warning");
        expect(result.data[0]).toEqual({
          id: "1",
          comment: "Text",
          interview: "Speaker",
        });
        expect(result.mappings.id.detected).toBe("comment-id");
        expect(result.mappings.comment.detected).toBe("answer");
        expect(result.mappings.interview.detected).toBe("name");
        expect(result.warnings.length).toBe(3); // All three columns are non-standard
      });
    });

    describe("ERROR cases - invalid format", () => {
      it("should return error when comment column is missing", () => {
        const data = [
          { id: "1", feedback: "This column is not in the accepted list" },
        ];

        const result = validateCSVFormat(data) as ValidationError;

        expect(result.status).toBe("error");
        expect(result.errorType).toBe("MISSING_COLUMNS");
        expect(result.missingColumns).toContain("comment");
        expect(result.suggestions).toEqual(COLUMN_MAPPINGS.COMMENT);
        expect(result.detectedHeaders).toContain("id");
        expect(result.detectedHeaders).toContain("feedback");
      });

      it("should return error for empty data array", () => {
        const result = validateCSVFormat([]) as ValidationError;

        expect(result.status).toBe("error");
        expect(result.missingColumns).toContain("all");
        expect(result.suggestions).toContain("CSV file must contain data rows");
      });

      it("should provide helpful suggestions for missing comment column", () => {
        const data = [{ feedback: "User feedback" }];

        const result = validateCSVFormat(data) as ValidationError;

        expect(result.status).toBe("error");
        expect(result.suggestions).toContain("comment");
        expect(result.suggestions).toContain("comment-body");
        expect(result.suggestions).toContain("response");
        expect(result.suggestions).toContain("answer");
        expect(result.suggestions).toContain("text");
      });
    });

    describe("Column precedence", () => {
      it("should use first matching column name in precedence order", () => {
        // "comment" has higher precedence than "response"
        const data = [{ comment: "Primary", response: "Should be ignored" }];

        const result = validateCSVFormat(data) as ValidationSuccess;

        expect(result.data[0].comment).toBe("Primary");
        expect(result.mappings.comment.detected).toBe("comment");
      });

      it("should respect ID column precedence order", () => {
        // "id" has higher precedence than "comment-id"
        const data = [
          { id: "primary", "comment-id": "ignored", comment: "text" },
        ];

        const result = validateCSVFormat(data) as ValidationSuccess;

        expect(result.data[0].id).toBe("primary");
        expect(result.mappings.id.detected).toBe("id");
      });
    });

    describe("Edge cases", () => {
      it("should handle rows with extra unknown columns", () => {
        const data = [
          {
            id: "1",
            comment: "Text",
            interview: "Speaker",
            unknown_column: "ignored",
            another_field: "also ignored",
          },
        ];

        const result = validateCSVFormat(data);

        expect(result.status).toBe("success");
        // Unknown columns are silently ignored
        expect(result.data[0]).not.toHaveProperty("unknown_column");
        expect(result.data[0]).not.toHaveProperty("another_field");
      });

      it("should convert all values to strings", () => {
        const data = [{ id: 123, comment: 456, interview: 789 }];

        const result = validateCSVFormat(data) as ValidationSuccess;

        expect(result.data[0].id).toBe("123");
        expect(result.data[0].comment).toBe("456");
        expect(result.data[0].interview).toBe("789");
      });

      it("should reject rows with empty comment values", () => {
        const data = [
          { id: "1", comment: "Valid comment", interview: "Alice" },
          { id: "2", comment: "", interview: "Bob" }, // Empty
          { id: "3", comment: "   ", interview: "Carol" }, // Whitespace only
        ];

        const result = validateCSVFormat(data) as ValidationError;

        expect(result.status).toBe("error");
        expect(result.errorType).toBe("EMPTY_COMMENTS");
        expect(result.invalidRows).toEqual([2, 3]); // 1-based row numbers
        expect(result.suggestions).toContain(
          "All rows must have non-empty comment values",
        );
      });

      it("should allow empty id and interview values", () => {
        const data = [{ id: "", comment: "Valid comment", interview: "" }];

        const result = validateCSVFormat(data) as ValidationSuccess;

        expect(result.status).not.toBe("error");
        expect(result.data[0].id).toBe("");
        expect(result.data[0].interview).toBe("");
      });

      it("should handle mixed case column names", () => {
        const data = [{ Id: "1", CoMmEnT: "Text", InTeRvIeW: "Speaker" }];

        const result = validateCSVFormat(data) as ValidationSuccess;

        expect(result.data[0]).toEqual({
          id: "1",
          comment: "Text",
          interview: "Speaker",
        });
      });
    });
  });

  describe("formatData (legacy wrapper)", () => {
    it("should delegate to validateCSVFormat and return data", () => {
      const data = [{ id: "1", comment: "Test", interview: "Speaker" }];

      const result = formatData(data);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: "1",
        comment: "Test",
        interview: "Speaker",
      });
    });

    it("should throw error when comment column is missing", () => {
      const data = [{ id: "1", feedback: "Not in accepted column list" }];

      expect(() => formatData(data)).toThrow();
      expect(() => formatData(data)).toThrow(/comment column/);
    });

    it("should throw error for empty data", () => {
      expect(() => formatData([])).toThrow(/Invalid or empty data file/);
    });

    it("should throw error for empty comment values", () => {
      const data = [
        { id: "1", comment: "Valid" },
        { id: "2", comment: "" },
        { id: "3", comment: "   " },
      ];

      expect(() => formatData(data)).toThrow(/Empty comment fields/);
      expect(() => formatData(data)).toThrow(/rows: 2, 3/);
    });

    it("should handle WhatsApp format", () => {
      const data = [{ "comment-body": "Text", name: "Speaker A" }];

      const result = formatData(data);

      expect(result[0].comment).toBe("Text");
      expect(result[0].interview).toBe("Speaker A");
      expect(result[0].id).toBe("0"); // Fallback
    });
  });

  describe("COLUMN_MAPPINGS configuration", () => {
    it("should export all column mapping arrays", () => {
      expect(COLUMN_MAPPINGS.ID).toContain("id");
      expect(COLUMN_MAPPINGS.COMMENT).toContain("comment");
      expect(COLUMN_MAPPINGS.INTERVIEW).toContain("interview");
      expect(COLUMN_MAPPINGS.VIDEO).toContain("video");
      expect(COLUMN_MAPPINGS.TIMESTAMP).toContain("timestamp");
    });

    it("should include WhatsApp format columns", () => {
      expect(COLUMN_MAPPINGS.INTERVIEW).toContain("extraquestion1");
      expect(COLUMN_MAPPINGS.INTERVIEW).toContain("name");
      expect(COLUMN_MAPPINGS.COMMENT).toContain("response");
      expect(COLUMN_MAPPINGS.COMMENT).toContain("answer");
    });

    it("should have ID column alternatives", () => {
      expect(COLUMN_MAPPINGS.ID).toContain("comment-id");
      expect(COLUMN_MAPPINGS.ID).toContain("row-id");
      expect(COLUMN_MAPPINGS.ID).toContain("i");
    });
  });
});
