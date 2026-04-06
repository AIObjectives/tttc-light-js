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

import { type ClusteringError, ParseFailedError } from "../types";
import { tokenCost } from "../utils";

const clusteringLogger = logger.child({ module: "clustering-model" });

/**
 * Call the clustering model with usage tracking and optional evaluation
 *
 * @param llmClient - LLM client instance
 * @param systemPrompt - System prompt
 * @param userPrompt - User prompt (should contain comments)
 * @param commentsText - Raw comments text for evaluation
 * @param options - Optional evaluation options
 * @returns Clustering output with taxonomy, usage stats, and cost
 */
export async function callClusteringModel(
  llmClient: LLMClient,
  systemPrompt: string,
  userPrompt: string,
  commentsText: string,
  options: {
    enableWeave?: boolean;
    openaiClientForWeave?: OpenAI;
  } = {},
): Promise<Result<ClusteringOutput, ClusteringError>> {
  const { enableWeave = false } = options;

  const llmResult = await llmClient.complete({ systemPrompt, userPrompt });
  if (llmResult.tag === "failure") {
    clusteringLogger.error(
      { error: llmResult.error, modelName: llmClient.modelName },
      "Failed to call clustering model",
    );
    return llmResult;
  }

  const { content, usage } = llmResult.value;

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
    llmClient.modelName,
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

  // If Weave is enabled, run a Weave Evaluation (shows in the evaluations tab)
  if (enableWeave && options.openaiClientForWeave) {
    const llmJudgeScorer = createLLMJudgeScorer(
      // biome-ignore lint/suspicious/noExplicitAny: SDK version mismatch requires assertion (T3C-853)
      options.openaiClientForWeave as any,
    );

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
