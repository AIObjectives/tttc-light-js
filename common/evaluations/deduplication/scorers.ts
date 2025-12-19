import type { OpenAI } from "openai";
import * as weave from "weave";
import { logger } from "../../logger";
import { EVAL_MODEL } from "../constants";
import type {
  Claim,
  ClaimCoverageScorerOutput,
  DeduplicationConsolidationScorerOutput,
  DeduplicationGroupClaimQualityScorerOutput,
  DeduplicationJsonStructureScorerOutput,
  DeduplicationLLMJudgeOutput,
  DeduplicationScorerInput,
  GroupedClaim,
  LLMJudgeScorerFunction,
} from "./types";

const evaluationLogger = logger.child({ module: "evaluations" });

/**
 * Scorer for valid JSON structure of deduplication output
 * Validates that the model output conforms to the expected schema with required fields
 * @param input - The scorer input containing model output and dataset row
 * @returns Validation results with structure validity and counts
 */
export const deduplicationJsonStructureScorer = weave.op(
  function deduplicationJsonStructureScorer({
    modelOutput,
  }: DeduplicationScorerInput): DeduplicationJsonStructureScorerOutput {
    try {
      const hasValidStructure =
        modelOutput?.groupedClaims && Array.isArray(modelOutput.groupedClaims);

      if (!hasValidStructure) {
        return {
          valid_json_structure: false,
          reason: "Missing or invalid groupedClaims array",
        };
      }

      // Check each grouped claim has required fields
      for (const group of modelOutput.groupedClaims) {
        if (!group.claimText || !group.originalClaimIds) {
          return {
            valid_json_structure: false,
            reason: "Invalid group structure - missing required fields",
          };
        }

        if (!Array.isArray(group.originalClaimIds)) {
          return {
            valid_json_structure: false,
            reason: "originalClaimIds must be an array",
          };
        }

        if (group.claimText.trim().length === 0) {
          return {
            valid_json_structure: false,
            reason: "Empty claimText",
          };
        }

        if (group.originalClaimIds.length === 0) {
          return {
            valid_json_structure: false,
            reason: "Empty originalClaimIds array",
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
        evaluationLogger.error(
          { error },
          `An error occured while evaluating the json structure of the deduplication response: ${error.message}`,
        );
        return {
          valid_json_structure: false,
          reason: "System Error",
          error: error.message,
        };
      } else {
        evaluationLogger.error(
          `An error occured while evaluating the json structure of the deduplication response: ${String(error)}`,
        );
        return {
          valid_json_structure: false,
          reason: "System Error",
          error: String(error),
        };
      }
    }
  },
);

/**
 * Parses a formatted claims string back into structured claims array
 * Expects claims in format with "ID:", "Claim:", and "Quote:" lines separated by blank lines
 * @param claimsString - The formatted claims string to parse
 * @returns Array of structured claim objects
 */
function parseClaimsFromString(claimsString: string): Array<Claim> {
  const claimBlocks = claimsString
    .split("\n\n")
    .filter((block) => block.trim());

  return claimBlocks.map((block) => {
    const lines = block.split("\n");
    const idLine = lines.find((line) => line.startsWith("ID: "));
    const claimLine = lines.find((line) => line.startsWith("Claim: "));
    const quoteLine = lines.find((line) => line.startsWith("Quote: "));

    return {
      claimId: idLine?.replace("ID: ", "").trim() || "",
      claimText: claimLine?.replace("Claim: ", "").trim() || "",
      quoteText: quoteLine?.replace("Quote: ", "").trim() || "",
    };
  });
}

/**
 * Evaluates how well the coverage of consolidated claims is
 * Checks that all input claims are referenced and no extra claims are added
 * @param input - The scorer input containing model output and dataset row
 * @returns Coverage metrics including missing and extra claims
 */
export const claimCoverageScorer = weave.op(function claimCoverageScorer({
  modelOutput,
  datasetRow,
}: DeduplicationScorerInput): ClaimCoverageScorerOutput {
  if (!modelOutput?.groupedClaims) {
    return { claim_coverage_score: 0, reason: "No grouped claims found" };
  }

  if (!datasetRow?.claims) {
    return { claim_coverage_score: 0, reason: "No input claims provided" };
  }

  const inputClaims = parseClaimsFromString(datasetRow.claims);

  const inputClaimIds = new Set<string>(
    inputClaims.map((claim: Claim) => claim.claimId),
  );
  const referencedClaimIds = new Set<string>();

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

/**
 * Scorer for consolidation effectiveness
 * Checks if appropriate consolidation occurred, avoiding over/under-consolidation
 * @param input - The scorer input containing model output and dataset row
 * @returns Consolidation metrics and identified issues
 */
export const consolidationScorer = weave.op(function consolidationScorer({
  modelOutput,
  datasetRow,
}: DeduplicationScorerInput): DeduplicationConsolidationScorerOutput {
  if (!modelOutput?.groupedClaims) {
    return { consolidation_score: 0, reason: "No grouped claims found" };
  }

  if (!datasetRow?.claims) {
    return { consolidation_score: 0, reason: "No input claims provided" };
  }

  const inputClaims = parseClaimsFromString(datasetRow.claims);
  const inputClaimsCount = inputClaims.length;
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
  const issues = [];

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

/**
 * Scorer for group claim quality
 * Checks if group claims are well-written, specific, and avoid platitudes
 * @param input - The scorer input containing model output and dataset row
 * @returns Quality metrics and identified issues
 */
export const groupClaimQualityScorer = weave.op(
  function groupClaimQualityScorer({
    modelOutput,
  }: DeduplicationScorerInput): DeduplicationGroupClaimQualityScorerOutput {
    if (!modelOutput?.groupedClaims) {
      return {
        group_claim_quality_score: 0,
        reason: "No grouped claims found",
      };
    }

    const groups = modelOutput.groupedClaims;
    const qualityIssues = [];
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
 * Populates the evaluation prompt for the LLM judge
 * Creates a formatted prompt with input claims and grouped output for evaluation
 * @param input - The scorer input containing model output and dataset row
 * @returns Formatted prompt string for LLM evaluation
 */
function populatePrompt({
  modelOutput,
  datasetRow,
}: DeduplicationScorerInput): string {
  return `You are evaluating the quality of an LLM in deduplicating and grouping similar claims together.

Input Claims:
${datasetRow.claims}

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
}

/**
 * Creates an LLM-as-a-judge scorer for evaluating deduplication quality
 * Uses an LLM to evaluate grouping accuracy, separation quality, and completeness
 * @param openaiClient - The OpenAI client instance to use for LLM evaluation
 * @returns A weave operation that performs LLM-based evaluation
 */
export function createLLMJudgeScorer(
  openaiClient: OpenAI,
): weave.Op<LLMJudgeScorerFunction> {
  return weave.op(async function llmDeduplicationJudgeScorer({
    modelOutput,
    datasetRow,
  }: DeduplicationScorerInput): Promise<DeduplicationLLMJudgeOutput> {
    if (!modelOutput?.groupedClaims) {
      return {
        llm_judge_score: 0,
        error: "Missing grouped claims data",
      };
    }

    try {
      const response = await openaiClient.chat.completions.create({
        model: EVAL_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are an expert evaluator of claim deduplication and grouping quality. You understand semantic similarity and can identify when claims express the same underlying idea.",
          },
          {
            role: "user",
            content: populatePrompt({ modelOutput, datasetRow }),
          },
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
        grouping_accuracy_score: evaluation.grouping_accuracy_score || 0,
        separation_quality_score: evaluation.separation_quality_score || 0,
        consolidated_claim_quality_score:
          evaluation.consolidated_claim_quality_score || 0,
        completeness_score: evaluation.completeness_score || 0,
        reasoning: evaluation.reasoning || "",
      };
    } catch (error: unknown) {
      if (error instanceof Error) {
        evaluationLogger.error(
          { error },
          `Error encountered while running Deduplication LLM Judge: ${error.message}`,
        );
        return {
          llm_judge_score: 0,
          error: error.message,
        };
      } else {
        evaluationLogger.error(
          `Error encountered while running Deduplication LLM Judge: ${String(error)}`,
        );
        return {
          llm_judge_score: 0,
          error: String(error),
        };
      }
    }
  });
}
