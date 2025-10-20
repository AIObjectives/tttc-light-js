import { describe, it, expect, vi } from "vitest";
import {
  deduplicationJsonStructureScorer,
  claimCoverageScorer,
  groupingQualityScorer,
  consolidationScorer,
  groupClaimQualityScorer,
  deduplicationTestCases,
} from "./deduplication-scorers.js";

// Mock weave.op to return the function directly for testing
vi.mock("weave", () => ({
  op: vi.fn((fn) => fn),
  wrapOpenAI: vi.fn(),
  Dataset: vi.fn(),
  Evaluation: vi.fn(),
  init: vi.fn(),
}));

describe("Deduplication Scorers", () => {
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
      });

      expect(result.valid_json_structure).toBe(true);
      expect(result.groups_count).toBe(0);
    });

    it("should reject missing groupedClaims property", () => {
      const invalidModelOutput = {};

      const result = deduplicationJsonStructureScorer({
        modelOutput: invalidModelOutput,
      });

      expect(result.valid_json_structure).toBe(false);
      expect(result.error).toBe("Missing or invalid groupedClaims array");
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
        modelOutput: invalidModelOutput,
      });

      expect(result.valid_json_structure).toBe(false);
      expect(result.error).toBe(
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
      });

      expect(result.valid_json_structure).toBe(false);
      expect(result.error).toBe("Empty claimText");
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
      });

      expect(result.valid_json_structure).toBe(false);
      expect(result.error).toBe("Empty originalClaimIds array");
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
        modelOutput: invalidModelOutput,
      });

      expect(result.valid_json_structure).toBe(false);
      expect(result.error).toBe("originalClaimIds must be an array");
    });
  });

  describe("claimCoverageScorer", () => {
    it("should score perfect coverage as 1.0", () => {
      const modelOutput = {
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

      const datasetRow = {
        claims: [
          { claimId: "claim1", claimText: "Parking is expensive" },
          { claimId: "claim2", claimText: "Parking is confusing" },
          { claimId: "claim3", claimText: "Need better transit" },
        ],
      };

      const result = claimCoverageScorer({ modelOutput, datasetRow });

      expect(result.claim_coverage_score).toBe(1);
      expect(result.missing_claims).toEqual([]);
      expect(result.extra_claims).toEqual([]);
    });

    it("should detect missing claims", () => {
      const modelOutput = {
        groupedClaims: [
          {
            claimText: "Parking needs improvement",
            originalClaimIds: ["claim1"],
          },
        ],
      };

      const datasetRow = {
        claims: [
          { claimId: "claim1", claimText: "Parking is expensive" },
          { claimId: "claim2", claimText: "Parking is confusing" },
        ],
      };

      const result = claimCoverageScorer({ modelOutput, datasetRow });

      expect(result.claim_coverage_score).toBe(0.5);
      expect(result.missing_claims).toEqual(["claim2"]);
      expect(result.extra_claims).toEqual([]);
    });

    it("should detect extra claims", () => {
      const modelOutput = {
        groupedClaims: [
          {
            claimText: "Parking needs improvement",
            originalClaimIds: ["claim1", "claim2", "claim999"],
          },
        ],
      };

      const datasetRow = {
        claims: [
          { claimId: "claim1", claimText: "Parking is expensive" },
          { claimId: "claim2", claimText: "Parking is confusing" },
        ],
      };

      const result = claimCoverageScorer({ modelOutput, datasetRow });

      expect(result.claim_coverage_score).toBe(0.5);
      expect(result.missing_claims).toEqual([]);
      expect(result.extra_claims).toEqual(["claim999"]);
    });

    it("should handle missing input claims", () => {
      const modelOutput = {
        groupedClaims: [
          {
            claimText: "Some claim",
            originalClaimIds: ["claim1"],
          },
        ],
      };

      const result = claimCoverageScorer({ modelOutput, datasetRow: {} });

      expect(result.claim_coverage_score).toBe(0);
      expect(result.reason).toBe("No input claims provided");
    });
  });

  describe("groupingQualityScorer", () => {
    it("should score perfect grouping as 1.0", () => {
      const modelOutput = {
        groupedClaims: [
          {
            claimText: "Parking needs improvement",
            originalClaimIds: ["claim1", "claim2"],
          },
        ],
      };

      const datasetRow = {
        expectedGroups: [
          {
            claimText: "Expected parking claim",
            originalClaimIds: ["claim1", "claim2"],
          },
        ],
      };

      const result = groupingQualityScorer({ modelOutput, datasetRow });

      expect(result.grouping_quality_score).toBe(1);
      expect(result.correct_groupings).toBe(1);
    });

    it("should detect incorrect groupings", () => {
      const modelOutput = {
        groupedClaims: [
          {
            claimText: "Parking expensive",
            originalClaimIds: ["claim1"],
          },
          {
            claimText: "Parking confusing",
            originalClaimIds: ["claim2"],
          },
        ],
      };

      const datasetRow = {
        expectedGroups: [
          {
            claimText: "Parking needs improvement",
            originalClaimIds: ["claim1", "claim2"],
          },
        ],
      };

      const result = groupingQualityScorer({ modelOutput, datasetRow });

      expect(result.grouping_quality_score).toBe(0);
      expect(result.correct_groupings).toBe(0);
    });

    it("should handle missing expected groups", () => {
      const modelOutput = {
        groupedClaims: [
          {
            claimText: "Some claim",
            originalClaimIds: ["claim1"],
          },
        ],
      };

      const result = groupingQualityScorer({ modelOutput, datasetRow: {} });

      expect(result.grouping_quality_score).toBe(1);
      expect(result.reason).toBe("No expected groups to compare against");
    });
  });

  describe("consolidationScorer", () => {
    it("should score appropriate consolidation as 1.0", () => {
      const modelOutput = {
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

      const datasetRow = {
        claims: [
          { claimId: "claim1" },
          { claimId: "claim2" },
          { claimId: "claim3" },
          { claimId: "claim4" },
        ],
      };

      const result = consolidationScorer({ modelOutput, datasetRow });

      expect(result.consolidation_score).toBeGreaterThan(0.8);
      expect(result.consolidation_issues).toEqual([]);
    });

    it("should detect over-consolidation", () => {
      const modelOutput = {
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

      const datasetRow = {
        claims: [
          { claimId: "claim1" },
          { claimId: "claim2" },
          { claimId: "claim3" },
          { claimId: "claim4" },
          { claimId: "claim5" },
        ],
      };

      const result = consolidationScorer({ modelOutput, datasetRow });

      expect(result.consolidation_score).toBeLessThan(1);
      expect(result.consolidation_issues).toContain(
        "Over-consolidated: Too few groups for the input diversity",
      );
    });

    it("should detect under-consolidation", () => {
      const modelOutput = {
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

      const datasetRow = {
        claims: [
          { claimId: "claim1" },
          { claimId: "claim2" },
          { claimId: "claim3" },
          { claimId: "claim4" },
        ],
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
      const modelOutput = {
        groupedClaims: [
          {
            claimText:
              "Parking fees create financial barriers for downtown workers",
            originalClaimIds: ["claim1", "claim2"],
          },
        ],
      };

      const result = groupClaimQualityScorer({ modelOutput, datasetRow: {} });

      expect(result.group_claim_quality_score).toBe(1);
      expect(result.quality_issues).toEqual([]);
    });

    it("should detect platitudes", () => {
      const modelOutput = {
        groupedClaims: [
          {
            claimText: "Parking should be improved",
            originalClaimIds: ["claim1", "claim2"],
          },
        ],
      };

      const result = groupClaimQualityScorer({ modelOutput, datasetRow: {} });

      expect(result.group_claim_quality_score).toBeLessThan(1);
      expect(result.quality_issues[0]).toContain("Potential platitude");
    });

    it("should detect generic language", () => {
      const modelOutput = {
        groupedClaims: [
          {
            claimText: "Parking issues need to be addressed",
            originalClaimIds: ["claim1", "claim2"],
          },
        ],
      };

      const result = groupClaimQualityScorer({ modelOutput, datasetRow: {} });

      expect(result.group_claim_quality_score).toBeLessThan(1);
      expect(
        result.quality_issues.some((issue) =>
          issue.includes("Generic language"),
        ),
      ).toBe(true);
    });

    it("should detect claims that are too short", () => {
      const modelOutput = {
        groupedClaims: [
          {
            claimText: "Parking bad",
            originalClaimIds: ["claim1"],
          },
        ],
      };

      const result = groupClaimQualityScorer({ modelOutput, datasetRow: {} });

      expect(result.group_claim_quality_score).toBeLessThan(1);
      expect(result.quality_issues[0]).toContain("Claim too short");
    });

    it("should detect claims that are too long", () => {
      const longClaim = "A".repeat(200);
      const modelOutput = {
        groupedClaims: [
          {
            claimText: longClaim,
            originalClaimIds: ["claim1"],
          },
        ],
      };

      const result = groupClaimQualityScorer({ modelOutput, datasetRow: {} });

      expect(result.group_claim_quality_score).toBeLessThan(1);
      expect(result.quality_issues[0]).toContain("Claim too long");
    });
  });

  describe("Sample Data", () => {
    it("should have valid deduplication test cases", () => {
      expect(Array.isArray(deduplicationTestCases)).toBe(true);
      expect(deduplicationTestCases.length).toBeGreaterThan(0);

      for (const testCase of deduplicationTestCases) {
        expect(testCase).toHaveProperty("id");
        expect(testCase).toHaveProperty("claims");
        expect(testCase).toHaveProperty("expectedGroups");
        expect(Array.isArray(testCase.claims)).toBe(true);
        expect(Array.isArray(testCase.expectedGroups)).toBe(true);

        for (const claim of testCase.claims) {
          expect(claim).toHaveProperty("claimId");
          expect(claim).toHaveProperty("claimText");
          expect(claim).toHaveProperty("quoteText");
        }

        for (const group of testCase.expectedGroups) {
          expect(group).toHaveProperty("claimText");
          expect(group).toHaveProperty("originalClaimIds");
          expect(Array.isArray(group.originalClaimIds)).toBe(true);
        }
      }
    });
  });
});
