import * as weave from "weave";
import type { OpenAI } from "openai";
import { EVAL_MODEL } from "../constants";

type CruxOutput = {
  crux: {
    cruxClaim: string;
    agree: string[];
    disagree: string[];
    explanation: string;
  };
};

// Scorer for valid JSON structure of crux output
export const cruxJsonStructureScorer = weave.op(
  function cruxJsonStructureScorer({
    modelOutput,
  }: {
    modelOutput: CruxOutput;
  }) {
    try {
      const hasValidStructure =
        modelOutput && modelOutput.crux && typeof modelOutput.crux === "object";

      if (!hasValidStructure) {
        return {
          valid_json_structure: false,
          error: "Missing or invalid crux object",
        };
      }

      const crux = modelOutput.crux;

      // Check required fields exist
      if (!crux.cruxClaim || typeof crux.cruxClaim !== "string") {
        return {
          valid_json_structure: false,
          error: "Missing or invalid cruxClaim",
        };
      }

      if (!Array.isArray(crux.agree)) {
        return {
          valid_json_structure: false,
          error: "Missing or invalid agree array",
        };
      }

      if (!Array.isArray(crux.disagree)) {
        return {
          valid_json_structure: false,
          error: "Missing or invalid disagree array",
        };
      }

      if (!crux.explanation || typeof crux.explanation !== "string") {
        return {
          valid_json_structure: false,
          error: "Missing or invalid explanation",
        };
      }

      // Check that cruxClaim is not empty
      if (crux.cruxClaim.trim().length === 0) {
        return {
          valid_json_structure: false,
          error: "Empty cruxClaim text",
        };
      }

      // Check that explanation is not empty
      if (crux.explanation.trim().length === 0) {
        return {
          valid_json_structure: false,
          error: "Empty explanation text",
        };
      }

      return {
        valid_json_structure: true,
        agree_count: crux.agree.length,
        disagree_count: crux.disagree.length,
        total_participants: crux.agree.length + crux.disagree.length,
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        return { valid_json_structure: false, error: error.message };
      } else {
        return { valid_json_structure: false, error: String(error) };
      }
    }
  },
);

// Scorer for explanation quality (checks if reasoning is clear and comprehensive)
export const explanationQualityScorer = weave.op(
  function explanationQualityScorer({ modelOutput }) {
    if (!modelOutput?.crux?.explanation) {
      return { explanation_quality_score: 0, error: "No explanation found" };
    }

    const explanation = modelOutput.crux.explanation;
    let qualityScore = 1;
    let qualityIssues = [];

    // Check if explanation is too short
    if (explanation.length < 30) {
      qualityIssues.push("Explanation is too brief");
      qualityScore -= 0.4;
    }

    // Check if explanation is too long
    if (explanation.length > 500) {
      qualityIssues.push("Explanation is overly verbose");
      qualityScore -= 0.2;
    }

    // Check if explanation references the participants
    const crux = modelOutput.crux;
    const allParticipants = [...crux.agree, ...crux.disagree];
    let referencedParticipants = 0;

    for (const participant of allParticipants) {
      if (explanation.includes(participant)) {
        referencedParticipants++;
      }
    }

    if (referencedParticipants === 0 && allParticipants.length > 0) {
      qualityIssues.push("Explanation doesn't reference any participants");
      qualityScore -= 0.3;
    }

    // Check if explanation addresses why participants would disagree
    const reasoningKeywords = [
      "while",
      "whereas",
      "however",
      "although",
      "but",
      "in contrast",
    ];
    const hasContrastiveReasoning = reasoningKeywords.some((keyword) =>
      explanation.toLowerCase().includes(keyword.toLowerCase()),
    );

    if (!hasContrastiveReasoning && crux.disagree.length > 0) {
      qualityIssues.push(
        "Explanation lacks contrastive reasoning (why sides differ)",
      );
      qualityScore -= 0.2;
    }

    return {
      explanation_quality_score: Math.max(0, qualityScore),
      quality_issues: qualityIssues,
      issues_count: qualityIssues.length,
      explanation_length: explanation.length,
      participants_referenced: referencedParticipants,
      total_participants: allParticipants.length,
    };
  },
);

/**
 * Creates an LLM-as-a-judge scorer for evaluating crux identification quality
 */
export function createLLMJudgeScorer(openaiClient: OpenAI) {
  return weave.op(async function llmCruxJudgeScorer({
    modelOutput,
    datasetRow,
  }: {
    modelOutput: CruxOutput;
    datasetRow: {
      topic: string;
      topicDescription: string;
      subtopic: string;
      subtopicDescription: string;
      participantClaims: Array<{ participant: string; claims: string[] }>;
    };
  }) {
    if (!modelOutput?.crux) {
      return {
        llm_judge_score: 0,
        error: "Missing crux data",
      };
    }

    // Format the participant claims for the prompt
    const participantClaimsText = datasetRow.participantClaims
      .map((p) => {
        const claimsText = p.claims.map((c) => `  - ${c}`).join("\n");
        return `${p.participant}:\n${claimsText}`;
      })
      .join("\n\n");

    const prompt = `You are evaluating the quality of an LLM's ability to identify the crux of disagreement in a conversation.

Topic: ${datasetRow.topic}
Description: ${datasetRow.topicDescription}
Subtopic: ${datasetRow.subtopic}
Subtopic Description: ${datasetRow.subtopicDescription}

Participant Claims:
${participantClaimsText}

Generated Crux:
${JSON.stringify(modelOutput.crux, null, 2)}

Evaluate the quality of the crux identification. Consider:
1. Crux Quality: Is the crux claim truly the central point of disagreement? Is it specific and debatable?
2. Participant Assignment Accuracy: Are participants correctly assigned to agree/disagree based on their claims?
3. Explanation Quality: Does the explanation clearly articulate why participants agree or disagree with the crux?
4. Completeness: Are all participants accounted for? Does it capture the main disagreement?

Provide your evaluation as a JSON object with:
- crux_quality_score: 0-1 score for how well the crux claim captures the central disagreement
- assignment_accuracy_score: 0-1 score for correctness of participant assignments
- explanation_quality_score: 0-1 score for clarity and completeness of explanation
- completeness_score: 0-1 score for how comprehensively it covers participants and disagreement
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
              "You are an expert evaluator of argumentation and discourse analysis. You understand how to assess whether a crux claim accurately identifies the central point of disagreement in a conversation.",
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

      return {
        llm_judge_score: evaluation.overall_score || 0,
        crux_quality_score: evaluation.crux_quality_score || 0,
        assignment_accuracy_score: evaluation.assignment_accuracy_score || 0,
        explanation_quality_score: evaluation.explanation_quality_score || 0,
        completeness_score: evaluation.completeness_score || 0,
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

// Helper function to create a crux model
export function createCruxModel(
  openaiClient: OpenAI,
  hydratePromptLiterals: Function,
  defaultCruxPrompt: string,
  systemPrompt: string,
) {
  return weave.op(async function cruxModel(input) {
    // Format participant claims for the prompt
    const participantClaimsText = input.datasetRow.participantClaims
      .map((p: any) => {
        const claimsText = p.claims.map((c: string) => `  - ${c}`).join("\n");
        return `${p.participant}:\n${claimsText}`;
      })
      .join("\n\n");

    const topicInfo = `Topic: ${input.datasetRow.topic}
Description: ${input.datasetRow.topicDescription}
Subtopic: ${input.datasetRow.subtopic}
Subtopic Description: ${input.datasetRow.subtopicDescription}`;

    const promptData = `${topicInfo}

Participants and their claims:
${participantClaimsText}`;

    const hydratedPrompt = hydratePromptLiterals(defaultCruxPrompt, {
      topic: promptData,
    });

    const response = await openaiClient.chat.completions.create({
      model: EVAL_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: hydratedPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
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
