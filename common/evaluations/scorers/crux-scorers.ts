import * as weave from "weave";
import { SubtopicCrux } from "../../schema";

// Sample participant claims for crux evaluation
export const sampleParticipantClaims = [
  {
    participant: "Person 1",
    claims: [
      "Government intervention in healthcare is necessary to ensure universal coverage",
      "Private insurance companies prioritize profits over patient care",
    ],
  },
  {
    participant: "Person 2",
    claims: [
      "Market-based healthcare solutions are more efficient than government programs",
      "Individual choice in healthcare is essential for quality outcomes",
    ],
  },
  {
    participant: "Person 3",
    claims: [
      "Healthcare is a fundamental right that should be guaranteed to all citizens",
      "Current healthcare costs are unsustainable for middle-class families",
    ],
  },
];

// Sample topic and subtopic for testing
export const sampleTopicData = {
  topic: "Healthcare Reform",
  topicDescription: "Views on healthcare policy and access",
  subtopic: "Universal Coverage",
  subtopicDescription:
    "Perspectives on whether government should guarantee healthcare for all",
};

// Test cases for crux evaluation
export const cruxTestCases = [
  {
    id: "crux-1",
    topic: sampleTopicData.topic,
    topicDescription: sampleTopicData.topicDescription,
    subtopic: sampleTopicData.subtopic,
    subtopicDescription: sampleTopicData.subtopicDescription,
    participantClaims: sampleParticipantClaims,
    expectedCrux: {
      topic: "Healthcare Reform",
      subtopic: "Universal Coverage",
      cruxClaim:
        "Government should guarantee healthcare coverage for all citizens",
      agree: ["Person 1", "Person 3"],
      disagree: ["Person 2"],
      explanation:
        "Person 1 and Person 3 advocate for government intervention and universal healthcare access, while Person 2 supports market-based solutions and individual choice",
    },
  },
  {
    id: "crux-2",
    topic: "Climate Policy",
    topicDescription: "Views on climate change and environmental regulation",
    subtopic: "Carbon Pricing",
    subtopicDescription:
      "Perspectives on carbon taxes and cap-and-trade systems",
    participantClaims: [
      {
        participant: "A",
        claims: [
          "Carbon taxes are necessary to incentivize emission reductions",
          "The cost of climate inaction outweighs the economic burden of regulation",
        ],
      },
      {
        participant: "B",
        claims: [
          "Carbon pricing will harm economic competitiveness",
          "Market innovation, not taxation, should drive emission reductions",
        ],
      },
      {
        participant: "C",
        claims: [
          "We need aggressive carbon pricing to meet climate targets",
          "Industry lobbying has blocked effective climate policy for too long",
        ],
      },
    ],
    expectedCrux: {
      topic: "Climate Policy",
      subtopic: "Carbon Pricing",
      cruxClaim:
        "Carbon pricing mechanisms should be implemented to reduce emissions",
      agree: ["A", "C"],
      disagree: ["B"],
      explanation:
        "A and C support carbon pricing as a necessary climate policy tool, while B opposes it due to economic concerns",
    },
  },
];

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
        return { valid_json_structure: false, error: error };
      }
    }
  },
);

// Scorer for participant coverage (checks if all participants are assigned)
export const participantCoverageScorer = weave.op(
  function participantCoverageScorer({ modelOutput, datasetRow }) {
    if (!modelOutput?.crux) {
      return { participant_coverage_score: 0, reason: "No crux found" };
    }

    if (!datasetRow?.participantClaims) {
      return {
        participant_coverage_score: 0,
        reason: "No participant claims provided",
      };
    }

    const crux = modelOutput.crux;
    const allParticipants = datasetRow.participantClaims.map(
      (p: any) => p.participant,
    );
    const assignedParticipants = [
      ...new Set([...crux.agree, ...crux.disagree]),
    ];

    let coveredParticipants = 0;
    let uncoveredParticipants = [];

    for (const participant of allParticipants) {
      if (assignedParticipants.includes(participant)) {
        coveredParticipants++;
      } else {
        uncoveredParticipants.push(participant);
      }
    }

    const coverageScore =
      allParticipants.length > 0
        ? coveredParticipants / allParticipants.length
        : 1;

    return {
      participant_coverage_score: coverageScore,
      covered_participants: coveredParticipants,
      total_participants: allParticipants.length,
      uncovered_participants: uncoveredParticipants,
    };
  },
);

// Scorer for crux claim quality (checks if it's specific, debatable, and clear)
export const cruxClaimQualityScorer = weave.op(function cruxClaimQualityScorer({
  modelOutput,
}) {
  if (!modelOutput?.crux?.cruxClaim) {
    return { crux_claim_quality_score: 0, reason: "No crux claim found" };
  }

  const cruxClaim = modelOutput.crux.cruxClaim;
  let qualityScore = 1;
  let qualityIssues = [];

  // Check if claim is too vague or platitudinous
  const vagueTerms = [
    "should improve",
    "should be better",
    "is important",
    "we need to consider",
    "should think about",
  ];

  for (const term of vagueTerms) {
    if (cruxClaim.toLowerCase().includes(term.toLowerCase())) {
      qualityIssues.push(`Claim contains vague language: "${term}"`);
      qualityScore -= 0.2;
    }
  }

  // Check if claim is too short (likely not specific enough)
  if (cruxClaim.length < 20) {
    qualityIssues.push("Claim is too short to be specific");
    qualityScore -= 0.3;
  }

  // Check if claim is too long (likely not concise)
  if (cruxClaim.length > 200) {
    qualityIssues.push("Claim is too long, should be more concise");
    qualityScore -= 0.2;
  }

  // Check if claim is actually a question
  if (cruxClaim.trim().endsWith("?")) {
    qualityIssues.push("Claim is a question, not a statement");
    qualityScore -= 0.4;
  }

  // Check if claim contains hedging language that weakens it
  const hedgingTerms = ["maybe", "perhaps", "might", "could possibly"];
  for (const term of hedgingTerms) {
    if (cruxClaim.toLowerCase().includes(term.toLowerCase())) {
      qualityIssues.push(`Claim contains hedging language: "${term}"`);
      qualityScore -= 0.15;
    }
  }

  return {
    crux_claim_quality_score: Math.max(0, qualityScore),
    quality_issues: qualityIssues,
    issues_count: qualityIssues.length,
    claim_length: cruxClaim.length,
  };
});

// Scorer for controversy balance (checks if crux actually splits participants)
export const controversyBalanceScorer = weave.op(
  function controversyBalanceScorer({ modelOutput }) {
    if (!modelOutput?.crux) {
      return { controversy_balance_score: 0, reason: "No crux found" };
    }

    const crux = modelOutput.crux;
    const agreeCount = crux.agree.length;
    const disagreeCount = crux.disagree.length;
    const totalCount = agreeCount + disagreeCount;

    if (totalCount === 0) {
      return {
        controversy_balance_score: 0,
        reason: "No participants assigned to either side",
      };
    }

    // Calculate how balanced the split is (1.0 = perfect 50/50 split)
    const agreeRatio = agreeCount / totalCount;
    const disagreeRatio = disagreeCount / totalCount;
    const controversyScore = Math.min(agreeRatio, disagreeRatio) * 2;

    let balanceAssessment = "";
    if (controversyScore >= 0.8) {
      balanceAssessment = "Excellent balance - very controversial";
    } else if (controversyScore >= 0.6) {
      balanceAssessment = "Good balance - reasonably controversial";
    } else if (controversyScore >= 0.4) {
      balanceAssessment = "Moderate imbalance";
    } else {
      balanceAssessment = "Poor balance - too one-sided";
    }

    return {
      controversy_balance_score: controversyScore,
      agree_count: agreeCount,
      disagree_count: disagreeCount,
      agree_ratio: agreeRatio,
      disagree_ratio: disagreeRatio,
      balance_assessment: balanceAssessment,
    };
  },
);

// Scorer for explanation quality (checks if reasoning is clear and comprehensive)
export const explanationQualityScorer = weave.op(
  function explanationQualityScorer({ modelOutput }) {
    if (!modelOutput?.crux?.explanation) {
      return { explanation_quality_score: 0, reason: "No explanation found" };
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

// Scorer for alignment with expected output
export const cruxAlignmentScorer = weave.op(function cruxAlignmentScorer({
  modelOutput,
  datasetRow,
}) {
  if (!datasetRow?.expectedCrux) {
    return {
      crux_alignment_score: 1,
      reason: "No expected crux to compare against",
    };
  }

  if (!modelOutput?.crux) {
    return { crux_alignment_score: 0, reason: "No crux found in output" };
  }

  const actualCrux = modelOutput.crux;
  const expectedCrux = datasetRow.expectedCrux;

  let alignmentScore = 0;
  let alignmentDetails = [];

  // Check topic/subtopic match
  const topicMatch = actualCrux.topic === expectedCrux.topic;
  const subtopicMatch = actualCrux.subtopic === expectedCrux.subtopic;

  if (topicMatch && subtopicMatch) {
    alignmentScore += 0.2;
    alignmentDetails.push("Topic and subtopic match");
  }

  // Check semantic similarity of crux claim
  const expectedWords = expectedCrux.cruxClaim.toLowerCase().split(/\s+/);
  const actualWords = actualCrux.cruxClaim.toLowerCase().split(/\s+/);
  const commonWords = expectedWords.filter((word: string) =>
    actualWords.includes(word),
  );
  const claimSimilarity =
    commonWords.length / Math.max(expectedWords.length, actualWords.length);

  alignmentScore += claimSimilarity * 0.4;
  alignmentDetails.push(
    `Claim semantic similarity: ${(claimSimilarity * 100).toFixed(1)}%`,
  );

  // Check if agree/disagree groups roughly match
  const expectedAgreeSet = new Set(expectedCrux.agree);
  const actualAgreeSet = new Set(actualCrux.agree);
  const agreeOverlap = [...expectedAgreeSet].filter((p) =>
    actualAgreeSet.has(p),
  ).length;
  const agreeScore =
    expectedCrux.agree.length > 0
      ? agreeOverlap / expectedCrux.agree.length
      : 1;

  const expectedDisagreeSet = new Set(expectedCrux.disagree);
  const actualDisagreeSet = new Set(actualCrux.disagree);
  const disagreeOverlap = [...expectedDisagreeSet].filter((p) =>
    actualDisagreeSet.has(p),
  ).length;
  const disagreeScore =
    expectedCrux.disagree.length > 0
      ? disagreeOverlap / expectedCrux.disagree.length
      : 1;

  const participantAlignmentScore = (agreeScore + disagreeScore) / 2;
  alignmentScore += participantAlignmentScore * 0.4;
  alignmentDetails.push(
    `Participant alignment: ${(participantAlignmentScore * 100).toFixed(1)}%`,
  );

  return {
    crux_alignment_score: alignmentScore,
    alignment_details: alignmentDetails,
    claim_similarity: claimSimilarity,
    participant_alignment: participantAlignmentScore,
    agree_overlap: agreeOverlap,
    disagree_overlap: disagreeOverlap,
  };
});

// Helper function to create a crux model
export function createCruxModel(
  openaiClient: any,
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
