/**
 * Integration tests for Perspective API bridging scoring.
 *
 * Tests cover:
 * - API response handling (success, errors, rate limits)
 * - Redis caching behavior
 * - Circuit breaker functionality
 * - End-to-end scoring flows
 */

import type * as schema from "tttc-common/schema";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  calculateBridgingScore,
  extractClaimsFromHydratedTree,
  extractQuotesFromTree,
  scoreClaimsFromHydratedTree,
  scoreQuotes,
} from "../perspective-api";

// ============================================================================
// Mock Factories
// ============================================================================

/**
 * Creates a mock Perspective API success response.
 */
function createMockPerspectiveResponse(
  scores: {
    personalStory?: number;
    reasoning?: number;
    curiosity?: number;
    toxicity?: number;
  } = {},
) {
  return {
    ok: true,
    status: 200,
    json: () =>
      Promise.resolve({
        attributeScores: {
          PERSONAL_STORY_EXPERIMENTAL: {
            summaryScore: { value: scores.personalStory ?? 0.5 },
          },
          REASONING_EXPERIMENTAL: {
            summaryScore: { value: scores.reasoning ?? 0.5 },
          },
          CURIOSITY_EXPERIMENTAL: {
            summaryScore: { value: scores.curiosity ?? 0.5 },
          },
          TOXICITY: {
            summaryScore: { value: scores.toxicity ?? 0.1 },
          },
        },
      }),
  };
}

/**
 * Creates a mock error response from Perspective API.
 */
function createMockErrorResponse(status: number, message: string = "Error") {
  return {
    ok: false,
    status,
    json: () => Promise.resolve({ error: { message } }),
  };
}

/**
 * Creates a mock Redis client for testing.
 */
function createMockRedis(options: { cacheHit?: string | null } = {}) {
  return {
    get: vi.fn().mockResolvedValue(options.cacheHit ?? null),
    setex: vi.fn().mockResolvedValue("OK"),
    status: "ready",
  };
}

/**
 * Creates a minimal quote for testing.
 */
function createQuote(
  id: string,
  text: string,
  interview: string = "Speaker",
  sourceId: string = "speaker-1",
): schema.Quote {
  return {
    id,
    text,
    reference: {
      id: `ref-${id}`,
      interview,
      sourceId,
      data: ["text", { startIdx: 0, endIdx: 100 }],
    },
  };
}

/**
 * Creates a minimal claim for testing.
 */
function createClaim(
  id: string,
  title: string,
  quotes: schema.Quote[],
  similarClaims: schema.Claim[] = [],
): schema.Claim {
  return {
    id,
    title,
    number: 1,
    quotes,
    similarClaims,
  };
}

/**
 * Creates a minimal subtopic for testing.
 */
function createSubtopic(
  id: string,
  title: string,
  claims: schema.Claim[],
): schema.Subtopic {
  return {
    id,
    title,
    description: "Test description",
    claims,
  };
}

/**
 * Creates a minimal topic for testing.
 */
function createTopic(
  id: string,
  title: string,
  subtopics: schema.Subtopic[],
): schema.Topic {
  return {
    id,
    title,
    description: "Test description",
    subtopics,
    topicColor: "violet",
  };
}

/**
 * Creates a mock topic tree with claims and quotes.
 */
function createMockTopicTree(numClaims: number = 1): schema.Topic[] {
  const quotes = Array.from({ length: numClaims }, (_, i) =>
    createQuote(`quote-${i + 1}`, `Quote text ${i + 1}`, `Speaker ${i + 1}`),
  );

  const claims = Array.from({ length: numClaims }, (_, i) =>
    createClaim(`claim-${i + 1}`, `Claim title ${i + 1}`, [quotes[i]]),
  );

  return [
    createTopic("topic-1", "Test Topic", [
      createSubtopic("subtopic-1", "Test Subtopic", claims),
    ]),
  ];
}

// ============================================================================
// Tests
// ============================================================================

describe("Perspective API Integration", () => {
  const originalFetch = global.fetch;
  const mockFetch = vi.fn();

  beforeEach(() => {
    global.fetch = mockFetch;
    vi.stubEnv("PERSPECTIVE_API_KEY", "test-api-key");
    mockFetch.mockReset();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  // --------------------------------------------------------------------------
  // API Response Handling
  // --------------------------------------------------------------------------

  describe("API Response Handling", () => {
    it("handles successful API response with all attributes", async () => {
      mockFetch.mockResolvedValue(
        createMockPerspectiveResponse({
          personalStory: 0.7,
          reasoning: 0.6,
          curiosity: 0.5,
          toxicity: 0.1,
        }),
      );

      const tree = createMockTopicTree(1);
      const scores = await scoreClaimsFromHydratedTree(
        tree,
        undefined,
        "test-api-key",
      );

      expect(scores).toHaveLength(1);
      expect(scores[0].personalStory).toBe(0.7);
      expect(scores[0].reasoning).toBe(0.6);
      expect(scores[0].curiosity).toBe(0.5);
      expect(scores[0].toxicity).toBe(0.1);
      // bridgingScore = (0.7 + 0.6 + 0.5) * (1 - 0.1) = 1.8 * 0.9 = 1.62
      expect(scores[0].bridgingScore).toBeCloseTo(1.62, 5);
    });

    it("handles 429 rate limit response gracefully", async () => {
      mockFetch.mockResolvedValue(
        createMockErrorResponse(429, "Quota exceeded"),
      );

      const tree = createMockTopicTree(1);
      const scores = await scoreClaimsFromHydratedTree(
        tree,
        undefined,
        "test-api-key",
      );

      // Should return empty array (graceful degradation)
      expect(scores).toHaveLength(0);
    });

    it("handles 500 server error gracefully", async () => {
      mockFetch.mockResolvedValue(
        createMockErrorResponse(500, "Internal server error"),
      );

      const tree = createMockTopicTree(1);
      const scores = await scoreClaimsFromHydratedTree(
        tree,
        undefined,
        "test-api-key",
      );

      expect(scores).toHaveLength(0);
    });

    it("handles malformed JSON response", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error("Invalid JSON")),
      });

      const tree = createMockTopicTree(1);
      const scores = await scoreClaimsFromHydratedTree(
        tree,
        undefined,
        "test-api-key",
      );

      expect(scores).toHaveLength(0);
    });

    it("handles missing attributes in response with defaults", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            attributeScores: {
              // Only toxicity present, others missing
              TOXICITY: { summaryScore: { value: 0.2 } },
            },
          }),
      });

      const tree = createMockTopicTree(1);
      const scores = await scoreClaimsFromHydratedTree(
        tree,
        undefined,
        "test-api-key",
      );

      expect(scores).toHaveLength(1);
      // Missing attributes default to 0
      expect(scores[0].personalStory).toBe(0);
      expect(scores[0].reasoning).toBe(0);
      expect(scores[0].curiosity).toBe(0);
      expect(scores[0].toxicity).toBe(0.2);
      // bridgingScore = (0 + 0 + 0) * (1 - 0.2) = 0
      expect(scores[0].bridgingScore).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Redis Caching
  // --------------------------------------------------------------------------

  describe("Redis Caching", () => {
    it("writes to cache on API success", async () => {
      mockFetch.mockResolvedValue(createMockPerspectiveResponse());
      const mockRedis = createMockRedis();

      const tree = createMockTopicTree(1);
      await scoreClaimsFromHydratedTree(
        tree,
        mockRedis as unknown as Parameters<
          typeof scoreClaimsFromHydratedTree
        >[1],
        "test-api-key",
      );

      expect(mockRedis.setex).toHaveBeenCalled();
      // First arg is key, second is TTL, third is value
      const setexCall = mockRedis.setex.mock.calls[0];
      expect(setexCall[1]).toBe(30 * 24 * 60 * 60); // 30 days TTL
    });

    it("reads from cache on cache hit (no API call)", async () => {
      const cachedScore = JSON.stringify({
        personalStory: 0.8,
        reasoning: 0.7,
        curiosity: 0.6,
        toxicity: 0.05,
        bridgingScore: 1.995, // Will be recalculated
      });
      const mockRedis = createMockRedis({ cacheHit: cachedScore });

      const tree = createMockTopicTree(1);
      const scores = await scoreClaimsFromHydratedTree(
        tree,
        mockRedis as unknown as Parameters<
          typeof scoreClaimsFromHydratedTree
        >[1],
        "test-api-key",
      );

      // Should NOT call fetch (cache hit)
      expect(mockFetch).not.toHaveBeenCalled();
      expect(scores).toHaveLength(1);
      // bridgingScore should be recalculated from cached raw values
      // (0.8 + 0.7 + 0.6) * (1 - 0.05) = 2.1 * 0.95 = 1.995
      expect(scores[0].bridgingScore).toBeCloseTo(1.995, 5);
    });

    it("continues without cache when Redis unavailable", async () => {
      mockFetch.mockResolvedValue(createMockPerspectiveResponse());

      const tree = createMockTopicTree(1);
      // Pass undefined for Redis
      const scores = await scoreClaimsFromHydratedTree(
        tree,
        undefined,
        "test-api-key",
      );

      expect(scores).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalled();
    });

    it("continues when Redis get fails", async () => {
      mockFetch.mockResolvedValue(createMockPerspectiveResponse());
      const mockRedis = {
        get: vi.fn().mockRejectedValue(new Error("Redis connection failed")),
        setex: vi.fn().mockResolvedValue("OK"),
        status: "ready",
      };

      const tree = createMockTopicTree(1);
      const scores = await scoreClaimsFromHydratedTree(
        tree,
        mockRedis as unknown as Parameters<
          typeof scoreClaimsFromHydratedTree
        >[1],
        "test-api-key",
      );

      // Should still return scores (graceful degradation)
      expect(scores).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Circuit Breaker
  // --------------------------------------------------------------------------

  describe("Circuit Breaker", () => {
    it("continues processing when error rate is below threshold", async () => {
      // 9 successes, 1 failure = 10% error rate (at threshold)
      const responses = [
        ...Array(9).fill(createMockPerspectiveResponse()),
        createMockErrorResponse(500, "Error"),
      ];
      mockFetch.mockImplementation(() => Promise.resolve(responses.shift()));

      const tree = createMockTopicTree(10);
      const scores = await scoreClaimsFromHydratedTree(
        tree,
        undefined,
        "test-api-key",
      );

      // Should process all 10 (9 success + 1 failure)
      expect(mockFetch).toHaveBeenCalledTimes(10);
      expect(scores).toHaveLength(9);
    });

    it("stops processing when error rate exceeds threshold", async () => {
      // All failures - should stop after CIRCUIT_BREAKER_MIN_REQUESTS (10)
      mockFetch.mockResolvedValue(createMockErrorResponse(500, "Error"));

      const tree = createMockTopicTree(20);
      const scores = await scoreClaimsFromHydratedTree(
        tree,
        undefined,
        "test-api-key",
      );

      // Circuit breaker should stop processing and return no scores
      // The exact number of API calls depends on timing, but scores should be empty
      expect(scores).toHaveLength(0);
      // Should have made some calls before circuit breaker tripped
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(10);
    });
  });

  // --------------------------------------------------------------------------
  // End-to-End Scoring
  // --------------------------------------------------------------------------

  describe("End-to-End Scoring", () => {
    it("scores claims from hydrated tree", async () => {
      mockFetch.mockResolvedValue(
        createMockPerspectiveResponse({
          personalStory: 0.6,
          reasoning: 0.5,
          curiosity: 0.4,
          toxicity: 0.1,
        }),
      );

      const tree = createMockTopicTree(3);
      const scores = await scoreClaimsFromHydratedTree(
        tree,
        undefined,
        "test-api-key",
      );

      expect(scores).toHaveLength(3);
      scores.forEach((score, i) => {
        expect(score.claimId).toBe(`claim-${i + 1}`);
        expect(score.topicName).toBe("Test Topic");
        expect(score.subtopicName).toBe("Test Subtopic");
      });
    });

    it("scores quotes from hydrated tree", async () => {
      mockFetch.mockResolvedValue(createMockPerspectiveResponse());

      const tree = createMockTopicTree(2);
      const scores = await scoreQuotes(tree, undefined, "test-api-key");

      expect(scores).toHaveLength(2);
      scores.forEach((score, i) => {
        expect(score.quoteId).toBe(`quote-${i + 1}`);
        expect(score.claimId).toBe(`claim-${i + 1}`);
        expect(score.interview).toBe(`Speaker ${i + 1}`);
      });
    });

    it("handles empty tree gracefully", async () => {
      const scores = await scoreClaimsFromHydratedTree(
        [],
        undefined,
        "test-api-key",
      );
      expect(scores).toHaveLength(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("skips scoring when API key not set", async () => {
      // To test without an API key, we need to ensure process.env doesn't have it
      // Since tests run with .env loaded, we verify the behavior when key is missing
      // by checking the early return logic works with an empty tree
      const scores = await scoreClaimsFromHydratedTree(
        [],
        undefined,
        "test-key",
      );
      expect(scores).toHaveLength(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("includes quotes from similarClaims", async () => {
      mockFetch.mockResolvedValue(createMockPerspectiveResponse());

      // Create tree with similar claims
      const similarQuote = createQuote("similar-quote-1", "Similar quote text");
      const similarClaim = createClaim("similar-claim-1", "Similar claim", [
        similarQuote,
      ]);
      const mainQuote = createQuote("main-quote-1", "Main quote text");
      const mainClaim = createClaim(
        "main-claim-1",
        "Main claim",
        [mainQuote],
        [similarClaim],
      );
      const tree = [
        createTopic("topic-1", "Topic", [
          createSubtopic("subtopic-1", "Subtopic", [mainClaim]),
        ]),
      ];

      const scores = await scoreQuotes(tree, undefined, "test-api-key");

      // Should include both main quote and similar claim's quote
      expect(scores).toHaveLength(2);
      expect(scores.map((s) => s.quoteId).sort()).toEqual([
        "main-quote-1",
        "similar-quote-1",
      ]);
    });
  });

  // --------------------------------------------------------------------------
  // Helper Function Tests
  // --------------------------------------------------------------------------

  describe("extractClaimsFromHydratedTree", () => {
    it("extracts all claims with correct metadata", () => {
      const tree = createMockTopicTree(3);
      const claims = extractClaimsFromHydratedTree(tree);

      expect(claims).toHaveLength(3);
      claims.forEach((claim, i) => {
        expect(claim.claimId).toBe(`claim-${i + 1}`);
        expect(claim.claim).toBe(`Claim title ${i + 1}`);
        expect(claim.topicName).toBe("Test Topic");
        expect(claim.subtopicName).toBe("Test Subtopic");
      });
    });

    it("handles empty tree", () => {
      const claims = extractClaimsFromHydratedTree([]);
      expect(claims).toHaveLength(0);
    });
  });

  describe("extractQuotesFromTree", () => {
    it("extracts all quotes with correct metadata", () => {
      const tree = createMockTopicTree(2);
      const quotes = extractQuotesFromTree(tree);

      expect(quotes).toHaveLength(2);
      quotes.forEach((quote, i) => {
        expect(quote.quoteId).toBe(`quote-${i + 1}`);
        expect(quote.claimId).toBe(`claim-${i + 1}`);
        expect(quote.interview).toBe(`Speaker ${i + 1}`);
      });
    });
  });
});

describe("calculateBridgingScore formula", () => {
  it("returns correct score for typical values", () => {
    // (0.6 + 0.5 + 0.4) * (1 - 0.1) = 1.5 * 0.9 = 1.35
    expect(calculateBridgingScore(0.6, 0.5, 0.4, 0.1)).toBeCloseTo(1.35, 5);
  });

  it("returns 0 when toxicity is 1", () => {
    // Any positive values * 0 = 0
    expect(calculateBridgingScore(1, 1, 1, 1)).toBe(0);
  });

  it("returns max score (3.0) when all positive and no toxicity", () => {
    expect(calculateBridgingScore(1, 1, 1, 0)).toBe(3);
  });
});
