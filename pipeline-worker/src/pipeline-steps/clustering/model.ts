/**
 * Clustering model using evaluation logic from common/evaluations
 */

import OpenAI from "openai";
import * as weave from "weave";
import {
  jsonStructureScorer,
  topicCoverageScorer,
  createLLMJudgeScorer,
} from "tttc-common/evaluations/clustering/scorers";
import { Result, success, failure } from "tttc-common/functional-utils";
import { tokenCost } from "./utils.js";
import type { ClusteringInput, ClusteringOutput } from "../types.js";
import {
  ApiCallFailedError,
  EmptyResponseError,
  ParseFailedError,
} from "../types.js";
import type { Topic } from "../types.js";
import { logger } from "tttc-common/logger";

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
): Promise<Result<ClusteringOutput, Error>> {
  const { enableScoring = false, weaveProjectName = "production-clustering" } =
    options;

  let chatCompletion = openaiClient.responses.create;

  // If scoring is enabled, initialize Weave and wrap chat completion in a WeaveOp
  if (enableScoring) {
    try {
      await weave.init(weaveProjectName);
      chatCompletion = weave.op(chatCompletion);
    } catch (error) {
      clusteringLogger.error(
        { error, weaveProjectName },
        "Failed to initialize Weave",
      );
    }
  }

  // Call OpenAI API directly to capture usage information
  let response;
  try {
    response = await chatCompletion({
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
  const cost = tokenCost(modelName, usage.input_tokens, usage.output_tokens);

  const result: ClusteringOutput = {
    taxonomy,
    usage: {
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      total_tokens: usage.total_tokens,
    },
    cost: cost >= 0 ? cost : 0, // Return 0 if model is unknown
  };

  // If scoring is enabled, run scorers on the result asynchronously
  if (enableScoring) {
    const llmJudgeScorer = createLLMJudgeScorer(openaiClient);

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

  return result;
}
