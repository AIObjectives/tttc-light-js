import * as weave from "weave";
import type { OpenAI } from "openai";
import { LLMTopic } from "../../schema";
import { logger } from "../../logger";
import { EVAL_MODEL } from "../constants";
import type {
  ClusteringScorerInput,
  JsonStructureScorerOutput,
  TopicCoverageScorerOutput,
  LLMJudgeOutput,
  LLMJudgeScorerFunction,
} from "./types";

import {
  smallInputCutoffLength,
  smallInputMinimumTopicLength,
  smallInputMaximumTopicLength,
  smallInputMinimumSubtopicLength,
  smallInputMaximumSubtopicLength,
  normalInputMinimumTopicLength,
  normalInputMaximumTopicLength,
  normalInputMinimumSubtopicLength,
  normalInputMaximumSubtopicLength,
} from "../../prompts";

const evaluationLogger = logger.child({ module: "evaluations" });

/**
 * Scorer for valid JSON structure
 * Validates that the model output conforms to the expected schema with required fields
 * @param input - The scorer input containing model output and dataset row
 * @returns Validation results with structure validity and counts
 */
export const jsonStructureScorer = weave.op(function jsonStructureScorer({
  modelOutput,
  datasetRow,
}: ClusteringScorerInput): JsonStructureScorerOutput {
  try {
    const hasValidStructure =
      modelOutput &&
      modelOutput.taxonomy &&
      Array.isArray(modelOutput.taxonomy) &&
      modelOutput.taxonomy.length > 0;

    if (!hasValidStructure) {
      return {
        valid_json_structure: false,
        reason: "Missing or invalid taxonomy array",
      };
    }

    const totalCommentWords = datasetRow.comments.trim().split(/\s+/).length;

    // Check each topic has required fields
    for (const topic of modelOutput.taxonomy) {
      if (
        !topic.topicName ||
        !topic.topicShortDescription ||
        !Array.isArray(topic.subtopics)
      ) {
        return {
          valid_json_structure: false,
          reason: "Invalid topic structure",
        };
      }

      // Determine expected word counts based on input size
      const isSmallInput = totalCommentWords < smallInputCutoffLength;

      const expectedTopicMin = isSmallInput
        ? smallInputMinimumTopicLength
        : normalInputMinimumTopicLength;
      const expectedTopicMax = isSmallInput
        ? smallInputMaximumTopicLength
        : normalInputMaximumTopicLength;
      const expectedSubtopicMin = isSmallInput
        ? smallInputMinimumSubtopicLength
        : normalInputMinimumSubtopicLength;
      const expectedSubtopicMax = isSmallInput
        ? smallInputMaximumSubtopicLength
        : normalInputMaximumSubtopicLength;

      // Check topic description word count
      const topicWordCount = topic.topicShortDescription
        .trim()
        .split(/\s+/).length;
      if (
        topicWordCount < expectedTopicMin ||
        topicWordCount > expectedTopicMax
      ) {
        return {
          valid_json_structure: false,
          reason: `Topic description must be ${expectedTopicMin}-${expectedTopicMax} words (input size: ${totalCommentWords} words): got ${topicWordCount} words`,
        };
      }

      // Check subtopics
      for (const subtopic of topic.subtopics) {
        if (!subtopic.subtopicName || !subtopic.subtopicShortDescription) {
          return {
            valid_json_structure: false,
            reason: "Invalid subtopic structure",
          };
        }
        // Check subtopic description word count
        const subtopicWordCount = subtopic.subtopicShortDescription
          .trim()
          .split(/\s+/).length;
        if (
          subtopicWordCount < expectedSubtopicMin ||
          subtopicWordCount > expectedSubtopicMax
        ) {
          return {
            valid_json_structure: false,
            reason: `Subtopic description must be ${expectedSubtopicMin}-${expectedSubtopicMax} words (input size: ${totalCommentWords} words): got ${subtopicWordCount} words`,
          };
        }
      }
    }

    const totalTopicDescriptionWords = modelOutput.taxonomy.reduce(
      (sum: number, topic: LLMTopic) => {
        const topicWords =
          topic.topicShortDescription?.trim().split(/\s+/).length || 0;
        const subtopicWords = topic.subtopics.reduce(
          (subSum: number, subtopic) =>
            subSum +
            (subtopic.subtopicShortDescription?.trim().split(/\s+/).length ||
              0),
          0,
        );
        return sum + topicWords + subtopicWords;
      },
      0,
    );

    // For small comment sets, descriptions should not greatly exceed the total comment length
    // Allow up to 1.5x the input length to account for necessary structure and clarity
    // This prevents verbose descriptions for topics with very few related comments
    const maxAllowedDescriptionWords = Math.floor(totalCommentWords * 1.5);
    if (
      totalCommentWords < smallInputCutoffLength &&
      totalTopicDescriptionWords > maxAllowedDescriptionWords
    ) {
      return {
        valid_json_structure: false,
        reason: `Total description length (${totalTopicDescriptionWords} words) exceeds allowed maximum (${maxAllowedDescriptionWords} words, 1.5x input of ${totalCommentWords} words). For small comment sets, descriptions should be proportional to content.`,
      };
    }

    return {
      valid_json_structure: true,
      topic_count: modelOutput.taxonomy.length,
      total_subtopics: modelOutput.taxonomy.reduce(
        (sum: number, topic: LLMTopic) => sum + topic.subtopics.length,
        0,
      ),
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
