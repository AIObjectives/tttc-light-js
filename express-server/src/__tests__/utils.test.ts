import { describe, it, expect } from "vitest";
import { formatData } from "tttc-common/utils";

describe("formatData", () => {
  describe("WhatsApp consultation format", () => {
    it("should map WhatsApp columns to standard format", () => {
      const whatsappData = [
        {
          "comment-id": "1",
          "comment-body": "This is a test comment",
          name: "Speaker A",
        },
        {
          "comment-id": "2",
          "comment-body": "Another comment",
          name: "Speaker B",
        },
      ];

      const result = formatData(whatsappData);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "1",
        comment: "This is a test comment",
        interview: "Speaker A",
      });
      expect(result[1]).toEqual({
        id: "2",
        comment: "Another comment",
        interview: "Speaker B",
      });
    });
  });

  describe("Standard T3C format", () => {
    it("should handle standard column names", () => {
      const standardData = [
        {
          id: "1",
          comment: "Standard comment",
          interview: "Speaker A",
        },
        {
          id: "2",
          comment: "Another standard comment",
          interview: "Speaker B",
        },
      ];

      const result = formatData(standardData);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "1",
        comment: "Standard comment",
        interview: "Speaker A",
      });
    });
  });

  describe("Alternative column names", () => {
    it("should map 'response' to comment", () => {
      const data = [
        {
          id: "1",
          response: "A response text",
          interview: "Speaker A",
        },
      ];

      const result = formatData(data);
      expect(result[0].comment).toBe("A response text");
    });

    it("should map 'answer' to comment", () => {
      const data = [
        {
          id: "1",
          answer: "An answer text",
          interview: "Speaker A",
        },
      ];

      const result = formatData(data);
      expect(result[0].comment).toBe("An answer text");
    });

    it("should map 'text' to comment", () => {
      const data = [
        {
          id: "1",
          text: "Some text content",
          interview: "Speaker A",
        },
      ];

      const result = formatData(data);
      expect(result[0].comment).toBe("Some text content");
    });

    it("should map 'speaker name' to interview", () => {
      const data = [
        {
          id: "1",
          comment: "A comment",
          "speaker name": "Speaker A",
        },
      ];

      const result = formatData(data);
      expect(result[0].interview).toBe("Speaker A");
    });

    it("should map 'author' to interview", () => {
      const data = [
        {
          id: "1",
          comment: "A comment",
          author: "Author Name",
        },
      ];

      const result = formatData(data);
      expect(result[0].interview).toBe("Author Name");
    });
  });

  describe("Error handling", () => {
    it("should throw error when no comment column exists", () => {
      const invalidData = [
        {
          id: "1",
          someField: "Some value",
        },
      ];

      expect(() => formatData(invalidData)).toThrow(
        /must contain a comment column/,
      );
    });

    it("should throw error for empty data", () => {
      expect(() => formatData([])).toThrow("Invalid or empty data file");
    });

    it("should throw error for null data", () => {
      // @ts-expect-error - Testing invalid input type
      expect(() => formatData(null)).toThrow("Invalid or empty data file");
    });
  });

  describe("Optional fields", () => {
    it("should handle data without interview column", () => {
      const data = [
        {
          id: "1",
          comment: "A comment without speaker",
        },
      ];

      const result = formatData(data);
      expect(result[0]).toEqual({
        id: "1",
        comment: "A comment without speaker",
      });
      expect(result[0].interview).toBeUndefined();
    });

    it("should preserve video and timestamp fields", () => {
      const data = [
        {
          id: "1",
          comment: "A comment",
          video: "video-url",
          timestamp: "00:05:30",
        },
      ];

      const result = formatData(data);
      expect(result[0]).toEqual({
        id: "1",
        comment: "A comment",
        video: "video-url",
        timestamp: "00:05:30",
      });
    });
  });

  describe("ID column fallback", () => {
    it("should use row index when no ID column exists", () => {
      const data = [
        {
          comment: "First comment",
        },
        {
          comment: "Second comment",
        },
        {
          comment: "Third comment",
        },
      ];

      const result = formatData(data);
      // When no ID column exists, it falls back to row index
      expect(result).toHaveLength(3);
      expect(result[0].id).toBe("0");
      expect(result[1].id).toBe("1");
      expect(result[2].id).toBe("2");
    });

    it("should handle 'row-id' as ID column", () => {
      const data = [
        {
          "row-id": "custom-1",
          comment: "A comment",
        },
      ];

      const result = formatData(data);
      expect(result[0].id).toBe("custom-1");
    });
  });

  describe("Column precedence", () => {
    it("should prefer 'comment' over 'comment-body' when both exist", () => {
      const data = [
        {
          id: "1",
          comment: "Primary comment",
          "comment-body": "Secondary comment",
        },
      ];

      const result = formatData(data);
      expect(result[0].comment).toBe("Primary comment");
    });

    it("should prefer 'interview' over 'name' when both exist", () => {
      const data = [
        {
          id: "1",
          comment: "A comment",
          interview: "Primary speaker",
          name: "Secondary speaker",
        },
      ];

      const result = formatData(data);
      expect(result[0].interview).toBe("Primary speaker");
    });

    it("should prefer 'id' over 'comment-id' when both exist", () => {
      const data = [
        {
          id: "primary-id",
          "comment-id": "secondary-id",
          comment: "A comment",
        },
      ];

      const result = formatData(data);
      expect(result[0].id).toBe("primary-id");
    });
  });

  describe("WhatsApp ExtraQuestion1 column", () => {
    it("should map ExtraQuestion1 to interview field", () => {
      const data = [
        {
          "comment-id": "1",
          "comment-body": "A comment",
          ExtraQuestion1: "Speaker from WhatsApp",
        },
      ];

      const result = formatData(data);
      expect(result[0].interview).toBe("Speaker from WhatsApp");
    });

    it("should prefer 'name' over 'ExtraQuestion1' when both exist", () => {
      const data = [
        {
          "comment-id": "1",
          "comment-body": "A comment",
          name: "Primary name",
          ExtraQuestion1: "Secondary name",
        },
      ];

      const result = formatData(data);
      expect(result[0].interview).toBe("Primary name");
    });
  });
});
