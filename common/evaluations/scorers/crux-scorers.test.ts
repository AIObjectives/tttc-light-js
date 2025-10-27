import { describe, it, expect, vi } from "vitest";
import {
  cruxJsonStructureScorer,
  participantCoverageScorer,
  cruxClaimQualityScorer,
  controversyBalanceScorer,
  explanationQualityScorer,
  cruxAlignmentScorer,
  cruxTestCases,
} from "./crux-scorers.js";

// Mock weave.op to return the function directly for testing
vi.mock("weave", () => ({
  op: vi.fn((fn) => fn),
  wrapOpenAI: vi.fn(),
  Dataset: vi.fn(),
  Evaluation: vi.fn(),
  init: vi.fn(),
}));

describe("Crux Scorers", () => {
  describe("cruxJsonStructureScorer", () => {
    it("should return valid structure for correct crux format", () => {
      const validModelOutput = {
        crux: {
          cruxClaim: "Government should guarantee healthcare for all citizens",
          agree: ["Person 1", "Person 3"],
          disagree: ["Person 2"],
          explanation:
            "Person 1 and Person 3 advocate for universal healthcare while Person 2 supports market solutions",
        },
      };

      const result = cruxJsonStructureScorer({
        modelOutput: validModelOutput,
      });

      expect(result.valid_json_structure).toBe(true);
      expect(result.agree_count).toBe(2);
      expect(result.disagree_count).toBe(1);
      expect(result.total_participants).toBe(3);
    });

    it("should reject empty cruxClaim text", () => {
      const invalidModelOutput = {
        crux: {
          cruxClaim: "   ",
          agree: ["Person 1"],
          disagree: ["Person 2"],
          explanation: "Some explanation",
        },
      };

      const result = cruxJsonStructureScorer({
        modelOutput: invalidModelOutput,
      });

      expect(result.valid_json_structure).toBe(false);
      expect(result.error).toBe("Empty cruxClaim text");
    });
  });

  describe("participantCoverageScorer", () => {
    it("should give perfect score when all participants are assigned", () => {
      const modelOutput = {
        crux: {
          cruxClaim: "Some claim",
          agree: ["Person 1", "Person 3"],
          disagree: ["Person 2"],
          explanation: "Some explanation",
        },
      };

      const datasetRow = {
        participantClaims: [
          { participant: "Person 1", claims: [] },
          { participant: "Person 2", claims: [] },
          { participant: "Person 3", claims: [] },
        ],
      };

      const result = participantCoverageScorer({ modelOutput, datasetRow });

      expect(result.participant_coverage_score).toBe(1);
      expect(result.covered_participants).toBe(3);
      expect(result.total_participants).toBe(3);
      expect(result.uncovered_participants).toHaveLength(0);
    });

    it("should give partial score when some participants are not assigned", () => {
      const modelOutput = {
        crux: {
          cruxClaim: "Some claim",
          agree: ["Person 1"],
          disagree: ["Person 2"],
          explanation: "Some explanation",
        },
      };

      const datasetRow = {
        participantClaims: [
          { participant: "Person 1", claims: [] },
          { participant: "Person 2", claims: [] },
          { participant: "Person 3", claims: [] },
        ],
      };

      const result = participantCoverageScorer({ modelOutput, datasetRow });

      expect(result.participant_coverage_score).toBeCloseTo(0.67, 2);
      expect(result.covered_participants).toBe(2);
      expect(result.total_participants).toBe(3);
      expect(result.uncovered_participants).toContain("Person 3");
    });
  });

  describe("cruxClaimQualityScorer", () => {
    it("should give perfect score for good quality claim", () => {
      const modelOutput = {
        crux: {
          cruxClaim: "Government should guarantee healthcare for all citizens",
          agree: ["Person 1"],
          disagree: ["Person 2"],
          explanation: "Some explanation",
        },
      };

      const result = cruxClaimQualityScorer({ modelOutput });

      expect(result.crux_claim_quality_score).toBeGreaterThan(0.8);
      expect(result.issues_count).toBe(0);
    });

    it("should penalize vague claims", () => {
      const modelOutput = {
        crux: {
          cruxClaim: "We should improve healthcare",
          agree: ["Person 1"],
          disagree: ["Person 2"],
          explanation: "Some explanation",
        },
      };

      const result = cruxClaimQualityScorer({ modelOutput });

      expect(result.crux_claim_quality_score).toBeLessThan(1);
      expect(result.quality_issues!.length).toBeGreaterThan(0);
      expect(result.quality_issues![0]).toContain("vague");
    });

    it("should penalize claims that are too short", () => {
      const modelOutput = {
        crux: {
          cruxClaim: "Short claim",
          agree: ["Person 1"],
          disagree: ["Person 2"],
          explanation: "Some explanation",
        },
      };

      const result = cruxClaimQualityScorer({ modelOutput });

      expect(result.crux_claim_quality_score).toBeLessThan(1);
      expect(
        result.quality_issues!.some((issue: string) => issue.includes("short")),
      ).toBe(true);
    });

    it("should penalize claims that are questions", () => {
      const modelOutput = {
        crux: {
          cruxClaim: "Should government guarantee healthcare for all?",
          agree: ["Person 1"],
          disagree: ["Person 2"],
          explanation: "Some explanation",
        },
      };

      const result = cruxClaimQualityScorer({ modelOutput });

      expect(result.crux_claim_quality_score).toBeLessThan(1);
      expect(
        result.quality_issues!.some((issue: string) =>
          issue.includes("question"),
        ),
      ).toBe(true);
    });
  });

  describe("controversyBalanceScorer", () => {
    it("should give perfect score for 50/50 split", () => {
      const modelOutput = {
        crux: {
          cruxClaim: "Some claim",
          agree: ["Person 1", "Person 2"],
          disagree: ["Person 3", "Person 4"],
          explanation: "Some explanation",
        },
      };

      const result = controversyBalanceScorer({ modelOutput });

      expect(result.controversy_balance_score).toBe(1);
      expect(result.agree_ratio).toBe(0.5);
      expect(result.disagree_ratio).toBe(0.5);
      expect(result.balance_assessment).toContain("Excellent");
    });

    it("should give lower score for one-sided split", () => {
      const modelOutput = {
        crux: {
          cruxClaim: "Some claim",
          agree: ["Person 1", "Person 2", "Person 3"],
          disagree: ["Person 4"],
          explanation: "Some explanation",
        },
      };

      const result = controversyBalanceScorer({ modelOutput });

      expect(result.controversy_balance_score).toBe(0.5);
      expect(result.agree_ratio).toBe(0.75);
      expect(result.disagree_ratio).toBe(0.25);
    });

    it("should give zero score when everyone agrees", () => {
      const modelOutput = {
        crux: {
          cruxClaim: "Some claim",
          agree: ["Person 1", "Person 2", "Person 3"],
          disagree: [],
          explanation: "Some explanation",
        },
      };

      const result = controversyBalanceScorer({ modelOutput });

      expect(result.controversy_balance_score).toBe(0);
      expect(result.balance_assessment).toContain("Poor balance");
    });
  });

  describe("explanationQualityScorer", () => {
    it("should give perfect score for good quality explanation", () => {
      const modelOutput = {
        crux: {
          cruxClaim: "Some claim",
          agree: ["Person 1", "Person 3"],
          disagree: ["Person 2"],
          explanation:
            "Person 1 and Person 3 support government intervention, while Person 2 prefers market solutions",
        },
      };

      const result = explanationQualityScorer({ modelOutput });

      expect(result.explanation_quality_score).toBeGreaterThan(0.8);
      expect(result.participants_referenced).toBe(3);
    });

    it("should penalize too short explanations", () => {
      const modelOutput = {
        crux: {
          cruxClaim: "Some claim",
          agree: ["Person 1"],
          disagree: ["Person 2"],
          explanation: "They disagree",
        },
      };

      const result = explanationQualityScorer({ modelOutput });

      expect(result.explanation_quality_score).toBeLessThan(1);
      expect(
        result.quality_issues!.some((issue: string) => issue.includes("brief")),
      ).toBe(true);
    });

    it("should penalize explanations without participant references", () => {
      const modelOutput = {
        crux: {
          cruxClaim: "Some claim",
          agree: ["Person 1", "Person 3"],
          disagree: ["Person 2"],
          explanation:
            "Some participants support government intervention while others prefer market solutions",
        },
      };

      const result = explanationQualityScorer({ modelOutput });

      expect(result.participants_referenced).toBe(0);
      expect(
        result.quality_issues!.some((issue: string) =>
          issue.includes("doesn't reference any participants"),
        ),
      ).toBe(true);
    });

    it("should penalize explanations without contrastive reasoning", () => {
      const modelOutput = {
        crux: {
          cruxClaim: "Some claim",
          agree: ["Person 1"],
          disagree: ["Person 2"],
          explanation:
            "Person 1 supports government intervention. Person 2 prefers market solutions.",
        },
      };

      const result = explanationQualityScorer({ modelOutput });

      expect(
        result.quality_issues!.some((issue: string) =>
          issue.includes("contrastive reasoning"),
        ),
      ).toBe(true);
    });
  });

  describe("cruxAlignmentScorer", () => {
    it("should give high score for output matching expected crux", () => {
      const modelOutput = {
        crux: {
          topic: "Healthcare Reform",
          subtopic: "Universal Coverage",
          cruxClaim:
            "Government should guarantee healthcare coverage for all citizens",
          agree: ["Person 1", "Person 3"],
          disagree: ["Person 2"],
          explanation: "Some explanation",
        },
      };

      const datasetRow = cruxTestCases[0];

      const result = cruxAlignmentScorer({ modelOutput, datasetRow });

      expect(result.crux_alignment_score).toBeGreaterThan(0.7);
      expect(result.agree_overlap).toBeGreaterThan(0);
      expect(result.disagree_overlap).toBeGreaterThan(0);
    });

    it("should give low score for misaligned output", () => {
      const modelOutput = {
        crux: {
          topic: "Different Topic",
          subtopic: "Different Subtopic",
          cruxClaim: "Something completely different",
          agree: ["Person 4"],
          disagree: ["Person 5"],
          explanation: "Some explanation",
        },
      };

      const datasetRow = cruxTestCases[0];

      const result = cruxAlignmentScorer({ modelOutput, datasetRow });

      expect(result.crux_alignment_score).toBeLessThan(0.3);
    });

    it("should return 1.0 when no expected crux is provided", () => {
      const modelOutput = {
        crux: {
          cruxClaim: "Some claim",
          agree: ["Person 1"],
          disagree: ["Person 2"],
          explanation: "Some explanation",
        },
      };

      const datasetRow = {};

      const result = cruxAlignmentScorer({ modelOutput, datasetRow });

      expect(result.crux_alignment_score).toBe(1);
      expect(result.reason).toBe("No expected crux to compare against");
    });
  });
});
