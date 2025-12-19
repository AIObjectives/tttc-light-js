import type { OpenAI } from "openai";
import * as weave from "weave";
import { logger } from "../../logger";
import type { LLMTopic } from "../../schema";
import { EVAL_MODEL } from "../constants";
import type {
  ClusteringScorerInput,
  JsonStructureScorerOutput,
  LLMJudgeOutput,
  LLMJudgeScorerFunction,
  TopicCoverageScorerOutput,
} from "./types";

const evaluationLogger = logger.child({ module: "evaluations" });

/**
 * Validates basic taxonomy structure
 * @param modelOutput - The model output to validate
 * @returns True if taxonomy exists and is a non-empty array
 */
function hasValidTaxonomyStructure(
  modelOutput: ClusteringScorerInput["modelOutput"],
): boolean {
  return !!(
    modelOutput &&
    modelOutput.taxonomy &&
    Array.isArray(modelOutput.taxonomy) &&
    modelOutput.taxonomy.length > 0
  );
}

/**
 * Validates word count is within acceptable range
 * @param text - The text to count words in
 * @param min - Minimum word count
 * @param max - Maximum word count
 * @returns Validation result with word count
 */
function validateWordCount(
  text: string,
  min: number,
  max: number,
): { valid: boolean; count: number } {
  const count = text.trim().split(/\s+/).length;
  return {
    valid: count >= min && count <= max,
    count,
  };
}

/**
 * Validates a single topic's structure and content
 * @param topic - The topic to validate
 * @returns Validation result with success status and reason for failure
 */
function validateTopic(topic: LLMTopic): {
  valid: boolean;
  reason?: string;
} {
  if (
    !topic.topicName ||
    !topic.topicShortDescription ||
    !Array.isArray(topic.subtopics)
  ) {
    return {
      valid: false,
      reason: "Invalid topic structure",
    };
  }

  const wordCountResult = validateWordCount(
    topic.topicShortDescription,
    25,
    35,
  );
  if (!wordCountResult.valid) {
    return {
      valid: false,
      reason: `Topic description must be 25-35 words: got ${wordCountResult.count} words`,
    };
  }

  return { valid: true };
}

/**
 * Validates a single subtopic's structure and content
 * @param subtopic - The subtopic to validate
 * @returns Validation result with success status and reason for failure
 */
function validateSubtopic(subtopic: LLMTopic["subtopics"][0]): {
  valid: boolean;
  reason?: string;
} {
  if (!subtopic.subtopicName || !subtopic.subtopicShortDescription) {
    return {
      valid: false,
      reason: "Invalid subtopic structure",
    };
  }

  const wordCountResult = validateWordCount(
    subtopic.subtopicShortDescription,
    70,
    90,
  );
  if (!wordCountResult.valid) {
    return {
      valid: false,
      reason: `Subtopic description must be 70-90 words: got ${wordCountResult.count} words`,
    };
  }

  return { valid: true };
}

/**
 * Validates all topics and their subtopics
 * @param taxonomy - The taxonomy array to validate
 * @returns Validation result with success status and reason for failure
 */
function validateAllTopics(taxonomy: Array<LLMTopic>): {
  valid: boolean;
  reason?: string;
} {
  for (const topic of taxonomy) {
    const topicResult = validateTopic(topic);
    if (!topicResult.valid) {
      return topicResult;
    }

    for (const subtopic of topic.subtopics) {
      const subtopicResult = validateSubtopic(subtopic);
      if (!subtopicResult.valid) {
        return subtopicResult;
      }
    }
  }

  return { valid: true };
}

/**
 * Calculates taxonomy statistics
 * @param taxonomy - The taxonomy array to analyze
 * @returns Object with topic count and total subtopics
 */
function calculateTaxonomyStats(taxonomy: Array<LLMTopic>): {
  topic_count: number;
  total_subtopics: number;
} {
  return {
    topic_count: taxonomy.length,
    total_subtopics: taxonomy.reduce(
      (sum: number, topic: LLMTopic) => sum + topic.subtopics.length,
      0,
    ),
  };
}

/**
 * Scorer for valid JSON structure
 * Validates that the model output conforms to the expected schema with required fields
 * @param input - The scorer input containing model output and dataset row
 * @returns Validation results with structure validity and counts
 */
export const jsonStructureScorer = weave.op(function jsonStructureScorer({
  modelOutput,
}: ClusteringScorerInput): JsonStructureScorerOutput {
  try {
    if (!hasValidTaxonomyStructure(modelOutput)) {
      return {
        valid_json_structure: false,
        reason: "Missing or invalid taxonomy array",
      };
    }

    const validationResult = validateAllTopics(modelOutput.taxonomy);
    if (!validationResult.valid) {
      return {
        valid_json_structure: false,
        reason: validationResult.reason ?? "Validation failed",
      };
    }

    const stats = calculateTaxonomyStats(modelOutput.taxonomy);
    return {
      valid_json_structure: true,
      ...stats,
    };
  } catch (error: unknown) {
    if (error instanceof Error) {
      evaluationLogger.error(
        { error },
        `An error occurred while evaluating the JSON structure of the clustering response: ${error.message}`,
      );
      return {
        valid_json_structure: false,
        reason: "Unexpected Error",
        error: error.message,
      };
    } else {
      evaluationLogger.error(
        `An error occurred while evaluating the JSON structure of the clustering response: ${String(error)}`,
      );
      return {
        valid_json_structure: false,
        reason: "Unexpected Error",
        error: String(error),
      };
    }
  }
});

/**
 * Scorer for topic coverage quality
 * Evaluates the number and distribution of topics and subtopics
 * @param input - The scorer input containing model output and dataset row
 * @returns Topic coverage metrics including counts and diversity scores
 */
export const topicCoverageScorer = weave.op(function topicCoverageScorer({
  modelOutput,
}: ClusteringScorerInput): TopicCoverageScorerOutput {
  if (!modelOutput?.taxonomy) {
    return { topic_coverage_score: 0, reason: "No taxonomy found" };
  }

  const topics = modelOutput.taxonomy;

  // Check for reasonable number of topics (2-6 is typically good)
  const topicCount = topics.length;
  let topicCountScore = 0;
  if (topicCount >= 2 && topicCount <= 6) {
    topicCountScore = 1;
  } else if (topicCount === 1 || topicCount === 7) {
    topicCountScore = 0.7;
  } else {
    topicCountScore = 0.3;
  }

  // Check for subtopic diversity (topics should have 1-4 subtopics each)
  let subtopicScore = 0;
  const subtopicCounts = topics.map(
    (topic: LLMTopic) => topic.subtopics.length,
  );
  const avgSubtopics =
    subtopicCounts.reduce((a: number, b: number) => a + b, 0) /
    subtopicCounts.length;

  if (avgSubtopics >= 1 && avgSubtopics <= 4) {
    subtopicScore = 1;
  } else {
    subtopicScore = 0.5;
  }

  const overallScore = (topicCountScore + subtopicScore) / 2;

  return {
    topic_coverage_score: overallScore,
    topic_count: topicCount,
    avg_subtopics_per_topic: avgSubtopics,
    topic_count_score: topicCountScore,
    subtopic_diversity_score: subtopicScore,
  };
});

/**
 * Populates the evaluation prompt for the LLM judge
 * Creates a formatted prompt with input comments and generated taxonomy for evaluation
 * @param taxonomy - The generated taxonomy to evaluate
 * @param comments - The original input comments
 * @returns Formatted prompt string for LLM evaluation
 */
function populateLLMJudgePrompt(
  taxonomy: Array<LLMTopic>,
  comments: string,
): string {
  return `You are evaluating the quality of an LLM in creating Topics, subtopics, and descriptions from a list of user comments.

Input Comments:
${comments}

Generated Taxonomy:
${JSON.stringify(taxonomy, null, 2)}

Evaluate the quality of the produced taxonomy. Consider:
1. Topic Coverage: Do the generated topics cover the major conceptual ideas?
2. Subtopic Alignment: Within topics, do the generated subtopics make sense?
3. Naming Quality: Are topic/subtopic names appropriate? 
4. Description Quality: Do descriptions convey quality information?

Provide your evaluation as a JSON object with:
- topic_coverage_score: 0-1 score for how well the comments are covered by the generated topics.
- subtopic_coverage_score: 0-1 score for how well subtopics align within matched topics
- overall_score: 0-1 overall quality score
- reasoning: brief explanation of the scores
`;
}

/**
 * Creates an LLM-as-a-judge scorer for evaluating quality of the clustering response
 * Uses an LLM to evaluate topic coverage, subtopic alignment, and overall quality
 * @param openaiClient - The OpenAI client instance to use for LLM evaluation
 * @returns A weave operation that performs LLM-based evaluation
 */
export function createLLMJudgeScorer(
  openaiClient: OpenAI,
): weave.Op<LLMJudgeScorerFunction> {
  return weave.op(async function llmJudgeScorer({
    modelOutput,
    datasetRow,
  }: ClusteringScorerInput): Promise<LLMJudgeOutput> {
    if (!modelOutput?.taxonomy) {
      return {
        llm_judge_score: 0,
        error: "Missing Taxonomy Data",
      };
    }

    try {
      const response = await openaiClient.chat.completions.create({
        model: EVAL_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are an expert evaluator of taxonomy quality and semantic similarity. You understand that different wordings can convey the same meaning.",
          },
          {
            role: "user",
            content: populateLLMJudgePrompt(
              modelOutput.taxonomy,
              datasetRow.comments,
            ),
          },
        ],
        response_format: { type: "json_object" },
      });

      const content = response?.choices[0]?.message?.content;
      if (!content) {
        evaluationLogger.error(
          { response },
          "Empty or invalid response recieved from LLM while evaluating clustering prompt",
        );
        return {
          llm_judge_score: 0,
          error: "No response from LLM judge",
        };
      }

      const evaluation = JSON.parse(content);
      evaluationLogger.debug(
        { reasoning: evaluation.reasoning },
        "LLM judge evaluation reasoning",
      );

      return {
        llm_judge_score: evaluation.overall_score || 0,
        topic_coverage_score: evaluation.topic_coverage_score || 0,
        subtopic_coverage_score: evaluation.subtopic_coverage_score || 0,
        reasoning: evaluation.reasoning || "",
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        evaluationLogger.error(
          { error },
          `An error occurred while evaluating the LLM Judge response of the clustering response: ${error.message}`,
        );
        return {
          llm_judge_score: 0,
          error: error.message,
        };
      } else {
        evaluationLogger.error(
          `An error occurred while evaluating the LLM Judge response of the clustering response: ${String(error)}`,
        );
        return {
          llm_judge_score: 0,
          error: String(error),
        };
      }
    }
  });
}
