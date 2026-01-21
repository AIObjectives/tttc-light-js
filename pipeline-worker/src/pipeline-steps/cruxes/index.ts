/**
 * Cruxes extraction pipeline step
 *
 * Given a claims tree with topics, subtopics, and claims, extract crux claims
 * that best split the claims into agree/disagree sides for each subtopic.
 * Returns a crux for each subtopic which contains at least 2 claims and at least 2 speakers.
 */

import OpenAI from "openai";
import type { Logger } from "pino";
import { failure, type Result, success } from "tttc-common/functional-utils";
import { sanitizeForOutput } from "../sanitizer";
import { ClusteringError, ParseFailedError } from "../types";
import { getReportLogger, processBatchConcurrently, tokenCost } from "../utils";
import { generateCruxForSubtopic } from "./model";
import type {
  Claim,
  ClaimsTree,
  CruxesOptions,
  CruxesResult,
  LLMConfig,
  SpeakerMap,
  SpeakerValidationContext,
  SubtopicCrux,
  SubtopicItem,
  SubtopicProcessingContext,
  Topic,
  TopicDescMap,
  ValidatedSpeakerIds,
} from "./types";
import {
  buildFullSpeakerMap,
  buildSpeakerCruxMatrix,
  buildTopicDescMap,
  calculateControversyScores,
  calculateTopicScores,
  formatSpeakersForOutput,
  SPEAKER_FORMAT_SEPARATOR,
} from "./utils";

// Concurrency configuration for rate limiting
const MAX_CONCURRENCY = 6;

interface SubtopicsToProcessResult {
  subtopicsToProcess: SubtopicItem[];
  subtopicCruxesByTopic: Record<string, SubtopicCrux[]>;
}

interface SpeakerMapsResult {
  speakerMap: SpeakerMap;
  idsToSpeakers: Record<string, string>;
  validIds: Set<string>;
  totalSpeakers: number;
}

/**
 * Build speaker maps from claims tree
 */
function buildSpeakerMaps(claimsTree: ClaimsTree): SpeakerMapsResult {
  const speakerMap = buildFullSpeakerMap(claimsTree);
  const totalSpeakers = Object.keys(speakerMap).length;

  const idsToSpeakers: Record<string, string> = {};
  for (const [speakerName, speakerId] of Object.entries(speakerMap)) {
    idsToSpeakers[speakerId] = speakerName;
  }
  const validIds = new Set(Object.keys(idsToSpeakers));

  return { speakerMap, idsToSpeakers, validIds, totalSpeakers };
}

/**
 * Count unique speakers in claims array
 */
function countUniqueSpeakers(claims: Claim[]): number {
  const speakers = new Set<string>();
  for (const claim of claims) {
    if (claim.speaker) {
      speakers.add(claim.speaker);
    }
  }
  return speakers.size;
}

interface ProcessSubtopicInput {
  topicName: string;
  subtopicName: string;
  claims: Claim[];
  topicDescMap: TopicDescMap;
  subtopicCounter: number;
  reportLogger: Logger;
}

/**
 * Process a single subtopic and add to results if valid
 */
function processSubtopic(input: ProcessSubtopicInput): SubtopicItem | null {
  const {
    topicName,
    subtopicName,
    claims,
    topicDescMap,
    subtopicCounter,
    reportLogger,
  } = input;

  // Skip subtopics with fewer than 2 claims
  if (claims.length < 2) {
    reportLogger.debug(
      { subtopic: subtopicName },
      "Skipping subtopic - fewer than 2 claims",
    );
    return null;
  }

  const subtopicDesc = topicDescMap[subtopicName] || "No further details";
  const cruxIdentifier = `${topicName}, ${subtopicName}`;
  const totalSpeakersInSubtopic = countUniqueSpeakers(claims);

  return {
    topicName,
    subtopicName,
    claims,
    subtopicDesc,
    cruxIdentifier,
    subtopicIndex: subtopicCounter,
    totalSpeakersInSubtopic,
  };
}

/**
 * Collect subtopics to process from claims tree
 */
function collectSubtopicsToProcess(
  claimsTree: ClaimsTree,
  topicDescMap: TopicDescMap,
  reportLogger: Logger,
): SubtopicsToProcessResult {
  const subtopicsToProcess: SubtopicItem[] = [];
  const subtopicCruxesByTopic: Record<string, SubtopicCrux[]> = {};
  let subtopicCounter = 0;

  for (const topicName in claimsTree) {
    const topicNode = claimsTree[topicName];
    subtopicCruxesByTopic[topicName] = [];

    for (const subtopicName in topicNode.subtopics) {
      const subtopicNode = topicNode.subtopics[subtopicName];
      subtopicCounter++;

      const subtopicItem = processSubtopic({
        topicName,
        subtopicName,
        claims: subtopicNode.claims,
        topicDescMap,
        subtopicCounter,
        reportLogger,
      });

      if (subtopicItem) {
        subtopicsToProcess.push(subtopicItem);
      }
    }
  }

  return { subtopicsToProcess, subtopicCruxesByTopic };
}

/**
 * Extract speaker IDs from raw LLM response
 */
function extractSpeakerIds(
  agree: unknown[],
  disagree: unknown[],
  noClearPosition: unknown[],
): ValidatedSpeakerIds {
  const agreeIds = Array.from(
    new Set(agree.map((a) => String(a).split(SPEAKER_FORMAT_SEPARATOR)[0])),
  );
  const disagreeIds = Array.from(
    new Set(disagree.map((d) => String(d).split(SPEAKER_FORMAT_SEPARATOR)[0])),
  );
  const noClearPositionIds = Array.from(
    new Set(
      noClearPosition.map((n) => String(n).split(SPEAKER_FORMAT_SEPARATOR)[0]),
    ),
  );

  return { agreeIds, disagreeIds, noClearPositionIds };
}

/**
 * Check if any speaker IDs are invalid
 */
function hasInvalidSpeakerIds(
  agreeIds: string[],
  disagreeIds: string[],
  noClearPositionIds: string[],
  validIds: Set<string>,
): boolean {
  const invalidAgree = agreeIds.filter((sid) => !validIds.has(sid));
  const invalidDisagree = disagreeIds.filter((sid) => !validIds.has(sid));
  const invalidNoClear = noClearPositionIds.filter((sid) => !validIds.has(sid));

  return (
    invalidAgree.length > 0 ||
    invalidDisagree.length > 0 ||
    invalidNoClear.length > 0
  );
}

/**
 * Handle invalid speaker IDs with recovery
 */
function recoverFromInvalidIds(
  agreeIds: string[],
  disagreeIds: string[],
  noClearPositionIds: string[],
  context: SpeakerValidationContext,
): Result<ValidatedSpeakerIds, ClusteringError> {
  const { validIds, cruxIdentifier, reportLogger } = context;

  const invalidAgree = agreeIds.filter((sid) => !validIds.has(sid));
  const invalidDisagree = disagreeIds.filter((sid) => !validIds.has(sid));
  const invalidNoClear = noClearPositionIds.filter((sid) => !validIds.has(sid));

  reportLogger.warn(
    {
      cruxIdentifier,
      invalidAgree,
      invalidDisagree,
      invalidNoClear,
      validIds: Array.from(validIds).sort(),
    },
    "LLM returned invalid speaker IDs",
  );

  // Filter out invalid IDs
  const validAgreeIds = agreeIds.filter((sid) => validIds.has(sid));
  const validDisagreeIds = disagreeIds.filter((sid) => validIds.has(sid));
  const validNoClearIds = noClearPositionIds.filter((sid) => validIds.has(sid));

  // Determine if we recovered (have some valid IDs)
  const recovered = validAgreeIds.length > 0 || validDisagreeIds.length > 0;

  if (!recovered) {
    reportLogger.error(
      { cruxIdentifier },
      "No valid speaker IDs in crux response, skipping",
    );
    return failure(
      new ParseFailedError(
        cruxIdentifier,
        "No valid speaker IDs in crux response",
      ),
    );
  }

  reportLogger.warn(
    {
      cruxIdentifier,
      agreeCount: `${validAgreeIds.length}/${agreeIds.length}`,
      disagreeCount: `${validDisagreeIds.length}/${disagreeIds.length}`,
      noClearCount: `${validNoClearIds.length}/${noClearPositionIds.length}`,
    },
    "Continuing with partial speaker data",
  );

  return success({
    agreeIds: validAgreeIds,
    disagreeIds: validDisagreeIds,
    noClearPositionIds: validNoClearIds,
  });
}

/**
 * Validate and filter speaker IDs returned by LLM
 */
function validateAndFilterSpeakerIds(
  agree: unknown[],
  disagree: unknown[],
  noClearPosition: unknown[],
  context: SpeakerValidationContext,
): Result<ValidatedSpeakerIds, ClusteringError> {
  const { agreeIds, disagreeIds, noClearPositionIds } = extractSpeakerIds(
    agree,
    disagree,
    noClearPosition,
  );

  if (
    !hasInvalidSpeakerIds(
      agreeIds,
      disagreeIds,
      noClearPositionIds,
      context.validIds,
    )
  ) {
    return success({ agreeIds, disagreeIds, noClearPositionIds });
  }

  return recoverFromInvalidIds(
    agreeIds,
    disagreeIds,
    noClearPositionIds,
    context,
  );
}

interface ParsedCruxData {
  cruxClaim: string;
  agree: unknown[];
  disagree: unknown[];
  noClearPosition: unknown[];
  explanation: string;
}

/**
 * Check if response has valid crux structure
 */
function hasValidCruxStructure(
  llmResponse: unknown,
): llmResponse is { crux: Record<string, unknown> } {
  return (
    !!llmResponse &&
    typeof llmResponse === "object" &&
    "crux" in llmResponse &&
    !!llmResponse.crux &&
    typeof llmResponse.crux === "object"
  );
}

/**
 * Check if crux object has required properties
 */
function hasRequiredCruxProperties(
  crux: Record<string, unknown>,
): crux is Record<string, unknown> & {
  cruxClaim: unknown;
  agree: unknown;
  disagree: unknown;
} {
  return "cruxClaim" in crux && "agree" in crux && "disagree" in crux;
}

/**
 * Extract typed crux data from raw crux object
 */
function extractCruxData(crux: Record<string, unknown>): ParsedCruxData {
  return {
    cruxClaim: typeof crux.cruxClaim === "string" ? crux.cruxClaim : "",
    agree: Array.isArray(crux.agree) ? crux.agree : [],
    disagree: Array.isArray(crux.disagree) ? crux.disagree : [],
    noClearPosition: Array.isArray(crux.no_clear_position)
      ? crux.no_clear_position
      : [],
    explanation:
      typeof crux.explanation === "string" ? crux.explanation : "N/A",
  };
}

/**
 * Process a single subtopic result from LLM
 */
function processSubtopicResult(
  item: SubtopicItem,
  llmResponse: unknown,
  context: SubtopicProcessingContext,
): Result<SubtopicCrux, ClusteringError> {
  const { idsToSpeakers, validIds, reportLogger } = context;

  // Validate response structure
  if (!hasValidCruxStructure(llmResponse)) {
    reportLogger.error(
      { cruxIdentifier: item.cruxIdentifier },
      "Invalid crux response structure",
    );
    return failure(
      new ParseFailedError(item.cruxIdentifier, "Invalid response structure"),
    );
  }

  // Type guard above ensures llmResponse.crux exists
  const crux = llmResponse.crux;

  // Validate required properties
  if (!hasRequiredCruxProperties(crux)) {
    reportLogger.error(
      { cruxIdentifier: item.cruxIdentifier },
      "Invalid crux object - missing required properties",
    );
    return failure(
      new ParseFailedError(
        item.cruxIdentifier,
        "Missing required properties (cruxClaim, agree, disagree)",
      ),
    );
  }

  // Extract typed data
  const { cruxClaim, agree, disagree, noClearPosition, explanation } =
    extractCruxData(crux);

  // Validate and filter speaker IDs
  const validatedResult = validateAndFilterSpeakerIds(
    agree,
    disagree,
    noClearPosition,
    { validIds, cruxIdentifier: item.cruxIdentifier, reportLogger },
  );

  if (validatedResult.tag === "failure") {
    return validatedResult;
  }

  const { agreeIds, disagreeIds, noClearPositionIds } = validatedResult.value;

  // Convert speaker IDs to "id:name" format for output
  const namedAgree = formatSpeakersForOutput(agreeIds, idsToSpeakers);
  const namedDisagree = formatSpeakersForOutput(disagreeIds, idsToSpeakers);
  const namedNoClearPosition = formatSpeakersForOutput(
    noClearPositionIds,
    idsToSpeakers,
  );

  // Calculate participation metadata
  const speakersInvolved = new Set([...namedAgree, ...namedDisagree]).size;

  // Calculate controversy scores for this subtopic
  const scores = calculateControversyScores(
    namedAgree,
    namedDisagree,
    item.totalSpeakersInSubtopic,
  );

  // Build subtopic crux object
  const subtopicCrux: SubtopicCrux = {
    topic: item.topicName,
    subtopic: item.subtopicName,
    cruxClaim,
    agree: namedAgree,
    disagree: namedDisagree,
    no_clear_position: namedNoClearPosition,
    explanation,
    agreementScore: scores.agreementScore,
    disagreementScore: scores.disagreementScore,
    controversyScore: scores.controversyScore,
    speakersInvolved,
    totalSpeakersInSubtopic: item.totalSpeakersInSubtopic,
  };

  return success(subtopicCrux);
}

/**
 * Extract cruxes from a claims tree
 *
 * Input format:
 * - claimsTree: Claims tree organized by topic → subtopic → claims
 * - topics: Array of topics with descriptions (from clustering step)
 * - llmConfig: LLM configuration with model_name, system_prompt, user_prompt
 *
 * Output format:
 * - subtopicCruxes: Array of crux objects for each subtopic with:
 *   - topic, subtopic: names
 *   - cruxClaim: the crux statement
 *   - agree, disagree, no_clear_position: arrays of speakers in format "id:name"
 *   - explanation: explanation of the crux
 *   - agreementScore, disagreementScore, controversyScore: metrics (0-1)
 *   - speakersInvolved, totalSpeakersInSubtopic: counts
 * - topicScores: Topic-level rollup scores
 * - speakerCruxMatrix: Speaker × Crux agreement matrix for visualization
 * - usage: Aggregated token counts across all LLM calls
 * - cost: Total estimated cost in dollars
 *
 * @param claimsTree - Claims tree from the claims extraction step
 * @param topics - Array of topics with descriptions (from clustering step)
 * @param llmConfig - LLM configuration (model, prompts)
 * @param apiKey - OpenAI API key
 * @param options - Optional configuration (reportId, userId, etc.)
 * @returns Result containing cruxes with usage and cost information, or an error
 */
export async function extractCruxes(
  claimsTree: ClaimsTree,
  topics: Topic[],
  llmConfig: LLMConfig,
  apiKey: string,
  options: CruxesOptions = {},
): Promise<Result<CruxesResult, ClusteringError>> {
  const { reportId, userId, enableWeave, weaveProjectName } = options;

  // Get report-specific logger
  const reportLogger = getReportLogger("cruxes", userId, reportId);

  // Build topic description map
  const topicDescMap = buildTopicDescMap(topics);

  // Build speaker maps from claims tree
  const { speakerMap, idsToSpeakers, validIds, totalSpeakers } =
    buildSpeakerMaps(claimsTree);

  // Collect all subtopics to process
  const { subtopicsToProcess, subtopicCruxesByTopic } =
    collectSubtopicsToProcess(claimsTree, topicDescMap, reportLogger);

  const totalSubtopics = subtopicsToProcess.length;

  reportLogger.info(
    `Starting cruxes extraction for ${totalSubtopics} subtopics with ${totalSpeakers} speakers (concurrency: ${MAX_CONCURRENCY})`,
  );

  // Validate inputs
  if (totalSubtopics === 0) {
    return failure(
      new ClusteringError("Claims tree cannot be empty for cruxes extraction"),
    );
  }

  if (topics.length === 0) {
    return failure(
      new ClusteringError("Topics cannot be empty for cruxes extraction"),
    );
  }

  // Initialize OpenAI client
  const client = new OpenAI({ apiKey });

  // Track aggregated usage and cost
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCost = 0;

  const subtopicCruxes: SubtopicCrux[] = [];

  // Process all subtopics concurrently
  const results = await processBatchConcurrently(
    subtopicsToProcess,
    async (item) => {
      const llmResult = await generateCruxForSubtopic({
        openaiClient: client,
        modelName: llmConfig.model_name,
        systemPrompt: llmConfig.system_prompt,
        userPrompt: llmConfig.user_prompt,
        subtopicIdentifier: item.cruxIdentifier,
        subtopicDesc: item.subtopicDesc,
        claims: item.claims,
        speakerMap,
        subtopicIndex: item.subtopicIndex,
        reportId,
        options: {
          enableWeave,
          weaveProjectName,
        },
      });

      return { item, result: llmResult };
    },
    MAX_CONCURRENCY,
  );

  // Process results
  let failedCount = 0;
  for (const { item, result: llmResult } of results) {
    if (llmResult.tag === "failure") {
      reportLogger.warn(
        { cruxIdentifier: item.cruxIdentifier, error: llmResult.error },
        "Failed to generate crux for subtopic",
      );
      failedCount++;
      continue;
    }

    const { crux: llmResponse, usage } = llmResult.value;

    // Process the subtopic result
    const subtopicResult = processSubtopicResult(item, llmResponse, {
      idsToSpeakers,
      validIds,
      reportLogger,
    });

    if (subtopicResult.tag === "failure") {
      failedCount++;
      continue;
    }

    const subtopicCrux = subtopicResult.value;
    subtopicCruxes.push(subtopicCrux);
    subtopicCruxesByTopic[item.topicName].push(subtopicCrux);

    // Aggregate usage
    totalInputTokens += usage.input_tokens;
    totalOutputTokens += usage.output_tokens;
  }

  // Log failure rate if there were failures
  if (failedCount > 0) {
    const successRate = ((totalSubtopics - failedCount) / totalSubtopics) * 100;
    reportLogger.warn(
      `Cruxes extraction completed with ${failedCount}/${totalSubtopics} failures (success rate: ${successRate.toFixed(1)}%)`,
    );
  }

  // Calculate topic-level rollup scores
  const topicScores = calculateTopicScores(subtopicCruxesByTopic);

  // Build Speaker × Crux agreement matrix for visualization
  // Sort speakers for consistent ordering
  const speakerLabels = Object.keys(speakerMap).sort();
  const speakerIds = speakerLabels.map((name) => speakerMap[name]);
  const allSpeakersFormatted = formatSpeakersForOutput(
    speakerIds,
    idsToSpeakers,
  );
  const speakerCruxMatrix = buildSpeakerCruxMatrix(
    subtopicCruxes,
    allSpeakersFormatted,
  );

  // Compute total cost
  const totalTokens = totalInputTokens + totalOutputTokens;
  const costResult = tokenCost(
    llmConfig.model_name,
    totalInputTokens,
    totalOutputTokens,
  );
  if (costResult.tag === "failure") {
    return costResult;
  }
  totalCost = costResult.value;

  reportLogger.info(
    `Cruxes extraction completed: ${subtopicCruxes.length} cruxes, ` +
      `${totalTokens} tokens, $${totalCost.toFixed(4)} cost`,
  );

  const responseData: CruxesResult = {
    subtopicCruxes,
    topicScores,
    speakerCruxMatrix,
    usage: {
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
      total_tokens: totalTokens,
    },
    cost: totalCost >= 0 ? totalCost : 0,
  };

  // Filter PII from final output for user privacy
  return success(sanitizeForOutput(responseData));
}

/**
 * Export main function as default
 */
export default extractCruxes;
