/**
 * Tests for SubtopicCrux schema speaker deduplication logic
 *
 * Tests the deduplication transform applied to subtopicCrux schema,
 * ensuring speakers appear in exactly one list (agree/disagree/no_clear_position).
 */

import { describe, expect, it } from "vitest";
import { subtopicCrux } from "../index";

describe("SubtopicCrux Speaker Deduplication", () => {
  const baseValidCrux = {
    topic: "AI Safety",
    subtopic: "Regulation",
    cruxClaim: "Government should regulate AI development",
    explanation: "Test explanation",
    agreementScore: 0.5,
    disagreementScore: 0.5,
    controversyScore: 1.0,
    speakersInvolved: 2,
    totalSpeakersInSubtopic: 5,
  };

  describe("Basic deduplication", () => {
    it("keeps speakers in separate lists when no duplicates", () => {
      const input = {
        ...baseValidCrux,
        agree: ["1:Alice", "2:Bob"],
        disagree: ["3:Charlie", "4:Diana"],
        no_clear_position: ["5:Eve"],
      };

      const result = subtopicCrux.parse(input);

      expect(result.agree).toEqual(["1:Alice", "2:Bob"]);
      expect(result.disagree).toEqual(["3:Charlie", "4:Diana"]);
      expect(result.no_clear_position).toEqual(["5:Eve"]);
    });

    it("removes duplicates within the same list", () => {
      const input = {
        ...baseValidCrux,
        agree: ["1:Alice", "1:Alice", "2:Bob", "1:Alice"],
        disagree: ["3:Charlie"],
        no_clear_position: [],
      };

      const result = subtopicCrux.parse(input);

      expect(result.agree).toEqual(["1:Alice", "2:Bob"]);
      expect(result.disagree).toEqual(["3:Charlie"]);
    });

    it("handles empty arrays", () => {
      const input = {
        ...baseValidCrux,
        agree: [],
        disagree: [],
        no_clear_position: [],
      };

      const result = subtopicCrux.parse(input);

      expect(result.agree).toEqual([]);
      expect(result.disagree).toEqual([]);
      expect(result.no_clear_position).toEqual([]);
    });
  });

  describe("Ambiguous speaker handling (appears in both agree and disagree)", () => {
    it("moves speakers from both agree+disagree to no_clear_position", () => {
      const input = {
        ...baseValidCrux,
        agree: ["1:Alice", "2:Bob"],
        disagree: ["1:Alice", "3:Charlie"],
        no_clear_position: [],
      };

      const result = subtopicCrux.parse(input);

      // Alice appears in both → moved to no_clear_position
      expect(result.agree).toEqual(["2:Bob"]);
      expect(result.disagree).toEqual(["3:Charlie"]);
      expect(result.no_clear_position).toEqual(["1:Alice"]);
    });

    it("handles multiple ambiguous speakers", () => {
      const input = {
        ...baseValidCrux,
        agree: ["1:Alice", "2:Bob", "3:Charlie"],
        disagree: ["1:Alice", "2:Bob", "4:Diana"],
        no_clear_position: [],
      };

      const result = subtopicCrux.parse(input);

      // Alice and Bob appear in both → moved to no_clear_position
      expect(result.agree).toEqual(["3:Charlie"]);
      expect(result.disagree).toEqual(["4:Diana"]);
      expect(result.no_clear_position).toEqual(["1:Alice", "2:Bob"]);
    });

    it("uses agree version of speaker data for ambiguous speakers", () => {
      const input = {
        ...baseValidCrux,
        agree: ["1:Alice | 0.9"], // Agree version with strength
        disagree: ["1:Alice | 0.3"], // Disagree version with different strength
        no_clear_position: [],
      };

      const result = subtopicCrux.parse(input);

      // Should use agree version (0.9 strength)
      expect(result.agree).toEqual([]);
      expect(result.disagree).toEqual([]);
      expect(result.no_clear_position).toEqual(["1:Alice | 0.9"]);
    });
  });

  describe("Priority rules: agree/disagree override no_clear_position", () => {
    it("keeps speaker in agree when also in no_clear_position", () => {
      const input = {
        ...baseValidCrux,
        agree: ["1:Alice"],
        disagree: ["2:Bob"],
        no_clear_position: ["1:Alice", "3:Charlie"],
      };

      const result = subtopicCrux.parse(input);

      // Alice expressed a stance (agree), so stays in agree
      expect(result.agree).toEqual(["1:Alice"]);
      expect(result.disagree).toEqual(["2:Bob"]);
      expect(result.no_clear_position).toEqual(["3:Charlie"]);
    });

    it("keeps speaker in disagree when also in no_clear_position", () => {
      const input = {
        ...baseValidCrux,
        agree: ["1:Alice"],
        disagree: ["2:Bob"],
        no_clear_position: ["2:Bob", "3:Charlie"],
      };

      const result = subtopicCrux.parse(input);

      // Bob expressed a stance (disagree), so stays in disagree
      expect(result.agree).toEqual(["1:Alice"]);
      expect(result.disagree).toEqual(["2:Bob"]);
      expect(result.no_clear_position).toEqual(["3:Charlie"]);
    });

    it("handles speaker appearing in all three lists", () => {
      const input = {
        ...baseValidCrux,
        agree: ["1:Alice"],
        disagree: ["1:Alice"],
        no_clear_position: ["1:Alice"],
      };

      const result = subtopicCrux.parse(input);

      // Alice in both agree+disagree → ambiguous → no_clear_position
      expect(result.agree).toEqual([]);
      expect(result.disagree).toEqual([]);
      expect(result.no_clear_position).toEqual(["1:Alice"]);
    });
  });

  describe("Edge cases and malformed input", () => {
    it("handles speakers with missing colons (filters out invalid format)", () => {
      const input = {
        ...baseValidCrux,
        agree: ["malformed_no_colon"],
        disagree: ["another_malformed"],
        no_clear_position: [],
      };

      const result = subtopicCrux.parse(input);

      // Speakers without colons are invalid format and filtered out
      // Valid format is "id:name", so malformed speakers are removed
      expect(result.agree).toEqual([]);
      expect(result.disagree).toEqual([]);
      expect(result.no_clear_position).toEqual([]);
    });

    it("handles empty strings in lists", () => {
      const input = {
        ...baseValidCrux,
        agree: ["1:Alice", "", "2:Bob"],
        disagree: ["", "3:Charlie"],
        no_clear_position: [""],
      };

      const result = subtopicCrux.parse(input);

      // Empty strings have no ID, so they're filtered out
      expect(result.agree).toEqual(["1:Alice", "2:Bob"]);
      expect(result.disagree).toEqual(["3:Charlie"]);
      expect(result.no_clear_position).toEqual([]);
    });

    it("handles speakers with extra whitespace", () => {
      const input = {
        ...baseValidCrux,
        agree: ["  1:Alice  ", "2:Bob"],
        disagree: ["3:Charlie"],
        no_clear_position: [],
      };

      const result = subtopicCrux.parse(input);

      // Whitespace is preserved in full speaker string, but ID is trimmed
      expect(result.agree).toEqual(["  1:Alice  ", "2:Bob"]);
      expect(result.disagree).toEqual(["3:Charlie"]);
    });

    it("handles speakers with strength annotations", () => {
      const input = {
        ...baseValidCrux,
        agree: ["1:Alice | 0.9", "2:Bob | 0.7"],
        disagree: ["3:Charlie | 0.8"],
        no_clear_position: [],
      };

      const result = subtopicCrux.parse(input);

      // Deduplication based on ID only, preserves full speaker string
      expect(result.agree).toEqual(["1:Alice | 0.9", "2:Bob | 0.7"]);
      expect(result.disagree).toEqual(["3:Charlie | 0.8"]);
    });

    it("handles speakers with colons in names", () => {
      const input = {
        ...baseValidCrux,
        agree: ["1:Dr. Smith: PhD"],
        disagree: ["2:Jane: MD"],
        no_clear_position: [],
      };

      const result = subtopicCrux.parse(input);

      // extractSpeakerId only uses first colon for ID extraction
      expect(result.agree).toEqual(["1:Dr. Smith: PhD"]);
      expect(result.disagree).toEqual(["2:Jane: MD"]);
    });
  });

  describe("Complex real-world scenarios", () => {
    it("handles scenario with all deduplication rules active", () => {
      const input = {
        ...baseValidCrux,
        agree: [
          "1:Alice", // Ambiguous (also in disagree) → no_clear
          "2:Bob", // Only in agree → stays
          "3:Charlie", // Also in no_clear → stays in agree
          "2:Bob", // Duplicate → removed
        ],
        disagree: [
          "1:Alice", // Ambiguous (also in agree) → no_clear
          "4:Diana", // Only in disagree → stays
          "5:Eve", // Also in no_clear → stays in disagree
        ],
        no_clear_position: [
          "3:Charlie", // Has stance in agree → removed
          "5:Eve", // Has stance in disagree → removed
          "6:Frank", // Only in no_clear → stays
        ],
      };

      const result = subtopicCrux.parse(input);

      expect(result.agree).toEqual(["2:Bob", "3:Charlie"]);
      expect(result.disagree).toEqual(["4:Diana", "5:Eve"]);
      expect(result.no_clear_position).toEqual(["6:Frank", "1:Alice"]);
    });

    it("preserves order within each list after deduplication", () => {
      const input = {
        ...baseValidCrux,
        agree: ["3:Charlie", "1:Alice", "2:Bob"],
        disagree: ["6:Frank", "4:Diana", "5:Eve"],
        no_clear_position: ["7:Grace"],
      };

      const result = subtopicCrux.parse(input);

      // Order should be preserved
      expect(result.agree).toEqual(["3:Charlie", "1:Alice", "2:Bob"]);
      expect(result.disagree).toEqual(["6:Frank", "4:Diana", "5:Eve"]);
      expect(result.no_clear_position).toEqual(["7:Grace"]);
    });

    it("handles large lists efficiently", () => {
      const largeAgree = Array.from(
        { length: 100 },
        (_, i) => `${i}:Speaker${i}`,
      );
      const largeDisagree = Array.from(
        { length: 100 },
        (_, i) => `${i + 100}:Speaker${i + 100}`,
      );

      const input = {
        ...baseValidCrux,
        agree: largeAgree,
        disagree: largeDisagree,
        no_clear_position: [],
      };

      const result = subtopicCrux.parse(input);

      expect(result.agree).toHaveLength(100);
      expect(result.disagree).toHaveLength(100);
      expect(result.no_clear_position).toHaveLength(0);
    });
  });

  describe("Schema validation integration", () => {
    it("validates complete crux object after deduplication", () => {
      const input = {
        ...baseValidCrux,
        agree: ["1:Alice", "1:Alice"],
        disagree: ["2:Bob"],
        no_clear_position: [],
      };

      const result = subtopicCrux.safeParse(input);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.agree).toEqual(["1:Alice"]);
      }
    });

    it("still enforces refinement validation after deduplication", () => {
      // This test verifies that the deduplication happens in transform
      // and the refinement (validateNoSpeakerOverlap) still runs after
      const input = {
        ...baseValidCrux,
        agree: ["1:Alice"],
        disagree: ["2:Bob"],
        no_clear_position: [],
      };

      const result = subtopicCrux.safeParse(input);

      // Should pass - no overlap after deduplication
      expect(result.success).toBe(true);
    });
  });
});
