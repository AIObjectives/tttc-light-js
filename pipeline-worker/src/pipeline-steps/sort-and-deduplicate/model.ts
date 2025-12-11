/**
 * Deduplication model using OpenAI API
 */

import OpenAI from "openai";
import * as weave from "weave";
import { Result, success, failure } from "tttc-common/functional-utils";
import { logger } from "tttc-common/logger";
import { tokenCost } from "../utils";
import type {
  Claim,
  DeduplicationResponse,
  LLMConfig,
  TokenUsage,
  ClusteringError,
  DeduplicationOutput,
} from "./types";
import {
  ApiCallFailedError,
  EmptyResponseError,
  ParseFailedError,
} from "../types";

const dedupLogger = logger.child({ module: "deduplication-model" });

/**
 * Call the deduplication model to identify near-duplicate claims
 *
 * @param openaiClient - OpenAI client instance
 * @param claims - Array of claims to deduplicate
 * @param llmConfig - LLM configuration with prompts and model name
 * @param topicName - Name of the topic (for logging)
 * @param subtopicName - Name of the subtopic (for logging)
 * @param reportId - Optional report ID for logging context
 * @param options - Optional weave tracking configuration
 * @returns Result containing deduplication response with usage stats, or an error
 */
export async function callDeduplicationModel(
  openaiClient: OpenAI,
  claims: Claim[],
  llmConfig: LLMConfig,
  topicName: string,
  subtopicName: string,
  reportId?: string,
  options: {
    enableWeave?: boolean;
    weaveProjectName?: string;
  } = {},
): Promise<Result<DeduplicationOutput, ClusteringError>> {
  const { enableWeave = false, weaveProjectName = "production-deduplication" } =
    options;

  const context = {
    topic: topicName,
    subtopic: subtopicName,
    numClaims: claims.length,
    reportId,
  };

  dedupLogger.info(
    context,
    `Deduplicating claims for ${topicName}/${subtopicName}`,
  );

  // Build prompt with enumerated claims
  let fullPrompt = llmConfig.user_prompt;
  for (let i = 0; i < claims.length; i++) {
    const claim = claims[i];
    fullPrompt += `\nclaimId${i}:`;
    fullPrompt += `\n  - claim: ${claim.claim}`;
    fullPrompt += `\n  - quote: ${claim.quote || ""}`;
    fullPrompt += `\n  - quoteId: quote${i}`;
  }

  let chatCompletion = openaiClient.chat.completions.create.bind(
    openaiClient.chat.completions,
  );

  // If weave is enabled, initialize and wrap chat completion
  if (enableWeave) {
    try {
      await weave.init(weaveProjectName);
      chatCompletion = weave.op(chatCompletion);
    } catch (error) {
      dedupLogger.error(
        { error, weaveProjectName },
        "Failed to initialize Weave",
      );
    }
  }

  // Call OpenAI API
  let response: OpenAI.Chat.Completions.ChatCompletion;
  try {
    response = await chatCompletion({
      model: llmConfig.model_name,
      messages: [
        { role: "system", content: llmConfig.system_prompt },
        { role: "user", content: fullPrompt },
      ],
      temperature: 0.0,
      response_format: { type: "json_object" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    dedupLogger.error(
      { ...context, error },
      "Failed to call deduplication model",
    );
    return failure(new ApiCallFailedError(llmConfig.model_name, errorMessage));
  }

  // Extract usage information
  const usage: TokenUsage = {
    input_tokens: response.usage?.prompt_tokens || 0,
    output_tokens: response.usage?.completion_tokens || 0,
    total_tokens: response.usage?.total_tokens || 0,
  };

  // Extract content
  const content = response.choices[0]?.message?.content;
  if (!content) {
    dedupLogger.error({ ...context, response }, "No response from model");
    return failure(new EmptyResponseError(llmConfig.model_name));
  }

  // Parse JSON response
  let dedupClaims: DeduplicationResponse;
  try {
    const parsed = JSON.parse(content);
    dedupClaims = {
      groupedClaims: parsed.groupedClaims || [],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    dedupLogger.error(
      { ...context, error, content: content.substring(0, 500) },
      "Failed to parse deduplication response",
    );
    return failure(new ParseFailedError(content, errorMessage));
  }

  dedupLogger.info(
    {
      ...context,
      numGroups: dedupClaims.groupedClaims.length,
      tokens: usage.total_tokens,
    },
    "Deduplication complete",
  );

  return success({
    dedupClaims,
    usage,
  });
}
