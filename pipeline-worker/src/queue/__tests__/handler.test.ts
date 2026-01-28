import { describe, expect, it } from "vitest";
import { validateDataArray } from "../handler";

describe("validateDataArray", () => {
  const createComment = (
    id: string,
    text: string,
  ): { comment_id: string; comment_text: string; speaker: string } => ({
    comment_id: id,
    comment_text: text,
    speaker: "participant",
  });

  it("should return success for valid non-empty comments", () => {
    const data = [
      createComment("1", "This is a valid comment"),
      createComment("2", "Another valid comment"),
    ];

    const result = validateDataArray(data);
    expect(result.tag).toBe("success");
  });

  it("should return failure for empty data array", () => {
    const result = validateDataArray([]);
    expect(result.tag).toBe("failure");
    if (result.tag === "failure") {
      expect(result.error.message).toBe(
        "Data array is empty - no comments to process",
      );
    }
  });

  it("should return failure for empty comment text", () => {
    const data = [
      createComment("1", "Valid comment"),
      createComment("2", ""),
      createComment("3", "Another valid comment"),
    ];

    const result = validateDataArray(data);
    expect(result.tag).toBe("failure");
    if (result.tag === "failure") {
      expect(result.error.message).toBe(
        "Found 1 comment(s) with empty or whitespace-only text: 2",
      );
    }
  });

  it("should return failure for whitespace-only comment text", () => {
    const data = [
      createComment("1", "Valid comment"),
      createComment("2", "   "),
      createComment("3", "\t\n"),
    ];

    const result = validateDataArray(data);
    expect(result.tag).toBe("failure");
    if (result.tag === "failure") {
      expect(result.error.message).toBe(
        "Found 2 comment(s) with empty or whitespace-only text: 2, 3",
      );
    }
  });

  it("should list up to 5 IDs when multiple empty comments exist", () => {
    const data = [
      createComment("id1", ""),
      createComment("id2", "   "),
      createComment("id3", ""),
      createComment("id4", "  \t  "),
      createComment("id5", ""),
      createComment("id6", ""),
      createComment("id7", ""),
    ];

    const result = validateDataArray(data);
    expect(result.tag).toBe("failure");
    if (result.tag === "failure") {
      expect(result.error.message).toBe(
        "Found 7 comment(s) with empty or whitespace-only text: id1, id2, id3, id4, id5 and 2 more",
      );
    }
  });

  it("should return success for comments with leading/trailing whitespace but content", () => {
    const data = [
      createComment("1", "  Valid comment with spaces  "),
      createComment("2", "\tTabbed comment\t"),
    ];

    const result = validateDataArray(data);
    expect(result.tag).toBe("success");
  });

  it("should return success for single valid comment", () => {
    const data = [createComment("1", "Single valid comment")];

    const result = validateDataArray(data);
    expect(result.tag).toBe("success");
  });

  it("should handle exactly 5 empty comments without 'and more' suffix", () => {
    const data = [
      createComment("id1", ""),
      createComment("id2", ""),
      createComment("id3", ""),
      createComment("id4", ""),
      createComment("id5", ""),
    ];

    const result = validateDataArray(data);
    expect(result.tag).toBe("failure");
    if (result.tag === "failure") {
      expect(result.error.message).toBe(
        "Found 5 comment(s) with empty or whitespace-only text: id1, id2, id3, id4, id5",
      );
    }
  });
});
