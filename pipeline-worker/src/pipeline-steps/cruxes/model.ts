/**
 * Cruxes extraction model using OpenAI Responses API
 */

import type OpenAI from "openai";
import {
  createLLMJudgeScorer,
  cruxesJsonStructureScorer,
  cruxPositionDistributionScorer,
  cruxQualityScorer,
} from "tttc-common/evaluations/cruxes/scorers";
import { failure, type Result, success } from "tttc-common/functional-utils";
import { logger } from "tttc-common/logger";
import { basicSanitize, sanitizePromptLength } from "../sanitizer";
import {
  ApiCallFailedError,
  EmptyResponseError,
  ParseFailedError,
} from "../types";
import { initializeWeaveIfEnabled, tokenCost } from "../utils";
import type {
  AnonymizedClaims,
  ClusteringError,
  CruxEvaluationParams,
  CruxForTopicResult,
  GenerateCruxInput,
  RawCruxResponse,
  SanitizedTopicInfo,
  TokenUsage,
} from "./types";

const cruxesLogger = logger.child({ module: "cruxes-model" });

/**
 * Build anonymized claims list with speaker IDs
 */
function buildAnonymizedClaims(
  claims: GenerateCruxInput["claims"],
  speakerMap: GenerateCruxInput["speakerMap"],
): AnonymizedClaims {
  const claimsAnon: string[] = [];
  const speakerSet = new Set<string>();

  for (const claim of claims) {
    if (claim.speaker) {
      const speakerAnon = speakerMap[claim.speaker];
      if (speakerAnon) {
        speakerSet.add(speakerAnon);
        const speakerClaim = `${speakerAnon}:${claim.claim}`;
        claimsAnon.push(speakerClaim);
      }
    }
  }

  return {
    claimsAnon,
    speakerCount: speakerSet.size,
  };
}

/**
 * Validate and sanitize topic information
 */
function validateTopicInfo(
  topic: string,
  topicDesc: string,
): Result<SanitizedTopicInfo, ClusteringError> {
  const { sanitizedText: sanitizedTopic, isSafe: topicSafe } = basicSanitize(
    topic,
    "cruxes_topic",
  );
  const { sanitizedText: sanitizedTopicDesc, isSafe: descSafe } = basicSanitize(
    topicDesc,
    "cruxes_desc",
  );

  if (!topicSafe || !descSafe) {
    return failure(
      new ParseFailedError(topic, "Unsafe topic/description in cruxes"),
    );
  }

  return success({ sanitizedTopic, sanitizedTopicDesc });
}

/**
 * Build the full prompt for crux extraction
 */
function buildPrompt(
  userPrompt: string,
  sanitizedTopic: string,
  sanitizedTopicDesc: string,
  claimsAnon: string[],
): string {
  let fullPrompt = userPrompt;
  fullPrompt += `\nTopic: ${sanitizedTopic}: ${sanitizedTopicDesc}`;
  fullPrompt += `\nParticipant claims: \n${JSON.stringify(claimsAnon)}`;
  return sanitizePromptLength(fullPrompt);
}

/**
 * Call OpenAI API for crux extraction
 */
async function callOpenAI(
  responsesCreate: OpenAI["beta"]["chat"]["completions"]["create"],
  modelName: string,
  systemPrompt: string,
  fullPrompt: string,
): Promise<Result<unknown, ClusteringError>> {
  try {
    const response = await responsesCreate({
      model: modelName,
      instructions: systemPrompt,
      input: fullPrompt,
      text: {
        format: {
          type: "json_object",
        },
      },
    });
    return success(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return failure(new ApiCallFailedError(modelName, errorMessage));
  }
}

/**
 * Parse OpenAI response and extract crux object
 */
function parseResponse(
  response: unknown,
  modelName: string,
): Result<RawCruxResponse, ClusteringError> {
  const content = (response as { output_text?: string }).output_text;
  if (!content) {
    return failure(new EmptyResponseError(modelName));
  }

  try {
    const cruxObj = JSON.parse(content);
    return success(cruxObj);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return failure(new ParseFailedError(content, errorMessage));
  }
}

/**
 * Generate a crux claim for a single subtopic
 *
 * This operates on SUBTOPICS, not topics.
 * The 'topic' parameter is formatted as "Topic, Subtopic" by the caller,
 * and 'claims' contains only claims from that specific subtopic.
 *
 * @param input - Input parameters including OpenAI client, prompts, and claims
 * @returns Result containing crux response and usage, or an error
 */
export async function generateCruxForSubtopic(
  input: GenerateCruxInput,
): Promise<Result<CruxForTopicResult, ClusteringError>> {
  const {
    openaiClient,
    modelName,
    systemPrompt,
    userPrompt,
    topic,
    topicDesc,
    claims,
    speakerMap,
    subtopicIndex,
    reportId,
    options = {},
  } = input;

  const { enableWeave = false, weaveProjectName = "production-cruxes" } =
    options;

  const context = {
    topic,
    subtopicIndex,
    reportId,
  };

  const { claimsAnon, speakerCount } = buildAnonymizedClaims(
    claims,
    speakerMap,
  );

  if (speakerCount < 2) {
    cruxesLogger.debug(
      { ...context, speakerCount },
      "Fewer than 2 speakers in subtopic",
    );
    return failure(
      new ParseFailedError(
        topic,
        `Fewer than 2 speakers in subtopic: ${speakerCount}`,
      ),
    );
  }

  const topicInfoResult = validateTopicInfo(topic, topicDesc);
  if (!topicInfoResult.success) {
    cruxesLogger.warn(context, "Rejecting unsafe topic/description in cruxes");
    return topicInfoResult;
  }

  const { sanitizedTopic, sanitizedTopicDesc } = topicInfoResult.value;
  const fullPrompt = buildPrompt(
    userPrompt,
    sanitizedTopic,
    sanitizedTopicDesc,
    claimsAnon,
  );

  cruxesLogger.info(
    {
      ...context,
      claimCount: claims.length,
      speakerCount,
      model: modelName,
    },
    "Calling OpenAI for crux extraction",
  );

  const responsesCreate = await initializeWeaveIfEnabled(
    openaiClient,
    enableWeave,
    weaveProjectName,
  );

  const responseResult = await callOpenAI(
    responsesCreate,
    modelName,
    systemPrompt,
    fullPrompt,
  );
  if (!responseResult.success) {
    cruxesLogger.error(
      { ...context, error: responseResult.error },
      "Failed to call OpenAI API for crux extraction",
    );
    return responseResult;
  }

  const response = responseResult.value;
  const usage: TokenUsage = {
    input_tokens: response.usage?.input_tokens || 0,
    output_tokens: response.usage?.output_tokens || 0,
    total_tokens: response.usage?.total_tokens || 0,
  };

  const cruxResult = parseResponse(response, modelName);
  if (!cruxResult.success) {
    cruxesLogger.error(
      { ...context, error: cruxResult.error },
      "Failed to parse crux response",
    );
    return cruxResult;
  }

  const cruxObj = cruxResult.value;
  const cost = tokenCost(modelName, usage.input_tokens, usage.output_tokens);

  cruxesLogger.info(
    {
      ...context,
      tokens: usage.total_tokens,
      cost: cost >= 0 ? cost : 0,
    },
    "Crux extraction complete",
  );

  const result: CruxForTopicResult = {
    crux: cruxObj,
    usage: {
      total_tokens: usage.total_tokens,
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
    },
  };

  if (enableWeave) {
    runCruxesEvaluation({
      openaiClient,
      cruxResponse: cruxObj,
      claims: claimsAnon,
      totalSpeakers: speakerCount,
      topic,
    });
  }

  return success(result);
}

/**
 * Run evaluation scorers on extracted crux asynchronously
 * Scores are sent to Weave for tracking
 */
function runCruxesEvaluation(params: CruxEvaluationParams): void {
  const { openaiClient, cruxResponse, claims, totalSpeakers, topic } = params;
  const llmJudgeScorer = createLLMJudgeScorer(openaiClient);

  // Build model output format for scorers
  const modelOutput = {
    crux: cruxResponse.crux,
  };

  // Build dataset row format with claims for evaluation
  const datasetRow = {
    id: topic,
    claims,
    totalSpeakers,
  };

  // Run scorers on the result we already have (non-blocking)
  // Scores are automatically sent to Weave since scorers are wrapped with weave.op
  Promise.all([
    cruxesJsonStructureScorer({
      modelOutput,
      datasetRow,
    }),
    cruxPositionDistributionScorer({
      modelOutput,
      datasetRow,
    }),
    cruxQualityScorer({
      modelOutput,
      datasetRow,
    }),
    llmJudgeScorer({
      modelOutput,
      datasetRow,
    }),
  ])
    .then((scores) => {
      cruxesLogger.info(
        {
          topic,
          jsonStructure: scores[0],
          positionDistribution: scores[1],
          cruxQuality: scores[2],
          llmJudge: scores[3],
        },
        "Crux extraction evaluation complete",
      );
    })
    .catch((error) => {
      cruxesLogger.error({ error, topic }, "Background scoring failed");
    });
}
