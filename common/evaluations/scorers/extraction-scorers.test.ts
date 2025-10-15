import { describe, it, expect, vi } from "vitest";
import {
  extractionJsonStructureScorer,
  claimQualityScorer,
  taxonomyAlignmentScorer,
  quoteRelevanceScorer,
  extractionCompletenessScorer,
  sampleTaxonomy,
  extractionTestCases,
} from "./extraction-scorers.js";

// Mock weave.op to return the function directly for testing
vi.mock("weave", () => ({
  op: vi.fn((fn) => fn),
  wrapOpenAI: vi.fn(),
  Dataset: vi.fn(),
  Evaluation: vi.fn(),
  init: vi.fn(),
}));

describe("Extraction Scorers", () => {
  describe("extractionJsonStructureScorer", () => {
    it("should return valid structure for correct claims format", () => {
      const validModelOutput = {
        claims: [
          {
            claim: "Cats are independent pets",
            quote: "I love cats because they are independent",
            topicName: "Pets",
            subtopicName: "Cats",
          },
        ],
      };

      const result = extractionJsonStructureScorer({
        modelOutput: validModelOutput,
      });

      expect(result.valid_json_structure).toBe(true);
      expect(result.claims_count).toBe(1);
    });

    it("should accept empty claims array", () => {
      const validModelOutput = {
        claims: [],
      };

      const result = extractionJsonStructureScorer({
        modelOutput: validModelOutput,
      });

      expect(result.valid_json_structure).toBe(true);
      expect(result.claims_count).toBe(0);
    });

    it("should reject missing claims property", () => {
      const invalidModelOutput = {};

      const result = extractionJsonStructureScorer({
        modelOutput: invalidModelOutput,
      });

      expect(result.valid_json_structure).toBe(false);
      expect(result.error).toBe("Missing or invalid claims array");
    });

    it("should reject claim with missing required fields", () => {
      const invalidModelOutput = {
        claims: [
          {
            claim: "Cats are great",
            // Missing quote, topicName, subtopicName
          },
        ],
      };

      const result = extractionJsonStructureScorer({
        modelOutput: invalidModelOutput,
      });

      expect(result.valid_json_structure).toBe(false);
      expect(result.error).toBe(
        "Invalid claim structure - missing required fields",
      );
    });

    it("should reject empty claim text", () => {
      const invalidModelOutput = {
        claims: [
          {
            claim: "   ",
            quote: "Some quote",
            topicName: "Pets",
            subtopicName: "Cats",
          },
        ],
      };

      const result = extractionJsonStructureScorer({
        modelOutput: invalidModelOutput,
      });

      expect(result.valid_json_structure).toBe(false);
      expect(result.error).toBe("Empty claim text");
    });
  });

  describe("claimQualityScorer", () => {
    it("should score high-quality claims as 1.0", () => {
      const modelOutput = {
        claims: [
          {
            claim:
              "Independent pets require less human interaction than social animals",
            quote: "I love cats because they are independent",
            topicName: "Pets",
            subtopicName: "Cats",
          },
        ],
      };

      const result = claimQualityScorer({ modelOutput, datasetRow: {} });

      expect(result.claim_quality_score).toBe(1);
      expect(result.issues_count).toBe(0);
      expect(result.quality_issues).toEqual([]);
    });

    it("should detect potential platitudes", () => {
      const modelOutput = {
        claims: [
          {
            claim: "Communication is important for pet care",
            quote: "We should talk to our pets",
            topicName: "Pets",
            subtopicName: "Cats",
          },
        ],
      };

      const result = claimQualityScorer({ modelOutput, datasetRow: {} });

      expect(result.claim_quality_score).toBeLessThan(1);
      expect(result.issues_count).toBeGreaterThan(0);
      expect(result.quality_issues?.at(0)).toContain("Potential platitude");
    });

    it("should detect claims that are too short", () => {
      const modelOutput = {
        claims: [
          {
            claim: "Dogs good",
            quote: "I love dogs",
            topicName: "Pets",
            subtopicName: "Dogs",
          },
        ],
      };

      const result = claimQualityScorer({ modelOutput, datasetRow: {} });

      expect(result.claim_quality_score).toBeLessThan(1);
      expect(result.quality_issues).toContain("Claim too short: Dogs good");
    });

    it("should detect non-debatable personal statements", () => {
      const modelOutput = {
        claims: [
          {
            claim: "I like cats more than dogs",
            quote: "I prefer cats",
            topicName: "Pets",
            subtopicName: "Cats",
          },
        ],
      };

      const result = claimQualityScorer({ modelOutput, datasetRow: {} });

      expect(result.claim_quality_score).toBeLessThan(1);
      expect(result.quality_issues?.at(0)).toContain(
        "Non-debatable personal statement",
      );
    });
  });

  describe("taxonomyAlignmentScorer", () => {
    it("should score perfect alignment as 1.0", () => {
      const modelOutput = {
        claims: [
          {
            claim: "Cats are independent pets",
            quote: "I love cats because they are independent",
            topicName: "Pets",
            subtopicName: "Cats",
          },
        ],
      };

      const datasetRow = {
        taxonomy: sampleTaxonomy,
      };

      const result = taxonomyAlignmentScorer({ modelOutput, datasetRow });

      expect(result.taxonomy_alignment_score).toBe(1);
      expect(result.valid_mappings).toBe(1);
      expect(result.invalid_mappings).toBe(0);
    });

    it("should detect invalid topic mappings", () => {
      const modelOutput = {
        claims: [
          {
            claim: "Cars are faster than bikes",
            quote: "I prefer driving",
            topicName: "Transportation", // Invalid topic
            subtopicName: "Cars",
          },
        ],
      };

      const datasetRow = {
        taxonomy: sampleTaxonomy,
      };

      const result = taxonomyAlignmentScorer({ modelOutput, datasetRow });

      expect(result.taxonomy_alignment_score).toBe(0);
      expect(result.valid_mappings).toBe(0);
      expect(result.invalid_mappings).toBe(1);
      expect(result.invalid_mapping_details).toHaveLength(1);
    });

    it("should handle missing taxonomy", () => {
      const modelOutput = {
        claims: [
          {
            claim: "Some claim",
            quote: "Some quote",
            topicName: "Pets",
            subtopicName: "Cats",
          },
        ],
      };

      const result = taxonomyAlignmentScorer({ modelOutput, datasetRow: {} });

      expect(result.taxonomy_alignment_score).toBe(0);
      expect(result.reason).toBe("No taxonomy provided");
    });
  });

  describe("quoteRelevanceScorer", () => {
    it("should score relevant quotes as 1.0", () => {
      const modelOutput = {
        claims: [
          {
            claim: "Cats are independent pets",
            quote: "I love cats because they are independent",
            topicName: "Pets",
            subtopicName: "Cats",
          },
        ],
      };

      const datasetRow = {
        comment:
          "I love cats because they are independent and low-maintenance pets",
      };

      const result = quoteRelevanceScorer({ modelOutput, datasetRow });

      expect(result.quote_relevance_score).toBe(1);
      expect(result.relevant_quotes).toBe(1);
      expect(result.quote_issues).toHaveLength(0);
    });

    it("should detect quotes that don't match original comment", () => {
      const modelOutput = {
        claims: [
          {
            claim: "Dogs are loyal",
            quote: "Elephants are large animals",
            topicName: "Pets",
            subtopicName: "Dogs",
          },
        ],
      };

      const datasetRow = {
        comment: "I really love dogs and their loyalty",
      };

      const result = quoteRelevanceScorer({ modelOutput, datasetRow });

      expect(result.quote_relevance_score).toBe(0);
      expect(result.quote_issues).toHaveLength(1);
      console.log(result.quote_issues[0]);
      expect(result.quote_issues[0].issues[0]).toContain(
        "Quote does not closely match",
      );
    });

    it("should detect quotes that are too similar to claims", () => {
      const modelOutput = {
        claims: [
          {
            claim: "Cats are independent",
            quote: "Cats are independent",
            topicName: "Pets",
            subtopicName: "Cats",
          },
        ],
      };

      const datasetRow = {
        comment: "Cats are independent creatures",
      };

      const result = quoteRelevanceScorer({ modelOutput, datasetRow });

      expect(result.quote_relevance_score).toBe(0);
      expect(result.quote_issues[0].issues[0]).toContain(
        "too similar to claim",
      );
    });
  });

  describe("extractionCompletenessScorer", () => {
    it("should score perfect extraction as 1.0", () => {
      const modelOutput = {
        claims: [
          {
            claim: "Cats are superior pets due to their independence",
            quote: "I love cats because they are independent",
            topicName: "Pets",
            subtopicName: "Cats",
          },
        ],
      };

      const datasetRow = {
        expectedClaims: [
          {
            claim: "Cats are superior pets due to their independence",
            quote: "I love cats because they are independent",
            topicName: "Pets",
            subtopicName: "Cats",
          },
        ],
      };

      const result = extractionCompletenessScorer({ modelOutput, datasetRow });

      expect(result.extraction_completeness_score).toBe(1);
      expect(result.matched_claims).toBe(1);
      expect(result.claim_matches).toHaveLength(1);
    });

    it("should handle zero expected claims correctly", () => {
      const modelOutput = {
        claims: [],
      };

      const datasetRow = {
        expectedClaims: [],
      };

      const result = extractionCompletenessScorer({ modelOutput, datasetRow });

      expect(result.extraction_completeness_score).toBe(1);
      expect(result.expected_zero_claims).toBe(true);
    });

    it("should penalize extracting claims when zero expected", () => {
      const modelOutput = {
        claims: [
          {
            claim: "Some unnecessary claim",
            quote: "Some quote",
            topicName: "Pets",
            subtopicName: "Cats",
          },
        ],
      };

      const datasetRow = {
        expectedClaims: [],
      };

      const result = extractionCompletenessScorer({ modelOutput, datasetRow });

      expect(result.extraction_completeness_score).toBe(0);
      expect(result.extracted_claims_count).toBe(1);
    });

    it("should handle missing expected claims", () => {
      const modelOutput = {
        claims: [
          {
            claim: "Some claim",
            quote: "Some quote",
            topicName: "Pets",
            subtopicName: "Cats",
          },
        ],
      };

      const result = extractionCompletenessScorer({
        modelOutput,
        datasetRow: {},
      });

      expect(result.extraction_completeness_score).toBe(1);
      expect(result.reason).toBe("No expected claims to compare against");
    });
  });

  describe("Sample Data", () => {
    it("should have valid sample taxonomy", () => {
      expect(sampleTaxonomy).toHaveProperty("taxonomy");
      expect(Array.isArray(sampleTaxonomy.taxonomy)).toBe(true);
      expect(sampleTaxonomy.taxonomy.length).toBeGreaterThan(0);
    });

    it("should have valid extraction test cases", () => {
      expect(Array.isArray(extractionTestCases)).toBe(true);
      expect(extractionTestCases.length).toBeGreaterThan(0);

      for (const testCase of extractionTestCases) {
        expect(testCase).toHaveProperty("id");
        expect(testCase).toHaveProperty("comment");
        expect(testCase).toHaveProperty("taxonomy");
        expect(testCase).toHaveProperty("expectedClaims");
        expect(Array.isArray(testCase.expectedClaims)).toBe(true);
      }
    });
  });
});
