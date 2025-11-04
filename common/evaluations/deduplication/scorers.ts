import * as weave from "weave";

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

/**
 * Creates an LLM-as-a-judge scorer for evaluating deduplication quality
 */
export function createLLMJudgeScorer(openaiClient: any) {
  return weave.op(async function llmDeduplicationJudgeScorer({
    modelOutput,
    datasetRow,
  }: {
    modelOutput: DeduplicationOutput;
    datasetRow: {
      claims: Array<{
        claimId: string;
        claimText: string;
        quoteText: string;
      }>;
    };
  }) {
    if (!modelOutput?.groupedClaims) {
      return {
        llm_judge_score: 0,
        reason: "Missing grouped claims data",
      };
    }

    const inputClaimsString = datasetRow.claims
      .map(
        (claim) =>
          `ID: ${claim.claimId}\nClaim: ${claim.claimText}\nQuote: ${claim.quoteText}`,
      )
      .join("\n\n");

    const prompt = `You are evaluating the quality of an LLM in deduplicating and grouping similar claims together.

Input Claims:
${inputClaimsString}

Grouped Output:
${JSON.stringify(modelOutput.groupedClaims, null, 2)}

Evaluate the quality of the deduplication and grouping. Consider:
1. Grouping Accuracy: Are semantically similar claims correctly grouped together?
2. Separation Quality: Are distinct/unrelated claims kept in separate groups?
3. Consolidated Claim Quality: Are the group claim texts well-written, specific, and representative of the grouped claims?
4. Completeness: Are all input claims properly accounted for in the output?

Provide your evaluation as a JSON object with:
- grouping_accuracy_score: 0-1 score for how well similar claims are grouped together
- separation_quality_score: 0-1 score for keeping distinct claims separate
- consolidated_claim_quality_score: 0-1 score for quality of the consolidated claim texts
- completeness_score: 0-1 score for whether all claims are properly referenced
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
              "You are an expert evaluator of claim deduplication and grouping quality. You understand semantic similarity and can identify when claims express the same underlying idea.",
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
        grouping_accuracy_score: evaluation.grouping_accuracy_score || 0,
        separation_quality_score: evaluation.separation_quality_score || 0,
        consolidated_claim_quality_score:
          evaluation.consolidated_claim_quality_score || 0,
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
