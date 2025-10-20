import * as weave from "weave";

// Sample claims for deduplication evaluation
export const sampleDeduplicationData = {
  input: {
    claims: [
      {
        claimId: "claim1",
        claimText: "Parking fees are too expensive for downtown workers",
        quoteText: "I can't afford to pay $20 a day for parking",
      },
      {
        claimId: "claim2",
        claimText: "The parking pass system is confusing and hard to navigate",
        quoteText:
          "I spent an hour trying to figure out how to buy a monthly pass",
      },
      {
        claimId: "claim3",
        claimText: "We need more parking spaces in the downtown area",
        quoteText:
          "I drive around for 30 minutes every morning looking for a spot",
      },
      {
        claimId: "claim4",
        claimText: "Public transit should be expanded to reduce car dependency",
        quoteText:
          "If we had better bus routes, people wouldn't need to drive downtown",
      },
    ],
  },
  expectedOutput: {
    groupedClaims: [
      {
        claimText: "Parking access and affordability need improvement",
        originalClaimIds: ["claim1", "claim2", "claim3"],
      },
      {
        claimText: "Public transit should be expanded to reduce car dependency",
        originalClaimIds: ["claim4"],
      },
    ],
  },
};

// Test cases for deduplication evaluation
export const deduplicationTestCases = [
  {
    id: "dedup-1",
    claims: [
      {
        claimId: "claim1",
        claimText: "Parking fees are too expensive for downtown workers",
        quoteText: "I can't afford to pay $20 a day for parking",
      },
      {
        claimId: "claim2",
        claimText: "The parking pass system is confusing and hard to navigate",
        quoteText:
          "I spent an hour trying to figure out how to buy a monthly pass",
      },
      {
        claimId: "claim3",
        claimText: "We need more parking spaces in the downtown area",
        quoteText:
          "I drive around for 30 minutes every morning looking for a spot",
      },
    ],
    expectedGroups: [
      {
        claimText: "Parking access and affordability need improvement",
        originalClaimIds: ["claim1", "claim2", "claim3"],
      },
    ],
  },
  {
    id: "dedup-2",
    claims: [
      {
        claimId: "claim1",
        claimText: "We should prioritize renewable energy investments",
        quoteText: "Solar and wind power are the future",
      },
      {
        claimId: "claim2",
        claimText: "The city should ban single-use plastic bags",
        quoteText: "Plastic bags are harming our environment",
      },
    ],
    expectedGroups: [
      {
        claimText: "We should prioritize renewable energy investments",
        originalClaimIds: ["claim1"],
      },
      {
        claimText: "The city should ban single-use plastic bags",
        originalClaimIds: ["claim2"],
      },
    ],
  },
  {
    id: "dedup-3",
    claims: [
      {
        claimId: "claim1",
        claimText: "The library should have longer hours on weekends",
        quoteText: "I work weekdays and can only visit on Saturday",
      },
      {
        claimId: "claim2",
        claimText: "Library hours should be extended in the evening",
        quoteText: "The library closes too early for working parents",
      },
      {
        claimId: "claim3",
        claimText: "We need more library staff to help with research",
        quoteText:
          "There's never anyone available when I need help finding books",
      },
    ],
    expectedGroups: [
      {
        claimText:
          "Library hours should be extended to better serve working people",
        originalClaimIds: ["claim1", "claim2"],
      },
      {
        claimText: "We need more library staff to help with research",
        originalClaimIds: ["claim3"],
      },
    ],
  },
];

type GroupedClaim = {
  claimText: string;
  originalClaimIds: Array<string>;
};

type DeduplicationOutput = {
  groupedClaims: Array<GroupedClaim>;
};

// Scorer for valid JSON structure of deduplication output
export const deduplicationJsonStructureScorer = weave.op(
  function deduplicationJsonStructureScorer({
    modelOutput,
  }: {
    modelOutput: DeduplicationOutput;
  }) {
    try {
      const hasValidStructure =
        modelOutput &&
        modelOutput.groupedClaims &&
        Array.isArray(modelOutput.groupedClaims);

      if (!hasValidStructure) {
        return {
          valid_json_structure: false,
          error: "Missing or invalid groupedClaims array",
        };
      }

      // Check each grouped claim has required fields
      for (const group of modelOutput.groupedClaims) {
        if (!group.claimText || !group.originalClaimIds) {
          return {
            valid_json_structure: false,
            error: "Invalid group structure - missing required fields",
          };
        }

        if (!Array.isArray(group.originalClaimIds)) {
          return {
            valid_json_structure: false,
            error: "originalClaimIds must be an array",
          };
        }

        if (group.claimText.trim().length === 0) {
          return {
            valid_json_structure: false,
            error: "Empty claimText",
          };
        }

        if (group.originalClaimIds.length === 0) {
          return {
            valid_json_structure: false,
            error: "Empty originalClaimIds array",
          };
        }
      }

      return {
        valid_json_structure: true,
        groups_count: modelOutput.groupedClaims.length,
        total_claims_referenced: modelOutput.groupedClaims.reduce(
          (sum, group) => sum + group.originalClaimIds.length,
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
  },
);

// Scorer for claim coverage (ensures all input claims are accounted for)
export const claimCoverageScorer = weave.op(function claimCoverageScorer({
  modelOutput,
  datasetRow,
}) {
  if (!modelOutput?.groupedClaims) {
    return { claim_coverage_score: 0, reason: "No grouped claims found" };
  }

  if (!datasetRow?.claims) {
    return { claim_coverage_score: 0, reason: "No input claims provided" };
  }

  const inputClaimIds = new Set(
    datasetRow.claims.map((claim: any) => claim.claimId),
  );
  const referencedClaimIds = new Set();

  // Collect all referenced claim IDs
  for (const group of modelOutput.groupedClaims) {
    for (const claimId of group.originalClaimIds) {
      referencedClaimIds.add(claimId);
    }
  }

  const missingClaims = Array.from(inputClaimIds).filter(
    (id) => !referencedClaimIds.has(id),
  );
  const extraClaims = Array.from(referencedClaimIds).filter(
    (id) => !inputClaimIds.has(id),
  );

  const coverageScore =
    missingClaims.length === 0 && extraClaims.length === 0
      ? 1
      : Math.max(
          0,
          1 - (missingClaims.length + extraClaims.length) / inputClaimIds.size,
        );

  return {
    claim_coverage_score: coverageScore,
    missing_claims: missingClaims,
    extra_claims: extraClaims,
    total_input_claims: inputClaimIds.size,
    total_referenced_claims: referencedClaimIds.size,
  };
});

// Scorer for grouping quality (checks if similar claims are grouped and different ones are separate)
export const groupingQualityScorer = weave.op(function groupingQualityScorer({
  modelOutput,
  datasetRow,
}) {
  if (!modelOutput?.groupedClaims) {
    return { grouping_quality_score: 0, reason: "No grouped claims found" };
  }

  if (!datasetRow?.expectedGroups) {
    return {
      grouping_quality_score: 1,
      reason: "No expected groups to compare against",
    };
  }

  const actualGroups = modelOutput.groupedClaims;
  const expectedGroups = datasetRow.expectedGroups;

  let correctGroupings = 0;
  let totalComparisons = 0;

  // For each expected group, check if the model grouped those claims together
  for (const expectedGroup of expectedGroups) {
    // Find if there's an actual group that contains all these claims
    let foundMatchingGroup = false;
    for (const actualGroup of actualGroups) {
      const actualClaimIds = new Set(actualGroup.originalClaimIds);

      // Check if this actual group contains all expected claims
      const hasAllExpectedClaims = expectedGroup.originalClaimIds.every(
        (id: string) => actualClaimIds.has(id),
      );

      if (hasAllExpectedClaims) {
        foundMatchingGroup = true;
        break;
      }
    }

    if (foundMatchingGroup) {
      correctGroupings++;
    }
    totalComparisons++;
  }

  const qualityScore =
    totalComparisons > 0 ? correctGroupings / totalComparisons : 1;

  return {
    grouping_quality_score: qualityScore,
    correct_groupings: correctGroupings,
    total_expected_groups: totalComparisons,
    actual_groups_count: actualGroups.length,
    expected_groups_count: expectedGroups.length,
  };
});

// Scorer for consolidation effectiveness (checks if appropriate consolidation occurred)
export const consolidationScorer = weave.op(function consolidationScorer({
  modelOutput,
  datasetRow,
}) {
  if (!modelOutput?.groupedClaims) {
    return { consolidation_score: 0, reason: "No grouped claims found" };
  }

  if (!datasetRow?.claims) {
    return { consolidation_score: 0, reason: "No input claims provided" };
  }

  const inputClaimsCount = datasetRow.claims.length;
  const outputGroupsCount = modelOutput.groupedClaims.length;

  // Calculate consolidation ratio
  const consolidationRatio = outputGroupsCount / inputClaimsCount;

  // Check for over-consolidation (too few groups)
  const overConsolidated = consolidationRatio < 0.3 && inputClaimsCount > 3;

  // Check for under-consolidation (too many single-claim groups)
  const singleClaimGroups = modelOutput.groupedClaims.filter(
    (group: GroupedClaim) => group.originalClaimIds.length === 1,
  ).length;
  const singleClaimRatio = singleClaimGroups / outputGroupsCount;
  const underConsolidated = singleClaimRatio > 0.7 && inputClaimsCount > 3;

  let consolidationScore = 1;
  let issues = [];

  if (overConsolidated) {
    consolidationScore -= 0.4;
    issues.push("Over-consolidated: Too few groups for the input diversity");
  }

  if (underConsolidated) {
    consolidationScore -= 0.3;
    issues.push("Under-consolidated: Too many single-claim groups");
  }

  // Bonus for appropriate consolidation (2-4 claims per group on average)
  const avgClaimsPerGroup = inputClaimsCount / outputGroupsCount;
  if (avgClaimsPerGroup >= 2 && avgClaimsPerGroup <= 4) {
    consolidationScore = Math.min(1, consolidationScore + 0.1);
  }

  return {
    consolidation_score: Math.max(0, consolidationScore),
    consolidation_ratio: consolidationRatio,
    input_claims_count: inputClaimsCount,
    output_groups_count: outputGroupsCount,
    single_claim_groups: singleClaimGroups,
    consolidation_issues: issues,
    avg_claims_per_group: avgClaimsPerGroup,
  };
});

// Scorer for group claim quality (checks if group claims are well-written)
export const groupClaimQualityScorer = weave.op(
  function groupClaimQualityScorer({ modelOutput, datasetRow }) {
    if (!modelOutput?.groupedClaims) {
      return {
        group_claim_quality_score: 0,
        reason: "No grouped claims found",
      };
    }

    const groups = modelOutput.groupedClaims;
    let qualityIssues = [];
    let qualityScore = 1;

    // Check for vague platitudes
    const platitudeTerms = [
      "improve",
      "better",
      "enhance",
      "optimize",
      "address",
      "deal with",
      "handle",
      "more effective",
      "needs attention",
    ];

    // Check for overly generic language
    const genericPatterns = [
      /should be improved/i,
      /needs to be better/i,
      /requires attention/i,
      /issues need to be addressed/i,
    ];

    for (const group of groups) {
      const claimText = group.claimText.toLowerCase();

      // Check for platitudes
      if (
        platitudeTerms.some((term) => claimText.includes(term.toLowerCase()))
      ) {
        qualityIssues.push(`Potential platitude: ${group.claimText}`);
        qualityScore -= 0.15;
      }

      // Check for generic language
      if (genericPatterns.some((pattern) => pattern.test(group.claimText))) {
        qualityIssues.push(`Generic language: ${group.claimText}`);
        qualityScore -= 0.2;
      }

      // Check for very short claims (likely not substantial)
      if (group.claimText.length < 20) {
        qualityIssues.push(`Claim too short: ${group.claimText}`);
        qualityScore -= 0.1;
      }

      // Check for very long claims (likely not concise)
      if (group.claimText.length > 150) {
        qualityIssues.push(
          `Claim too long: ${group.claimText.substring(0, 50)}...`,
        );
        qualityScore -= 0.1;
      }
    }

    return {
      group_claim_quality_score: Math.max(0, qualityScore),
      quality_issues: qualityIssues,
      issues_count: qualityIssues.length,
      groups_analyzed: groups.length,
    };
  },
);

// Helper function to create a deduplication model
export function createDeduplicationModel(
  openaiClient: any,
  hydratePromptLiterals: Function,
  defaultDedupPrompt: string,
  systemPrompt: string,
) {
  return weave.op(async function deduplicationModel(input) {
    const claimsString = input.datasetRow.claims
      .map(
        (claim: any) =>
          `ID: ${claim.claimId}\nClaim: ${claim.claimText}\nQuote: ${claim.quoteText}`,
      )
      .join("\n\n");

    const hydratedPrompt = hydratePromptLiterals(defaultDedupPrompt, {
      claims: claimsString,
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
