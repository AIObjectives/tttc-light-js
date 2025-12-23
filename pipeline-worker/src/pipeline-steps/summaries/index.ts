/**
 * Topic Summaries Pipeline Step
 *
 * Given a sorted and deduplicated tree with topics, subtopics, and claims, this step:
 * 1. Generates a summary for each topic using an LLM
 * 2. Processes each topic individually in parallel with controlled concurrency
 * 3. Aggregates usage and cost statistics
 *
 * Error handling: If any topic fails to generate a summary, the entire operation
 * fails fast and returns the first error encountered.
 */

import OpenAI from "openai";
import type { Logger } from "pino";
import { failure, type Result, success } from "tttc-common/functional-utils";
import { sanitizeForOutput } from "../sanitizer";
import { getReportLogger, processBatchConcurrently } from "../utils";
import { callSummaryModel } from "./model";
import type {
  ClusteringOptions,
  LLMConfig,
  SortedTree,
  SummariesInput,
  SummariesResult,
  SummaryModelResult,
  TopicSummary,
} from "./types";
import { ClusteringError } from "./types";

/**
 * Maximum number of topics to process concurrently to avoid rate limits
 */
const MAX_CONCURRENT_SUMMARIES = 6;

/**
 * Process a single topic to generate its summary
 *
 * @param openaiClient - Shared OpenAI client instance
 * @param topicName - Name of the topic
 * @param topicData - Processed topic data with subtopics and claims
 * @param llmConfig - LLM configuration for summary generation
 * @param reportId - Optional report ID for logging context
 * @param reportLogger - Logger instance
 * @param options - Optional Weave evaluation options
 * @returns Result containing topic summary with usage stats, or an error
 */
async function processTopicSummary(
  openaiClient: OpenAI,
  topicName: string,
  topicData: SortedTree[number][1],
  llmConfig: LLMConfig,
  reportId: string | undefined,
  reportLogger: Logger,
  options?: {
    enableWeave?: boolean;
    weaveProjectName?: string;
  },
): Promise<
  Result<SummaryModelResult & { topicName: string }, ClusteringError>
> {
  reportLogger.debug({ topicName }, "Processing summary for topic");

  // Create single-topic tree (following express-server pattern)
  const singleTopicTree: SortedTree = [[topicName, topicData]];

  // Call model to generate summary
  const result = await callSummaryModel({
    openaiClient,
    modelName: llmConfig.model_name,
    systemPrompt: llmConfig.system_prompt,
    userPrompt: llmConfig.user_prompt,
    tree: singleTopicTree,
    topicName,
    reportId,
    options,
  });

  if (result.tag === "failure") {
    reportLogger.error(
      { error: result.error, topic: topicName },
      "Summary generation failed",
    );
    return failure(result.error);
  }

  const { summary, usage, cost } = result.value;

  return success({
    topicName,
    summary,
    usage,
    cost,
  });
}

/**
 * Generate summaries for all topics in the tree.
 *
 * Topics are processed in parallel with controlled concurrency to respect API rate
 * limits. If any topic fails, the function returns the first error encountered
 * (fail-fast behavior). The results are aggregated with combined usage and cost.
 *
 * @param input - Input configuration with tree and LLM config
 * @param apiKey - OpenAI API key
 * @param options - Optional configuration (reportId, userId, enableWeave, weaveProjectName)
 * @returns Result containing array of topic summaries with aggregated usage and cost, or an error
 */
export async function generateTopicSummaries(
  input: SummariesInput,
  apiKey: string,
  options: ClusteringOptions = {},
): Promise<Result<SummariesResult, ClusteringError>> {
  const { tree, llm } = input;
  const { reportId, userId, enableWeave, weaveProjectName } = options;

  const reportLogger = getReportLogger("summaries", userId, reportId);

  // Validate inputs
  if (tree.length === 0) {
    return failure(
      new ClusteringError("Tree cannot be empty for summary generation"),
    );
  }

  reportLogger.info(
    { numTopics: tree.length },
    "Starting individual topic summaries",
  );

  // Create shared OpenAI client for all topics
  const openaiClient = new OpenAI({ apiKey });

  // Process each topic individually with controlled concurrency
  // Using processBatchConcurrently to limit parallel API calls
  const results = await processBatchConcurrently(
    tree,
    async ([topicName, topicData]) => {
      return processTopicSummary(
        openaiClient,
        topicName,
        topicData,
        llm,
        reportId,
        reportLogger,
        { enableWeave, weaveProjectName },
      );
    },
    MAX_CONCURRENT_SUMMARIES,
  );

  // Check for failures
  const firstFailure = results.find((r) => r.tag === "failure");
  if (firstFailure && firstFailure.tag === "failure") {
    reportLogger.error(
      { error: firstFailure.error },
      "At least one topic summary failed",
    );
    return firstFailure;
  }

  // All succeeded, extract values from successful results
  // TypeScript knows these are all success results after the failure check above
  const successfulSummaries = results.map((r) => {
    if (r.tag !== "success") {
      // This should never happen due to the check above, but TypeScript needs it
      throw new Error("Unexpected failure result after filtering");
    }
    return r.value;
  });

  // Build combined data array
  const combinedData: TopicSummary[] = successfulSummaries.map((summary) => ({
    topicName: summary.topicName,
    summary: summary.summary,
  }));

  // Aggregate usage statistics
  const combinedUsage = successfulSummaries.reduce(
    (acc, summary) => ({
      input_tokens: acc.input_tokens + summary.usage.input_tokens,
      output_tokens: acc.output_tokens + summary.usage.output_tokens,
      total_tokens: acc.total_tokens + summary.usage.total_tokens,
    }),
    { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
  );

  // Aggregate cost
  const combinedCost = successfulSummaries.reduce(
    (acc, summary) => acc + summary.cost,
    0,
  );

  reportLogger.info(
    {
      summariesGenerated: combinedData.length,
      topicsProcessed: tree.length,
      totalTokens: combinedUsage.total_tokens,
      cost: combinedCost,
    },
    "Completed all topic summaries",
  );

  const result: SummariesResult = {
    data: combinedData,
    usage: combinedUsage,
    cost: combinedCost,
  };

  // Filter PII from final output
  return success(sanitizeForOutput(result));
}

/**
 * Export main function as default
 */
export default generateTopicSummaries;
