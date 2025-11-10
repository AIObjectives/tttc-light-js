/**
 * Perspective API scoring module for bridging-based report structuring.
 *
 * Uses Google's Perspective API to score claims based on bridge-building qualities:
 * - PERSONAL_STORY_EXPERIMENTAL: Personal experiences/anecdotes (builds empathy)
 * - REASONING_EXPERIMENTAL: Logical argumentation (fosters understanding)
 * - CURIOSITY_EXPERIMENTAL: Questions/curiosity (encourages dialogue)
 * - TOXICITY: Rude/divisive content (inverse indicator)
 *
 * Composite bridging score: (personalStory + reasoning + curiosity) / 3 - toxicity
 * Range: -1.0 to 1.0 (higher = more constructive, bridge-building content)
 */

import "dotenv/config";
import { logger } from "tttc-common/logger";
import * as schema from "tttc-common/schema";
import { getQuotes } from "tttc-common/morphisms";
import { createHash } from "crypto";
import type Redis from "ioredis";
import { z } from "zod";

const perspectiveLogger = logger.child({ module: "perspective-api" });

const PERSPECTIVE_API_URL =
  "https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze";

// Redis cache TTL for Perspective API responses (30 days)
// Longer than LLM cache since Perspective API is much slower
const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * Sanitize text input for Perspective API.
 * Removes control characters and limits length to avoid API errors.
 */
function sanitizeText(text: string): string {
  // Remove control characters (except newline and tab)
  const cleanedText = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Perspective API has a 20,480 character limit
  const maxLength = 20480;
  if (cleanedText.length > maxLength) {
    perspectiveLogger.warn(
      { originalLength: cleanedText.length, maxLength },
      "Claim text exceeds Perspective API limit, truncating",
    );
    return cleanedText.substring(0, maxLength);
  }

  return cleanedText;
}

/**
 * Generate a cache key from claim text using SHA-256 hash.
 * Includes environment prefix to isolate dev/prod caches.
 */
function getCacheKey(text: string, envPrefix?: string): string {
  const hash = createHash("sha256")
    .update(text.trim().toLowerCase())
    .digest("hex");
  const prefix = envPrefix || "dev";
  return `${prefix}-perspective:${hash}`;
}

// Attributes to request from Perspective API
const BRIDGING_ATTRIBUTES = {
  PERSONAL_STORY_EXPERIMENTAL: {},
  REASONING_EXPERIMENTAL: {},
  CURIOSITY_EXPERIMENTAL: {},
  TOXICITY: {},
};

interface PerspectiveScores {
  personalStory: number;
  reasoning: number;
  curiosity: number;
  toxicity: number;
  bridgingScore: number;
}

/**
 * Calculate composite bridging score from individual attribute scores.
 *
 * Formula: (personalStory + reasoning + curiosity) / 3 - toxicity
 *
 * Toxicity receives a full penalty (not discounted), balancing constructive
 * attributes against divisiveness. This prevents high reasoning/curiosity
 * scores from masking toxic language.
 */
function calculateBridgingScore(
  personalStory: number,
  reasoning: number,
  curiosity: number,
  toxicity: number,
): number {
  const positiveAvg = (personalStory + reasoning + curiosity) / 3;
  return positiveAvg - toxicity;
}

/**
 * Score a single text using Perspective API with Redis caching.
 *
 * Caches responses in Redis to avoid redundant API calls for duplicate claims.
 * Uses a 30-day TTL since Perspective API is slow.
 */
async function scoreText(
  text: string,
  apiKey: string,
  redis?: Redis,
  envPrefix?: string,
): Promise<PerspectiveScores | null> {
  if (!text || !text.trim()) {
    perspectiveLogger.warn("Empty text provided for scoring, skipping");
    return null;
  }

  // Sanitize input text
  const sanitizedText = sanitizeText(text);
  if (!sanitizedText.trim()) {
    perspectiveLogger.warn("Text became empty after sanitization, skipping");
    return null;
  }

  // Check Redis cache first (use original text for cache key to preserve exact matches)
  const cacheKey = getCacheKey(text, envPrefix);
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const cachedScore: PerspectiveScores = JSON.parse(cached);
        perspectiveLogger.debug(
          { cacheKey: cacheKey.substring(0, 30) },
          "Returning cached bridging score from Redis",
        );
        return cachedScore;
      }
    } catch (error) {
      perspectiveLogger.warn(
        { error, cacheKey: cacheKey.substring(0, 30) },
        "Redis cache read failed, continuing without cache",
      );
    }
  }

  try {
    const requestBody = {
      comment: { text: sanitizedText },
      requestedAttributes: BRIDGING_ATTRIBUTES,
      doNotStore: true, // Privacy: don't store text on Google servers
      languages: ["en"], // Bridging attributes are English-only
    };

    const response = await fetch(`${PERSPECTIVE_API_URL}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      perspectiveLogger.error(
        {
          status: response.status,
          error: errorData,
        },
        "Perspective API error",
      );
      return null;
    }

    const data = await response.json();

    // Extract scores from response
    const attrScores = data.attributeScores || {};

    const personalStory =
      attrScores.PERSONAL_STORY_EXPERIMENTAL?.summaryScore?.value || 0.0;
    const reasoning =
      attrScores.REASONING_EXPERIMENTAL?.summaryScore?.value || 0.0;
    const curiosity =
      attrScores.CURIOSITY_EXPERIMENTAL?.summaryScore?.value || 0.0;
    const toxicity = attrScores.TOXICITY?.summaryScore?.value || 0.0;

    // Calculate composite score
    const bridgingScore = calculateBridgingScore(
      personalStory,
      reasoning,
      curiosity,
      toxicity,
    );

    const scores: PerspectiveScores = {
      personalStory,
      reasoning,
      curiosity,
      toxicity,
      bridgingScore,
    };

    // Cache the result in Redis with 30-day TTL
    if (redis) {
      try {
        await redis.setex(cacheKey, CACHE_TTL_SECONDS, JSON.stringify(scores));
        perspectiveLogger.debug(
          { cacheKey: cacheKey.substring(0, 30), ttlDays: 30 },
          "Cached bridging score in Redis",
        );
      } catch (error) {
        perspectiveLogger.warn(
          { error, cacheKey: cacheKey.substring(0, 30) },
          "Failed to cache bridging score in Redis",
        );
      }
    }

    return scores;
  } catch (error) {
    perspectiveLogger.error(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      "Unexpected error scoring text",
    );
    return null;
  }
}

/**
 * Delay helper for rate limiting.
 */
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Zod schema for pyserver taxonomy structure.
 * Validates the claims tree structure from pyserver sorting.
 */
const pyserverClaimSchema = z.object({
  claim: z.string(),
});

const pyserverSubtopicDataSchema = z.object({
  counts: z.record(z.unknown()).optional(),
  claims: z.array(pyserverClaimSchema),
});

const pyserverSubtopicTupleSchema = z.tuple([
  z.string(), // subtopicName
  pyserverSubtopicDataSchema,
]);

const pyserverTopicDataSchema = z.object({
  counts: z.record(z.unknown()).optional(),
  topics: z.array(pyserverSubtopicTupleSchema),
});

const pyserverTopicTupleSchema = z.tuple([
  z.string(), // topicName
  pyserverTopicDataSchema,
]);

const pyserverTaxonomySchema = z.object({
  taxonomy: z.array(pyserverTopicTupleSchema),
});

/**
 * Type alias for the pyserver taxonomy structure.
 * Inferred from Zod schema for type-safe function signatures.
 */
type PyserverTaxonomy = z.infer<typeof pyserverTaxonomySchema>;

/**
 * Extract all claims from the sorted claims tree.
 *
 * Tree structure from pyserver:
 * [
 *   [topicName: string, {
 *     counts: {...},
 *     topics: [  // Actually subtopics
 *       [subtopicName: string, {
 *         counts: {...},
 *         claims: [...]
 *       }]
 *     ]
 *   }]
 * ]
 */
function extractClaimsFromTree(tree: unknown): Array<{
  id: string;
  claim: string;
  topicName: string;
  subtopicName: string;
}> {
  const claims: Array<{
    id: string;
    claim: string;
    topicName: string;
    subtopicName: string;
  }> = [];

  // Validate tree structure with Zod
  const parseResult = pyserverTaxonomySchema.safeParse(tree);

  if (!parseResult.success) {
    perspectiveLogger.error(
      {
        error: parseResult.error.message,
        issues: parseResult.error.issues,
      },
      "Invalid pyserver taxonomy structure for bridging scoring",
    );
    return claims;
  }

  const validatedTree = parseResult.data;

  // tree.taxonomy is an array of validated tuples: [topicName, subtopicData]
  for (const [topicName, subtopicData] of validatedTree.taxonomy) {
    // subtopicData.topics is an array of validated tuples: [subtopicName, claimData]
    for (const [subtopicName, claimData] of subtopicData.topics) {
      for (const claim of claimData.claims) {
        claims.push({
          // Temporarily use claim text as ID for matching (IDs don't exist yet at this stage)
          id: claim.claim,
          claim: claim.claim,
          topicName,
          subtopicName,
        });
      }
    }
  }

  return claims;
}

/**
 * Generic helper to score a collection of items using Perspective API.
 * Shared by scoreClaims and scoreQuotes to eliminate code duplication.
 *
 * @param items - Collection of items to score
 * @param options - Configuration for scoring process
 * @returns Array of scored results
 */
async function scoreItems<TItem, TResult>(
  items: TItem[],
  options: {
    itemTypeName: string; // "claim" or "quote"
    itemTypeNamePlural: string; // "claims" or "quotes"
    getText: (item: TItem) => string | null | undefined;
    getId: (item: TItem) => string;
    buildResult: (item: TItem, score: PerspectiveScores) => TResult;
    redis?: Redis;
    apiKey: string;
    envPrefix: string;
  },
): Promise<TResult[]> {
  const {
    itemTypeName,
    itemTypeNamePlural,
    getText,
    getId,
    buildResult,
    redis,
    apiKey,
    envPrefix,
  } = options;

  perspectiveLogger.info(
    { [`${itemTypeName}Count`]: items.length },
    `Scoring ${itemTypeNamePlural} with Perspective API`,
  );

  const scores: TResult[] = [];
  let errors = 0;
  let processed = 0;

  // Rate limiting: default quota is 1 QPS (query per second)
  // Add 100ms buffer to be safe = 1100ms delay
  const delayBetweenRequests = 1100;

  // Circuit breaker: stop if >10% of requests fail
  const errorRateThreshold = 0.1;
  const minRequestsBeforeCheck = 10; // Need at least 10 requests before checking error rate

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemId = getId(item);

    try {
      // Apply rate limiting (skip delay for first request)
      if (i > 0) {
        await delay(delayBetweenRequests);
      }

      const text = getText(item);
      if (!text?.trim()) {
        perspectiveLogger.warn(
          { [`${itemTypeName}Id`]: itemId },
          `${itemTypeName} has no text, skipping`,
        );
        continue;
      }

      processed++;
      const score = await scoreText(text, apiKey, redis, envPrefix);

      if (score) {
        scores.push(buildResult(item, score));

        perspectiveLogger.debug(
          {
            [`${itemTypeName}Id`]: itemId,
            bridgingScore: score.bridgingScore.toFixed(3),
            progress: `${i + 1}/${items.length}`,
          },
          `Scored ${itemTypeName}`,
        );
      } else {
        perspectiveLogger.warn(
          { [`${itemTypeName}Id`]: itemId },
          `Failed to score ${itemTypeName}`,
        );
        errors++;
      }
    } catch (error) {
      perspectiveLogger.error(
        {
          [`${itemTypeName}Id`]: itemId,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        `Error scoring ${itemTypeName}`,
      );
      errors++;
      processed++;

      // Circuit breaker: stop if error rate exceeds threshold
      if (processed >= minRequestsBeforeCheck) {
        const errorRate = errors / processed;
        if (errorRate > errorRateThreshold) {
          perspectiveLogger.error(
            {
              errors,
              processed,
              errorRate: (errorRate * 100).toFixed(1) + "%",
              threshold: (errorRateThreshold * 100).toFixed(1) + "%",
            },
            `Error rate exceeded threshold, stopping ${itemTypeName} scoring`,
          );
          break;
        }
      }
    }
  }

  perspectiveLogger.info(
    {
      scoresGenerated: scores.length,
      errors,
      [`total${itemTypeNamePlural.charAt(0).toUpperCase() + itemTypeNamePlural.slice(1)}`]:
        items.length,
    },
    `${itemTypeName.charAt(0).toUpperCase() + itemTypeName.slice(1)} bridging scoring complete`,
  );

  return scores;
}

/**
 * Score multiple claims using Perspective API with rate limiting and Redis caching.
 *
 * @param claimsTree - The sorted claims tree from pipeline
 * @param redis - Redis client for caching (optional)
 * @param apiKey - Google Perspective API key (defaults to PERSPECTIVE_API_KEY env var)
 * @param envPrefix - Environment prefix for Redis cache keys (e.g., 'prod', 'dev')
 * @returns Array of bridging score objects
 */
export async function scoreClaims(
  claimsTree: PyserverTaxonomy,
  redis?: Redis,
  apiKey?: string,
  envPrefix?: string,
): Promise<schema.ClaimBridgingScore[]> {
  const effectiveApiKey = apiKey || process.env.PERSPECTIVE_API_KEY;
  const effectiveEnvPrefix =
    envPrefix || process.env.RATE_LIMIT_PREFIX || "dev";

  if (!effectiveApiKey) {
    perspectiveLogger.warn(
      "PERSPECTIVE_API_KEY not set, skipping bridging scores. " +
        "Set PERSPECTIVE_API_KEY environment variable to enable.",
    );
    return [];
  }

  const claims = extractClaimsFromTree(claimsTree);

  if (!claims || claims.length === 0) {
    perspectiveLogger.info("No claims provided for scoring");
    return [];
  }

  return scoreItems(claims, {
    itemTypeName: "claim",
    itemTypeNamePlural: "claims",
    getText: (claim) => claim.claim,
    getId: (claim) => claim.id,
    buildResult: (claim, score) => ({
      claimId: claim.id,
      topicName: claim.topicName,
      subtopicName: claim.subtopicName,
      ...score,
    }),
    redis,
    apiKey: effectiveApiKey,
    envPrefix: effectiveEnvPrefix,
  });
}

/**
 * Extract all quotes from the hydrated report tree.
 *
 * Traverses topics > subtopics > claims to get all quotes with their context.
 * Uses getQuotes() to include quotes from similarClaims (deduplicated claims).
 *
 * Note: Uses schema.Topic[] (UI-facing hydrated tree), not schema.Taxonomy (LLM output).
 */
export function extractQuotesFromTree(tree: schema.Topic[]): Array<{
  quoteId: string;
  claimId: string;
  text: string;
  topicName: string;
  subtopicName: string;
  speakerId: string;
  interview: string;
}> {
  const quotes: Array<{
    quoteId: string;
    claimId: string;
    text: string;
    topicName: string;
    subtopicName: string;
    speakerId: string;
    interview: string;
  }> = [];

  for (const topic of tree) {
    for (const subtopic of topic.subtopics) {
      for (const claim of subtopic.claims) {
        // Get all quotes including from similarClaims
        const allQuotes = getQuotes(claim);

        for (const quote of allQuotes) {
          quotes.push({
            quoteId: quote.id,
            claimId: claim.id,
            text: quote.text,
            topicName: topic.title,
            subtopicName: subtopic.title,
            speakerId: quote.reference.sourceId,
            interview: quote.reference.interview,
          });
        }
      }
    }
  }

  return quotes;
}

/**
 * Score multiple quotes using Perspective API with rate limiting and Redis caching.
 *
 * @param tree - The hydrated Topic[] tree with quotes (UI-facing format)
 * @param redis - Redis client for caching (optional)
 * @param apiKey - Google Perspective API key (defaults to PERSPECTIVE_API_KEY env var)
 * @param envPrefix - Environment prefix for Redis cache keys (e.g., 'prod', 'dev')
 * @returns Array of quote bridging score objects
 */
export async function scoreQuotes(
  tree: schema.Topic[],
  redis?: Redis,
  apiKey?: string,
  envPrefix?: string,
): Promise<schema.QuoteBridgingScore[]> {
  const effectiveApiKey = apiKey || process.env.PERSPECTIVE_API_KEY;
  const effectiveEnvPrefix =
    envPrefix || process.env.RATE_LIMIT_PREFIX || "dev";

  if (!effectiveApiKey) {
    perspectiveLogger.warn(
      "PERSPECTIVE_API_KEY not set, skipping quote bridging scores.",
    );
    return [];
  }

  const quotes = extractQuotesFromTree(tree);

  if (!quotes || quotes.length === 0) {
    perspectiveLogger.info("No quotes provided for scoring");
    return [];
  }

  return scoreItems(quotes, {
    itemTypeName: "quote",
    itemTypeNamePlural: "quotes",
    getText: (quote) => quote.text,
    getId: (quote) => quote.quoteId,
    buildResult: (quote, score) => ({
      quoteId: quote.quoteId,
      claimId: quote.claimId,
      topicName: quote.topicName,
      subtopicName: quote.subtopicName,
      speakerId: quote.speakerId,
      interview: quote.interview,
      ...score,
    }),
    redis,
    apiKey: effectiveApiKey,
    envPrefix: effectiveEnvPrefix,
  });
}
