/**
 * Clustering model using evaluation logic from common/evaluations
 */

import type OpenAI from "openai";
import {
  createLLMJudgeScorer,
  jsonStructureScorer,
  topicCoverageScorer,
} from "tttc-common/evaluations/clustering/scorers";
import { failure, type Result, success } from "tttc-common/functional-utils";
import { logger } from "tttc-common/logger";
import * as weave from "weave";
import type { LLMClient } from "../llm-client.js";
import type { ClusteringOutput, Topic } from "../types";

import {
  ApiCallFailedError,
  type ClusteringError,
  EmptyResponseError,
  ParseFailedError,
} from "../types";
import { tokenCost } from "../utils";

const clusteringLogger = logger.child({ module: "clustering-model" });

/**
 * Call the clustering model with usage tracking and optional evaluation
 *
 * @param llmClient - LLM client instance (OpenAI or Anthropic)
 * @param modelName - Model name (e.g., "gpt-4o-mini")
 * @param systemPrompt - System prompt
 * @param userPrompt - User prompt (should contain comments)
 * @param commentsText - Raw comments text for evaluation
 * @param openaiClientForWeave - Optional OpenAI client for Weave evaluation (OpenAI only)
 * @param options - Optional evaluation options
 * @returns Clustering output with taxonomy, usage stats, and cost
 */
export async function callClusteringModel(
  llmClient: LLMClient,
  modelName: string,
  systemPrompt: string,
  userPrompt: string,
  commentsText: string,
  openaiClientForWeave: OpenAI | undefined,
  options: {
    enableWeave?: boolean;
  } = {},
): Promise<Result<ClusteringOutput, ClusteringError>> {
  const { enableWeave = false } = options;

  // Weave is only supported with OpenAI clients
  if (enableWeave && llmClient.provider === "anthropic") {
    clusteringLogger.warn(
      { modelName },
      "Weave evaluation is not supported for Anthropic models, skipping",
    );
  }

  // Call LLM API to capture usage information
  let content: string;
  let usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };

  try {
    const result = await llmClient.call({
      model: modelName,
      systemPrompt,
      userPrompt,
      jsonMode: true,
    });
    content = result.content;
    usage = result.usage;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    clusteringLogger.error({ error, modelName }, "Failed to call LLM API");
    return failure(new ApiCallFailedError(modelName, errorMessage));
  }

  if (!content) {
    clusteringLogger.error({ modelName }, "No response from clustering model");
    return failure(new EmptyResponseError(modelName));
  }

  let taxonomy: Topic[];
  try {
    const parsed = JSON.parse(content);
    taxonomy = parsed.taxonomy || [];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    clusteringLogger.error(
      { error, content },
      "Failed to parse clustering response",
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

  const result: ClusteringOutput = {
    taxonomy,
    usage: {
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      total_tokens: usage.total_tokens,
    },
    cost: costResult.value,
  };

  // If Weave is enabled with OpenAI, run a Weave Evaluation (shows in the evaluations tab)
  if (enableWeave && openaiClientForWeave) {
    // Cast to any to handle OpenAI version mismatch between pipeline-worker (v6) and common (v4)
    // biome-ignore lint/suspicious/noExplicitAny: SDK version mismatch requires assertion
    const llmJudgeScorer = createLLMJudgeScorer(openaiClientForWeave as any);

    const capturedTaxonomy = taxonomy;
    const model = weave.op(async function clusteringModel() {
      return { taxonomy: capturedTaxonomy };
    });

    const dataset = new weave.Dataset({
      name: "clustering-production",
      rows: [{ comments: commentsText }],
    });

    const evaluation = new weave.Evaluation({
      dataset,
      scorers: [jsonStructureScorer, topicCoverageScorer, llmJudgeScorer],
    });

    evaluation
      .evaluate({ model })
      .then((scores: Record<string, unknown>) => {
        clusteringLogger.info({ scores }, "Clustering evaluation complete");
      })
      .catch((error: unknown) => {
        clusteringLogger.error({ error }, "Clustering evaluation failed");
      });
  }

  return success(result);
}
