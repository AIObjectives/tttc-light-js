/**
 * Unit tests for quote bridging utility functions
 */
import { describe, it, expect } from "vitest";
import type { AddOns, Quote } from "tttc-common/schema";
import {
  getQuoteBridgingScore,
  getQuoteBridgingScoreDetails,
  hasQuoteBridgingScores,
  sortQuotesByBridging,
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

describe("getQuoteBridgingScore", () => {
  it("returns bridging score for existing quote", () => {
    const addOns: AddOns = {
      quoteBridgingScores: [
        {
          quoteId: "quote-1",
          claimId: "claim-1",
          topicName: "Topic A",
          subtopicName: "Subtopic A",
          speakerId: "speaker-1",
          interview: "Speaker Name",
          personalStory: 0.8,
          reasoning: 0.7,
          curiosity: 0.6,
          toxicity: 0.1,
          bridgingScore: 0.6,
        },
        {
          quoteId: "quote-2",
          claimId: "claim-1",
          topicName: "Topic A",
          subtopicName: "Subtopic A",
          speakerId: "speaker-2",
          interview: "Another Speaker",
          personalStory: 0.2,
          reasoning: 0.3,
          curiosity: 0.1,
          toxicity: 0.8,
          bridgingScore: -0.6,
        },
      ],
    };

    expect(getQuoteBridgingScore(addOns, "quote-1")).toBe(0.6);
    expect(getQuoteBridgingScore(addOns, "quote-2")).toBe(-0.6);
  });

  it("returns null for non-existent quote", () => {
    const addOns: AddOns = {
      quoteBridgingScores: [
        {
          quoteId: "quote-1",
          claimId: "claim-1",
          topicName: "Topic A",
          subtopicName: "Subtopic A",
          speakerId: "speaker-1",
          interview: "Speaker Name",
          personalStory: 0.8,
          reasoning: 0.7,
          curiosity: 0.6,
          toxicity: 0.1,
          bridgingScore: 0.6,
        },
      ],
    };

    expect(getQuoteBridgingScore(addOns, "non-existent")).toBeNull();
  });

  it("returns null when addOns is undefined", () => {
    expect(getQuoteBridgingScore(undefined, "quote-1")).toBeNull();
  });

  it("returns null when quoteBridgingScores is missing", () => {
    const addOns: AddOns = {};
    expect(getQuoteBridgingScore(addOns, "quote-1")).toBeNull();
  });
});

describe("getQuoteBridgingScoreDetails", () => {
  it("returns full score details for existing quote", () => {
    const scoreData = {
      quoteId: "quote-1",
      claimId: "claim-1",
      topicName: "Topic A",
      subtopicName: "Subtopic A",
      speakerId: "speaker-1",
      interview: "Speaker Name",
      personalStory: 0.8,
      reasoning: 0.7,
      curiosity: 0.6,
      toxicity: 0.1,
      bridgingScore: 0.6,
    };

    const addOns: AddOns = {
      quoteBridgingScores: [scoreData],
    };

    const result = getQuoteBridgingScoreDetails(addOns, "quote-1");
    expect(result).toEqual(scoreData);
  });

  it("returns null for non-existent quote", () => {
    const addOns: AddOns = {
      quoteBridgingScores: [
        {
          quoteId: "quote-1",
          claimId: "claim-1",
          topicName: "Topic A",
          subtopicName: "Subtopic A",
          speakerId: "speaker-1",
          interview: "Speaker Name",
          personalStory: 0.8,
          reasoning: 0.7,
          curiosity: 0.6,
          toxicity: 0.1,
          bridgingScore: 0.6,
        },
      ],
    };

    expect(getQuoteBridgingScoreDetails(addOns, "non-existent")).toBeNull();
  });

  it("returns null when addOns is undefined", () => {
    expect(getQuoteBridgingScoreDetails(undefined, "quote-1")).toBeNull();
  });
});

describe("hasQuoteBridgingScores", () => {
  it("returns true when scores exist", () => {
    const addOns: AddOns = {
      quoteBridgingScores: [
        {
          quoteId: "quote-1",
          claimId: "claim-1",
          topicName: "Topic A",
          subtopicName: "Subtopic A",
          speakerId: "speaker-1",
          interview: "Speaker Name",
          personalStory: 0.8,
          reasoning: 0.7,
          curiosity: 0.6,
          toxicity: 0.1,
          bridgingScore: 0.6,
        },
      ],
    };

    expect(hasQuoteBridgingScores(addOns)).toBe(true);
  });

  it("returns false when scores array is empty", () => {
    const addOns: AddOns = {
      quoteBridgingScores: [],
    };

    expect(hasQuoteBridgingScores(addOns)).toBe(false);
  });

  it("returns false when quoteBridgingScores is missing", () => {
    const addOns: AddOns = {};
    expect(hasQuoteBridgingScores(addOns)).toBe(false);
  });

  it("returns false when addOns is undefined", () => {
    expect(hasQuoteBridgingScores(undefined)).toBe(false);
  });
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

describe("BRIDGING_THRESHOLDS", () => {
  it("has expected threshold values", () => {
    expect(BRIDGING_THRESHOLDS.HIGH_BRIDGING).toBe(0.5);
    expect(BRIDGING_THRESHOLDS.MODERATE_BRIDGING).toBe(0.25);
    expect(BRIDGING_THRESHOLDS.NEUTRAL).toBe(0.0);
    expect(BRIDGING_THRESHOLDS.SOMEWHAT_DIVISIVE).toBe(-0.25);
    expect(BRIDGING_THRESHOLDS.MIN_DISPLAY).toBe(0.3);
  });
});
