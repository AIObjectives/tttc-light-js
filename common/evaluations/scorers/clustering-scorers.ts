import * as weave from "weave";
import { LLMTopic, LLMSubtopic } from "../../schema";

// Sample comments for clustering evaluation - Pet preferences data
export const sampleComments = `I love cats
I really really love dogs
I am not sure about birds`;

// Sample input data with expected results for evaluation
export const sampleClusteringData = {
  input: {
    comments: sampleComments,
  },
  expectedOutput: {
    taxonomy: [
      {
        topicName: "Pets",
        topicShortDescription: "Views on various pets",
        subtopics: [
          {
            subtopicName: "Cats",
            subtopicShortDescription:
              "Positive feelings and appreciation for cats",
          },
          {
            subtopicName: "Dogs",
            subtopicShortDescription:
              "Strong affection for dogs, indicated by enthusiastic comments",
          },
          {
            subtopicName: "Birds",
            subtopicShortDescription:
              "Uncertainty or mixed feelings regarding keeping birds as pets",
          },
        ],
      },
    ],
  },
};

// Scorer for valid JSON structure
export const jsonStructureScorer = weave.op(function jsonStructureScorer({
  modelOutput,
}: {
  modelOutput: { taxonomy: LLMTopic[] };
}) {
  try {
    const hasValidStructure =
      modelOutput &&
      modelOutput.taxonomy &&
      Array.isArray(modelOutput.taxonomy) &&
      modelOutput.taxonomy.length > 0;

    if (!hasValidStructure) {
      return {
        valid_json_structure: false,
        error: "Missing or invalid taxonomy array",
      };
    }

    // Check each topic has required fields
    for (const topic of modelOutput.taxonomy) {
      if (
        !topic.topicName ||
        !topic.topicShortDescription ||
        !Array.isArray(topic.subtopics)
      ) {
        return {
          valid_json_structure: false,
          error: "Invalid topic structure",
        };
      }

      // Check topic description length
      if (topic.topicShortDescription.length > 30) {
        return {
          valid_json_structure: false,
          error: `Topic description too long: ${topic.topicShortDescription.length} chars`,
        };
      }

      // Check subtopics
      for (const subtopic of topic.subtopics) {
        if (!subtopic.subtopicName || !subtopic.subtopicShortDescription) {
          return {
            valid_json_structure: false,
            error: "Invalid subtopic structure",
          };
        }
        if (subtopic.subtopicShortDescription.length > 140) {
          return {
            valid_json_structure: false,
            error: `Subtopic description too long: ${subtopic.subtopicShortDescription.length} chars`,
          };
        }
      }
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
      return { valid_json_structure: false, error: error.message };
    } else {
      return { valid_json_structure: false, error: error };
    }
  }
});

// Scorer for topic coverage quality
export const topicCoverageScorer = weave.op(function topicCoverageScorer({
  modelOutput,
  datasetRow,
}: {
  modelOutput: { taxonomy: LLMTopic[] };
  datasetRow: { comments: string; expectedTaxonomy?: { taxonomy: LLMTopic[] } };
}) {
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

// Scorer for content quality (checks for meaningful, non-generic topics)
export const contentQualityScorer = weave.op(function contentQualityScorer({
  modelOutput,
  datasetRow,
}: {
  modelOutput: { taxonomy: LLMTopic[] };
  datasetRow: { comments: string; expectedTaxonomy?: { taxonomy: LLMTopic[] } };
}) {
  if (!modelOutput?.taxonomy) {
    return { content_quality_score: 0, reason: "No taxonomy found" };
  }

  const topics = modelOutput.taxonomy;
  let qualityIssues = [];
  let qualityScore = 1;

  // Check for generic or vague topic names
  const genericTerms = [
    "other",
    "miscellaneous",
    "general",
    "various",
    "different",
    "topic",
    "category",
  ];

  for (const topic of topics) {
    const topicNameLower = topic.topicName.toLowerCase();

    // Check for generic terms
    if (genericTerms.some((term) => topicNameLower.includes(term))) {
      qualityIssues.push(`Generic topic name: ${topic.topicName}`);
      qualityScore -= 0.2;
    }

    // Check for very short or very long topic names
    if (topic.topicName.length < 3) {
      qualityIssues.push(`Topic name too short: ${topic.topicName}`);
      qualityScore -= 0.1;
    }

    if (topic.topicName.length > 50) {
      qualityIssues.push(`Topic name too long: ${topic.topicName}`);
      qualityScore -= 0.1;
    }

    // Check subtopic quality
    for (const subtopic of topic.subtopics) {
      if (subtopic.subtopicName.length < 3) {
        qualityIssues.push(`Subtopic name too short: ${subtopic.subtopicName}`);
        qualityScore -= 0.05;
      }

      if (
        genericTerms.some((term) =>
          subtopic.subtopicName.toLowerCase().includes(term),
        )
      ) {
        qualityIssues.push(`Generic subtopic name: ${subtopic.subtopicName}`);
        qualityScore -= 0.1;
      }
    }
  }

  return {
    content_quality_score: Math.max(0, qualityScore),
    quality_issues: qualityIssues,
    issues_count: qualityIssues.length,
  };
});

// Scorer for semantic similarity against expected results
export const semanticSimilarityScorer = weave.op(
  function semanticSimilarityScorer({
    modelOutput,
    datasetRow,
  }: {
    modelOutput: { taxonomy: LLMTopic[] };
    datasetRow: {
      comments: string;
      expectedTaxonomy: { taxonomy: LLMTopic[] };
    };
  }) {
    if (!modelOutput?.taxonomy || !datasetRow?.expectedTaxonomy) {
      return { semantic_similarity_score: 0, reason: "Missing taxonomy data" };
    }

    const modelTopics = modelOutput.taxonomy;
    const expectedTopics = datasetRow.expectedTaxonomy.taxonomy;

    let topicMatches = 0;
    let subtopicMatches = 0;
    let totalExpectedTopics = expectedTopics.length;
    let totalExpectedSubtopics = expectedTopics.reduce(
      (sum: number, topic: LLMTopic) => sum + topic.subtopics.length,
      0,
    );

    // Check topic coverage
    for (const expectedTopic of expectedTopics) {
      const matchingTopic = modelTopics.find(
        (topic: LLMTopic) =>
          topic.topicName
            .toLowerCase()
            .includes(expectedTopic.topicName.toLowerCase()) ||
          expectedTopic.topicName
            .toLowerCase()
            .includes(topic.topicName.toLowerCase()) ||
          // Check for semantic similarity in descriptions
          (topic.topicShortDescription &&
            expectedTopic.topicShortDescription &&
            topic.topicShortDescription
              .toLowerCase()
              .includes(expectedTopic.topicShortDescription.toLowerCase())) ||
          (expectedTopic.topicShortDescription &&
            topic.topicShortDescription &&
            expectedTopic.topicShortDescription
              .toLowerCase()
              .includes(topic.topicShortDescription.toLowerCase())),
      );

      if (matchingTopic) {
        topicMatches++;

        // Check subtopic coverage within matching topics
        for (const expectedSubtopic of expectedTopic.subtopics) {
          const matchingSubtopic = matchingTopic.subtopics.find(
            (subtopic: LLMSubtopic) =>
              subtopic.subtopicName
                .toLowerCase()
                .includes(expectedSubtopic.subtopicName.toLowerCase()) ||
              expectedSubtopic.subtopicName
                .toLowerCase()
                .includes(subtopic.subtopicName.toLowerCase()) ||
              // Check for key terms overlap
              (subtopic.subtopicShortDescription &&
                expectedSubtopic.subtopicShortDescription &&
                hasKeyTermOverlap(
                  subtopic.subtopicShortDescription,
                  expectedSubtopic.subtopicShortDescription,
                )),
          );

          if (matchingSubtopic) {
            subtopicMatches++;
          }
        }
      }
    }

    const topicCoverage = topicMatches / totalExpectedTopics;
    const subtopicCoverage =
      totalExpectedSubtopics > 0 ? subtopicMatches / totalExpectedSubtopics : 0;
    const overallSimilarity = (topicCoverage + subtopicCoverage) / 2;

    return {
      semantic_similarity_score: overallSimilarity,
      topic_coverage: topicCoverage,
      subtopic_coverage: subtopicCoverage,
      topics_matched: topicMatches,
      subtopics_matched: subtopicMatches,
      expected_topics: totalExpectedTopics,
      expected_subtopics: totalExpectedSubtopics,
    };
  },
);

// Helper function to check key term overlap
function hasKeyTermOverlap(text1: string, text2: string): boolean {
  const getKeyTerms = (text: string) =>
    text
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .filter(
        (word) =>
          ![
            "this",
            "that",
            "with",
            "from",
            "they",
            "have",
            "been",
            "will",
            "such",
            "other",
          ].includes(word),
      );

  const terms1 = getKeyTerms(text1);
  const terms2 = getKeyTerms(text2);

  const commonTerms = terms1.filter((term) => terms2.includes(term));
  return (
    commonTerms.length >= 2 ||
    (commonTerms.length >= 1 && Math.min(terms1.length, terms2.length) <= 3)
  );
}

// Helper function to create a clustering model using the defaultClusteringPrompt
export function createClusteringModel(
  openaiClient: any,
  hydratePromptLiterals: (
    template: string,
    variables: Record<string, string>,
  ) => string,
  defaultClusteringPrompt: string,
  systemPrompt: string,
) {
  return weave.op(async function clusteringModel(input: {
    datasetRow: { comments: string };
  }) {
    const hydratedPrompt = hydratePromptLiterals(defaultClusteringPrompt, {
      comments: input.datasetRow.comments,
    });

    const response = await openaiClient.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: hydratedPrompt },
      ],
      response_format: { type: "json_object" },
    });

    const result = response.choices[0].message.content;
    if (result == null) {
      throw new Error("No response from model");
    }

    try {
      return JSON.parse(result);
    } catch (e) {
      throw new Error(`Failed to parse JSON response: ${result}`);
    }
  });
}
