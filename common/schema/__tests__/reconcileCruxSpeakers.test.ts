/**
 * Unit tests for reconcileCruxSpeakers function
 *
 * Tests the core reconciliation logic in isolation, without Zod schema overhead.
 * Focuses on edge cases, performance, and correctness of the reconciliation algorithm.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { reconcileCruxSpeakers } from "../index";

describe("reconcileCruxSpeakers", () => {
  describe("Rule 1: Ambiguous speakers (in both agree AND disagree)", () => {
    it("moves speaker from both agree+disagree to no_clear_position", () => {
      const input = {
        agree: ["1:Alice"],
        disagree: ["1:Alice"],
        no_clear_position: [],
      };

      const result = reconcileCruxSpeakers(input);

      expect(result.agree).toEqual([]);
      expect(result.disagree).toEqual([]);
      expect(result.no_clear_position).toEqual(["1:Alice"]);
    });

    it("uses agree version of speaker data for ambiguous speakers", () => {
      const input = {
        agree: ["1:Alice | 0.9"], // Agree version has strength 0.9
        disagree: ["1:Alice | 0.3"], // Disagree version has strength 0.3
        no_clear_position: [],
      };

      const result = reconcileCruxSpeakers(input);

      // Should use agree version (0.9 strength)
      expect(result.no_clear_position).toEqual(["1:Alice | 0.9"]);
    });

    it("handles multiple ambiguous speakers", () => {
      const input = {
        agree: ["1:Alice", "2:Bob", "3:Charlie"],
        disagree: ["1:Alice", "2:Bob", "4:Diana"],
        no_clear_position: [],
      };

      const result = reconcileCruxSpeakers(input);

      // Alice and Bob are ambiguous
      expect(result.agree).toEqual(["3:Charlie"]);
      expect(result.disagree).toEqual(["4:Diana"]);
      expect(result.no_clear_position).toEqual(["1:Alice", "2:Bob"]);
    });
  });

  describe("Rule 2: Clear stance takes precedence over no_clear_position", () => {
    it("keeps speaker in agree when also in no_clear_position", () => {
      const input = {
        agree: ["1:Alice"],
        disagree: [],
        no_clear_position: ["1:Alice", "2:Bob"],
      };

      const result = reconcileCruxSpeakers(input);

      expect(result.agree).toEqual(["1:Alice"]);
      expect(result.disagree).toEqual([]);
      expect(result.no_clear_position).toEqual(["2:Bob"]);
    });

    it("keeps speaker in disagree when also in no_clear_position", () => {
      const input = {
        agree: [],
        disagree: ["1:Alice"],
        no_clear_position: ["1:Alice", "2:Bob"],
      };

      const result = reconcileCruxSpeakers(input);

      expect(result.agree).toEqual([]);
      expect(result.disagree).toEqual(["1:Alice"]);
      expect(result.no_clear_position).toEqual(["2:Bob"]);
    });

    it("handles speaker in all three lists (ambiguous overrides all)", () => {
      const input = {
        agree: ["1:Alice"],
        disagree: ["1:Alice"],
        no_clear_position: ["1:Alice"],
      };

      const result = reconcileCruxSpeakers(input);

      // Ambiguous (agree + disagree) takes precedence over no_clear
      expect(result.agree).toEqual([]);
      expect(result.disagree).toEqual([]);
      expect(result.no_clear_position).toEqual(["1:Alice"]);
    });
  });

  describe("Rule 3: Within-list deduplication", () => {
    it("removes duplicate speakers within agree list", () => {
      const input = {
        agree: ["1:Alice", "2:Bob", "1:Alice", "3:Charlie", "1:Alice"],
        disagree: [],
        no_clear_position: [],
      };

      const result = reconcileCruxSpeakers(input);

      expect(result.agree).toEqual(["1:Alice", "2:Bob", "3:Charlie"]);
    });

    it("removes duplicate speakers within disagree list", () => {
      const input = {
        agree: [],
        disagree: ["1:Alice", "1:Alice", "2:Bob"],
        no_clear_position: [],
      };

      const result = reconcileCruxSpeakers(input);

      expect(result.disagree).toEqual(["1:Alice", "2:Bob"]);
    });

    it("removes duplicate speakers within no_clear_position list", () => {
      const input = {
        agree: [],
        disagree: [],
        no_clear_position: ["1:Alice", "2:Bob", "1:Alice"],
      };

      const result = reconcileCruxSpeakers(input);

      expect(result.no_clear_position).toEqual(["1:Alice", "2:Bob"]);
    });

    it("preserves order when removing duplicates (first occurrence kept)", () => {
      const input = {
        agree: ["3:Charlie", "1:Alice", "2:Bob", "1:Alice"],
        disagree: [],
        no_clear_position: [],
      };

      const result = reconcileCruxSpeakers(input);

      // First "1:Alice" is kept, second is dropped
      expect(result.agree).toEqual(["3:Charlie", "1:Alice", "2:Bob"]);
    });
  });

  describe("Edge cases", () => {
    it("handles empty arrays", () => {
      const input = {
        agree: [],
        disagree: [],
        no_clear_position: [],
      };

      const result = reconcileCruxSpeakers(input);

      expect(result.agree).toEqual([]);
      expect(result.disagree).toEqual([]);
      expect(result.no_clear_position).toEqual([]);
    });

    it("handles malformed speaker IDs (no colon)", () => {
      const input = {
        agree: ["malformed"],
        disagree: ["another_malformed"],
        no_clear_position: [],
      };

      const result = reconcileCruxSpeakers(input);

      // Malformed speakers (no colon) are filtered out by improved validation
      // Valid format is "id:name", so "malformed" is invalid
      expect(result.agree).toEqual([]);
      expect(result.disagree).toEqual([]);
    });

    it("handles empty strings by filtering them out", () => {
      const input = {
        agree: ["1:Alice", "", "2:Bob"],
        disagree: ["", "3:Charlie"],
        no_clear_position: [""],
      };

      const result = reconcileCruxSpeakers(input);

      // Empty strings are filtered out
      expect(result.agree).toEqual(["1:Alice", "2:Bob"]);
      expect(result.disagree).toEqual(["3:Charlie"]);
      expect(result.no_clear_position).toEqual([]);
    });

    it("handles speakers with whitespace", () => {
      const input = {
        agree: ["  1:Alice  ", "2:Bob"],
        disagree: [],
        no_clear_position: [],
      };

      const result = reconcileCruxSpeakers(input);

      // Whitespace is preserved in full string, but ID is trimmed for matching
      expect(result.agree).toEqual(["  1:Alice  ", "2:Bob"]);
    });

    it("handles speakers with colons in names", () => {
      const input = {
        agree: ["1:Dr. Smith: PhD"],
        disagree: ["2:Jane: MD"],
        no_clear_position: [],
      };

      const result = reconcileCruxSpeakers(input);

      // Only first colon is used for ID extraction
      expect(result.agree).toEqual(["1:Dr. Smith: PhD"]);
      expect(result.disagree).toEqual(["2:Jane: MD"]);
    });
  });

  describe("Complex scenarios", () => {
    it("applies all deduplication rules in one pass", () => {
      const input = {
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
          "3:Charlie", // Has clear stance in agree → removed
          "5:Eve", // Has clear stance in disagree → removed
          "6:Frank", // Only in no_clear → stays
        ],
      };

      const result = reconcileCruxSpeakers(input);

      expect(result.agree).toEqual(["2:Bob", "3:Charlie"]);
      expect(result.disagree).toEqual(["4:Diana", "5:Eve"]);
      expect(result.no_clear_position).toEqual(["6:Frank", "1:Alice"]);
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
        agree: largeAgree,
        disagree: largeDisagree,
        no_clear_position: [],
      };

      const startTime = Date.now();
      const result = reconcileCruxSpeakers(input);
      const duration = Date.now() - startTime;

      // Should complete quickly (< 50ms for 200 speakers)
      expect(duration).toBeLessThan(50);
      expect(result.agree).toHaveLength(100);
      expect(result.disagree).toHaveLength(100);
    });

    it("handles 1000+ speakers efficiently (performance benchmark)", () => {
      // Generate 1500 speakers with complex overlaps to stress-test reconciliation:
      // - agree: 0-599 (600 speakers)
      // - disagree: 500-1099 (600 speakers) → 100 overlap with agree (500-599)
      // - no_clear: 1000-1299 (300 speakers) → 100 overlap with disagree (1000-1099)
      const agree = Array.from({ length: 600 }, (_, i) => `${i}:Speaker${i}`);
      const disagree = Array.from(
        { length: 600 },
        (_, i) => `${i + 500}:Speaker${i + 500}`,
      );
      const noClear = Array.from(
        { length: 300 },
        (_, i) => `${i + 1000}:Speaker${i + 1000}`,
      );

      // Add duplicates to stress-test within-list deduplication
      agree.push("5:Speaker5", "10:Speaker10", "15:Speaker15"); // 3 duplicates
      disagree.push("505:Speaker505", "510:Speaker510"); // 2 duplicates
      noClear.push("1005:Speaker1005"); // 1 duplicate

      const input = {
        agree,
        disagree,
        no_clear_position: noClear,
      };

      const startTime = performance.now();
      const result = reconcileCruxSpeakers(input);
      const duration = performance.now() - startTime;

      // Performance target: < 100ms for 1500 speakers (2-pass Map-based algorithm is O(n))
      expect(duration).toBeLessThan(100);

      // Verify correct reconciliation:
      // - Ambiguous (500-599): moved from agree+disagree to no_clear
      // - Clear stance in disagree (1000-1099): removed from no_clear
      // - Duplicates: removed from all lists
      // Final counts:
      // - agree: 500 (0-499, after removing 500-599 ambiguous and 3 duplicates)
      // - disagree: 500 (600-1099, after removing 500-599 ambiguous and 2 duplicates)
      // - no_clear: 300 (500-599 ambiguous + 1100-1299 remaining, after removing
      //             1000-1099 with clear stance and 1 duplicate)
      expect(result.agree.length).toBe(500);
      expect(result.disagree.length).toBe(500);
      expect(result.no_clear_position.length).toBe(300);
    });

    it("handles worst-case scenario: all speakers ambiguous", () => {
      // Worst case: every speaker appears in both agree AND disagree
      const speakers = Array.from(
        { length: 500 },
        (_, i) => `${i}:Speaker${i}`,
      );

      const input = {
        agree: [...speakers],
        disagree: [...speakers],
        no_clear_position: [],
      };

      const startTime = performance.now();
      const result = reconcileCruxSpeakers(input);
      const duration = performance.now() - startTime;

      // Should still complete quickly even in worst case
      // Using 200ms threshold to account for CI/slower machines
      expect(duration).toBeLessThan(200);

      // All speakers should move to no_clear_position
      expect(result.agree).toHaveLength(0);
      expect(result.disagree).toHaveLength(0);
      expect(result.no_clear_position).toHaveLength(500);
    });
  });

  describe("Return value characteristics", () => {
    it("preserves non-speaker properties of input object", () => {
      const input = {
        agree: ["1:Alice"],
        disagree: ["2:Bob"],
        no_clear_position: [],
        extraProperty: "preserved",
        anotherProperty: 42,
      };

      const result = reconcileCruxSpeakers(input);

      // @ts-expect-error - Testing that extra properties are preserved
      expect(result.extraProperty).toBe("preserved");
      // @ts-expect-error - Testing that extra properties are preserved
      expect(result.anotherProperty).toBe(42);
    });

    it("returns new arrays (does not mutate input)", () => {
      const input = {
        agree: ["1:Alice"],
        disagree: ["2:Bob"],
        no_clear_position: [],
      };

      const originalAgree = input.agree;
      const result = reconcileCruxSpeakers(input);

      // Should return new arrays
      expect(result.agree).not.toBe(originalAgree);
      // Original input should be unchanged
      expect(input.agree).toEqual(["1:Alice"]);
    });
  });

  describe("Data quality logging", () => {
    let consoleDebugSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      // Spy on console.debug (browser logger uses debug level for reconciliation metrics)
      consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    });

    afterEach(() => {
      // Restore original console.debug after each test
      consoleDebugSpy.mockRestore();
    });

    it("logs metrics when ambiguous speakers are found", () => {
      const input = {
        agree: ["1:Alice", "2:Bob"],
        disagree: ["1:Alice", "3:Charlie"],
        no_clear_position: [],
      };

      reconcileCruxSpeakers(input);

      // Verify console.debug was called with structured data
      expect(consoleDebugSpy).toHaveBeenCalled();
      const [message, logData] = consoleDebugSpy.mock.calls[0];
      // Browser logger format: [timestamp] DEBUG: message
      expect(message).toContain("Crux speaker reconciliation applied");
      expect(logData.module).toBe("crux-reconciliation");

      // Verify logged metrics
      expect(logData).toMatchObject({
        input: { agree: 2, disagree: 2, no_clear: 0 },
        output: { agree: 1, disagree: 1, no_clear: 1 },
        ambiguousSpeakers: {
          count: 1,
          speakerIds: ["1"],
        },
        totalSpeakers: {
          input: 4,
          output: 3,
          duplicatesRemoved: 1,
        },
      });
    });

    it("logs metrics when duplicates are removed", () => {
      const input = {
        agree: ["1:Alice", "1:Alice", "2:Bob"],
        disagree: ["3:Charlie", "3:Charlie", "3:Charlie"],
        no_clear_position: [],
      };

      reconcileCruxSpeakers(input);

      expect(consoleDebugSpy).toHaveBeenCalled();
      const [, logData] = consoleDebugSpy.mock.calls[0];

      // Verify total duplicates removed (simplified from per-list breakdown)
      expect(logData.totalSpeakers.duplicatesRemoved).toBe(3);
      expect(logData.totalSpeakers.input).toBe(6);
      expect(logData.totalSpeakers.output).toBe(3);
    });

    it("logs metrics when speakers removed from no_clear", () => {
      const input = {
        agree: ["1:Alice"],
        disagree: ["2:Bob"],
        no_clear_position: ["1:Alice", "2:Bob", "3:Charlie"],
      };

      reconcileCruxSpeakers(input);

      expect(consoleDebugSpy).toHaveBeenCalled();
      const [, logData] = consoleDebugSpy.mock.calls[0];

      expect(logData.removedFromNoClear).toMatchObject({
        count: 2,
        speakerIds: expect.arrayContaining(["1", "2"]),
      });
    });

    it("does NOT log when input is clean (no deduplication needed)", () => {
      const input = {
        agree: ["1:Alice", "2:Bob"],
        disagree: ["3:Charlie", "4:Diana"],
        no_clear_position: ["5:Eve"],
      };

      reconcileCruxSpeakers(input);

      // No logging should occur for clean data
      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it("logs complete metrics for complex deduplication scenario", () => {
      const input = {
        agree: ["1:Alice", "2:Bob", "2:Bob", "3:Charlie"], // 1 duplicate
        disagree: ["1:Alice", "4:Diana"], // 1 ambiguous with agree
        no_clear_position: ["3:Charlie", "5:Eve"], // 1 will be removed (has clear stance)
      };

      reconcileCruxSpeakers(input);

      expect(consoleDebugSpy).toHaveBeenCalled();
      const [, logData] = consoleDebugSpy.mock.calls[0];

      // Verify all aspects of deduplication are logged
      expect(logData).toMatchObject({
        input: { agree: 4, disagree: 2, no_clear: 2 },
        output: { agree: 2, disagree: 1, no_clear: 2 }, // Bob, Charlie | Diana | Eve, Alice
        ambiguousSpeakers: { count: 1, speakerIds: ["1"] },
        removedFromNoClear: { count: 1, speakerIds: ["3"] },
        // Total duplicates: input (8) - output (5) = 3 duplicates removed
        // (1 Bob duplicate + 1 Charlie in no_clear + 1 Alice in disagree)
        totalSpeakers: { input: 8, output: 5, duplicatesRemoved: 3 },
      });
    });

    it("correctly counts empty string filtering", () => {
      const input = {
        agree: ["1:Alice", "", "2:Bob"],
        disagree: ["", "3:Charlie"],
        no_clear_position: [""],
      };

      reconcileCruxSpeakers(input);

      // Empty strings should not count toward input totals
      expect(consoleDebugSpy).not.toHaveBeenCalled(); // No deduplication of valid speakers
    });
  });
});
