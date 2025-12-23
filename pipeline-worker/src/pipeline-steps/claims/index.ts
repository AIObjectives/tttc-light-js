/**
 * Claims extraction pipeline step
 *
 * Given a list of comments and a taxonomy (topic tree), extract claims from each comment
 * and organize them into a tree structure grouped by topic and subtopic.
 */

import OpenAI from "openai";
import type { Logger } from "pino";
import { failure, type Result, success } from "tttc-common/functional-utils";
import { basicSanitize, sanitizeForOutput } from "../sanitizer";
import { ClusteringError } from "../types";
import { getReportLogger, processBatchConcurrently } from "../utils";
import { extractClaimsFromComment } from "./model";
import type {
  Claim,
  ClaimsOptions,
  ClaimsResult,
  ClaimsTree,
  Comment,
  LLMConfig,
  Topic,
} from "./types";

// Concurrency configuration for rate limiting
const MAX_CONCURRENCY = parseInt(process.env.CLAIMS_MAX_CONCURRENCY || "6", 10);
const CHUNK_SIZE = MAX_CONCURRENCY * 10; // 60 comments per chunk (6 concurrent * 10)

/**
 * Check if a comment has meaningful content
 */
function commentIsMeaningful(text: string): boolean {
  const MIN_CHAR_COUNT = 10;
  const MIN_WORD_COUNT = 3;
  return (
    text.length >= MIN_CHAR_COUNT || text.split(/\s+/).length >= MIN_WORD_COUNT
  );
}

/**
 * Process comments and extract claims
 *
 * @param comments - Array of comments to process
 * @param reportLogger - Logger instance
 * @returns Array of sanitized comments and filtered count
 */
function filterAndSanitizeComments(
  comments: Comment[],
  reportLogger: Logger,
): { sanitizedComments: Comment[]; filteredCount: number } {
  const sanitizedComments: Comment[] = [];
  let filteredCount = 0;

  for (const comment of comments) {
    const { sanitizedText, isSafe } = basicSanitize(
      comment.text,
      "claims_comment",
    );

    if (isSafe && commentIsMeaningful(sanitizedText)) {
      sanitizedComments.push({
        ...comment,
        text: sanitizedText,
      });
    } else if (!isSafe) {
      reportLogger.warn(`Rejecting unsafe comment in claims: ${comment.id}`);
      filteredCount++;
    } else {
      reportLogger.debug(`Filtering non-meaningful comment: ${comment.id}`);
      filteredCount++;
    }
  }

  if (filteredCount > 0) {
    reportLogger.info(
      `Filtered ${filteredCount} comments (unsafe or non-meaningful)`,
    );
  }

  return { sanitizedComments, filteredCount };
}

/**
 * Initialize claims tree structure from taxonomy
 */
function initializeClaimsTree(taxonomy: Topic[]): {
  tree: ClaimsTree;
  validTopics: Set<string>;
  validSubtopics: Map<string, Set<string>>;
} {
  const tree: ClaimsTree = {};
  const validTopics = new Set<string>();
  const validSubtopics = new Map<string, Set<string>>();

  for (const topic of taxonomy) {
    validTopics.add(topic.topicName);
    validSubtopics.set(topic.topicName, new Set());

    tree[topic.topicName] = {
      total: 0,
      subtopics: {},
    };

    for (const subtopic of topic.subtopics || []) {
      validSubtopics.get(topic.topicName)?.add(subtopic.subtopicName);
      tree[topic.topicName].subtopics[subtopic.subtopicName] = {
        total: 0,
        claims: [],
      };
    }
  }

  return { tree, validTopics, validSubtopics };
}

/**
 * Validate and add a claim to the tree
 */
function addClaimToTree(
  claim: Claim,
  tree: ClaimsTree,
  validTopics: Set<string>,
  validSubtopics: Map<string, Set<string>>,
  reportLogger: Logger,
): void {
  const { topicName, subtopicName } = claim;

  // Validate topic
  if (!validTopics.has(topicName)) {
    reportLogger.warn(
      {
        topicName,
        subtopicName,
        commentId: claim.commentId,
        validTopics: Array.from(validTopics),
      },
      "Claim references invalid topic not in taxonomy, skipping",
    );
    return;
  }

  // Validate subtopic
  if (!validSubtopics.get(topicName)?.has(subtopicName)) {
    reportLogger.warn(
      {
        topicName,
        subtopicName,
        commentId: claim.commentId,
        validSubtopicsForTopic: Array.from(validSubtopics.get(topicName) || []),
      },
      "Claim references invalid subtopic for this topic, skipping",
    );
    return;
  }

  // Add claim to tree
  tree[topicName].subtopics[subtopicName].claims.push(claim);
  tree[topicName].subtopics[subtopicName].total++;
  tree[topicName].total++;
}

/**
 * Build a claims tree from an array of claims
 *
 * @param claims - Array of all extracted claims
 * @param taxonomy - The taxonomy structure
 * @param reportLogger - Logger instance for warnings
 * @returns Claims tree organized by topic and subtopic
 */
function buildClaimsTree(
  claims: Claim[],
  taxonomy: Topic[],
  reportLogger: Logger,
): ClaimsTree {
  const { tree, validTopics, validSubtopics } = initializeClaimsTree(taxonomy);

  for (const claim of claims) {
    addClaimToTree(claim, tree, validTopics, validSubtopics, reportLogger);
  }

  return tree;
}

/**
 * Extract claims from a list of comments and organize them into a tree structure.
 *
 * This function processes comments in chunks with controlled concurrency to extract
 * claims using an LLM. Each claim is categorized into topics and subtopics based on
 * the provided taxonomy. Comments are sanitized and filtered for meaningful content
 * before processing.
 *
 * Input format:
 * - comments: Array of Comment objects (each has text, id, speaker)
 * - taxonomy: Array of topics with subtopics (the topic tree from clustering step)
 * - llmConfig: LLM configuration with model_name, system_prompt, user_prompt
 *
 * Output format:
 * - data: Claims tree organized by topic → subtopic → claims
 *   Each topic has:
 *   - total: total number of claims in the topic
 *   - subtopics: object mapping subtopic names to their claims
 *     Each subtopic has:
 *     - total: number of claims in the subtopic
 *     - claims: array of claim objects
 * - usage: Aggregated token counts across all LLM calls
 * - cost: Total estimated cost in dollars
 *
 * @param comments - Array of Comment objects to extract claims from
 * @param taxonomy - Array of topics with subtopics (from clustering step)
 * @param llmConfig - LLM configuration (model, prompts)
 * @param apiKey - OpenAI API key for LLM calls
 * @param options - Optional configuration object
 * @param options.reportId - Optional report identifier for logging context
 * @param options.userId - Optional user identifier for logging context
 * @param options.enableScoring - Optional flag to enable Weave evaluation scoring
 * @returns Result containing claims tree with usage and cost information, or an error
 *
 * @example
 * const result = await extractClaims(
 *   comments,
 *   taxonomy,
 *   { model_name: "gpt-4o-mini", system_prompt: "...", user_prompt: "..." },
 *   apiKey,
 *   { reportId: "report-123", userId: "user-456" }
 * );
 *
 * if (result.tag === "success") {
 *   console.log(`Extracted ${result.value.data} claims`);
 *   console.log(`Total cost: $${result.value.cost.toFixed(4)}`);
 * }
 */
export async function extractClaims(
  comments: Comment[],
  taxonomy: Topic[],
  llmConfig: LLMConfig,
  apiKey: string,
  options: ClaimsOptions = {},
): Promise<Result<ClaimsResult, ClusteringError>> {
  const { reportId, userId } = options;

  // Get report-specific logger
  const reportLogger = getReportLogger("claims", userId, reportId);

  reportLogger.info(
    `Starting claims extraction for ${comments.length} comments across ${taxonomy.length} topics`,
  );

  // Validate inputs
  if (comments.length === 0) {
    return failure(
      new ClusteringError("Comments cannot be empty for claims extraction"),
    );
  }

  if (taxonomy.length === 0) {
    return failure(
      new ClusteringError("Taxonomy cannot be empty for claims extraction"),
    );
  }

  // Initialize OpenAI client
  const client = new OpenAI({ apiKey });

  // Filter and sanitize comments
  const { sanitizedComments } = filterAndSanitizeComments(
    comments,
    reportLogger,
  );

  const totalComments = sanitizedComments.length;
  reportLogger.info(
    `Processing ${totalComments} comments in chunks of ${CHUNK_SIZE} (concurrency: ${MAX_CONCURRENCY})`,
  );

  // Track aggregated usage and cost
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCost = 0;
  let failedCount = 0;

  // Extract claims from each comment
  const allClaims: Claim[] = [];

  // Process comments in chunks to avoid memory issues with large datasets
  for (
    let chunkStart = 0;
    chunkStart < totalComments;
    chunkStart += CHUNK_SIZE
  ) {
    const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, totalComments);
    const chunk = sanitizedComments.slice(chunkStart, chunkEnd);

    reportLogger.debug(
      `Processing chunk ${chunkStart}-${chunkEnd} (${chunk.length} comments)`,
    );

    // Process chunk concurrently
    const chunkResults = await processBatchConcurrently(
      chunk,
      async (comment) => {
        const result = await extractClaimsFromComment({
          openaiClient: client,
          modelName: llmConfig.model_name,
          systemPrompt: llmConfig.system_prompt,
          userPrompt: llmConfig.user_prompt,
          commentText: comment.text,
          taxonomy,
          speaker: comment.speaker,
          commentId: comment.id,
          options: {
            enableScoring: options.enableScoring,
          },
        });
        return { comment, result };
      },
      MAX_CONCURRENCY,
    );

    // Process results from this chunk
    for (const { comment, result } of chunkResults) {
      if (result.tag === "failure") {
        reportLogger.error(
          { error: result.error, commentId: comment.id },
          "Failed to extract claims from comment",
        );
        failedCount++;
        continue;
      }

      const { claims, usage, cost } = result.value;

      // Aggregate usage
      totalInputTokens += usage.input_tokens;
      totalOutputTokens += usage.output_tokens;
      totalCost += cost;

      // Add claims to collection
      allClaims.push(...claims);
    }

    // Log progress after each chunk
    const progressPct = ((chunkEnd / totalComments) * 100).toFixed(1);
    reportLogger.info(
      `Progress: ${chunkEnd}/${totalComments} (${progressPct}%)`,
    );
  }

  // Final logging
  if (failedCount > 0) {
    const successRate = ((totalComments - failedCount) / totalComments) * 100;
    reportLogger.warn(
      `Claims extraction completed with ${failedCount}/${totalComments} failures (success rate: ${successRate.toFixed(1)}%)`,
    );

    // If more than 50% failed, this indicates a systemic issue - fail the entire operation
    if (failedCount > totalComments / 2) {
      const errorMsg = `High failure rate detected: ${failedCount}/${totalComments} failed (${(100 - successRate).toFixed(1)}% failure rate). This may indicate an API or system issue.`;
      reportLogger.error(errorMsg);
      return failure(new ClusteringError(errorMsg));
    }
  } else {
    reportLogger.info(
      `Claims extraction completed successfully for all ${totalComments} comments`,
    );
  }

  reportLogger.info(
    `Total claims extracted: ${allClaims.length}, ` +
      `${totalInputTokens + totalOutputTokens} tokens, $${totalCost.toFixed(4)} cost`,
  );

  // Build the claims tree
  const claimsTree = buildClaimsTree(allClaims, taxonomy, reportLogger);

  const responseData: ClaimsResult = {
    data: claimsTree,
    usage: {
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
      total_tokens: totalInputTokens + totalOutputTokens,
    },
    cost: totalCost,
  };

  // Filter PII from final output for user privacy
  return success(sanitizeForOutput(responseData));
}

/**
 * Export main function as default
 */
export default extractClaims;
