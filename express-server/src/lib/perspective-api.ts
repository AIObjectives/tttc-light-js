/**
 * Perspective API scoring module for bridging-based report structuring.
 *
 * Uses Google's Perspective API to score claims based on bridge-building qualities:
 * - PERSONAL_STORY_EXPERIMENTAL: Personal experiences/anecdotes (builds empathy)
 * - REASONING_EXPERIMENTAL: Logical argumentation (fosters understanding)
 * - CURIOSITY_EXPERIMENTAL: Questions/curiosity (encourages dialogue)
 * - TOXICITY: Rude/divisive content (penalty multiplier)
 *
 * Composite bridging score: (personalStory + reasoning + curiosity) * (1 - toxicity)
 * Range: 0 to 3.0 (higher = more constructive, bridge-building content)
 * Max toxicity (1.0) completely disqualifies content (score becomes 0).
 */

import "dotenv/config";
import { logger } from "tttc-common/logger";
import * as schema from "tttc-common/schema";
import { getQuotes } from "tttc-common/morphisms";
import { createHash } from "crypto";
import type Redis from "ioredis";
import { z } from "zod";

const perspectiveLogger = logger.child({ module: "perspective-api" });

// ============================================================================
// Configuration Constants
// ============================================================================

const PERSPECTIVE_API_URL =
  "https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze";

/** Maximum text length accepted by Perspective API */
const PERSPECTIVE_API_MAX_TEXT_LENGTH = 20480;

/** Redis cache TTL for Perspective API responses (30 days) */
const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * Fallback rate limiting delay (milliseconds) when Redis is unavailable.
 * Default quota is 1 QPS, add 100ms buffer for safety.
 */
const RATE_LIMIT_DELAY_MS = 1100;

// ============================================================================
// Global Rate Limiting (Redis-based)
// ============================================================================

/** Redis key for global rate limiting across all pipeline runs */
const GLOBAL_RATE_LIMIT_KEY = "perspective:global-rate-limit";

/** Minimum interval between API calls (1 QPS) */
const GLOBAL_RATE_LIMIT_INTERVAL_MS = 1000;

/** Polling interval when waiting for rate limit slot */
const GLOBAL_RATE_LIMIT_POLL_MS = 50;

/** TTL for rate limit key (auto-cleanup if no pipelines running) */
const GLOBAL_RATE_LIMIT_TTL_SECONDS = 60;

/**
 * Lua script for atomic rate limit acquisition.
 * Returns 0 if acquired, or milliseconds to wait if not.
 */
const RATE_LIMIT_LUA_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local minInterval = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])

local lastCall = redis.call('GET', key)

if lastCall == false then
  redis.call('SETEX', key, ttl, now)
  return 0
end

local elapsed = now - tonumber(lastCall)

if elapsed >= minInterval then
  redis.call('SETEX', key, ttl, now)
  return 0
else
  return minInterval - elapsed
end
`;

/**
 * Circuit breaker error rate threshold.
 * Stop scoring if error rate exceeds this percentage.
 */
const CIRCUIT_BREAKER_ERROR_THRESHOLD = 0.1;

/**
 * Minimum requests before checking circuit breaker.
 * Prevents false positives from small sample sizes.
 */
const CIRCUIT_BREAKER_MIN_REQUESTS = 10;

/**
 * Sanitize text input for Perspective API.
 * Removes control characters and limits length to avoid API errors.
 */
function sanitizeText(text: string): string {
  // Remove control characters (except newline and tab)
  const cleanedText = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  if (cleanedText.length > PERSPECTIVE_API_MAX_TEXT_LENGTH) {
    perspectiveLogger.warn(
      {
        originalLength: cleanedText.length,
        maxLength: PERSPECTIVE_API_MAX_TEXT_LENGTH,
      },
      "Claim text exceeds Perspective API limit, truncating",
    );
    return cleanedText.substring(0, PERSPECTIVE_API_MAX_TEXT_LENGTH);
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
 * Formula: (personalStory + reasoning + curiosity) * (1 - toxicity)
 *
 * Sums the positive bridging attributes, then multiplies by (1 - toxicity)
 * so that high toxicity acts as a penalty multiplier. Max toxicity (1.0)
 * completely disqualifies content from being considered bridging.
 * Score range is 0 to 3.0.
 *
 * @param personalStory - Personal story score (0-1)
 * @param reasoning - Reasoning score (0-1)
 * @param curiosity - Curiosity score (0-1)
 * @param toxicity - Toxicity score (0-1)
 * @returns Composite bridging score (0 to 3.0)
 */
export function calculateBridgingScore(
  personalStory: number,
  reasoning: number,
  curiosity: number,
  toxicity: number,
): number {
  const positiveSum = personalStory + reasoning + curiosity;
  return positiveSum * (1 - toxicity);
}

/**
 * Check Redis cache for a previously scored text.
 * Returns cached score with recalculated bridgingScore, or null if not cached.
 *
 * This is separated from scoreText to allow cache checks before rate limiting delays.
 */
async function getCachedScore(
  text: string,
  redis: Redis | undefined,
  envPrefix?: string,
): Promise<PerspectiveScores | null> {
  if (!redis || !text?.trim()) return null;

  const cacheKey = getCacheKey(text, envPrefix);
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const cachedScore: PerspectiveScores = JSON.parse(cached);
      // Recalculate bridgingScore from cached raw attributes
      // This ensures formula changes apply to cached entries
      cachedScore.bridgingScore = calculateBridgingScore(
        cachedScore.personalStory,
        cachedScore.reasoning,
        cachedScore.curiosity,
        cachedScore.toxicity,
      );
      perspectiveLogger.debug(
        { cacheKey: cacheKey.substring(0, 30) },
        "Returning cached bridging score from Redis (recalculated)",
      );
      return cachedScore;
    }
  } catch (error) {
    perspectiveLogger.warn(
      { error, cacheKey: cacheKey.substring(0, 30) },
      "Redis cache read failed, continuing without cache",
    );
  }
  return null;
}

/**
 * Score a single text using Perspective API with Redis caching.
 *
 * Makes an API call and caches the response in Redis with 30-day TTL.
 * This function does NOT check the cache before calling - that's the caller's
 * responsibility via getCachedScore() to enable cache checks before rate limiting.
 *
 * @internal Only called from scoreItems() which handles cache reads and rate limiting.
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

  // Generate cache key for writing to Redis after API call
  // Note: Cache reads are handled by scoreItems() before calling this function
  const cacheKey = getCacheKey(text, envPrefix);

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

    // Extract scores from response (nullish coalescing for precise handling)
    const attrScores = data.attributeScores ?? {};

    const personalStory =
      attrScores.PERSONAL_STORY_EXPERIMENTAL?.summaryScore?.value ?? 0.0;
    const reasoning =
      attrScores.REASONING_EXPERIMENTAL?.summaryScore?.value ?? 0.0;
    const curiosity =
      attrScores.CURIOSITY_EXPERIMENTAL?.summaryScore?.value ?? 0.0;
    const toxicity = attrScores.TOXICITY?.summaryScore?.value ?? 0.0;

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
 * Acquire global rate limit slot using Redis-based coordination.
 * Waits indefinitely until a slot is available (1 QPS limit).
 *
 * Uses atomic Lua script to check-and-set timestamp, ensuring
 * only one pipeline can acquire a slot per second across all
 * concurrent pipeline runs.
 *
 * @param redis - Redis client (must be connected)
 */
async function acquireGlobalRateLimit(redis: Redis): Promise<void> {
  // No timeout - wait indefinitely for rate limit slot
  // Each slot clears in 1s, so even heavy contention resolves quickly
  while (true) {
    const now = Date.now();
    const result = await redis.eval(
      RATE_LIMIT_LUA_SCRIPT,
      1,
      GLOBAL_RATE_LIMIT_KEY,
      now,
      GLOBAL_RATE_LIMIT_INTERVAL_MS,
      GLOBAL_RATE_LIMIT_TTL_SECONDS,
    );

    if (result === 0) {
      perspectiveLogger.debug("Acquired global Perspective API rate limit");
      return;
    }

    // Wait before retrying (use remaining time or poll interval, whichever is smaller)
    const waitTime = Math.min(GLOBAL_RATE_LIMIT_POLL_MS, result as number);
    await delay(waitTime);
  }
}

/**
 * Acquire rate limit with graceful fallback when Redis is unavailable.
 *
 * Falls back to per-pipeline delay (RATE_LIMIT_DELAY_MS) if:
 * - Redis client is not provided
 * - Redis connection is not ready
 * - Redis operation fails
 *
 * @param redis - Redis client (optional)
 */
async function acquireRateLimitWithFallback(
  redis: Redis | undefined,
): Promise<void> {
  // Fallback: No Redis connection
  if (!redis) {
    perspectiveLogger.debug(
      "Redis unavailable, using per-pipeline rate limiting fallback",
    );
    await delay(RATE_LIMIT_DELAY_MS);
    return;
  }

  // Fallback: Redis not ready
  if (redis.status !== "ready") {
    perspectiveLogger.warn(
      { redisStatus: redis.status },
      "Redis not ready, using per-pipeline rate limiting fallback",
    );
    await delay(RATE_LIMIT_DELAY_MS);
    return;
  }

  try {
    await acquireGlobalRateLimit(redis);
  } catch (error) {
    // Fallback: Redis operation failed
    perspectiveLogger.warn(
      { error: error instanceof Error ? error.message : String(error) },
      "Global rate limit acquisition failed, using per-pipeline fallback",
    );
    await delay(RATE_LIMIT_DELAY_MS);
  }
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

  // Track API calls to apply rate limiting only when needed
  let apiCallsMade = 0;
  let cacheHits = 0;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemId = getId(item);

    try {
      const text = getText(item);
      if (!text?.trim()) {
        perspectiveLogger.warn(
          { [`${itemTypeName}Id`]: itemId },
          `${itemTypeName} has no text, skipping`,
        );
        continue;
      }

      // Check cache BEFORE applying rate limiting delay
      // This allows cached items to be processed without waiting
      const cachedScore = await getCachedScore(text, redis, envPrefix);
      if (cachedScore) {
        scores.push(buildResult(item, cachedScore));
        cacheHits++;
        perspectiveLogger.debug(
          {
            [`${itemTypeName}Id`]: itemId,
            bridgingScore: cachedScore.bridgingScore.toFixed(3),
            progress: `${i + 1}/${items.length}`,
            cached: true,
          },
          `Scored ${itemTypeName} (cached)`,
        );
        continue;
      }

      // Acquire global rate limit for ALL API calls (including first)
      // Another pipeline might have made a call milliseconds ago
      await acquireRateLimitWithFallback(redis);

      processed++;
      apiCallsMade++;
      const score = await scoreText(text, apiKey, redis, envPrefix);

      if (score) {
        scores.push(buildResult(item, score));

        perspectiveLogger.debug(
          {
            [`${itemTypeName}Id`]: itemId,
            bridgingScore: score.bridgingScore.toFixed(3),
            progress: `${i + 1}/${items.length}`,
            cached: false,
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
      if (processed >= CIRCUIT_BREAKER_MIN_REQUESTS) {
        const errorRate = errors / processed;
        if (errorRate > CIRCUIT_BREAKER_ERROR_THRESHOLD) {
          perspectiveLogger.error(
            {
              errors,
              processed,
              errorRate: (errorRate * 100).toFixed(1) + "%",
              threshold:
                (CIRCUIT_BREAKER_ERROR_THRESHOLD * 100).toFixed(1) + "%",
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
      cacheHits,
      apiCalls: apiCallsMade,
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
 * Extract all claims from the hydrated report tree.
 *
 * Traverses topics > subtopics > claims to get all claims with their UUIDs.
 *
 * Note: Uses schema.Topic[] (UI-facing hydrated tree), not schema.Taxonomy (LLM output).
 */
export function extractClaimsFromHydratedTree(tree: schema.Topic[]): Array<{
  claimId: string;
  claim: string;
  topicName: string;
  subtopicName: string;
}> {
  const claims: Array<{
    claimId: string;
    claim: string;
    topicName: string;
    subtopicName: string;
  }> = [];

  for (const topic of tree) {
    for (const subtopic of topic.subtopics) {
      for (const claim of subtopic.claims) {
        claims.push({
          claimId: claim.id,
          claim: claim.title,
          topicName: topic.title,
          subtopicName: subtopic.title,
        });
      }
    }
  }

  return claims;
}

/**
 * Score claims from the hydrated report tree using Perspective API.
 *
 * @param tree - The hydrated Topic[] tree with claims (UI-facing format)
 * @param redis - Redis client for caching (optional)
 * @param apiKey - Google Perspective API key (defaults to PERSPECTIVE_API_KEY env var)
 * @param envPrefix - Environment prefix for Redis cache keys (e.g., 'prod', 'dev')
 * @returns Array of claim bridging score objects with UUIDs
 */
export async function scoreClaimsFromHydratedTree(
  tree: schema.Topic[],
  redis?: Redis,
  apiKey?: string,
  envPrefix?: string,
): Promise<schema.ClaimBridgingScore[]> {
  const effectiveApiKey = apiKey || process.env.PERSPECTIVE_API_KEY;
  const effectiveEnvPrefix =
    envPrefix || process.env.RATE_LIMIT_PREFIX || "dev";

  if (!effectiveApiKey) {
    perspectiveLogger.warn(
      "PERSPECTIVE_API_KEY not set, skipping claim bridging scores.",
    );
    return [];
  }

  const claims = extractClaimsFromHydratedTree(tree);

  if (!claims || claims.length === 0) {
    perspectiveLogger.info("No claims provided for scoring");
    return [];
  }

  return scoreItems(claims, {
    itemTypeName: "claim",
    itemTypeNamePlural: "claims",
    getText: (claim) => claim.claim,
    getId: (claim) => claim.claimId,
    buildResult: (claim, score) => ({
      claimId: claim.claimId,
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
