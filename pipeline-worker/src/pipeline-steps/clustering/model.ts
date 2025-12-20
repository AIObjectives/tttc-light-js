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
import type { ClusteringOutput, Topic } from "../types";
import {
  ApiCallFailedError,
  type ClusteringError,
  EmptyResponseError,
  ParseFailedError,
} from "../types";
import { initializeWeaveIfEnabled, tokenCost } from "../utils";

const clusteringLogger = logger.child({ module: "clustering-model" });

/**
 * Call the clustering model with usage tracking and optional evaluation
 *
 * @param openaiClient - OpenAI client instance
 * @param modelName - Model name (e.g., "gpt-4o-mini")
 * @param systemPrompt - System prompt
 * @param userPrompt - User prompt (should contain comments)
 * @param commentsText - Raw comments text for evaluation
 * @param options - Optional evaluation options
 * @returns Clustering output with taxonomy, usage stats, and cost
 */
export async function callClusteringModel(
  openaiClient: OpenAI,
  modelName: string,
  systemPrompt: string,
  userPrompt: string,
  commentsText: string,
  options: {
    enableScoring?: boolean;
    weaveProjectName?: string;
  } = {},
): Promise<Result<ClusteringOutput, ClusteringError>> {
  const { enableScoring = false, weaveProjectName = "production-clustering" } =
    options;

  // If scoring is enabled, initialize Weave and wrap responses create in a WeaveOp
  const responsesCreate = await initializeWeaveIfEnabled(
    openaiClient,
    enableScoring,
    weaveProjectName,
  );

  // Call OpenAI API directly to capture usage information
  let response: Awaited<ReturnType<typeof responsesCreate>> | undefined;
  try {
    response = await responsesCreate({
      model: modelName,
      instructions: systemPrompt,
      input: userPrompt,
      text: {
        format: {
          type: "json_object",
        },
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    clusteringLogger.error({ error, modelName }, "Failed to call OpenAI API");
    return failure(new ApiCallFailedError(modelName, errorMessage));
  }

  // Extract usage information
  const usage = response.usage || {
    input_tokens: 0,
    output_tokens: 0,
    total_tokens: 0,
  };

  const content = response.output_text;
  if (!content) {
    clusteringLogger.error({ response }, "No response from clustering model");
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

  // Calculate cost using the utility function
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

  // If scoring is enabled, run scorers on the result asynchronously
  if (enableScoring) {
    // Cast to any to handle OpenAI version mismatch between pipeline-worker (v6) and common (v4)
    const llmJudgeScorer = createLLMJudgeScorer(openaiClient as any);

    // Run scorers on the result we already have (non-blocking)
    // Note: The LLM judge scorer will make its own LLM call for evaluation
    // Scores are automatically sent to Weave since scorers are wrapped with weave.op
    Promise.all([
      jsonStructureScorer({
        modelOutput: { taxonomy },
        datasetRow: { comments: commentsText },
      }),
      topicCoverageScorer({
        modelOutput: { taxonomy },
        datasetRow: { comments: commentsText },
      }),
      llmJudgeScorer({
        modelOutput: { taxonomy },
        datasetRow: { comments: commentsText },
      }),
    ])
      .then((scores) => {
        clusteringLogger.info(
          {
            jsonStructure: scores[0],
            topicCoverage: scores[1],
            llmJudge: scores[2],
          },
          "Clustering evaluation complete",
        );
      })
      .catch((error) => {
        clusteringLogger.error({ error }, "Background scoring failed");
      });
  }

  return success(result);
}
