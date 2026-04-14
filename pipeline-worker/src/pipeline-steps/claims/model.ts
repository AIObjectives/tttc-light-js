/**
 * Claims extraction model using LLM client abstraction
 */

import type OpenAI from "openai";
import {
  claimQualityScorer,
  createLLMJudgeScorer,
  extractionJsonStructureScorer,
  quoteRelevanceScorer,
  taxonomyAlignmentScorer,
} from "tttc-common/evaluations/extraction/scorers";
import { failure, type Result, success } from "tttc-common/functional-utils";
import { logger } from "tttc-common/logger";
import * as weave from "weave";
import type { LLMClient } from "../llm-client.js";
import { escapeQuotes } from "../sanitizer";
import {
  ApiCallFailedError,
  type ClaimsModelResult,
  type ClusteringError,
  EmptyResponseError,
  ParseFailedError,
  type TokenUsage,
} from "../types";
import { tokenCost } from "../utils";
import type { Claim, Topic } from "./types";
import { extractSubtopicNames, extractTopicNames } from "./utils";

const claimsLogger = logger.child({ module: "claims-model" });

/**
 * Validate taxonomy has required structure
 */
function validateTaxonomy(
  taxonomy: Topic[],
): Result<
  { validTopicNames: string[]; validSubtopicNames: string[] },
  ClusteringError
> {
  const validTopicNames = extractTopicNames(taxonomy);
  const validSubtopicNames = extractSubtopicNames(taxonomy);

  if (validTopicNames.length === 0 || validSubtopicNames.length === 0) {
    return failure(
      new ParseFailedError(
        "taxonomy",
        "Taxonomy must contain at least one topic and subtopic",
      ),
    );
  }

  return success({ validTopicNames, validSubtopicNames });
}

/**
 * Call LLM API to extract claims
 */
async function callLLMForClaims(
  llmClient: LLMClient,
  modelName: string,
  systemPrompt: string,
  userPrompt: string,
  commentText: string,
  taxonomy: Topic[],
): Promise<Result<{ content: string; usage: TokenUsage }, ClusteringError>> {
  // Build taxonomy constraints for the prompt
  const taxonomyPrompt = buildTaxonomyPromptSection(taxonomy);

  // Construct the full prompts
  const fullSystemPrompt = `${systemPrompt}\n\n${taxonomyPrompt}`;
  const fullUserPrompt = `${userPrompt}\n\nComment:\n${commentText}`;

  try {
    const result = await llmClient.call({
      model: modelName,
      systemPrompt: fullSystemPrompt,
      userPrompt: fullUserPrompt,
      jsonMode: true,
    });

    const usage: TokenUsage = {
      input_tokens: result.usage.input_tokens,
      output_tokens: result.usage.output_tokens,
      total_tokens: result.usage.total_tokens,
    };

    if (!result.content) {
      claimsLogger.error(
        { modelName },
        "No response from claims extraction model",
      );
      return failure(new EmptyResponseError(modelName));
    }

    return success({ content: result.content, usage });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    claimsLogger.error({ error, modelName }, "Failed to call LLM API");
    return failure(new ApiCallFailedError(modelName, errorMessage));
  }
}

/**
 * Parameters for parsing and validating claims
 */
interface ParseClaimsParams {
  content: string;
  taxonomy: Topic[];
  speaker: string;
  commentId: string;
}

/**
 * Parse and validate claims from API response
 */
function parseAndValidateClaims(
  params: ParseClaimsParams,
): Result<Claim[], ClusteringError> {
  const { content, taxonomy, speaker, commentId } = params;
  let parsed: {
    claims: Array<{
      claim: string;
      quote: string;
      topicName: string;
      subtopicName: string;
    }>;
  };
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    claimsLogger.error({ error, content }, "Failed to parse claims response");
    return failure(new ParseFailedError(content, errorMessage));
  }

  const claims: Claim[] = [];
  for (const rawClaim of parsed.claims || []) {
    const topic = taxonomy.find((t) => t.topicName === rawClaim.topicName);
    if (!topic) {
      claimsLogger.error(
        {
          topicName: rawClaim.topicName,
          validTopics: taxonomy.map((t) => t.topicName),
        },
        "Claim has invalid topic name, skipping",
      );
      continue;
    }

    const validSubtopicsForTopic =
      topic.subtopics?.map((s) => s.subtopicName) || [];
    if (!validSubtopicsForTopic.includes(rawClaim.subtopicName)) {
      claimsLogger.error(
        {
          topicName: rawClaim.topicName,
          subtopicName: rawClaim.subtopicName,
          validSubtopicsForTopic,
        },
        "Claim has invalid subtopic name for this topic, skipping",
      );
      continue;
    }

    claims.push({
      claim: rawClaim.claim,
      quote: rawClaim.quote,
      topicName: rawClaim.topicName,
      subtopicName: rawClaim.subtopicName,
      speaker,
      commentId,
    });
  }

  return success(claims);
}

/**
 * Format a topic line with optional description
 */
function formatTopicLine(topicName: string, description: string): string {
  const name = escapeQuotes(topicName);
  const desc = escapeQuotes(description);
  return desc ? `Topic: "${name}" - ${desc}` : `Topic: "${name}"`;
}

/**
 * Format a subtopic line with optional description
 */
function formatSubtopicLine(subtopicName: string, description: string): string {
  const name = escapeQuotes(subtopicName);
  const desc = escapeQuotes(description);
  return desc ? `  - Subtopic: "${name}" - ${desc}` : `  - Subtopic: "${name}"`;
}

/**
 * Build the taxonomy prompt section
 */
function buildTaxonomyPromptSection(taxonomy: Topic[]): string {
  const lines = ["VALID TAXONOMY - YOU MUST USE THESE EXACT NAMES:", ""];

  for (const topic of taxonomy) {
    lines.push(
      formatTopicLine(topic.topicName, topic.topicShortDescription || ""),
    );

    const subtopics = topic.subtopics || [];
    for (const subtopic of subtopics) {
      lines.push(
        formatSubtopicLine(
          subtopic.subtopicName,
          subtopic.subtopicShortDescription || "",
        ),
      );
    }
    lines.push("");
  }

  lines.push(
    "YOU MUST ONLY USE THE EXACT TOPIC AND SUBTOPIC NAMES LISTED ABOVE.",
  );
  lines.push("Do not create new names or variations.");

  return lines.join("\n");
}

/**
 * Input parameters for extracting claims from a single comment using the LLM client abstraction
 */
export interface ExtractClaimsFromCommentInput {
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
  /** The comment text to extract claims from */
  commentText: string;
  /** Array of topics with subtopics */
  taxonomy: Topic[];
  /** The speaker who made the comment */
  speaker: string;
  /** The ID of the comment */
  commentId: string;
  /** Optional evaluation options */
  options?: {
    enableWeave?: boolean;
    weaveProjectName?: string;
  };
}

/**
 * Extract claims from a single comment using the LLM client abstraction
 *
 * @param input - Object containing all required parameters
 * @returns Result containing claims with usage stats and cost, or an error
 */
export async function extractClaimsFromComment(
  input: ExtractClaimsFromCommentInput,
): Promise<Result<ClaimsModelResult, ClusteringError>> {
  const {
    llmClient,
    openaiClientForWeave,
    modelName,
    systemPrompt,
    userPrompt,
    commentText,
    taxonomy,
    speaker,
    commentId,
    options = {},
  } = input;

  const { enableWeave = false, weaveProjectName = "production-extraction" } =
    options;

  // Weave evaluation is only supported with OpenAI
  if (enableWeave && llmClient.provider === "anthropic") {
    claimsLogger.warn(
      { modelName },
      "Weave evaluation is not supported for Anthropic models, skipping",
    );
  }

  // Validate taxonomy structure
  const taxonomyValidation = validateTaxonomy(taxonomy);
  if (taxonomyValidation.tag === "failure") {
    return taxonomyValidation;
  }

  // Call LLM API to extract claims
  const apiResult = await callLLMForClaims(
    llmClient,
    modelName,
    systemPrompt,
    userPrompt,
    commentText,
    taxonomy,
  );
  if (apiResult.tag === "failure") {
    return apiResult;
  }

  const { content, usage } = apiResult.value;

  // Parse and validate claims
  const claimsResult = parseAndValidateClaims({
    content,
    taxonomy,
    speaker,
    commentId,
  });
  if (claimsResult.tag === "failure") {
    return claimsResult;
  }
  const claims = claimsResult.value;

  const costResult = tokenCost(
    modelName,
    usage.input_tokens,
    usage.output_tokens,
  );
  if (costResult.tag === "failure") {
    return costResult;
  }

  const result: ClaimsModelResult = {
    claims,
    usage: {
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      total_tokens: usage.total_tokens,
    },
    cost: costResult.value,
  };

  // If scoring is enabled with OpenAI, run scorers on the result asynchronously
  if (enableWeave && llmClient.provider === "openai" && openaiClientForWeave) {
    runClaimsEvaluation(openaiClientForWeave, claims, commentText, taxonomy);
  }

  return success(result);
}

/**
 * Run evaluation scorers on extracted claims asynchronously
 * Scores are sent to Weave for tracking
 */
function runClaimsEvaluation(
  openaiClient: OpenAI,
  claims: Claim[],
  commentText: string,
  taxonomy: Topic[],
): void {
  // TODO: Remove cast after fixing OpenAI SDK version mismatch (T3C-853)
  // biome-ignore lint/suspicious/noExplicitAny: SDK version mismatch requires assertion
  const llmJudgeScorer = createLLMJudgeScorer(openaiClient as any);

  const capturedClaims = claims.map((c) => ({
    claim: c.claim,
    quote: c.quote,
    topicName: c.topicName,
    subtopicName: c.subtopicName,
  }));

  const model = weave.op(async function claimsModel() {
    return { claims: capturedClaims };
  });

  const dataset = new weave.Dataset({
    name: "extraction-production",
    rows: [
      {
        comment: commentText,
        taxonomy: taxonomy.map((t) => ({
          topicName: t.topicName,
          subtopics: t.subtopics.map((s) => ({ subtopicName: s.subtopicName })),
        })),
      },
    ],
  });

  const evaluation = new weave.Evaluation({
    dataset,
    scorers: [
      extractionJsonStructureScorer,
      claimQualityScorer,
      taxonomyAlignmentScorer,
      quoteRelevanceScorer,
      llmJudgeScorer,
    ],
  });

  evaluation
    .evaluate({ model })
    .then((scores: Record<string, unknown>) => {
      claimsLogger.info({ scores }, "Claims extraction evaluation complete");
    })
    .catch((error: unknown) => {
      claimsLogger.error({ error }, "Claims evaluation failed");
    });
}
