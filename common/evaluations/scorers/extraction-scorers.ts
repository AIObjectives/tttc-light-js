import * as weave from "weave";
import { LLMClaim } from "../../schema";

// Sample taxonomy for extraction evaluation
export const sampleTaxonomy = {
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
};

// Sample comments and expected extractions
export const sampleExtractionData = {
  input: {
    comment:
      "I love cats because they are independent and low-maintenance pets",
    taxonomy: sampleTaxonomy,
  },
  expectedOutput: {
    claims: [
      {
        claim: "Cats are superior pets due to their independence",
        quote:
          "I love cats because they are independent and low-maintenance pets",
        topicName: "Pets",
        subtopicName: "Cats",
      },
    ],
  },
};

// Additional test cases
export const extractionTestCases = [
  {
    id: "extraction-1",
    comment:
      "I love cats because they are independent and low-maintenance pets",
    taxonomy: sampleTaxonomy,
    expectedClaims: [
      {
        claim: "Cats are superior pets due to their independence",
        quote:
          "I love cats because they are independent and low-maintenance pets",
        topicName: "Pets",
        subtopicName: "Cats",
      },
    ],
  },
  {
    id: "extraction-2",
    comment: "Dogs are amazing companions and I really really love them",
    taxonomy: sampleTaxonomy,
    expectedClaims: [
      {
        claim: "Dogs make excellent companions",
        quote: "Dogs are amazing companions and I really really love them",
        topicName: "Pets",
        subtopicName: "Dogs",
      },
    ],
  },
  {
    id: "extraction-3",
    comment: "I am not sure about birds, they seem difficult to care for",
    taxonomy: sampleTaxonomy,
    expectedClaims: [
      {
        claim: "Birds are challenging pets to maintain",
        quote: "I am not sure about birds, they seem difficult to care for",
        topicName: "Pets",
        subtopicName: "Birds",
      },
    ],
  },
  {
    id: "extraction-4",
    comment: "Today I had a nice walk in the park and saw some flowers",
    taxonomy: sampleTaxonomy,
    expectedClaims: [], // Should extract zero claims - just a description, no debatable position
  },
];

type ExtractionOutput = {
  claims: LLMClaim[];
};

// Scorer for valid JSON structure of extraction output
export const extractionJsonStructureScorer = weave.op(
  function extractionJsonStructureScorer({
    modelOutput,
  }: {
    modelOutput: ExtractionOutput;
  }) {
    try {
      const hasValidStructure =
        modelOutput && modelOutput.claims && Array.isArray(modelOutput.claims);

      if (!hasValidStructure) {
        return {
          valid_json_structure: false,
          error: "Missing or invalid claims array",
        };
      }

      // Check each claim has required fields
      for (const claim of modelOutput.claims) {
        if (
          !claim.claim ||
          !claim.quote ||
          !claim.topicName ||
          !claim.subtopicName
        ) {
          return {
            valid_json_structure: false,
            error: "Invalid claim structure - missing required fields",
          };
        }

        // Check that claim is not empty
        if (claim.claim.trim().length === 0) {
          return {
            valid_json_structure: false,
            error: "Empty claim text",
          };
        }

        // Check that quote is not empty
        if (claim.quote.trim().length === 0) {
          return {
            valid_json_structure: false,
            error: "Empty quote text",
          };
        }
      }

      return {
        valid_json_structure: true,
        claims_count: modelOutput.claims.length,
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

// Scorer for claim quality (checks if claims are debatable, not platitudes)
export const claimQualityScorer = weave.op(function claimQualityScorer({
  modelOutput,
  datasetRow,
}) {
  if (!modelOutput?.claims) {
    return { claim_quality_score: 0, reason: "No claims found" };
  }

  const claims = modelOutput.claims;
  let qualityIssues = [];
  let qualityScore = 1;

  // Check for platitudes or truisms
  const platitudeTerms = [
    "important",
    "good",
    "bad",
    "nice",
    "great",
    "wonderful",
    "terrible",
    "communication is important",
    "we should",
    "people need",
    "it's good to",
  ];

  // Check for non-debatable statements
  const nonDebatablePatterns = [
    /^I (like|love|hate|enjoy|prefer)/i,
    /^(today|yesterday|last week)/i,
    /^(in my opinion|I think|I believe)/i,
  ];

  for (const claim of claims) {
    const claimText = claim.claim.toLowerCase();

    // Check for platitudes
    if (platitudeTerms.some((term) => claimText.includes(term.toLowerCase()))) {
      qualityIssues.push(`Potential platitude: ${claim.claim}`);
      qualityScore -= 0.2;
    }

    // Check for very short claims (likely not substantial)
    if (claim.claim.length < 10) {
      qualityIssues.push(`Claim too short: ${claim.claim}`);
      qualityScore -= 0.15;
    }

    // Check for very long claims (likely not concise)
    if (claim.claim.length > 200) {
      qualityIssues.push(`Claim too long: ${claim.claim.substring(0, 50)}...`);
      qualityScore -= 0.1;
    }

    // Check if claim seems to be just a personal preference without broader principle
    if (nonDebatablePatterns.some((pattern) => pattern.test(claim.claim))) {
      qualityIssues.push(`Non-debatable personal statement: ${claim.claim}`);
      qualityScore -= 0.25;
    }
  }

  return {
    claim_quality_score: Math.max(0, qualityScore),
    quality_issues: qualityIssues,
    issues_count: qualityIssues.length,
    claims_analyzed: claims.length,
  };
});

// Scorer for taxonomy alignment (checks if claims map to valid topics/subtopics)
export const taxonomyAlignmentScorer = weave.op(
  function taxonomyAlignmentScorer({ modelOutput, datasetRow }) {
    if (!modelOutput?.claims) {
      return { taxonomy_alignment_score: 0, reason: "No claims found" };
    }

    if (!datasetRow?.taxonomy) {
      return { taxonomy_alignment_score: 0, reason: "No taxonomy provided" };
    }

    const claims = modelOutput.claims;
    const taxonomy = datasetRow.taxonomy.taxonomy;

    let validMappings = 0;
    let invalidMappings = [];

    for (const claim of claims) {
      let foundValidMapping = false;

      // Check if the topic and subtopic exist in the taxonomy
      for (const topic of taxonomy) {
        if (topic.topicName === claim.topicName) {
          for (const subtopic of topic.subtopics) {
            if (subtopic.subtopicName === claim.subtopicName) {
              foundValidMapping = true;
              break;
            }
          }
          break;
        }
      }

      if (foundValidMapping) {
        validMappings++;
      } else {
        invalidMappings.push({
          claim: claim.claim,
          invalidTopic: claim.topicName,
          invalidSubtopic: claim.subtopicName,
        });
      }
    }

    const alignmentScore =
      claims.length > 0 ? validMappings / claims.length : 1;

    return {
      taxonomy_alignment_score: alignmentScore,
      valid_mappings: validMappings,
      invalid_mappings: invalidMappings.length,
      total_claims: claims.length,
      invalid_mapping_details: invalidMappings,
    };
  },
);

// Scorer for quote relevance (checks if quotes support the claims)
export const quoteRelevanceScorer = weave.op(function quoteRelevanceScorer({
  modelOutput,
  datasetRow,
}) {
  if (!modelOutput?.claims) {
    return { quote_relevance_score: 0, reason: "No claims found" };
  }

  const claims = modelOutput.claims;
  const originalComment = datasetRow?.comment || "";

  let relevantQuotes = 0;
  let quoteIssues = [];

  for (const claim of claims) {
    let issuesWithThisQuote = [];

    // Check if quote exists in original comment (allowing for [...] ellipsis)
    const cleanQuote = claim.quote.replace(/\[\.\.\.\]/g, "").trim();
    const quoteWords = cleanQuote
      .split(/\s+/)
      .filter((word: string) => word.length > 2);

    // Check if most quote words appear in the original comment
    const matchingWords = quoteWords.filter((word: string) =>
      originalComment.toLowerCase().includes(word.toLowerCase()),
    );

    const wordMatchRatio =
      quoteWords.length > 0 ? matchingWords.length / quoteWords.length : 0;

    if (wordMatchRatio < 0.7) {
      issuesWithThisQuote.push("Quote does not closely match original comment");
    }

    // Check if quote is too short (likely not supportive enough)
    if (claim.quote.length < 10) {
      issuesWithThisQuote.push("Quote too short to support claim");
    }

    // Check if quote is just a repetition of the claim
    const claimWords = claim.claim.toLowerCase().split(/\s+/);
    const quoteWords2 = claim.quote.toLowerCase().split(/\s+/);
    const overlap = claimWords.filter((word: string) =>
      quoteWords2.includes(word),
    ).length;
    const overlapRatio =
      claimWords.length > 0 ? overlap / claimWords.length : 0;

    if (overlapRatio > 0.8) {
      issuesWithThisQuote.push(
        "Quote is too similar to claim (likely circular)",
      );
    }

    if (issuesWithThisQuote.length === 0) {
      relevantQuotes++;
    } else {
      quoteIssues.push({
        claim: claim.claim,
        quote: claim.quote,
        issues: issuesWithThisQuote,
      });
    }
  }

  const relevanceScore = claims.length > 0 ? relevantQuotes / claims.length : 1;

  return {
    quote_relevance_score: relevanceScore,
    relevant_quotes: relevantQuotes,
    total_quotes: claims.length,
    quote_issues: quoteIssues,
  };
});

// Scorer for extraction completeness (compares against expected claims)
export const extractionCompletenessScorer = weave.op(
  function extractionCompletenessScorer({ modelOutput, datasetRow }) {
    if (!datasetRow?.expectedClaims) {
      return {
        extraction_completeness_score: 1,
        reason: "No expected claims to compare against",
      };
    }

    const extractedClaims = modelOutput?.claims || [];
    const expectedClaims = datasetRow.expectedClaims;

    if (expectedClaims.length === 0) {
      // If we expect zero claims, score based on whether model extracted zero
      return {
        extraction_completeness_score: extractedClaims.length === 0 ? 1 : 0,
        expected_zero_claims: true,
        extracted_claims_count: extractedClaims.length,
      };
    }

    let matchedClaims = 0;
    let claimMatches = [];

    // Simple semantic matching - check for key concept overlap
    for (const expected of expectedClaims) {
      let bestMatch = null;
      let bestScore = 0;

      for (const extracted of extractedClaims) {
        // Check topic/subtopic match
        const topicMatch = extracted.topicName === expected.topicName;
        const subtopicMatch = extracted.subtopicName === expected.subtopicName;

        // Check semantic similarity of claim text
        const expectedWords = expected.claim.toLowerCase().split(/\s+/);
        const extractedWords = extracted.claim.toLowerCase().split(/\s+/);
        const commonWords = expectedWords.filter((word: string) =>
          extractedWords.includes(word),
        );
        const semanticScore =
          commonWords.length /
          Math.max(expectedWords.length, extractedWords.length);

        const overallScore =
          (topicMatch ? 0.4 : 0) +
          (subtopicMatch ? 0.3 : 0) +
          semanticScore * 0.3;

        if (overallScore > bestScore && overallScore > 0.5) {
          bestScore = overallScore;
          bestMatch = extracted;
        }
      }

      if (bestMatch) {
        matchedClaims++;
        claimMatches.push({
          expected: expected.claim,
          matched: bestMatch.claim,
          score: bestScore,
        });
      }
    }

    const completenessScore =
      expectedClaims.length > 0 ? matchedClaims / expectedClaims.length : 1;

    return {
      extraction_completeness_score: completenessScore,
      matched_claims: matchedClaims,
      expected_claims: expectedClaims.length,
      extracted_claims: extractedClaims.length,
      claim_matches: claimMatches,
    };
  },
);

// Helper function to create an extraction model
export function createExtractionModel(
  openaiClient: any,
  hydratePromptLiterals: Function,
  defaultExtractionPrompt: string,
  systemPrompt: string,
) {
  return weave.op(async function extractionModel(input) {
    const hydratedPrompt = hydratePromptLiterals(defaultExtractionPrompt, {
      comment: input.datasetRow.comment,
      taxonomy: JSON.stringify(input.datasetRow.taxonomy, null, 2),
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
