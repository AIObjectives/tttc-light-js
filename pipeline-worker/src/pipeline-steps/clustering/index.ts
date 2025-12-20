/**
 * Clustering pipeline step - Topic Tree Generation
 *
 * Given a list of comments, return a corresponding taxonomy of relevant topics and their
 * subtopics, with a short description for each.
 */

import OpenAI from "openai";
import type { Logger } from "pino";
import { failure, type Result, success } from "tttc-common/functional-utils";
import {
  basicSanitize,
  sanitizeForOutput,
  sanitizePromptLength,
} from "../sanitizer";
import { getReportLogger } from "../utils";
import { callClusteringModel } from "./model";
import type {
  ClusteringError,
  ClusteringOptions,
  Comment,
  LLMConfig,
  TopicTreeResult,
} from "./types";

/**
 * Check if a comment has meaningful content
 */
function commentIsMeaningful(text: string): boolean {
  const MIN_CHAR_COUNT = 10;
  const MIN_WORD_COUNT = 3;
  return (
    text.length >= MIN_CHAR_COUNT || text.split(" ").length >= MIN_WORD_COUNT
  );
}

/**
 * Sanitize and filter comments, building a prompt
 *
 * @param comments - Array of comments to process
 * @param basePrompt - Base user prompt to prepend
 * @param reportLogger - Logger instance
 * @returns Object with fullPrompt, sanitizedComments array, and filteredCount
 */
function sanitizeAndBuildPrompt(
  comments: Comment[],
  basePrompt: string,
  reportLogger: Logger,
): { fullPrompt: string; sanitizedComments: string[]; filteredCount: number } {
  let fullPrompt = basePrompt;
  let filteredCount = 0;
  const sanitizedComments: string[] = [];

  for (const comment of comments) {
    // Basic sanitization check
    const { sanitizedText, isSafe } = basicSanitize(
      comment.text,
      "topic_tree_comment",
    );

    if (isSafe && commentIsMeaningful(sanitizedText)) {
      fullPrompt += `\n${sanitizedText}`;
      sanitizedComments.push(sanitizedText);
    } else if (!isSafe) {
      reportLogger.warn(
        `Rejecting unsafe comment in topic_tree: ${comment.id}`,
      );
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

  // Basic prompt length check
  fullPrompt = sanitizePromptLength(fullPrompt);

  return { fullPrompt, sanitizedComments, filteredCount };
}

/**
 * Generate a topic tree (taxonomy) from a list of comments.
 *
 * Input format:
 * - comments: a list of Comment objects (each has text, id, speaker, optional interview)
 * - llmConfig: LLM configuration with model_name, system_prompt, user_prompt
 *
 * Output format:
 * - data: array of topics, where each topic has:
 *   - topicName: short topic title
 *   - topicShortDescription: short description of the topic
 *   - subtopics: array of subtopics with subtopicName and subtopicShortDescription
 * - usage: token counts (completion_tokens, prompt_tokens, total_tokens)
 * - cost: estimated cost in dollars
 *
 * @param comments - Array of Comment objects to cluster
 * @param llmConfig - LLM configuration (model, prompts)
 * @param apiKey - OpenAI API key
 * @param options - Optional configuration (reportId, userId, etc.)
 * @returns Result containing topic tree with usage and cost information, or an error
 */
export async function commentsToTree(
  comments: Comment[],
  llmConfig: LLMConfig,
  apiKey: string,
  options: ClusteringOptions = {},
): Promise<Result<TopicTreeResult, ClusteringError>> {
  const { reportId, userId } = options;

  // Get report-specific logger
  const reportLogger = getReportLogger("clustering", userId, reportId);

  reportLogger.info(
    `Starting topic_tree processing with ${comments.length} comments`,
  );

  // Initialize OpenAI client
  const client = new OpenAI({ apiKey });

  // Build prompt with sanitized comments and collect sanitized text for evaluation
  const { fullPrompt, sanitizedComments } = sanitizeAndBuildPrompt(
    comments,
    llmConfig.user_prompt,
    reportLogger,
  );

  // Join sanitized comments for evaluation
  const commentsText = sanitizedComments.join("\n");

  reportLogger.info(
    `Making API call to ${llmConfig.model_name} (prompt length: ${fullPrompt.length} chars)`,
  );

  // Call clustering model with usage tracking
  const clusteringResult = await callClusteringModel(
    client,
    llmConfig.model_name,
    llmConfig.system_prompt,
    fullPrompt,
    commentsText,
  );

  if (clusteringResult.tag === "failure") {
    reportLogger.error(
      { error: clusteringResult.error },
      "Failed to call clustering model",
    );

    return failure(clusteringResult.error);
  }

  const result = clusteringResult.value;

  reportLogger.info(
    `Topic tree generated: ${result.taxonomy.length} topics, ` +
      `${result.usage.total_tokens} tokens, $${result.cost.toFixed(4)} cost`,
  );

  const responseData: TopicTreeResult = {
    data: result.taxonomy,
    usage: result.usage,
    cost: result.cost,
  };

  // Filter PII from final output for user privacy
  return success(sanitizeForOutput(responseData));
}

/**
 * Export main function as default
 */
export default commentsToTree;
