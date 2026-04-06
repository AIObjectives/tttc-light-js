/**
 * Summary generation model using LLMClient
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
import { basicSanitize } from "../sanitizer";
import { ParseFailedError } from "../types";
import { tokenCost } from "../utils";
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
  // biome-ignore lint/suspicious/noExplicitAny: SDK version mismatch requires assertion (T3C-853)
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
 * Call the summary generation model to create a summary for a single topic
 *
 * @param input - Input parameters for summary generation
 * @returns Result containing summary text with usage stats and cost, or an error
 */
export async function callSummaryModel(
  input: GenerateSummaryInput,
): Promise<Result<SummaryModelResult, ClusteringError>> {
  const {
    llmClient,
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

  summaryLogger.info(context, `Generating summary for topic: ${topicName}`);

  // Build prompt with tree data
  const { sanitizedText: sanitizedPrompt } = basicSanitize(userPrompt);
  let fullPrompt = sanitizedPrompt;
  fullPrompt += `\n${JSON.stringify(tree, null, 2)}`;

  // Sanitize system prompt
  const { sanitizedText: sanitizedSystemPrompt } = basicSanitize(systemPrompt);

  const llmResult = await llmClient.complete({
    systemPrompt: sanitizedSystemPrompt,
    userPrompt: fullPrompt,
  });
  if (llmResult.tag === "failure") {
    summaryLogger.error(
      { ...context, error: llmResult.error },
      "Failed to call summary model",
    );
    return llmResult;
  }

  const { content, usage: rawUsage } = llmResult.value;

  const usage: TokenUsage = {
    input_tokens: rawUsage.input_tokens,
    output_tokens: rawUsage.output_tokens,
    total_tokens: rawUsage.total_tokens,
  };

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
    llmClient.modelName,
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

  if (enableWeave && options.openaiClientForWeave) {
    runSummaryScorers(options.openaiClientForWeave, topicName, summary, tree);
  }

  return success(result);
}
