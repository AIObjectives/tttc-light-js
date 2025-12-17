/**
 * Claims extraction model using OpenAI Responses API
 */

import OpenAI from "openai";
import * as weave from "weave";
import {
  extractionJsonStructureScorer,
  claimQualityScorer,
  taxonomyAlignmentScorer,
  quoteRelevanceScorer,
  createLLMJudgeScorer,
} from "tttc-common/evaluations/extraction/scorers";
import { Result, success, failure } from "tttc-common/functional-utils";
import { logger } from "tttc-common/logger";
import { tokenCost, initializeWeaveIfEnabled } from "../utils";
import { escapeQuotes } from "../sanitizer";
import { extractTopicNames, extractSubtopicNames } from "./utils";
import type { Claim, ClaimsOutput, Topic, TokenUsage } from "./types";
import {
  ClusteringError,
  ApiCallFailedError,
  EmptyResponseError,
  ParseFailedError,
  ClaimsModelResult,
  ExtractClaimsInput,
} from "../types";

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
 * Call OpenAI API to extract claims
 */
async function callOpenAIForClaims(
  responsesCreate: OpenAI["responses"]["create"],
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

  // Call OpenAI Responses API with JSON output
  let response;
  try {
    response = await responsesCreate({
      model: modelName,
      instructions: fullSystemPrompt,
      input: fullUserPrompt,
      text: {
        format: {
          type: "json_object",
        },
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    claimsLogger.error({ error, modelName }, "Failed to call OpenAI API");
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
    claimsLogger.error(
      { response },
      "No response from claims extraction model",
    );
    return failure(new EmptyResponseError(modelName));
  }

  return success({ content, usage });
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
  // Parse the JSON response
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

  // Validate and transform the claims
  const claims: Claim[] = [];
  for (const rawClaim of parsed.claims || []) {
    // Find the topic in the taxonomy
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

    // Validate that the subtopic belongs to this specific topic
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
 * Extract claims from a single comment using OpenAI Responses API
 *
 * @param input - Object containing all required parameters
 * @returns Result containing claims with usage stats and cost, or an error
 */
export async function extractClaimsFromComment(
  input: ExtractClaimsInput,
): Promise<Result<ClaimsModelResult, ClusteringError>> {
  const {
    openaiClient,
    modelName,
    systemPrompt,
    userPrompt,
    commentText,
    taxonomy,
    speaker,
    commentId,
    options = {},
  } = input;

  const { enableScoring = false, weaveProjectName = "production-extraction" } =
    options;

  // Initialize Weave for scoring if enabled
  const responsesCreate = await initializeWeaveIfEnabled(
    openaiClient,
    enableScoring,
    weaveProjectName,
  );

  // Validate taxonomy structure
  const taxonomyValidation = validateTaxonomy(taxonomy);
  if (taxonomyValidation.tag === "failure") {
    return taxonomyValidation;
  }

  // Call OpenAI API to extract claims
  const apiResult = await callOpenAIForClaims(
    responsesCreate,
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

  // Calculate cost
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

  // If scoring is enabled, run scorers on the result asynchronously
  if (enableScoring) {
    runClaimsEvaluation(openaiClient, claims, commentText, taxonomy);
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
  // TODO: Remove 'any' cast after fixing OpenAI SDK version mismatch
  // See: https://linear.app/ai-objectives/issue/T3C-853/update-openai-sdk-version-in-eval-suite
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const llmJudgeScorer = createLLMJudgeScorer(openaiClient as any);

  // Build model output format for scorers
  const modelOutput = {
    claims: claims.map((c) => ({
      claim: c.claim,
      quote: c.quote,
      topicName: c.topicName,
      subtopicName: c.subtopicName,
    })),
  };

  // Build dataset row format with taxonomy for alignment checking
  const datasetRow = {
    comment: commentText,
    taxonomy: taxonomy.map((t) => ({
      topicName: t.topicName,
      subtopics: t.subtopics.map((s) => ({
        subtopicName: s.subtopicName,
      })),
    })),
  };

  // Run scorers on the result we already have (non-blocking)
  // Scores are automatically sent to Weave since scorers are wrapped with weave.op
  Promise.all([
    extractionJsonStructureScorer({
      modelOutput,
      datasetRow,
    }),
    claimQualityScorer({
      modelOutput,
      datasetRow,
    }),
    taxonomyAlignmentScorer({
      modelOutput,
      datasetRow,
    }),
    quoteRelevanceScorer({
      modelOutput,
      datasetRow,
    }),
    llmJudgeScorer({
      modelOutput,
      datasetRow,
    }),
  ])
    .then((scores) => {
      claimsLogger.info(
        {
          jsonStructure: scores[0],
          claimQuality: scores[1],
          taxonomyAlignment: scores[2],
          quoteRelevance: scores[3],
          llmJudge: scores[4],
        },
        "Claims extraction evaluation complete",
      );
    })
    .catch((error) => {
      claimsLogger.error({ error }, "Background scoring failed");
    });
}
