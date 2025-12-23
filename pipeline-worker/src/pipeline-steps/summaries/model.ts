/**
 * Summary generation model using OpenAI API
 */

import type OpenAI from "openai";
import {
  createLLMJudgeScorer,
  summariesJsonStructureScorer,
  summaryContentQualityScorer,
  summaryLengthScorer,
} from "tttc-common/evaluations/summaries/scorers";
import { failure, type Result, success } from "tttc-common/functional-utils";
import { logger } from "tttc-common/logger";
import { basicSanitize } from "../sanitizer";
import {
  ApiCallFailedError,
  EmptyResponseError,
  ParseFailedError,
} from "../types";
import { initializeWeaveIfEnabled, tokenCost } from "../utils";
import type {
  ClusteringError,
  GenerateSummaryInput,
  SortedTree,
  SummaryModelResult,
  TokenUsage,
} from "./types";

const summaryLogger = logger.child({ module: "summary-model" });

/**
 * Run Weave scorers on a generated summary (non-blocking)
 *
 * @param openaiClient - OpenAI client for LLM judge scorer
 * @param topicName - Name of the topic
 * @param summary - Generated summary text
 * @param tree - The tree data used to generate the summary
 */
function runSummaryScorers(
  openaiClient: OpenAI,
  topicName: string,
  summary: string,
  tree: SortedTree,
): void {
  // Type assertion needed temporarily until T3C-853 is completed
  // (https://linear.app/ai-objectives/issue/T3C-853/update-openai-sdk-version-in-eval-suite)
  // The eval suite uses OpenAI v4 while pipeline-worker uses v6
  const llmJudgeScorer = createLLMJudgeScorer(openaiClient as any);

  // Run scorers on the result we already have (non-blocking)
  // Note: The LLM judge scorer will make its own LLM call for evaluation
  // Scores are automatically sent to Weave since scorers are wrapped with weave.op
  Promise.all([
    summariesJsonStructureScorer({
      modelOutput: { topicName, summary },
      datasetRow: { id: topicName, topic: tree[0] },
    }),
    summaryLengthScorer({
      modelOutput: { topicName, summary },
      datasetRow: { id: topicName, topic: tree[0] },
    }),
    summaryContentQualityScorer({
      modelOutput: { topicName, summary },
      datasetRow: { id: topicName, topic: tree[0] },
    }),
    llmJudgeScorer({
      modelOutput: { topicName, summary },
      datasetRow: { id: topicName, topic: tree[0] },
    }),
  ])
    .then((scores) => {
      summaryLogger.info(
        {
          jsonStructure: scores[0],
          lengthScore: scores[1],
          contentQuality: scores[2],
          llmJudge: scores[3],
        },
        "Summary evaluation complete",
      );
    })
    .catch((error) => {
      summaryLogger.error({ error }, "Background scoring failed");
    });
}

/**
 * Call the summary generation model to create a summary for a single topic
 *
 * This function uses OpenAI's Responses API to generate a summary for a topic
 * based on its claims and subtopics. The function handles JSON parsing, token
 * usage tracking, and cost calculation. If Weave evaluation is enabled, it runs
 * quality scorers asynchronously in the background.
 *
 * @param input - Input parameters for summary generation
 * @param input.openaiClient - Configured OpenAI client instance
 * @param input.modelName - Name of the OpenAI model to use (e.g., "gpt-4o-mini")
 * @param input.systemPrompt - System-level instructions for the LLM
 * @param input.userPrompt - User-level prompt template
 * @param input.tree - Tree data containing topic and claims to summarize
 * @param input.topicName - Name of the topic being summarized
 * @param input.reportId - Optional report identifier for logging
 * @param input.options - Optional configuration for Weave evaluation
 * @param input.options.enableWeave - Whether to enable Weave scoring
 * @param input.options.weaveProjectName - Weave project name for tracking
 * @returns Result containing summary text with usage stats and cost, or an error
 *
 * @example
 * const result = await callSummaryModel({
 *   openaiClient: client,
 *   modelName: "gpt-4o-mini",
 *   systemPrompt: "Generate a concise summary...",
 *   userPrompt: "Summarize the following topic:",
 *   tree: topicTree,
 *   topicName: "Climate Change",
 *   reportId: "report-123",
 *   options: { enableWeave: true }
 * });
 *
 * if (result.tag === "success") {
 *   console.log(result.value.summary);
 *   console.log(`Cost: $${result.value.cost.toFixed(4)}`);
 * }
 */
export async function callSummaryModel(
  input: GenerateSummaryInput,
): Promise<Result<SummaryModelResult, ClusteringError>> {
  const {
    openaiClient,
    modelName,
    systemPrompt,
    userPrompt,
    tree,
    topicName,
    reportId,
    options = {},
  } = input;

  const { enableWeave = false, weaveProjectName = "production-summaries" } =
    options;

  const context = {
    topic: topicName,
    reportId,
  };

  summaryLogger.info(context, `Generating summary for topic: ${topicName}`);

  // Build prompt with tree data
  const { sanitizedText: sanitizedPrompt } = basicSanitize(userPrompt);
  let fullPrompt = sanitizedPrompt;
  fullPrompt += `\n${JSON.stringify(tree, null, 2)}`;

  // Sanitize system prompt
  const { sanitizedText: sanitizedSystemPrompt } = basicSanitize(systemPrompt);

  // Initialize Weave for scoring if enabled
  const responsesCreate = await initializeWeaveIfEnabled(
    openaiClient,
    enableWeave,
    weaveProjectName,
  );

  // Call OpenAI Responses API
  let response: Awaited<ReturnType<typeof responsesCreate>>;
  try {
    response = await responsesCreate({
      model: modelName,
      instructions: sanitizedSystemPrompt,
      input: fullPrompt,
      text: {
        format: {
          type: "json_object",
        },
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    summaryLogger.error({ ...context, error }, "Failed to call summary model");
    return failure(new ApiCallFailedError(modelName, errorMessage));
  }

  // Extract usage information
  const usage: TokenUsage = {
    input_tokens: response.usage?.input_tokens || 0,
    output_tokens: response.usage?.output_tokens || 0,
    total_tokens: response.usage?.total_tokens || 0,
  };

  // Extract content
  const content = response.output_text;
  if (!content) {
    summaryLogger.error({ ...context, response }, "No response from model");
    return failure(new EmptyResponseError(modelName));
  }

  // Parse JSON response
  let summary: string;
  try {
    const parsed = JSON.parse(content);
    if (!parsed.summary || typeof parsed.summary !== "string") {
      summaryLogger.error(
        { ...context, parsed },
        "Response missing 'summary' field or not a string",
      );
      return failure(
        new ParseFailedError(
          content,
          "Response missing 'summary' field or not a string",
        ),
      );
    }
    summary = parsed.summary.trim();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    summaryLogger.error(
      { ...context, error, content: content.substring(0, 500) },
      "Failed to parse summary response",
    );
    return failure(new ParseFailedError(content, errorMessage));
  }

  // Calculate cost
  const costResult = tokenCost(
    modelName,
    usage.input_tokens,
    usage.output_tokens,
  );
  if (costResult.tag === "failure") {
    return costResult;
  }

  summaryLogger.info(
    {
      ...context,
      tokens: usage.total_tokens,
      cost: costResult.value,
    },
    "Summary generation complete",
  );

  const result: SummaryModelResult = {
    summary,
    usage,
    cost: costResult.value,
  };

  // If scoring is enabled, run scorers on the result asynchronously
  if (enableWeave) {
    runSummaryScorers(openaiClient, topicName, summary, tree);
  }

  return success(result);
}
