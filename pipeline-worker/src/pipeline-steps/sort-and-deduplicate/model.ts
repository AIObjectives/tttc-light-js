/**
 * Deduplication model using OpenAI API
 */

import type OpenAI from "openai";
import { APIError, BadRequestError, RateLimitError } from "openai";
import { failure, type Result, success } from "tttc-common/functional-utils";
import { logger } from "tttc-common/logger";
import {
  ApiCallFailedError,
  EmptyResponseError,
  ParseFailedError,
} from "../types";
import { initializeWeaveIfEnabled } from "../utils";
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
 * Determine the error type from an API error
 *
 * @param error - The error object from the API call
 * @returns String describing the error type
 */
function getErrorType(error: unknown): string {
  if (error instanceof RateLimitError) {
    return "rate_limit";
  }

  if (error instanceof BadRequestError) {
    return "invalid_request";
  }

  const errorMessage = error instanceof Error ? error.message : String(error);
  if (
    errorMessage.toLowerCase().includes("quota") ||
    errorMessage.toLowerCase().includes("insufficient_quota")
  ) {
    return "quota_exceeded";
  }

  return "unknown";
}

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

  // Initialize Weave for scoring if enabled
  const responsesCreate = await initializeWeaveIfEnabled(
    openaiClient,
    enableWeave,
    weaveProjectName,
  );

  // Call OpenAI Responses API
  // biome-ignore lint/suspicious/noImplicitAnyLet: responsesCreate return type is complex and inferred from Weave wrapper
  let response;
  try {
    response = await responsesCreate({
      model: llmConfig.model_name,
      instructions: llmConfig.system_prompt,
      input: fullPrompt,
      text: {
        format: {
          type: "json_object",
        },
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorType = getErrorType(error);

    dedupLogger.error(
      {
        ...context,
        error,
        errorType,
        statusCode: error instanceof APIError ? error.status : undefined,
      },
      `Failed to call deduplication model: ${errorType}`,
    );

    return failure(new ApiCallFailedError(llmConfig.model_name, errorMessage));
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
