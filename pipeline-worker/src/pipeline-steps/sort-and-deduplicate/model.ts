/**
 * Deduplication model using LLM client abstraction
 */

import { failure, type Result, success } from "tttc-common/functional-utils";
import { logger } from "tttc-common/logger";
import type { LLMClient } from "../llm-client.js";
import {
  ApiCallFailedError,
  EmptyResponseError,
  ParseFailedError,
} from "../types";
import type {
  Claim,
  ClusteringError,
  DeduplicationOutput,
  DeduplicationResponse,
  LLMConfig,
  TokenUsage,
} from "./types";

const dedupLogger = logger.child({ module: "deduplication-model" });

/**
 * Call the deduplication model to identify near-duplicate claims
 *
 * @param llmClient - LLM client instance (OpenAI or Anthropic)
 * @param claims - Array of claims to deduplicate
 * @param llmConfig - LLM configuration with prompts
 * @param topicName - Name of the topic (for logging)
 * @param subtopicName - Name of the subtopic (for logging)
 * @param reportId - Optional report ID for logging context
 * @returns Result containing deduplication response with usage stats, or an error
 */
export async function callDeduplicationModel(
  llmClient: LLMClient,
  claims: Claim[],
  llmConfig: LLMConfig,
  topicName: string,
  subtopicName: string,
  reportId?: string,
): Promise<Result<DeduplicationOutput, ClusteringError>> {
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

  // Call LLM API
  let content: string;
  let usage: TokenUsage;
  try {
    const result = await llmClient.call({
      model: llmConfig.model_name,
      systemPrompt: llmConfig.system_prompt,
      userPrompt: fullPrompt,
      jsonMode: true,
    });

    if (!result.content) {
      dedupLogger.error({ ...context }, "No response from model");
      return failure(new EmptyResponseError(llmConfig.model_name));
    }

    content = result.content;
    usage = {
      input_tokens: result.usage.input_tokens,
      output_tokens: result.usage.output_tokens,
      total_tokens: result.usage.total_tokens,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    dedupLogger.error(
      { ...context, error: errorMessage },
      "Failed to call deduplication model",
    );
    return failure(new ApiCallFailedError(llmConfig.model_name, errorMessage));
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
