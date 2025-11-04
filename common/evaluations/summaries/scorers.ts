import * as weave from "weave";
import type { OpenAI } from "openai";
import { logger } from "../../logger";
import { EVAL_MODEL } from "../constants";
import type {
  SummariesScorerInput,
  SummariesJsonStructureScorerOutput,
  SummaryLengthScorerOutput,
  SummaryContentQualityScorerOutput,
  SummariesLLMJudgeOutput,
} from "./types";

const evaluationLogger = logger.child({ module: "evaluations" });

/**
 * Scorer that validates JSON structure of summaries output
 * Validates that the model output conforms to the expected schema with required fields
 * @param input - The scorer input containing model output
 * @returns Validation results with structure validity and counts
 */
export const summariesJsonStructureScorer = weave.op(
  function summariesJsonStructureScorer({
    modelOutput,
  }: SummariesScorerInput): SummariesJsonStructureScorerOutput {
    if (!modelOutput?.summary) {
      return {
        valid_json_structure: false,
        reason: "Missing summary",
      };
    }

    if (!modelOutput?.topicName) {
      return {
        valid_json_structure: false,
        reason: "Missing topicName",
      };
    }

    // Check that summary text is not empty
    if (modelOutput.summary.trim().length === 0) {
      return {
        valid_json_structure: false,
        reason: "Empty summary text",
      };
    }

    return {
      valid_json_structure: true,
      summaries_count: modelOutput.summary.length,
    };
  },
);

/**
 * Scorer that checks if summaries meet length requirements (max 140 words)
 * Evaluates whether summaries are concise and within word limits
 * @param input - The scorer input containing model output
 * @returns Length metrics and issues
 */
export const summaryLengthScorer = weave.op(function summaryLengthScorer({
  modelOutput,
}: SummariesScorerInput): SummaryLengthScorerOutput {
  if (!modelOutput?.summary) {
    return {
      summary_length_score: 0,
      issues_count: 1,
      error: "Invalid output structure",
    };
  }

  let totalSummaries = 0;
  let withinLimit = 0;
  const lengthIssues: string[] = [];

  totalSummaries++;
  const wordCount = modelOutput.summary.trim().split(/\s+/).length;

  if (wordCount <= 140) {
    withinLimit++;
  } else {
    lengthIssues.push(
      `${modelOutput.topicName}: ${wordCount} words (exceeds 140 limit)`,
    );
  }

  const score = totalSummaries > 0 ? withinLimit / totalSummaries : 0;

  return {
    summary_length_score: score,
    summaries_within_limit: withinLimit,
    total_summaries: totalSummaries,
    issues_count: lengthIssues.length,
    issues: lengthIssues,
  };
});

/**
 * Scorer that evaluates content quality of summaries
 * Checks for completeness, specificity, and avoidance of platitudes
 * @param input - The scorer input containing model output
 * @returns Quality metrics and identified issues
 */
export const summaryContentQualityScorer = weave.op(
  function summaryContentQualityScorer({
    modelOutput,
  }: SummariesScorerInput): SummaryContentQualityScorerOutput {
    if (!modelOutput?.summary) {
      return {
        content_quality_score: 0,
        issues_count: 1,
        error: "Invalid output structure",
      };
    }

    const issues: string[] = [];

    const text = modelOutput.summary.trim();

    // Check for very short summaries (likely incomplete)
    if (text.split(/\s+/).length < 20) {
      issues.push(`${modelOutput.topicName}: Summary too brief (< 20 words)`);
    }

    // Check for platitudes or generic statements
    const platitudes = [
      /this is important/i,
      /we should consider/i,
      /it's worth noting/i,
      /in conclusion/i,
    ];

    for (const pattern of platitudes) {
      if (pattern.test(text)) {
        issues.push(
          `${modelOutput.topicName}: Contains generic language - "${text.match(pattern)?.[0]}"`,
        );
      }

      // Check if summary actually references subtopics or claims
      // (A good summary should synthesize the content)
      if (
        !text.toLowerCase().includes("participant") &&
        !text.toLowerCase().includes("view") &&
        !text.toLowerCase().includes("opinion") &&
        !text.toLowerCase().includes("perspective")
      ) {
        issues.push(
          `${modelOutput.topicName}: May not be synthesizing participant perspectives`,
        );
      }
    }

    const score = issues.length === 0 ? 1.0 : 0.0;

    return {
      content_quality_score: score,
      issues_count: issues.length,
      issues,
    };
  },
);

/**
 * Function signature for LLM judge scorer
 */
type LLMJudgeScorerFunction = (
  args: SummariesScorerInput,
) => Promise<SummariesLLMJudgeOutput>;

/**
 * Creates an LLM-as-a-judge scorer for evaluating summary quality
 * Uses an LLM to evaluate comprehensiveness, synthesis quality, accuracy, and conciseness
 * @param openaiClient - The OpenAI client instance to use for LLM evaluation
 * @returns A weave operation that performs LLM-based evaluation
 */
export function createLLMJudgeScorer(
  openaiClient: OpenAI,
): weave.Op<LLMJudgeScorerFunction> {
  return weave.op(async function llmSummariesJudgeScorer({
    modelOutput,
    datasetRow,
  }: SummariesScorerInput): Promise<SummariesLLMJudgeOutput> {
    if (!modelOutput?.summary) {
      return {
        llm_judge_score: 0,
        error: "Missing summary data",
      };
    }

    const prompt = `You are evaluating the quality of an LLM in generating topic summaries from structured claims and subtopics.

Input Topic with Claims:
${JSON.stringify(datasetRow, null, 2)}

Generated Summary:
${JSON.stringify(modelOutput.summary, null, 2)}

Evaluate the quality of the generated summary. Consider:
1. Comprehensiveness: Does the summary cover all key subtopics and important claims?
2. Synthesis Quality: Does the summary have well-synthesized narratives or just lists of points?
3. Accuracy: Does the summary accurately represent the claims without adding information?
4. Conciseness: Is summary concise while being comprehensive (ideally under 140 words)?

Provide your evaluation as a JSON object with:
- comprehensiveness_score: 0-1 score for how well all subtopics and claims are covered
- synthesis_quality_score: 0-1 score for narrative quality and coherence
- accuracy_score: 0-1 score for how accurately claims are represented
- conciseness_score: 0-1 score for being concise while comprehensive
- overall_score: 0-1 overall quality score
- reasoning: brief explanation of the scores
`;

    try {
      const response = await openaiClient.chat.completions.create({
        model: EVAL_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are an expert evaluator of summary quality. You understand how to assess whether summaries comprehensively and accurately synthesize source material.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      });

      const content = response.choices[0].message.content;
      if (!content) {
        return {
          llm_judge_score: 0,
          error: "No response from LLM judge",
        };
      }

      const evaluation = JSON.parse(content);
      evaluationLogger.debug({ evaluation }, "LLM judge evaluation result");

      return {
        llm_judge_score: evaluation.overall_score || 0,
        comprehensiveness_score: evaluation.comprehensiveness_score || 0,
        synthesis_quality_score: evaluation.synthesis_quality_score || 0,
        accuracy_score: evaluation.accuracy_score || 0,
        conciseness_score: evaluation.conciseness_score || 0,
        reasoning: evaluation.reasoning || "",
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        evaluationLogger.error(
          { error },
          `Error encountered while running Summaries LLM Judge: ${error.message}`,
        );
        return {
          llm_judge_score: 0,
          error: error.message,
        };
      } else {
        evaluationLogger.error(
          `Error encountered while running Summaries LLM Judge: ${String(error)}`,
        );
        return {
          llm_judge_score: 0,
          error: String(error),
        };
      }
    }
  });
}
