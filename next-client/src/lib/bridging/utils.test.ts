/**
 * Unit tests for quote bridging utility functions
 */
import { describe, it, expect } from "vitest";
import type { AddOns, Quote } from "tttc-common/schema";
import {
  sortQuotesByBridging,
  getClaimBridgingScore,
  BRIDGING_THRESHOLDS,
} from "./utils";

// Helper to create a minimal quote for testing
const createQuote = (id: string, text: string = "Test quote"): Quote => ({
  id,
  text,
  reference: {
    id: `ref-${id}`,
    interview: "Test Speaker",
    sourceId: "speaker-1",
    data: ["audio", { link: "https://example.com/audio.mp3" }],
  },
});

describe("sortQuotesByBridging", () => {
  const createScoreEntry = (quoteId: string, bridgingScore: number) => ({
    quoteId,
    claimId: "claim-1",
    topicName: "Topic A",
    subtopicName: "Subtopic A",
    speakerId: "speaker-1",
    interview: "Speaker Name",
    personalStory: 0.5,
    reasoning: 0.5,
    curiosity: 0.5,
    toxicity: 0.1,
    bridgingScore,
  });

  it("sorts quotes by bridging score in descending order", () => {
    const quotes: Quote[] = [
      createQuote("quote-1", "Low bridging"),
      createQuote("quote-2", "High bridging"),
      createQuote("quote-3", "Medium bridging"),
    ];

    const addOns: AddOns = {
      quoteBridgingScores: [
        createScoreEntry("quote-1", -0.5),
        createScoreEntry("quote-2", 0.8),
        createScoreEntry("quote-3", 0.3),
      ],
    };

    const sorted = sortQuotesByBridging(quotes, addOns);

    expect(sorted[0].id).toBe("quote-2"); // Highest (0.8)
    expect(sorted[1].id).toBe("quote-3"); // Medium (0.3)
    expect(sorted[2].id).toBe("quote-1"); // Lowest (-0.5)
  });

  it("returns original order when no scores available", () => {
    const quotes: Quote[] = [
      createQuote("quote-1"),
      createQuote("quote-2"),
      createQuote("quote-3"),
    ];

    const addOns: AddOns = {};

    const sorted = sortQuotesByBridging(quotes, addOns);

    expect(sorted[0].id).toBe("quote-1");
    expect(sorted[1].id).toBe("quote-2");
    expect(sorted[2].id).toBe("quote-3");
  });

  it("returns original order when addOns is undefined", () => {
    const quotes: Quote[] = [createQuote("quote-1"), createQuote("quote-2")];

    const sorted = sortQuotesByBridging(quotes, undefined);

    expect(sorted[0].id).toBe("quote-1");
    expect(sorted[1].id).toBe("quote-2");
  });

  it("handles quotes without scores (treats as -1)", () => {
    const quotes: Quote[] = [
      createQuote("quote-1", "Has score"),
      createQuote("quote-2", "No score"),
      createQuote("quote-3", "Has low score"),
    ];

    const addOns: AddOns = {
      quoteBridgingScores: [
        createScoreEntry("quote-1", 0.5),
        createScoreEntry("quote-3", -0.3),
        // quote-2 has no score
      ],
    };

    const sorted = sortQuotesByBridging(quotes, addOns);

    expect(sorted[0].id).toBe("quote-1"); // 0.5
    expect(sorted[1].id).toBe("quote-3"); // -0.3
    expect(sorted[2].id).toBe("quote-2"); // -1 (no score)
  });

  it("does not mutate the original array", () => {
    const quotes: Quote[] = [createQuote("quote-1"), createQuote("quote-2")];

    const addOns: AddOns = {
      quoteBridgingScores: [
        createScoreEntry("quote-1", 0.1),
        createScoreEntry("quote-2", 0.9),
      ],
    };

    const sorted = sortQuotesByBridging(quotes, addOns);

    // Original array should be unchanged
    expect(quotes[0].id).toBe("quote-1");
    expect(quotes[1].id).toBe("quote-2");

    // Sorted array should be different
    expect(sorted[0].id).toBe("quote-2");
    expect(sorted[1].id).toBe("quote-1");
  });
});

describe("getClaimBridgingScore", () => {
  const createClaimScoreEntry = (claimId: string, bridgingScore: number) => ({
    claimId,
    topicName: "Topic A",
    subtopicName: "Subtopic A",
    personalStory: 0.5,
    reasoning: 0.5,
    curiosity: 0.5,
    toxicity: 0.1,
    bridgingScore,
  });

  it("returns the bridging score for a claim", () => {
    const addOns: AddOns = {
      claimBridgingScores: [
        createClaimScoreEntry("claim-1", 1.5),
        createClaimScoreEntry("claim-2", 2.0),
      ],
    };

    expect(getClaimBridgingScore("claim-1", addOns)).toBe(1.5);
    expect(getClaimBridgingScore("claim-2", addOns)).toBe(2.0);
  });

  it("returns undefined for non-existent claim", () => {
    const addOns: AddOns = {
      claimBridgingScores: [createClaimScoreEntry("claim-1", 1.5)],
    };

    expect(getClaimBridgingScore("claim-999", addOns)).toBeUndefined();
  });

  it("returns undefined when addOns is undefined", () => {
    expect(getClaimBridgingScore("claim-1", undefined)).toBeUndefined();
  });

  it("returns undefined when claimBridgingScores is undefined", () => {
    const addOns: AddOns = {};
    expect(getClaimBridgingScore("claim-1", addOns)).toBeUndefined();
  });

  it("handles multiple lookups efficiently (uses cached Map)", () => {
    const addOns: AddOns = {
      claimBridgingScores: [
        createClaimScoreEntry("claim-1", 1.0),
        createClaimScoreEntry("claim-2", 2.0),
        createClaimScoreEntry("claim-3", 3.0),
      ],
    };

    // Multiple lookups should work correctly (caching is internal)
    expect(getClaimBridgingScore("claim-1", addOns)).toBe(1.0);
    expect(getClaimBridgingScore("claim-2", addOns)).toBe(2.0);
    expect(getClaimBridgingScore("claim-3", addOns)).toBe(3.0);
    // Repeat lookups
    expect(getClaimBridgingScore("claim-1", addOns)).toBe(1.0);
    expect(getClaimBridgingScore("claim-2", addOns)).toBe(2.0);
  });
});

describe("BRIDGING_THRESHOLDS", () => {
  it("has expected threshold values", () => {
    expect(BRIDGING_THRESHOLDS.HIGH_BRIDGING).toBe(1.5);
    expect(BRIDGING_THRESHOLDS.MODERATE_BRIDGING).toBe(0.75);
    expect(BRIDGING_THRESHOLDS.LOW_BRIDGING).toBe(0.25);
    expect(BRIDGING_THRESHOLDS.MIN_DISPLAY).toBe(1.0);
  });

  it("thresholds are in valid range for formula (0 to 3.0)", () => {
    // All thresholds should be non-negative since formula is:
    // (personalStory + reasoning + curiosity) * (1 - toxicity)
    // which ranges from 0 to 3.0
    Object.values(BRIDGING_THRESHOLDS).forEach((threshold) => {
      expect(threshold).toBeGreaterThanOrEqual(0);
      expect(threshold).toBeLessThanOrEqual(3);
    });
  });
});
