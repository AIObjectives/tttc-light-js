/**
 * Sort and Deduplicate Claims Pipeline Step
 *
 * Given a claims tree with topics, subtopics, and claims, this step:
 * 1. Deduplicates claims within each subtopic using an LLM
 * 2. Sorts topics, subtopics, and claims by frequency
 *
 * The most popular topics, subtopics, and claims (by near-duplicate count) appear first.
 * Near-duplicate claims are nested under a primary claim in the "duplicates" field.
 */

import OpenAI from "openai";
import { Logger } from "pino";
import { Result, success, failure } from "tttc-common/functional-utils";
import { logger } from "tttc-common/logger";
import {
  tokenCost,
  processBatchConcurrently,
  getReportLogger,
} from "../utils";
import { basicSanitize } from "../sanitizer";
import { callDeduplicationModel } from "./model";
import type {
  ClaimsTree,
  SortAndDeduplicateInput,
  SortAndDeduplicateResult,
  SortStrategy,
  Claim,
  ProcessedSubtopic,
  ProcessedTopic,
  SortedTree,
  ClusteringOptions,
  ClusteringError,
  GroupedClaim,
  ProcessSubtopicResult,
} from "./types";

const sortLogger = logger.child({ module: "sort-and-deduplicate" });

/**
 * Parse claim ID from string or number format
 *
 * @param claimIdStr - Claim ID in format "claimId0" or number 0
 * @returns Parsed claim ID number or null if invalid
 */
function parseClaimId(claimIdStr: string | number): number | null {
  if (typeof claimIdStr === "number") {
    return claimIdStr;
  }

  if (typeof claimIdStr === "string") {
    if (!claimIdStr.includes("claimId")) {
      return null;
    }

    const parsed = parseInt(claimIdStr.replace("claimId", ""), 10);
    return isNaN(parsed) ? null : parsed;
  }

  return null;
}

/**
 * Process grouped claims from LLM deduplication response
 *
 * @param groups - Grouped claims from LLM
 * @param claims - Original claims array
 * @param reportLogger - Logger instance
 * @returns Deduplicated claims and set of accounted claim IDs
 */
function processGroupedClaims(
  groups: GroupedClaim[],
  claims: Claim[],
  reportLogger: Logger,
): {
  dedupedClaims: Claim[];
  accountedClaimIds: Set<number>;
  speakers: Set<string>;
} {
  const dedupedClaims: Claim[] = [];
  const accountedClaimIds = new Set<number>();
  const speakers = new Set<string>();

  for (const group of groups) {
    // Parse originalClaimIds
    const originalClaimIds: number[] = [];
    for (const claimIdStr of group.originalClaimIds) {
      const parsed = parseClaimId(claimIdStr);
      if (parsed !== null) {
        originalClaimIds.push(parsed);
      } else {
        reportLogger.warn({ claimIdStr }, "Could not parse claim ID");
      }
    }

    if (originalClaimIds.length === 0) {
      reportLogger.warn({ group }, "Group has no valid claim IDs");
      continue;
    }

    // Validate claim IDs are within bounds
    const validClaimIds = originalClaimIds.filter(
      (id) => id >= 0 && id < claims.length,
    );

    if (validClaimIds.length === 0) {
      reportLogger.warn(
        { originalClaimIds },
        "Group has no valid claim IDs within bounds",
      );
      continue;
    }

    // Track accounted claims
    validClaimIds.forEach((id) => accountedClaimIds.add(id));

    // Use first claim as base, but with grouped claim text
    const primaryClaimId = validClaimIds[0];
    const baseClaim = claims[primaryClaimId];

    const groupedClaim: Claim = {
      ...baseClaim,
      claim: group.claimText?.trim() || baseClaim.claim,
      duplicates: [],
    };

    // Track speaker
    if (baseClaim.speaker) {
      speakers.add(baseClaim.speaker);
    }

    // Add remaining claims as duplicates
    for (let i = 1; i < validClaimIds.length; i++) {
      const claimId = validClaimIds[i];
      const dupeClaim = { ...claims[claimId], duplicated: true };
      groupedClaim.duplicates!.push(dupeClaim);

      // Track speaker
      if (dupeClaim.speaker) {
        speakers.add(dupeClaim.speaker);
      }
    }

    dedupedClaims.push(groupedClaim);
  }

  return { dedupedClaims, accountedClaimIds, speakers };
}

/**
 * Add missing claims that weren't grouped by LLM
 *
 * @param accountedClaimIds - Set of claim IDs already accounted for
 * @param claims - Original claims array
 * @param reportLogger - Logger instance
 * @param subtopicName - Subtopic name for logging
 * @returns Array of missing claims with empty duplicates arrays
 */
function addMissingClaims(
  accountedClaimIds: Set<number>,
  claims: Claim[],
  reportLogger: Logger,
  subtopicName: string,
): { claims: Claim[]; speakers: Set<string> } {
  const allClaimIds = new Set(
    Array.from({ length: claims.length }, (_, i) => i),
  );
  const missingClaimIds = Array.from(allClaimIds).filter(
    (id) => !accountedClaimIds.has(id),
  );

  const missingClaims: Claim[] = [];
  const speakers = new Set<string>();

  if (missingClaimIds.length > 0) {
    reportLogger.warn(
      {
        subtopic: subtopicName,
        numMissing: missingClaimIds.length,
      },
      "LLM missed claims in grouping, adding as single-item groups",
    );

    for (const missingId of missingClaimIds.sort((a, b) => a - b)) {
      const claim = { ...claims[missingId], duplicates: [] };
      if (claim.speaker) {
        speakers.add(claim.speaker);
      }
      missingClaims.push(claim);
    }
  }

  return { claims: missingClaims, speakers };
}

/**
 * Process a subtopic by deduplicating and sorting its claims
 *
 * @param subtopicData - The subtopic data with claims
 * @param llmConfig - LLM configuration for deduplication
 * @param apiKey - OpenAI API key
 * @param topicName - Topic name for logging
 * @param subtopicName - Subtopic name for logging
 * @param reportId - Report ID for logging
 * @param reportLogger - Logger instance
 * @returns Result containing processed claims, speakers, usage stats, or an error
 */
async function processSubtopic(
  subtopicData: { total: number; claims: Claim[] },
  llmConfig: { model_name: string; system_prompt: string; user_prompt: string },
  apiKey: string,
  topicName: string,
  subtopicName: string,
  reportId: string | undefined,
  reportLogger: Logger,
): Promise<Result<ProcessSubtopicResult, ClusteringError>> {
  const perTopicSpeakers = new Set<string>();
  let usage = { input_tokens: 0, output_tokens: 0, total_tokens: 0 };

  // Single claim or empty - no deduplication needed
  if (subtopicData.total === 1) {
    const claims = subtopicData.claims.map((claim) => ({
      ...claim,
      duplicates: [],
    }));

    // Track speaker
    if (claims.length > 0 && claims[0].speaker) {
      perTopicSpeakers.add(claims[0].speaker);
    }

    return success({ claims, speakers: perTopicSpeakers, usage });
  }

  // Multiple claims - deduplicate
  const client = new OpenAI({ apiKey });
  const dedupResult = await callDeduplicationModel(
    client,
    subtopicData.claims,
    llmConfig,
    topicName,
    subtopicName,
    reportId,
  );

  if (dedupResult.tag === "failure") {
    reportLogger.error(
      { error: dedupResult.error, topic: topicName, subtopic: subtopicName },
      "Deduplication failed",
    );
    return failure(dedupResult.error);
  }

  const { dedupClaims, usage: dedupUsage } = dedupResult.value;
  usage = dedupUsage;

  // Process grouped claims from LLM deduplication
  const { dedupedClaims, accountedClaimIds, speakers } = processGroupedClaims(
    dedupClaims.groupedClaims,
    subtopicData.claims,
    reportLogger,
  );

  // Merge speakers
  speakers.forEach((s) => perTopicSpeakers.add(s));

  // Add missing claims that weren't grouped by LLM
  const { claims: missingClaims, speakers: missingSpeakers } = addMissingClaims(
    accountedClaimIds,
    subtopicData.claims,
    reportLogger,
    subtopicName,
  );

  // Merge missing speakers
  missingSpeakers.forEach((s) => perTopicSpeakers.add(s));

  const allClaims = [...dedupedClaims, ...missingClaims];

  // Log statistics
  const singleQuoteCount = allClaims.filter(
    (c) => c.duplicates!.length === 0,
  ).length;
  const multiQuoteCount = allClaims.length - singleQuoteCount;

  if (singleQuoteCount > 0) {
    reportLogger.info(
      {
        subtopic: subtopicName,
        multiQuoteCount,
        singleQuoteCount,
      },
      "Claims deduplicated",
    );
  }

  // Sort by number of duplicates (most duplicated first)
  const sortedClaims = allClaims.sort(
    (a, b) => (b.duplicates?.length || 0) - (a.duplicates?.length || 0),
  );

  return success({
    claims: sortedClaims,
    speakers: perTopicSpeakers,
    usage,
  });
}

/**
 * Sort and deduplicate a claims tree.
 *
 * For each subtopic:
 * - Send claims to LLM to detect near-duplicates
 * - Group duplicates under primary claims
 * - Sort claims by number of duplicates (most popular first)
 *
 * After deduplication, sort the full tree:
 * - More frequent topics appear first
 * - Within each topic, more frequent subtopics appear first
 * - Within each subtopic, claims with most duplicates appear first
 *
 * @param input - Input configuration with tree, LLM config, and sort strategy
 * @param apiKey - OpenAI API key
 * @param options - Optional configuration (reportId, userId)
 * @returns Result containing sorted tree with usage and cost, or an error
 */
export async function sortAndDeduplicateClaims(
  input: SortAndDeduplicateInput,
  apiKey: string,
  options: ClusteringOptions = {},
): Promise<Result<SortAndDeduplicateResult, ClusteringError>> {
  const { tree, llm, sort } = input;
  const { reportId, userId } = options;

  const reportLogger = getReportLogger("sort-and-deduplicate", userId, reportId);

  reportLogger.info(
    {
      numTopics: Object.keys(tree).length,
      sortStrategy: sort,
    },
    "Starting sort and deduplicate",
  );

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalTokens = 0;

  const sortedTree: Record<string, ProcessedTopic> = {};

  // Process each topic
  for (const [topicName, topicData] of Object.entries(tree)) {
    let perTopicTotal = 0;
    const perTopicList: Record<string, ProcessedSubtopic> = {};

    // Check for empty topics
    if (!topicData.subtopics || Object.keys(topicData.subtopics).length === 0) {
      reportLogger.warn({ topic: topicName }, "Topic has no subtopics");
      continue;
    }

    // Process each subtopic in parallel
    const subtopicEntries = Object.entries(topicData.subtopics);

    // Calculate total for this topic
    for (const [, subtopicData] of subtopicEntries) {
      perTopicTotal += subtopicData.total;
    }

    const results = await processBatchConcurrently(
      subtopicEntries,
      async ([subtopicName, subtopicData]) => {
        return {
          subtopicName,
          subtopicData,
          result: await processSubtopic(
            subtopicData,
            llm,
            apiKey,
            topicName,
            subtopicName,
            reportId,
            reportLogger,
          ),
        };
      },
      6, // Process up to 6 subtopics concurrently
    );

    // Process results
    for (const { subtopicName, subtopicData, result } of results) {
      if (result.tag === "failure") {
        // Log error but continue processing other subtopics
        reportLogger.error(
          { error: result.error, topic: topicName, subtopic: subtopicName },
          "Failed to process subtopic, skipping",
        );
        continue;
      }

      const { claims, speakers, usage } = result.value;

      // Accumulate token usage
      totalInputTokens += usage.input_tokens;
      totalOutputTokens += usage.output_tokens;
      totalTokens += usage.total_tokens;

      // Store processed subtopic
      perTopicList[subtopicName] = {
        claims,
        speakers: Array.from(speakers),
        counts: {
          claims: subtopicData.total,
          speakers: speakers.size,
        },
      };
    }

    // Collect all unique speakers for this topic
    const topicSpeakers = new Set<string>();
    for (const subtopic of Object.values(perTopicList)) {
      subtopic.speakers.forEach((s) => topicSpeakers.add(s));
    }

    // Sort subtopics based on strategy
    const sortedSubtopics = Object.entries(perTopicList).sort((a, b) => {
      if (sort === "numPeople") {
        return b[1].counts.speakers - a[1].counts.speakers;
      } else {
        return b[1].counts.claims - a[1].counts.claims;
      }
    });

    sortedTree[topicName] = {
      topics: sortedSubtopics,
      speakers: Array.from(topicSpeakers),
      counts: {
        claims: perTopicTotal,
        speakers: topicSpeakers.size,
      },
    };
  }

  // Sort topics based on strategy
  const fullSortedTree: SortedTree = Object.entries(sortedTree).sort((a, b) => {
    if (sort === "numPeople") {
      return b[1].counts.speakers - a[1].counts.speakers;
    } else {
      return b[1].counts.claims - a[1].counts.claims;
    }
  });

  // Calculate cost
  const cost = tokenCost(llm.model_name, totalInputTokens, totalOutputTokens);

  reportLogger.info(
    {
      numTopics: fullSortedTree.length,
      totalTokens,
      cost: cost >= 0 ? cost : 0,
    },
    "Sort and deduplicate complete",
  );

  const result: SortAndDeduplicateResult = {
    data: fullSortedTree,
    usage: {
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
      total_tokens: totalTokens,
    },
    cost: cost >= 0 ? cost : 0,
  };

  return success(result);
}

/**
 * Export main function as default
 */
export default sortAndDeduplicateClaims;
