import * as weave from "weave";
import { TopicSummary } from "../../apiPyserver";

// Sample taxonomy and claims for summaries evaluation
export const sampleTopicsData = [
  {
    topicName: "Pets",
    topicShortDescription: "General attitudes and preferences about pets",
    subtopics: [
      {
        subtopicName: "Cats",
        subtopicShortDescription: "Opinions and experiences with cats as pets",
        claims: [
          { claimText: "Cats are independent and low-maintenance pets" },
          { claimText: "Cats provide emotional support and companionship" },
        ],
      },
      {
        subtopicName: "Dogs",
        subtopicShortDescription: "Opinions and experiences with dogs as pets",
        claims: [
          { claimText: "Dogs require significant time and attention" },
          { claimText: "Dogs are loyal and protective companions" },
        ],
      },
    ],
  },
];

// Test cases for summaries evaluation
export const summariesTestCases = [
  {
    topics: sampleTopicsData,
    expectedSummaries: [
      {
        topicName: "Pets",
        summary:
          "Participants expressed diverse views on pet ownership. Regarding cats, people appreciated their independence and low-maintenance nature, while also valuing the emotional support they provide. Dog owners highlighted the significant time commitment required but emphasized the loyalty and protective nature of dogs as companions.",
      },
    ],
  },
];

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
