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
import type { Logger } from "pino";
import { failure, type Result, success } from "tttc-common/functional-utils";
import { logger } from "tttc-common/logger";
import { getReportLogger, processBatchConcurrently, tokenCost } from "../utils";
import { callDeduplicationModel } from "./model";
import type {
  Claim,
  ClusteringError,
  ClusteringOptions,
  GroupedClaim,
  ProcessedSubtopic,
  ProcessedTopic,
  ProcessSubtopicResult,
  SortAndDeduplicateInput,
  SortAndDeduplicateResult,
  SortedTree,
  SortStrategy,
} from "./types";

const _sortLogger = logger.child({ module: "sort-and-deduplicate" });

/**
 * Maximum number of subtopics to process concurrently
 * Based on observed performance characteristics from pyserver implementation
 */
const MAX_CONCURRENT_SUBTOPICS = 6;

/**
 * Sort entries by count strategy (numPeople or numClaims)
 *
 * @param entries - Array of entries with counts
 * @param strategy - Sort strategy to use
 * @returns Sorted array of entries
 */
function sortByStrategy<
  T extends { counts: { speakers: number; claims: number } },
>(entries: [string, T][], strategy: SortStrategy): [string, T][] {
  return entries.sort((a, b) => {
    if (strategy === "numPeople") {
      return b[1].counts.speakers - a[1].counts.speakers;
    } else {
      return b[1].counts.claims - a[1].counts.claims;
    }
  });
}

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
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

/**
 * Parse and validate claim IDs from a group
 *
 * @param group - Grouped claim with original claim IDs
 * @param claims - Original claims array
 * @param reportLogger - Logger instance
 * @returns Valid claim IDs or null if none are valid
 */
function parseAndValidateClaimIds(
  group: GroupedClaim,
  claims: Claim[],
  reportLogger: Logger,
): number[] | null {
  // Parse original claim IDs
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
    return null;
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
    return null;
  }

  return validClaimIds;
}

/**
 * Create a grouped claim from valid claim IDs
 *
 * @param validClaimIds - Valid claim IDs to group
 * @param claimText - Consolidated claim text from LLM
 * @param claims - Original claims array
 * @param speakers - Set to collect speakers
 * @returns Grouped claim with duplicates
 */
function createGroupedClaim(
  validClaimIds: number[],
  claimText: string | undefined,
  claims: Claim[],
  speakers: Set<string>,
): Claim {
  const primaryClaimId = validClaimIds[0];
  const baseClaim = claims[primaryClaimId];

  const groupedClaim: Claim = {
    ...baseClaim,
    claim: claimText?.trim() || baseClaim.claim,
    duplicates: [],
  };

  // Track primary speaker
  if (baseClaim.speaker) {
    speakers.add(baseClaim.speaker);
  }

  // Add remaining claims as duplicates
  for (let i = 1; i < validClaimIds.length; i++) {
    const claimId = validClaimIds[i];
    const dupeClaim = { ...claims[claimId], duplicated: true };
    groupedClaim.duplicates?.push(dupeClaim);

    // Track duplicate speaker
    if (dupeClaim.speaker) {
      speakers.add(dupeClaim.speaker);
    }
  }

  return groupedClaim;
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
    const validClaimIds = parseAndValidateClaimIds(group, claims, reportLogger);
    if (!validClaimIds) continue;

    // Track accounted claims
    validClaimIds.forEach((id) => {
      accountedClaimIds.add(id);
    });

    // Create grouped claim
    const groupedClaim = createGroupedClaim(
      validClaimIds,
      group.claimText,
      claims,
      speakers,
    );

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
 * Configuration for processing a subtopic
 */
interface SubtopicProcessingConfig {
  subtopicData: { total: number; claims: Claim[] };
  llmConfig: { model_name: string; system_prompt: string; user_prompt: string };
  apiKey: string;
  topicName: string;
  subtopicName: string;
  reportId: string | undefined;
  reportLogger: Logger;
}

/**
 * Handle single claim subtopics without deduplication
 *
 * @param claim - The single claim
 * @returns ProcessSubtopicResult with no duplicates
 */
function handleSingleClaim(claim: Claim): ProcessSubtopicResult {
  const speakers = new Set<string>();
  if (claim.speaker) {
    speakers.add(claim.speaker);
  }

  return {
    claims: [{ ...claim, duplicates: [] }],
    speakers,
    usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
  };
}

/**
 * Merge speakers from multiple sources
 *
 * @param target - Target speaker set
 * @param sources - Source speaker sets or arrays
 */
function mergeSpeakers(
  target: Set<string>,
  ...sources: (Set<string> | string[])[]
): void {
  for (const source of sources) {
    source.forEach((s) => {
      target.add(s);
    });
  }
}

/**
 * Log deduplication statistics
 *
 * @param claims - All claims after deduplication
 * @param subtopicName - Subtopic name for logging
 * @param reportLogger - Logger instance
 */
function logDeduplicationStats(
  claims: Claim[],
  subtopicName: string,
  reportLogger: Logger,
): void {
  const singleQuoteCount = claims.filter(
    (c) => c.duplicates?.length === 0,
  ).length;

  if (singleQuoteCount > 0) {
    const multiQuoteCount = claims.length - singleQuoteCount;
    reportLogger.info(
      {
        subtopic: subtopicName,
        multiQuoteCount,
        singleQuoteCount,
      },
      "Claims deduplicated",
    );
  }
}

/**
 * Process a subtopic by deduplicating and sorting its claims
 *
 * @param config - Configuration for processing the subtopic
 * @returns Result containing processed claims, speakers, usage stats, or an error
 */
async function processSubtopic(
  config: SubtopicProcessingConfig,
): Promise<Result<ProcessSubtopicResult, ClusteringError>> {
  const {
    subtopicData,
    llmConfig,
    apiKey,
    topicName,
    subtopicName,
    reportId,
    reportLogger,
  } = config;

  // Guard clause: single claim needs no deduplication
  if (subtopicData.total === 1 && subtopicData.claims.length > 0) {
    return success(handleSingleClaim(subtopicData.claims[0]));
  }

  // Deduplicate multiple claims
  const client = new OpenAI({ apiKey });
  const dedupResult = await callDeduplicationModel(
    client,
    subtopicData.claims,
    llmConfig,
    topicName,
    subtopicName,
    reportId,
  );

  // Guard clause: deduplication failure
  if (dedupResult.tag === "failure") {
    reportLogger.error(
      { error: dedupResult.error, topic: topicName, subtopic: subtopicName },
      "Deduplication failed",
    );
    return failure(dedupResult.error);
  }

  const { dedupClaims, usage } = dedupResult.value;

  // Process grouped claims from LLM deduplication
  const {
    dedupedClaims,
    accountedClaimIds,
    speakers: groupedSpeakers,
  } = processGroupedClaims(
    dedupClaims.groupedClaims,
    subtopicData.claims,
    reportLogger,
  );

  // Add missing claims that weren't grouped by LLM
  const { claims: missingClaims, speakers: missingSpeakers } = addMissingClaims(
    accountedClaimIds,
    subtopicData.claims,
    reportLogger,
    subtopicName,
  );

  // Merge all speakers and claims
  const allSpeakers = new Set<string>();
  mergeSpeakers(allSpeakers, groupedSpeakers, missingSpeakers);

  const allClaims = [...dedupedClaims, ...missingClaims];

  // Log statistics
  logDeduplicationStats(allClaims, subtopicName, reportLogger);

  // Sort by number of duplicates (most duplicated first)
  const sortedClaims = allClaims.sort(
    (a, b) => (b.duplicates?.length || 0) - (a.duplicates?.length || 0),
  );

  return success({
    claims: sortedClaims,
    speakers: allSpeakers,
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

  const reportLogger = getReportLogger(
    "sort-and-deduplicate",
    userId,
    reportId,
  );

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
          result: await processSubtopic({
            subtopicData,
            llmConfig: llm,
            apiKey,
            topicName,
            subtopicName,
            reportId,
            reportLogger,
          }),
        };
      },
      MAX_CONCURRENT_SUBTOPICS,
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

    // Skip topics with no successfully processed subtopics
    if (Object.keys(perTopicList).length === 0) {
      reportLogger.warn(
        { topic: topicName },
        "Topic has no successfully processed subtopics, skipping",
      );
      continue;
    }

    // Collect all unique speakers for this topic
    const topicSpeakers = new Set<string>();
    for (const subtopic of Object.values(perTopicList)) {
      subtopic.speakers.forEach((s) => {
        topicSpeakers.add(s);
      });
    }

    // Sort subtopics based on strategy
    const sortedSubtopics = sortByStrategy(Object.entries(perTopicList), sort);

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
  const fullSortedTree: SortedTree = sortByStrategy(
    Object.entries(sortedTree),
    sort,
  );

  // Calculate cost
  const costResult = tokenCost(
    llm.model_name,
    totalInputTokens,
    totalOutputTokens,
  );
  const cost = costResult.tag === "success" ? costResult.value : 0;

  reportLogger.info(
    {
      numTopics: fullSortedTree.length,
      totalTokens,
      cost,
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
    cost,
  };

  return success(result);
}

/**
 * Export main function as default
 */
export default sortAndDeduplicateClaims;
