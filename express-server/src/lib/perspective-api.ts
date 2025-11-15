/**
 * Perspective API scoring module for bridging-based report structuring.
 *
 * Uses Google's Perspective API to score claims based on bridge-building qualities:
 * - PERSONAL_STORY_EXPERIMENTAL: Personal experiences/anecdotes (builds empathy)
 * - REASONING_EXPERIMENTAL: Logical argumentation (fosters understanding)
 * - CURIOSITY_EXPERIMENTAL: Questions/curiosity (encourages dialogue)
 * - TOXICITY: Rude/divisive content (inverse indicator)
 *
 * Composite bridging score: (personalStory + reasoning + curiosity) / 3 - (toxicity * 0.5)
 * Range: -0.5 to 1.0 (higher = more constructive, bridge-building content)
 */

import "dotenv/config";
import { logger } from "tttc-common/logger";
import * as schema from "tttc-common/schema";
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
 * Score multiple claims using Perspective API with rate limiting and Redis caching.
 *
 * @param claimsTree - The sorted claims tree from pipeline
 * @param redis - Redis client for caching (optional)
 * @param apiKey - Google Perspective API key (defaults to PERSPECTIVE_API_KEY env var)
 * @param envPrefix - Environment prefix for Redis cache keys (e.g., 'prod', 'dev')
 * @returns Array of bridging score objects
 */
export async function scoreClaims(
  claimsTree: any,
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

  perspectiveLogger.info(
    { claimCount: claims.length },
    "Scoring claims with Perspective API",
  );

  const scores: schema.ClaimBridgingScore[] = [];
  let errors = 0;
  let processed = 0;

  // Rate limiting: default quota is 1 QPS (query per second)
  // Add 100ms buffer to be safe = 1100ms delay
  const delayBetweenRequests = 1100;

  // Circuit breaker: stop if >10% of requests fail
  const errorRateThreshold = 0.1;
  const minRequestsBeforeCheck = 10; // Need at least 10 requests before checking error rate

  for (let i = 0; i < claims.length; i++) {
    const claim = claims[i];

    try {
      // Apply rate limiting (skip delay for first request)
      if (i > 0) {
        await delay(delayBetweenRequests);
      }

      if (!claim.claim) {
        perspectiveLogger.warn(
          { claimId: claim.id },
          "Claim has no text, skipping",
        );
        continue;
      }

      processed++;
      const score = await scoreText(
        claim.claim,
        effectiveApiKey,
        redis,
        effectiveEnvPrefix,
      );

      if (score) {
        scores.push({
          claimId: claim.id,
          topicName: claim.topicName,
          subtopicName: claim.subtopicName,
          ...score,
        });

        perspectiveLogger.debug(
          {
            claimId: claim.id,
            bridgingScore: score.bridgingScore.toFixed(3),
            progress: `${i + 1}/${claims.length}`,
          },
          "Scored claim",
        );
      } else {
        perspectiveLogger.warn({ claimId: claim.id }, "Failed to score claim");
        errors++;
      }
    } catch (error) {
      perspectiveLogger.error(
        {
          claimId: claim.id,
          error: error instanceof Error ? error.message : "Unknown error",
        },
        "Error scoring claim",
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
            "Error rate exceeded threshold, stopping bridging scoring",
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
      totalClaims: claims.length,
    },
    "Bridging scoring complete",
  );

  return scores;
}
