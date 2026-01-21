/**
 * Cruxes extraction model using OpenAI Responses API
 */

import type OpenAI from "openai";
import {
  createLLMJudgeScorer,
  cruxJsonStructureScorer,
  explanationQualityScorer,
} from "tttc-common/evaluations/crux/scorers";
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
 * Validate and sanitize subtopic information
 */
function validateSubtopicInfo(
  subtopicIdentifier: string,
  subtopicDesc: string,
): Result<SanitizedTopicInfo, ClusteringError> {
  const { sanitizedText: sanitizedTopic, isSafe: topicSafe } = basicSanitize(
    subtopicIdentifier,
    "cruxes_topic",
  );
  const { sanitizedText: sanitizedTopicDesc, isSafe: descSafe } = basicSanitize(
    subtopicDesc,
    "cruxes_desc",
  );

  if (!topicSafe || !descSafe) {
    return failure(
      new ParseFailedError(
        subtopicIdentifier,
        "Unsafe subtopic identifier/description in cruxes",
      ),
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

/** Response type from OpenAI Responses API (non-streaming) */
interface ResponsesApiResult {
  output_text?: string;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    total_tokens?: number;
  };
}

/**
 * Call OpenAI API for crux extraction
 */
async function callOpenAI(
  responsesCreate: OpenAI["responses"]["create"],
  modelName: string,
  systemPrompt: string,
  fullPrompt: string,
): Promise<Result<ResponsesApiResult, ClusteringError>> {
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
    // Cast to our expected response type (non-streaming)
    return success(response as ResponsesApiResult);
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
    subtopicIdentifier,
    subtopicDesc,
    claims,
    speakerMap,
    subtopicIndex,
    reportId,
    options = {},
  } = input;

  const { enableWeave = false, weaveProjectName = "production-cruxes" } =
    options;

  const context = {
    subtopicIdentifier,
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
        subtopicIdentifier,
        `Fewer than 2 speakers in subtopic: ${speakerCount}`,
      ),
    );
  }

  const subtopicInfoResult = validateSubtopicInfo(
    subtopicIdentifier,
    subtopicDesc,
  );
  if (subtopicInfoResult.tag === "failure") {
    cruxesLogger.warn(
      context,
      "Rejecting unsafe subtopic identifier/description in cruxes",
    );
    return subtopicInfoResult;
  }

  const { sanitizedTopic, sanitizedTopicDesc } = subtopicInfoResult.value;
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
  if (responseResult.tag === "failure") {
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
  if (cruxResult.tag === "failure") {
    cruxesLogger.error(
      { ...context, error: cruxResult.error },
      "Failed to parse crux response",
    );
    return cruxResult;
  }

  const cruxObj = cruxResult.value;
  const costResult = tokenCost(
    modelName,
    usage.input_tokens,
    usage.output_tokens,
  );
  if (costResult.tag === "failure") {
    return costResult;
  }
  const cost = costResult.value;

  cruxesLogger.info(
    {
      ...context,
      tokens: usage.total_tokens,
      cost,
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
      subtopicIdentifier,
    });
  }

  return success(result);
}

/**
 * Run evaluation scorers on extracted crux asynchronously
 * Scores are sent to Weave for tracking
 */
function runCruxesEvaluation(params: CruxEvaluationParams): void {
  const { openaiClient, cruxResponse, claims, subtopicIdentifier } = params;
  // Type assertion needed temporarily until T3C-853 is completed
  // (https://linear.app/ai-objectives/issue/T3C-853/update-openai-sdk-version-in-eval-suite)
  // The eval suite uses OpenAI v4 while pipeline-worker uses v6
  // biome-ignore lint/suspicious/noExplicitAny: SDK version mismatch requires assertion
  const llmJudgeScorer = createLLMJudgeScorer(openaiClient as any);

  // Build model output format for scorers
  // Cast to match CruxModelOutput type expected by scorers
  // Our internal RawCruxResponse uses (string | number)[] while scorers expect string[]
  const modelOutput = {
    crux: {
      cruxClaim: cruxResponse.crux.cruxClaim,
      agree: cruxResponse.crux.agree.map(String),
      disagree: cruxResponse.crux.disagree.map(String),
      explanation: cruxResponse.crux.explanation || "",
    },
  };

  // Build dataset row format with claims for evaluation.
  // Simple scorers (cruxJsonStructureScorer, explanationQualityScorer) don't use
  // datasetRow topic fields, so minimal data is sufficient.
  // TODO(T3C-XXX): Consider passing full topic/subtopic info to improve LLM judge
  // accuracy, or evaluate whether the LLM judge scorer is effective without it.
  const datasetRow = {
    topic: subtopicIdentifier,
    topicDescription: "",
    subtopic: "",
    subtopicDescription: "",
    participantClaims: claims.map((claim) => {
      const [participant, ...claimParts] = claim.split(":");
      return { participant, claims: [claimParts.join(":")] };
    }),
  };

  // Run scorers on the result we already have (non-blocking)
  // Scores are automatically sent to Weave since scorers are wrapped with weave.op
  Promise.all([
    cruxJsonStructureScorer({
      modelOutput,
      datasetRow,
    }),
    explanationQualityScorer({
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
          subtopicIdentifier,
          jsonStructure: scores[0],
          explanationQuality: scores[1],
          llmJudge: scores[2],
        },
        "Crux extraction evaluation complete",
      );
    })
    .catch((error) => {
      cruxesLogger.error(
        { error, subtopicIdentifier },
        "Background scoring failed",
      );
    });
}
