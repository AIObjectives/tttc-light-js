/**
 * Clustering model using evaluation logic from common/evaluations
 */

import OpenAI from "openai";
import * as weave from "weave";
import {
  jsonStructureScorer,
  topicCoverageScorer,
  createLLMJudgeScorer,
} from "common/evaluations/clustering/scorers";
import { tokenCost } from "./utils.js";
import type { ClusteringInput, ClusteringOutput } from "../types.js";
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
): Promise<ClusteringOutput> {
  const { enableScoring = false, weaveProjectName = "production-clustering" } =
    options;

  // Wrap OpenAI client with Weave for observability if scoring is enabled
  const client = enableScoring ? weave.wrapOpenAI(openaiClient) : openaiClient;

  // If scoring is enabled, initialize Weave
  if (enableScoring) {
    // Initialize Weave asynchronously so it doesn't block
    weave.init(weaveProjectName).catch((error) => {
      clusteringLogger.error(
        { error, weaveProjectName },
        "Failed to initialize Weave",
      );
    });
  }

  // Call OpenAI API directly to capture usage information
  const response = await client.chat.completions.create({
    model: modelName,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("No response from clustering model");
  }

  let taxonomy: Topic[];
  try {
    const parsed = JSON.parse(content);
    taxonomy = parsed.taxonomy || [];
  } catch (error) {
    throw new Error(`Failed to parse clustering response: ${error}`);
  }

  // Extract usage information
  const usage = response.usage || {
    prompt_tokens: 0,
    completion_tokens: 0,
    total_tokens: 0,
  };

  // Calculate cost using the utility function
  const cost = tokenCost(
    modelName,
    usage.prompt_tokens,
    usage.completion_tokens,
  );

  const result: ClusteringOutput = {
    taxonomy,
    usage: {
      prompt_tokens: usage.prompt_tokens,
      completion_tokens: usage.completion_tokens,
      total_tokens: usage.total_tokens,
    },
    cost: cost >= 0 ? cost : 0, // Return 0 if model is unknown
  };

  // If scoring is enabled, run scorers on the result asynchronously
  if (enableScoring) {
    const llmJudgeScorer = createLLMJudgeScorer(client);

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
