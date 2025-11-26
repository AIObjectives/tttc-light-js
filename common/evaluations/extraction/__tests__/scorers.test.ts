import { describe, it, expect, vi } from "vitest";
import type { OpenAI } from "openai";
import {
  extractionJsonStructureScorer,
  claimQualityScorer,
  taxonomyAlignmentScorer,
  quoteRelevanceScorer,
  createLLMJudgeScorer,
} from "../scorers";
import { sampleTaxonomy } from "../datasets";
import { EVAL_MODEL } from "../../constants";
import { ExtractionDatasetRow } from "../types";

// Mock weave.op to return the function directly for testing
vi.mock("weave", () => ({
  op: vi.fn((fn) => fn),
  wrapOpenAI: vi.fn(),
  Dataset: vi.fn(),
  Evaluation: vi.fn(),
  init: vi.fn(),
}));

describe("Extraction Scorers", () => {
  const dummyData: ExtractionDatasetRow = {
    comment: "Test comment",
    taxonomy: [
      {
        topicName: "Test Topic",
        subtopics: [],
      },
    ],
  };

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
        datasetRow: dummyData,
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
        datasetRow: dummyData,
      });

      expect(result.valid_json_structure).toBe(true);
      expect(result.claims_count).toBe(0);
    });

    it("should reject missing claims property", () => {
      const invalidModelOutput = {};

      const result = extractionJsonStructureScorer({
        modelOutput: invalidModelOutput as any,
        datasetRow: dummyData,
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
        modelOutput: invalidModelOutput as any,
        datasetRow: dummyData,
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
        datasetRow: dummyData,
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

      const result = claimQualityScorer({ modelOutput, datasetRow: dummyData });

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

      const result = claimQualityScorer({ modelOutput, datasetRow: dummyData });

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

      const result = claimQualityScorer({ modelOutput, datasetRow: dummyData });

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

      const result = claimQualityScorer({ modelOutput, datasetRow: dummyData });

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
        comment: "This is a comment",
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
        comment: "Test Comment",
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

      const datasetRowWithoutTaxonomy = {
        comment: "Test comment",
        taxonomy: undefined as any,
      };

      const result = taxonomyAlignmentScorer({
        modelOutput,
        datasetRow: datasetRowWithoutTaxonomy,
      });

      expect(result.taxonomy_alignment_score).toBe(0);
      expect(result.error).toBe("No taxonomy provided");
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
        taxonomy: sampleTaxonomy,
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
        taxonomy: sampleTaxonomy,
      };

      const result = quoteRelevanceScorer({ modelOutput, datasetRow });

      expect(result.quote_relevance_score).toBe(0);
      expect(result.quote_issues).toHaveLength(1);
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
        taxonomy: sampleTaxonomy,
      };

      const result = quoteRelevanceScorer({ modelOutput, datasetRow });

      expect(result.quote_relevance_score).toBe(0);
      expect(result.quote_issues).toHaveLength(1);
    });
  });

  describe("createLLMJudgeScorer", () => {
    it("should return 0 when claims data is missing", async () => {
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
          comment: "Test comment",
          taxonomy: sampleTaxonomy,
        },
      });

      expect(result.llm_judge_score).toBe(0);
      expect(result.error).toBe("Missing claims data");
      expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
    });

    it("should call OpenAI with correct prompt and return parsed evaluation", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                claim_quality_score: 0.9,
                quote_accuracy_score: 0.85,
                taxonomy_mapping_score: 0.95,
                completeness_score: 0.88,
                overall_score: 0.89,
                reasoning: "Claims are well extracted and appropriately mapped",
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

      const modelOutput = {
        claims: [
          {
            claim: "Cats are independent animals",
            quote: "I love cats because they are independent",
            topicName: "Pets",
            subtopicName: "Cats",
          },
        ],
      };

      const datasetRow = {
        comment:
          "I love cats because they are independent and easy to care for",
        taxonomy: sampleTaxonomy,
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

      expect(result.llm_judge_score).toBe(0.89);
      expect(result.claim_quality_score).toBe(0.9);
      expect(result.quote_accuracy_score).toBe(0.85);
      expect(result.taxonomy_mapping_score).toBe(0.95);
      expect(result.completeness_score).toBe(0.88);
      expect(result.reasoning).toBe(
        "Claims are well extracted and appropriately mapped",
      );
    });

    it("should handle OpenAI API errors gracefully", async () => {
      const mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn().mockRejectedValue(new Error("Network timeout")),
          },
        },
      } as unknown as OpenAI;

      const llmJudgeScorer = createLLMJudgeScorer(mockOpenAI);

      const result = await llmJudgeScorer({
        modelOutput: {
          claims: [
            {
              claim: "Test",
              quote: "Test",
              topicName: "Test",
              subtopicName: "Test",
            },
          ],
        },
        datasetRow: {
          comment: "Test",
          taxonomy: sampleTaxonomy,
        },
      });

      expect(result.llm_judge_score).toBe(0);
      expect(result.error).toBe("Network timeout");
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
          claims: [
            {
              claim: "Test",
              quote: "Test",
              topicName: "Test",
              subtopicName: "Test",
            },
          ],
        },
        datasetRow: {
          comment: "Test",
          taxonomy: sampleTaxonomy,
        },
      });

      expect(result.llm_judge_score).toBe(0);
      expect(result.error).toBe("No response from LLM judge");
    });
  });
});
