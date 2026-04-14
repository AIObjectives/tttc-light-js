/**
 * Summary generation model using LLM client abstraction
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
import * as weave from "weave";
import type { LLMClient } from "../llm-client.js";
import { basicSanitize } from "../sanitizer";
import {
  ApiCallFailedError,
  EmptyResponseError,
  ParseFailedError,
} from "../types";
import { tokenCost } from "../utils";
import type {
  ClusteringError,
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
  // biome-ignore lint/suspicious/noExplicitAny: SDK version mismatch requires assertion
  const llmJudgeScorer = createLLMJudgeScorer(openaiClient as any);

  const capturedTopicName = topicName;
  const capturedSummary = summary;
  const model = weave.op(async function summaryModel() {
    return { topicName: capturedTopicName, summary: capturedSummary };
  });

  const dataset = new weave.Dataset({
    name: "summaries-production",
    rows: [{ id: topicName, topic: tree[0] }],
  });

  const evaluation = new weave.Evaluation({
    dataset,
    scorers: [
      summariesJsonStructureScorer,
      summaryLengthScorer,
      summaryContentQualityScorer,
      llmJudgeScorer,
    ],
  });

  evaluation
    .evaluate({ model })
    .then((scores: Record<string, unknown>) => {
      summaryLogger.info({ scores }, "Summary evaluation complete");
    })
    .catch((error: unknown) => {
      summaryLogger.error({ error }, "Summary evaluation failed");
    });
}

/**
 * Input parameters for generating a summary for a single topic
 */
export interface CallSummaryModelInput {
  /** LLM client instance (OpenAI or Anthropic) */
  llmClient: LLMClient;
  /** Optional OpenAI client for Weave evaluation (only used when provider is openai) */
  openaiClientForWeave?: OpenAI;
  /** Model name (e.g., "gpt-4o-mini") */
  modelName: string;
  /** System prompt */
  systemPrompt: string;
  /** User prompt template */
  userPrompt: string;
  /** The tree data for a single topic */
  tree: SortedTree;
  /** The topic name */
  topicName: string;
  /** Optional report ID for logging context */
  reportId?: string;
  /** Optional Weave evaluation options */
  options?: {
    enableWeave?: boolean;
    weaveProjectName?: string;
  };
}

/**
 * Call the summary generation model to create a summary for a single topic
 *
 * This function uses the LLM client abstraction to generate a summary for a topic
 * based on its claims and subtopics. The function handles JSON parsing, token
 * usage tracking, and cost calculation. If Weave evaluation is enabled and the
 * provider is OpenAI, it runs quality scorers asynchronously in the background.
 *
 * @param input - Input parameters for summary generation
 * @param input.llmClient - Configured LLM client instance (OpenAI or Anthropic)
 * @param input.openaiClientForWeave - Optional OpenAI client for Weave evaluation
 * @param input.modelName - Name of the model to use (e.g., "gpt-4o-mini")
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
 *   llmClient: client,
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
  input: CallSummaryModelInput,
): Promise<Result<SummaryModelResult, ClusteringError>> {
  const {
    llmClient,
    openaiClientForWeave,
    modelName,
    systemPrompt,
    userPrompt,
    tree,
    topicName,
    reportId,
    options = {},
  } = input;

  const { enableWeave = false } = options;

  const context = {
    topic: topicName,
    reportId,
  };

  // Weave evaluation is only supported with OpenAI
  if (enableWeave && llmClient.provider === "anthropic") {
    summaryLogger.warn(
      { modelName },
      "Weave evaluation is not supported for Anthropic models, skipping",
    );
  }

  summaryLogger.info(context, `Generating summary for topic: ${topicName}`);

  // Build prompt with tree data
  const { sanitizedText: sanitizedPrompt } = basicSanitize(userPrompt);
  let fullPrompt = sanitizedPrompt;
  fullPrompt += `\n${JSON.stringify(tree, null, 2)}`;

  // Sanitize system prompt
  const { sanitizedText: sanitizedSystemPrompt } = basicSanitize(systemPrompt);

  // Call LLM API
  let content: string;
  let usage: TokenUsage;
  try {
    const result = await llmClient.call({
      model: modelName,
      systemPrompt: sanitizedSystemPrompt,
      userPrompt: fullPrompt,
      jsonMode: true,
    });

    if (!result.content) {
      summaryLogger.error({ ...context }, "No response from model");
      return failure(new EmptyResponseError(modelName));
    }

    content = result.content;
    usage = {
      input_tokens: result.usage.input_tokens,
      output_tokens: result.usage.output_tokens,
      total_tokens: result.usage.total_tokens,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    summaryLogger.error({ ...context, error }, "Failed to call summary model");
    return failure(new ApiCallFailedError(modelName, errorMessage));
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

  // If scoring is enabled with OpenAI, run scorers on the result asynchronously
  if (enableWeave && llmClient.provider === "openai" && openaiClientForWeave) {
    runSummaryScorers(openaiClientForWeave, topicName, summary, tree);
  }

  return success(result);
}
