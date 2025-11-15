import * as weave from "weave";
import { TopicSummary } from "../../apiPyserver";

/**
 * Scorer that validates JSON structure of summaries output
 */
export const summariesJsonStructureScorer = weave.op(
  function summariesJsonStructureScorer(args: {
    modelOutput?: { summaries: Array<{ topicName: string; summary: string }> };
  }) {
    const { modelOutput } = args;
    // Check if summaries array exists
    if (!modelOutput || !Array.isArray(modelOutput.summaries)) {
      return {
        valid_json_structure: false,
        error: "Missing or invalid summaries array",
      };
    }

    // Check each summary has required fields
    for (const summary of modelOutput.summaries) {
      if (!summary.topicName || !summary.summary) {
        return {
          valid_json_structure: false,
          error: "Invalid summary structure - missing required fields",
        };
      }

      // Check that summary text is not empty
      if (summary.summary.trim().length === 0) {
        return {
          valid_json_structure: false,
          error: "Empty summary text",
        };
      }
    }

    return {
      valid_json_structure: true,
      summaries_count: modelOutput.summaries.length,
    };
  },
);

/**
 * Scorer that checks if summaries meet length requirements (max 140 words)
 */
export const summaryLengthScorer = weave.op(function summaryLengthScorer(args: {
  modelOutput?: { summaries: Array<{ topicName: string; summary: string }> };
}) {
  const { modelOutput } = args;
  if (!modelOutput?.summaries || !Array.isArray(modelOutput.summaries)) {
    return {
      summary_length_score: 0,
      issues_count: 1,
      error: "Invalid output structure",
    };
  }

  let totalSummaries = 0;
  let withinLimit = 0;
  const lengthIssues: string[] = [];

  for (const summary of modelOutput.summaries) {
    totalSummaries++;
    const wordCount = summary.summary.trim().split(/\s+/).length;

    if (wordCount <= 140) {
      withinLimit++;
    } else {
      lengthIssues.push(
        `${summary.topicName}: ${wordCount} words (exceeds 140 limit)`,
      );
    }
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
 */
export const summaryContentQualityScorer = weave.op(
  function summaryContentQualityScorer(args: {
    modelOutput?: { summaries: Array<{ topicName: string; summary: string }> };
  }) {
    const { modelOutput } = args;
    if (!modelOutput?.summaries || !Array.isArray(modelOutput.summaries)) {
      return {
        content_quality_score: 0,
        issues_count: 1,
        error: "Invalid output structure",
      };
    }

    const issues: string[] = [];

    for (const summary of modelOutput.summaries) {
      const text = summary.summary.trim();

      // Check for very short summaries (likely incomplete)
      if (text.split(/\s+/).length < 20) {
        issues.push(`${summary.topicName}: Summary too brief (< 20 words)`);
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
            `${summary.topicName}: Contains generic language - "${text.match(pattern)?.[0]}"`,
          );
        }
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
          `${summary.topicName}: May not be synthesizing participant perspectives`,
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
 * Scorer that checks topic coverage and alignment
 */
export const summariesTopicCoverageScorer = weave.op(
  function summariesTopicCoverageScorer({ modelOutput, datasetRow }) {
    if (!modelOutput?.summaries || !Array.isArray(modelOutput.summaries)) {
      return {
        topic_coverage_score: 0,
        error: "Invalid output structure",
      };
    }

    if (!datasetRow?.topics || !Array.isArray(datasetRow.topics)) {
      return {
        topic_coverage_score: 0,
        error: "Invalid input structure",
      };
    }

    const inputTopics = new Set(
      datasetRow.topics.map((t: TopicSummary) => t.topicName.toLowerCase()),
    );
    const outputTopics = new Set(
      modelOutput.summaries.map((s: TopicSummary) => s.topicName.toLowerCase()),
    );

    let matched = 0;
    for (const topic of inputTopics) {
      if (outputTopics.has(topic)) {
        matched++;
      }
    }

    const coverage = inputTopics.size > 0 ? matched / inputTopics.size : 0;

    return {
      topic_coverage_score: coverage,
      topics_matched: matched,
      expected_topics: inputTopics.size,
      generated_summaries: outputTopics.size,
    };
  },
);

/**
 * Creates an LLM-as-a-judge scorer for evaluating summary quality
 */
export function createLLMJudgeScorer(openaiClient: any) {
  return weave.op(async function llmSummariesJudgeScorer({
    modelOutput,
    datasetRow,
  }: {
    modelOutput: { summaries: Array<{ topicName: string; summary: string }> };
    datasetRow: {
      topics: Array<any>;
    };
  }) {
    if (!modelOutput?.summaries) {
      return {
        llm_judge_score: 0,
        reason: "Missing summaries data",
      };
    }

    const prompt = `You are evaluating the quality of an LLM in generating topic summaries from structured claims and subtopics.

Input Topics with Claims:
${JSON.stringify(datasetRow.topics, null, 2)}

Generated Summaries:
${JSON.stringify(modelOutput.summaries, null, 2)}

Evaluate the quality of the generated summaries. Consider:
1. Comprehensiveness: Do the summaries cover all key subtopics and important claims?
2. Synthesis Quality: Are the summaries well-synthesized narratives or just lists of points?
3. Accuracy: Do the summaries accurately represent the claims without adding information?
4. Conciseness: Are the summaries concise while being comprehensive (ideally under 140 words)?

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
        model: "gpt-4o-mini",
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
      console.log(evaluation);

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
        return {
          llm_judge_score: 0,
          error: error.message,
        };
      } else {
        return {
          llm_judge_score: 0,
          error: String(error),
        };
      }
    }
  });
}

/**
 * Creates a model function for summaries evaluation
 */
export function createSummariesModel(
  openaiClient: any,
  hydratePromptLiterals: Function,
  defaultSummariesPrompt: string,
  systemPrompt: string,
) {
  return weave.op(async function summariesModel(input) {
    const { topics } = input.datasetRow;

    const prompt = hydratePromptLiterals(defaultSummariesPrompt, {
      topics: JSON.stringify(topics, null, 2),
    });

    const response = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const content = response.choices[0].message.content || "{}";
    const parsed = JSON.parse(content);
    return parsed;
  });
}
