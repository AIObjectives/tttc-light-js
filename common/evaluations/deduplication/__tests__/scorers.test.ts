import type { OpenAI } from "openai";
import { describe, expect, it, vi } from "vitest";
import { EVAL_MODEL } from "../../constants";
import { deduplicationTestCases } from "../datasets";
import {
  claimCoverageScorer,
  consolidationScorer,
  createLLMJudgeScorer,
  deduplicationJsonStructureScorer,
  groupClaimQualityScorer,
} from "../scorers";
import type {
  DeduplicationDatasetRow,
  DeduplicationModelOutput,
} from "../types.js";

// Mock weave.op to return the function directly for testing
vi.mock("weave", () => ({
  op: vi.fn((fn) => fn),
  wrapOpenAI: vi.fn(),
  Dataset: vi.fn(),
  Evaluation: vi.fn(),
  init: vi.fn(),
}));

describe("Deduplication Scorers", () => {
  // dummyData is used to fill type requirements for the scorers, but is not used for any comparisons
  const dummyData = {
    id: "test-data-1",
    claims: "this is a list of claims",
  };
  describe("deduplicationJsonStructureScorer", () => {
    it("should return valid structure for correct groupedClaims format", () => {
      const validModelOutput = {
        groupedClaims: [
          {
            claimText: "Parking access and affordability need improvement",
            originalClaimIds: ["claim1", "claim2", "claim3"],
          },
        ],
      };

      const result = deduplicationJsonStructureScorer({
        modelOutput: validModelOutput,
        datasetRow: dummyData,
      });

      expect(result.valid_json_structure).toBe(true);
      expect(result.groups_count).toBe(1);
      expect(result.total_claims_referenced).toBe(3);
    });

    it("should accept empty groupedClaims array", () => {
      const validModelOutput = {
        groupedClaims: [],
      };

      const result = deduplicationJsonStructureScorer({
        modelOutput: validModelOutput,
        datasetRow: dummyData,
      });

      expect(result.valid_json_structure).toBe(true);
      expect(result.groups_count).toBe(0);
    });

    it("should reject missing groupedClaims property", () => {
      const invalidModelOutput = {};

      const result = deduplicationJsonStructureScorer({
        modelOutput: invalidModelOutput as any,
        datasetRow: dummyData,
      });

      expect(result.valid_json_structure).toBe(false);
      expect(result.reason).toBe("Missing or invalid groupedClaims array");
    });

    it("should reject group with missing required fields", () => {
      const invalidModelOutput = {
        groupedClaims: [
          {
            claimText: "Some claim",
            // Missing originalClaimIds
          },
        ],
      };

      const result = deduplicationJsonStructureScorer({
        modelOutput: invalidModelOutput as any,
        datasetRow: dummyData,
      });

      expect(result.valid_json_structure).toBe(false);
      expect(result.reason).toBe(
        "Invalid group structure - missing required fields",
      );
    });

    it("should reject empty claimText", () => {
      const invalidModelOutput = {
        groupedClaims: [
          {
            claimText: "   ",
            originalClaimIds: ["claim1"],
          },
        ],
      };

      const result = deduplicationJsonStructureScorer({
        modelOutput: invalidModelOutput,
        datasetRow: dummyData,
      });

      expect(result.valid_json_structure).toBe(false);
      expect(result.reason).toBe("Empty claimText");
    });

    it("should reject empty originalClaimIds array", () => {
      const invalidModelOutput = {
        groupedClaims: [
          {
            claimText: "Some claim",
            originalClaimIds: [],
          },
        ],
      };

      const result = deduplicationJsonStructureScorer({
        modelOutput: invalidModelOutput,
        datasetRow: dummyData,
      });

      expect(result.valid_json_structure).toBe(false);
      expect(result.reason).toBe("Empty originalClaimIds array");
    });

    it("should reject non-array originalClaimIds", () => {
      const invalidModelOutput = {
        groupedClaims: [
          {
            claimText: "Some claim",
            originalClaimIds: "claim1",
          },
        ],
      };

      const result = deduplicationJsonStructureScorer({
        modelOutput: invalidModelOutput as any,
        datasetRow: { id: "test", claims: "" },
      });

      expect(result.valid_json_structure).toBe(false);
      expect(result.reason).toBe("originalClaimIds must be an array");
    });
  });

  describe("claimCoverageScorer", () => {
    it("should score perfect coverage as 1.0", () => {
      const modelOutput: DeduplicationModelOutput = {
        groupedClaims: [
          {
            claimText: "Parking needs improvement",
            originalClaimIds: ["claim1", "claim2"],
          },
          {
            claimText: "Transit should be expanded",
            originalClaimIds: ["claim3"],
          },
        ],
      };

      const datasetRow: DeduplicationDatasetRow = {
        id: "test-1",
        claims: `ID: claim1
Claim: Parking is expensive
Quote: Too expensive

ID: claim2
Claim: Parking is confusing
Quote: Hard to navigate

ID: claim3
Claim: Need better transit
Quote: More buses needed`,
      };

      const result = claimCoverageScorer({ modelOutput, datasetRow });

      expect(result.claim_coverage_score).toBe(1);
      expect(result.missing_claims).toEqual([]);
      expect(result.extra_claims).toEqual([]);
    });

    it("should detect missing claims", () => {
      const modelOutput: DeduplicationModelOutput = {
        groupedClaims: [
          {
            claimText: "Parking needs improvement",
            originalClaimIds: ["claim1"],
          },
        ],
      };

      const datasetRow: DeduplicationDatasetRow = {
        id: "test-2",
        claims: `ID: claim1
Claim: Parking is expensive
Quote: Too expensive

ID: claim2
Claim: Parking is confusing
Quote: Hard to navigate`,
      };

      const result = claimCoverageScorer({ modelOutput, datasetRow });

      expect(result.claim_coverage_score).toBe(0.5);
      expect(result.missing_claims).toEqual(["claim2"]);
      expect(result.extra_claims).toEqual([]);
    });

    it("should detect extra claims", () => {
      const modelOutput: DeduplicationModelOutput = {
        groupedClaims: [
          {
            claimText: "Parking needs improvement",
            originalClaimIds: ["claim1", "claim2", "claim999"],
          },
        ],
      };

      const datasetRow: DeduplicationDatasetRow = {
        id: "test-3",
        claims: `ID: claim1
Claim: Parking is expensive
Quote: Too expensive

ID: claim2
Claim: Parking is confusing
Quote: Hard to navigate`,
      };

      const result = claimCoverageScorer({ modelOutput, datasetRow });

      expect(result.claim_coverage_score).toBe(0.5);
      expect(result.missing_claims).toEqual([]);
      expect(result.extra_claims).toEqual(["claim999"]);
    });

    it("should handle missing input claims", () => {
      const modelOutput: DeduplicationModelOutput = {
        groupedClaims: [
          {
            claimText: "Some claim",
            originalClaimIds: ["claim1"],
          },
        ],
      };

      const result = claimCoverageScorer({
        modelOutput,
        datasetRow: { id: "test-4", claims: "" },
      });

      expect(result.claim_coverage_score).toBe(0);
      expect(result.reason).toBe("No input claims provided");
    });
  });

  describe("consolidationScorer", () => {
    it("should score appropriate consolidation as 1.0", () => {
      const modelOutput: DeduplicationModelOutput = {
        groupedClaims: [
          {
            claimText: "Parking needs improvement",
            originalClaimIds: ["claim1", "claim2", "claim3"],
          },
          {
            claimText: "Transit should be expanded",
            originalClaimIds: ["claim4"],
          },
        ],
      };

      const datasetRow: DeduplicationDatasetRow = {
        id: "test-5",
        claims: `ID: claim1
Claim: Claim 1
Quote: Quote 1

ID: claim2
Claim: Claim 2
Quote: Quote 2

ID: claim3
Claim: Claim 3
Quote: Quote 3

ID: claim4
Claim: Claim 4
Quote: Quote 4`,
      };

      const result = consolidationScorer({ modelOutput, datasetRow });

      expect(result.consolidation_score).toBeGreaterThan(0.8);
      expect(result.consolidation_issues).toEqual([]);
    });

    it("should detect over-consolidation", () => {
      const modelOutput: DeduplicationModelOutput = {
        groupedClaims: [
          {
            claimText: "Everything needs improvement",
            originalClaimIds: [
              "claim1",
              "claim2",
              "claim3",
              "claim4",
              "claim5",
            ],
          },
        ],
      };

      const datasetRow: DeduplicationDatasetRow = {
        id: "test-6",
        claims: `ID: claim1
Claim: Claim 1
Quote: Quote 1

ID: claim2
Claim: Claim 2
Quote: Quote 2

ID: claim3
Claim: Claim 3
Quote: Quote 3

ID: claim4
Claim: Claim 4
Quote: Quote 4

ID: claim5
Claim: Claim 5
Quote: Quote 5`,
      };

      const result = consolidationScorer({ modelOutput, datasetRow });

      expect(result.consolidation_score).toBeLessThan(1);
      expect(result.consolidation_issues).toContain(
        "Over-consolidated: Too few groups for the input diversity",
      );
    });

    it("should detect under-consolidation", () => {
      const modelOutput: DeduplicationModelOutput = {
        groupedClaims: [
          {
            claimText: "Claim 1",
            originalClaimIds: ["claim1"],
          },
          {
            claimText: "Claim 2",
            originalClaimIds: ["claim2"],
          },
          {
            claimText: "Claim 3",
            originalClaimIds: ["claim3"],
          },
          {
            claimText: "Claim 4",
            originalClaimIds: ["claim4"],
          },
        ],
      };

      const datasetRow: DeduplicationDatasetRow = {
        id: "test-7",
        claims: `ID: claim1
Claim: Claim 1
Quote: Quote 1

ID: claim2
Claim: Claim 2
Quote: Quote 2

ID: claim3
Claim: Claim 3
Quote: Quote 3

ID: claim4
Claim: Claim 4
Quote: Quote 4`,
      };

      const result = consolidationScorer({ modelOutput, datasetRow });

      expect(result.consolidation_score).toBeLessThan(1);
      expect(result.consolidation_issues).toContain(
        "Under-consolidated: Too many single-claim groups",
      );
    });
  });

  describe("groupClaimQualityScorer", () => {
    it("should score high-quality group claims as 1.0", () => {
      const modelOutput: DeduplicationModelOutput = {
        groupedClaims: [
          {
            claimText:
              "Parking fees create financial barriers for downtown workers",
            originalClaimIds: ["claim1", "claim2"],
          },
        ],
      };

      const result = groupClaimQualityScorer({
        modelOutput,
        datasetRow: { id: "test", claims: "" },
      });

      expect(result.group_claim_quality_score).toBe(1);
      expect(result.quality_issues).toEqual([]);
    });

    it("should detect platitudes", () => {
      const modelOutput: DeduplicationModelOutput = {
        groupedClaims: [
          {
            claimText: "Parking should be improved",
            originalClaimIds: ["claim1", "claim2"],
          },
        ],
      };

      const result = groupClaimQualityScorer({
        modelOutput,
        datasetRow: { id: "test", claims: "" },
      });

      expect(result.group_claim_quality_score).toBeLessThan(1);
      expect(result.quality_issues![0]).toContain("Potential platitude");
    });

    it("should detect generic language", () => {
      const modelOutput: DeduplicationModelOutput = {
        groupedClaims: [
          {
            claimText: "Parking issues need to be addressed",
            originalClaimIds: ["claim1", "claim2"],
          },
        ],
      };

      const result = groupClaimQualityScorer({
        modelOutput,
        datasetRow: dummyData,
      });

      expect(result.group_claim_quality_score).toBeLessThan(1);
      expect(
        result.quality_issues!.some((issue: string) =>
          issue.includes("Generic language"),
        ),
      ).toBe(true);
    });

    it("should detect claims that are too short", () => {
      const modelOutput: DeduplicationModelOutput = {
        groupedClaims: [
          {
            claimText: "Parking bad",
            originalClaimIds: ["claim1"],
          },
        ],
      };

      const result = groupClaimQualityScorer({
        modelOutput,
        datasetRow: dummyData,
      });

      expect(result.group_claim_quality_score).toBeLessThan(1);
      expect(result.quality_issues![0]).toContain("Claim too short");
    });

    it("should detect claims that are too long", () => {
      const longClaim = "A".repeat(200);
      const modelOutput: DeduplicationModelOutput = {
        groupedClaims: [
          {
            claimText: longClaim,
            originalClaimIds: ["claim1"],
          },
        ],
      };

      const result = groupClaimQualityScorer({
        modelOutput,
        datasetRow: dummyData,
      });

      expect(result.group_claim_quality_score).toBeLessThan(1);
      expect(result.quality_issues![0]).toContain("Claim too long");
    });
  });

  describe("Sample Data", () => {
    it("should have valid deduplication test cases", () => {
      expect(Array.isArray(deduplicationTestCases)).toBe(true);
      expect(deduplicationTestCases.length).toBeGreaterThan(0);

      for (const testCase of deduplicationTestCases) {
        expect(testCase).toHaveProperty("id");
        expect(testCase).toHaveProperty("claims");
        expect(typeof testCase.claims).toBe("string");
      }
    });
  });

  describe("createLLMJudgeScorer", () => {
    it("should return 0 when groupedClaims data is missing", async () => {
      const mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn(),
          },
        },
      } as unknown as OpenAI;

      const llmJudgeScorer = createLLMJudgeScorer(mockOpenAI);

      const result = await llmJudgeScorer({
        modelOutput: {} as any,
        datasetRow: {
          id: "test",
          claims: `ID: 1
Claim: Test claim
Quote: Test quote`,
        },
      });

      expect(result.llm_judge_score).toBe(0);
      expect(result.error).toBe("Missing grouped claims data");
      expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
    });

    it("should call OpenAI with correct prompt and return parsed evaluation", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                grouping_accuracy_score: 0.92,
                separation_quality_score: 0.88,
                consolidated_claim_quality_score: 0.95,
                completeness_score: 0.91,
                overall_score: 0.91,
                reasoning:
                  "Claims are well grouped with appropriate consolidation",
              }),
            },
          },
        ],
      };

      const mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue(mockResponse),
          },
        },
      } as unknown as OpenAI;

      const llmJudgeScorer = createLLMJudgeScorer(mockOpenAI);

      const modelOutput: DeduplicationModelOutput = {
        groupedClaims: [
          {
            claimText: "Parking access needs improvement",
            originalClaimIds: ["1", "2"],
          },
        ],
      };

      const datasetRow: DeduplicationDatasetRow = {
        id: "test",
        claims: `ID: 1
Claim: Parking fees are too expensive
Quote: I can't afford parking

ID: 2
Claim: We need more parking spaces
Quote: There's never enough parking`,
      };

      const result = await llmJudgeScorer({ modelOutput, datasetRow });

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: EVAL_MODEL,
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "system" }),
          expect.objectContaining({ role: "user" }),
        ]),
        response_format: { type: "json_object" },
      });

      expect(result.llm_judge_score).toBe(0.91);
      expect(result.grouping_accuracy_score).toBe(0.92);
      expect(result.separation_quality_score).toBe(0.88);
      expect(result.consolidated_claim_quality_score).toBe(0.95);
      expect(result.completeness_score).toBe(0.91);
      expect(result.reasoning).toBe(
        "Claims are well grouped with appropriate consolidation",
      );
    });

    it("should handle OpenAI API errors gracefully", async () => {
      const mockOpenAI = {
        chat: {
          completions: {
            create: vi
              .fn()
              .mockRejectedValue(new Error("Service temporarily unavailable")),
          },
        },
      } as unknown as OpenAI;

      const llmJudgeScorer = createLLMJudgeScorer(mockOpenAI);

      const result = await llmJudgeScorer({
        modelOutput: {
          groupedClaims: [
            {
              claimText: "Test",
              originalClaimIds: ["1"],
            },
          ],
        },
        datasetRow: dummyData,
      });

      expect(result.llm_judge_score).toBe(0);
      expect(result.error).toBe("Service temporarily unavailable");
    });

    it("should handle empty response content", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: null,
            },
          },
        ],
      };

      const mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn().mockResolvedValue(mockResponse),
          },
        },
      } as unknown as OpenAI;

      const llmJudgeScorer = createLLMJudgeScorer(mockOpenAI);

      const result = await llmJudgeScorer({
        modelOutput: {
          groupedClaims: [
            {
              claimText: "Test",
              originalClaimIds: ["1"],
            },
          ],
        },
        datasetRow: dummyData,
      });

      expect(result.llm_judge_score).toBe(0);
      expect(result.error).toBe("No response from LLM judge");
    });
  });
});
