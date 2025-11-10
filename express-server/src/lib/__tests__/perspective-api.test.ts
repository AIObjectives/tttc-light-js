/**
 * Unit tests for Perspective API utility functions
 */
import { describe, it, expect } from "vitest";
import * as schema from "tttc-common/schema";
import {
  extractQuotesFromTree,
  calculateBridgingScore,
} from "../perspective-api";

describe("calculateBridgingScore", () => {
  it("returns maximum score (3.0) when all positive attributes are 1.0 and toxicity is 0", () => {
    const score = calculateBridgingScore(1.0, 1.0, 1.0, 0.0);
    expect(score).toBe(3.0);
  });

  it("returns 0 when toxicity is 1.0 (completely disqualifies)", () => {
    // Even with max positive attributes, full toxicity zeros the score
    const score = calculateBridgingScore(1.0, 1.0, 1.0, 1.0);
    expect(score).toBe(0);
  });

  it("returns 0 when all attributes are 0", () => {
    const score = calculateBridgingScore(0, 0, 0, 0);
    expect(score).toBe(0);
  });

  it("reduces score proportionally with toxicity", () => {
    // Sum of positive = 1.5, toxicity = 0.5
    // Score = 1.5 * (1 - 0.5) = 1.5 * 0.5 = 0.75
    const score = calculateBridgingScore(0.5, 0.5, 0.5, 0.5);
    expect(score).toBe(0.75);
  });

  it("handles realistic attribute values", () => {
    // Typical values from Perspective API
    const score = calculateBridgingScore(0.3, 0.6, 0.2, 0.1);
    // Sum = 1.1, toxicity factor = 0.9
    // Score = 1.1 * 0.9 = 0.99
    expect(score).toBeCloseTo(0.99, 5);
  });

  it("produces score in valid range (0 to 3.0)", () => {
    // Test various combinations
    const testCases = [
      [0, 0, 0, 0],
      [1, 1, 1, 0],
      [1, 1, 1, 1],
      [0.5, 0.5, 0.5, 0.5],
      [0.1, 0.2, 0.3, 0.9],
      [0.9, 0.8, 0.7, 0.1],
    ];

    for (const [ps, re, cu, tox] of testCases) {
      const score = calculateBridgingScore(ps, re, cu, tox);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(3.0);
    }
  });

  it("correctly applies the formula: (ps + re + cu) * (1 - tox)", () => {
    // Explicit formula verification
    const ps = 0.4,
      re = 0.5,
      cu = 0.6,
      tox = 0.2;
    const expected = (ps + re + cu) * (1 - tox);
    const score = calculateBridgingScore(ps, re, cu, tox);
    expect(score).toBe(expected);
  });
});

// Helper to create a minimal quote
const createQuote = (
  id: string,
  text: string,
  interview: string = "Speaker",
  sourceId: string = "speaker-1",
): schema.Quote => ({
  id,
  text,
  reference: {
    id: `ref-${id}`,
    interview,
    sourceId,
    data: ["audio", { beginTimestamp: "0:00" }],
  },
});

// Helper to create a minimal claim
const createClaim = (
  id: string,
  title: string,
  quotes: schema.Quote[],
  similarClaims: schema.Claim[] = [],
): schema.Claim => ({
  id,
  title,
  number: 1,
  quotes,
  similarClaims,
});

// Helper to create a minimal subtopic
const createSubtopic = (
  id: string,
  title: string,
  claims: schema.Claim[],
): schema.Subtopic => ({
  id,
  title,
  description: "Test description",
  claims,
});

// Helper to create a minimal topic
const createTopic = (
  id: string,
  title: string,
  subtopics: schema.Subtopic[],
): schema.Topic => ({
  id,
  title,
  description: "Test description",
  subtopics,
  topicColor: "violet",
});

describe("extractQuotesFromTree", () => {
  it("extracts quotes from a simple tree", () => {
    const quote1 = createQuote("q1", "Quote 1 text", "Alice", "alice-1");
    const quote2 = createQuote("q2", "Quote 2 text", "Bob", "bob-1");
    const claim = createClaim("c1", "Test Claim", [quote1, quote2]);
    const subtopic = createSubtopic("st1", "Test Subtopic", [claim]);
    const topic = createTopic("t1", "Test Topic", [subtopic]);

    const tree: schema.Topic[] = [topic];
    const result = extractQuotesFromTree(tree);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      quoteId: "q1",
      claimId: "c1",
      text: "Quote 1 text",
      topicName: "Test Topic",
      subtopicName: "Test Subtopic",
      speakerId: "alice-1",
      interview: "Alice",
    });
    expect(result[1]).toEqual({
      quoteId: "q2",
      claimId: "c1",
      text: "Quote 2 text",
      topicName: "Test Topic",
      subtopicName: "Test Subtopic",
      speakerId: "bob-1",
      interview: "Bob",
    });
  });

  it("extracts quotes from multiple topics and subtopics", () => {
    const quote1 = createQuote("q1", "Quote 1");
    const quote2 = createQuote("q2", "Quote 2");
    const quote3 = createQuote("q3", "Quote 3");

    const claim1 = createClaim("c1", "Claim 1", [quote1]);
    const claim2 = createClaim("c2", "Claim 2", [quote2]);
    const claim3 = createClaim("c3", "Claim 3", [quote3]);

    const subtopic1 = createSubtopic("st1", "Subtopic 1", [claim1]);
    const subtopic2 = createSubtopic("st2", "Subtopic 2", [claim2]);
    const subtopic3 = createSubtopic("st3", "Subtopic 3", [claim3]);

    const topic1 = createTopic("t1", "Topic 1", [subtopic1, subtopic2]);
    const topic2 = createTopic("t2", "Topic 2", [subtopic3]);

    const tree: schema.Topic[] = [topic1, topic2];
    const result = extractQuotesFromTree(tree);

    expect(result).toHaveLength(3);
    expect(result[0].topicName).toBe("Topic 1");
    expect(result[0].subtopicName).toBe("Subtopic 1");
    expect(result[1].topicName).toBe("Topic 1");
    expect(result[1].subtopicName).toBe("Subtopic 2");
    expect(result[2].topicName).toBe("Topic 2");
    expect(result[2].subtopicName).toBe("Subtopic 3");
  });

  it("includes quotes from similarClaims", () => {
    const mainQuote = createQuote("q1", "Main quote");
    const similarQuote = createQuote("q2", "Similar quote");

    const similarClaim = createClaim("c2", "Similar Claim", [similarQuote]);
    const mainClaim = createClaim(
      "c1",
      "Main Claim",
      [mainQuote],
      [similarClaim],
    );

    const subtopic = createSubtopic("st1", "Subtopic", [mainClaim]);
    const topic = createTopic("t1", "Topic", [subtopic]);

    const tree: schema.Topic[] = [topic];
    const result = extractQuotesFromTree(tree);

    // Should include both main quote and similar claim's quote
    expect(result).toHaveLength(2);
    expect(result.map((q) => q.quoteId).sort()).toEqual(["q1", "q2"]);
  });

  it("returns empty array for empty tree", () => {
    const result = extractQuotesFromTree([]);
    expect(result).toHaveLength(0);
  });

  it("handles topics with no subtopics", () => {
    const topic = createTopic("t1", "Empty Topic", []);
    const result = extractQuotesFromTree([topic]);
    expect(result).toHaveLength(0);
  });

  it("handles subtopics with no claims", () => {
    const subtopic = createSubtopic("st1", "Empty Subtopic", []);
    const topic = createTopic("t1", "Topic", [subtopic]);
    const result = extractQuotesFromTree([topic]);
    expect(result).toHaveLength(0);
  });

  it("handles claims with no quotes", () => {
    const claim = createClaim("c1", "Empty Claim", []);
    const subtopic = createSubtopic("st1", "Subtopic", [claim]);
    const topic = createTopic("t1", "Topic", [subtopic]);
    const result = extractQuotesFromTree([topic]);
    expect(result).toHaveLength(0);
  });

  it("preserves speaker information correctly", () => {
    const quote1 = createQuote("q1", "Text", "Alice Smith", "alice-123");
    const quote2 = createQuote("q2", "Text", "Bob Jones", "bob-456");

    const claim = createClaim("c1", "Claim", [quote1, quote2]);
    const subtopic = createSubtopic("st1", "Subtopic", [claim]);
    const topic = createTopic("t1", "Topic", [subtopic]);

    const result = extractQuotesFromTree([topic]);

    expect(result[0].interview).toBe("Alice Smith");
    expect(result[0].speakerId).toBe("alice-123");
    expect(result[1].interview).toBe("Bob Jones");
    expect(result[1].speakerId).toBe("bob-456");
  });

  it("handles multiple claims per subtopic", () => {
    const quote1 = createQuote("q1", "Quote 1");
    const quote2 = createQuote("q2", "Quote 2");
    const quote3 = createQuote("q3", "Quote 3");

    const claim1 = createClaim("c1", "Claim 1", [quote1]);
    const claim2 = createClaim("c2", "Claim 2", [quote2, quote3]);

    const subtopic = createSubtopic("st1", "Subtopic", [claim1, claim2]);
    const topic = createTopic("t1", "Topic", [subtopic]);

    const result = extractQuotesFromTree([topic]);

    expect(result).toHaveLength(3);
    expect(result[0].claimId).toBe("c1");
    expect(result[1].claimId).toBe("c2");
    expect(result[2].claimId).toBe("c2");
  });
});
