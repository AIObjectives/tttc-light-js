import * as weave from "weave";
import { LLMTopic, LLMSubtopic } from "../../schema";

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

      // Check topic description word count (25-30 words)
      const topicWordCount = topic.topicShortDescription
        .trim()
        .split(/\s+/).length;
      if (topicWordCount < 25 || topicWordCount > 30) {
        return {
          valid_json_structure: false,
          error: `Topic description must be 25-30 words: got ${topicWordCount} words`,
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
        // Check subtopic description word count (70-80 words)
        const subtopicWordCount = subtopic.subtopicShortDescription
          .trim()
          .split(/\s+/).length;
        if (subtopicWordCount < 70 || subtopicWordCount > 80) {
          return {
            valid_json_structure: false,
            error: `Subtopic description must be 70-80 words: got ${subtopicWordCount} words`,
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
  datasetRow: { comments: string };
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

/**
 * Creates an LLM-as-a-judge scorer for evaluating quality of the response
 */
export function createLLMJudgeScorer(openaiClient: any) {
  return weave.op(async function llmSemanticSimilarityScorer({
    modelOutput,
    datasetRow,
  }: {
    modelOutput: { taxonomy: LLMTopic[] };
    datasetRow: {
      comments: string;
    };
  }) {
    if (!modelOutput?.taxonomy) {
      return {
        llm_judge_score: 0,
        reason: "Missing taxonomy data",
      };
    }

    const prompt = `You are evaluating the quality of an LLM in creating Topics, subtopics, and descriptions from a list of user comments.

Input Comments:
${datasetRow.comments}

Generated Taxonomy:
${JSON.stringify(modelOutput.taxonomy, null, 2)}

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

    try {
      const response = await openaiClient.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are an expert evaluator of taxonomy quality and semantic similarity. You understand that different wordings can convey the same meaning.",
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
      console.log(evaluation.reasoning);

      return {
        llm_judge_score: evaluation.overall_score || 0,
        topic_coverage_score: evaluation.topic_coverage_score || 0,
        subtopic_coverage_score: evaluation.subtopic_coverage_score || 0,
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
