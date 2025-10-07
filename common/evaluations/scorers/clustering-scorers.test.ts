import { describe, it, expect, vi } from "vitest";
import * as weave from "weave";
import {
  jsonStructureScorer,
  topicCoverageScorer,
  contentQualityScorer,
  semanticSimilarityScorer,
  createClusteringModel,
  sampleComments,
  sampleClusteringData,
} from "./clustering-scorers.js";

// Mock weave.op to return the function directly for testing
vi.mock("weave", () => ({
  op: vi.fn((fn) => fn),
  wrapOpenAI: vi.fn(),
  Dataset: vi.fn(),
  Evaluation: vi.fn(),
  init: vi.fn(),
}));

describe("Clustering Scorers", () => {
  describe("jsonStructureScorer", () => {
    it("should return valid structure for correct taxonomy format", () => {
      const validModelOutput = {
        taxonomy: [
          {
            topicName: "Pets",
            topicShortDescription: "About animals",
            subtopics: [
              {
                subtopicName: "Dogs",
                subtopicShortDescription: "Canine companions",
              },
            ],
          },
        ],
      };

      const result = jsonStructureScorer({ modelOutput: validModelOutput });

      expect(result.valid_json_structure).toBe(true);
      expect(result.topic_count).toBe(1);
      expect(result.total_subtopics).toBe(1);
    });

    it("should reject empty taxonomy array", () => {
      const invalidModelOutput = {
        taxonomy: [],
      };

      const result = jsonStructureScorer({ modelOutput: invalidModelOutput });

      expect(result.valid_json_structure).toBe(false);
      expect(result.error).toBe("Missing or invalid taxonomy array");
    });

    it("should reject missing taxonomy property", () => {
      const invalidModelOutput = {};

      const result = jsonStructureScorer({ modelOutput: invalidModelOutput });

      expect(result.valid_json_structure).toBe(false);
      expect(result.error).toBe("Missing or invalid taxonomy array");
    });

    it("should reject topic with missing required fields", () => {
      const invalidModelOutput = {
        taxonomy: [
          {
            topicName: "Pets",
            // Missing topicShortDescription and subtopics
          },
        ],
      };

      const result = jsonStructureScorer({ modelOutput: invalidModelOutput });

      expect(result.valid_json_structure).toBe(false);
      expect(result.error).toBe("Invalid topic structure");
    });

    it("should reject topic description that is too long", () => {
      const invalidModelOutput = {
        taxonomy: [
          {
            topicName: "Pets",
            topicShortDescription:
              "This description is way too long and exceeds the thirty character limit",
            subtopics: [],
          },
        ],
      };

      const result = jsonStructureScorer({ modelOutput: invalidModelOutput });

      expect(result.valid_json_structure).toBe(false);
      expect(result.error).toContain("Topic description too long");
    });

    it("should reject subtopic description that is too long", () => {
      const invalidModelOutput = {
        taxonomy: [
          {
            topicName: "Pets",
            topicShortDescription: "About animals",
            subtopics: [
              {
                subtopicName: "Dogs",
                subtopicShortDescription:
                  "This subtopic description is way too long and exceeds the one hundred and forty character limit which should definitely cause validation to fail because it is much longer than allowed",
              },
            ],
          },
        ],
      };

      const result = jsonStructureScorer({ modelOutput: invalidModelOutput });

      expect(result.valid_json_structure).toBe(false);
      expect(result.error).toContain("Subtopic description too long");
    });
  });

  describe("topicCoverageScorer", () => {
    it("should score optimal topic count (2-6) as 1.0", () => {
      const modelOutput = {
        taxonomy: [
          {
            topicName: "Topic1",
            subtopics: [{ subtopicName: "Sub1" }, { subtopicName: "Sub2" }],
          },
          {
            topicName: "Topic2",
            subtopics: [{ subtopicName: "Sub3" }],
          },
          {
            topicName: "Topic3",
            subtopics: [{ subtopicName: "Sub4" }],
          },
        ],
      };

      const result = topicCoverageScorer({ modelOutput, datasetRow: {} });

      expect(result.topic_coverage_score).toBe(1);
      expect(result.topic_count).toBe(3);
      expect(result.topic_count_score).toBe(1);
      expect(result.subtopic_diversity_score).toBe(1);
    });

    it("should score single topic as 0.7", () => {
      const modelOutput = {
        taxonomy: [
          {
            topicName: "Topic1",
            subtopics: [{ subtopicName: "Sub1" }, { subtopicName: "Sub2" }],
          },
        ],
      };

      const result = topicCoverageScorer({ modelOutput, datasetRow: {} });

      expect(result.topic_count_score).toBe(0.7);
      expect(result.topic_count).toBe(1);
    });

    it("should handle missing taxonomy", () => {
      const modelOutput = {};

      const result = topicCoverageScorer({ modelOutput, datasetRow: {} });

      expect(result.topic_coverage_score).toBe(0);
      expect(result.reason).toBe("No taxonomy found");
    });
  });

  describe("contentQualityScorer", () => {
    it("should score high-quality topics as 1.0", () => {
      const modelOutput = {
        taxonomy: [
          {
            topicName: "Transportation",
            subtopics: [
              { subtopicName: "Public Transit" },
              { subtopicName: "Traffic Management" },
            ],
          },
        ],
      };

      const result = contentQualityScorer({ modelOutput, datasetRow: {} });

      expect(result.content_quality_score).toBe(1);
      expect(result.issues_count).toBe(0);
      expect(result.quality_issues).toEqual([]);
    });

    it("should detect generic topic names", () => {
      const modelOutput = {
        taxonomy: [
          {
            topicName: "Other Topics",
            subtopics: [{ subtopicName: "Miscellaneous Items" }],
          },
        ],
      };

      const result = contentQualityScorer({ modelOutput, datasetRow: {} });

      expect(result.content_quality_score).toBeLessThan(1);
      expect(result.issues_count).toBeGreaterThan(0);
      expect(result.quality_issues).toContain(
        "Generic topic name: Other Topics",
      );
      expect(result.quality_issues).toContain(
        "Generic subtopic name: Miscellaneous Items",
      );
    });

    it("should detect names that are too short", () => {
      const modelOutput = {
        taxonomy: [
          {
            topicName: "AB",
            subtopics: [{ subtopicName: "XY" }],
          },
        ],
      };

      const result = contentQualityScorer({ modelOutput, datasetRow: {} });

      expect(result.content_quality_score).toBeLessThan(1);
      expect(result.quality_issues).toContain("Topic name too short: AB");
      expect(result.quality_issues).toContain("Subtopic name too short: XY");
    });
  });

  describe("semanticSimilarityScorer", () => {
    it("should return perfect score for exact matches", () => {
      const modelOutput = {
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
            ],
          },
        ],
      };

      const datasetRow = {
        expectedTaxonomy: {
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
              ],
            },
          ],
        },
      };

      const result = semanticSimilarityScorer({ modelOutput, datasetRow });

      expect(result.semantic_similarity_score).toBe(1);
      expect(result.topic_coverage).toBe(1);
      expect(result.subtopic_coverage).toBe(1);
      expect(result.topics_matched).toBe(1);
      expect(result.subtopics_matched).toBe(1);
    });

    it("should handle partial matches", () => {
      const modelOutput = {
        taxonomy: [
          {
            topicName: "Animals",
            topicShortDescription: "Different animals",
            subtopics: [
              {
                subtopicName: "Cats",
                subtopicShortDescription: "Feline friends",
              },
            ],
          },
        ],
      };

      const datasetRow = {
        expectedTaxonomy: {
          taxonomy: [
            {
              topicName: "Pets",
              topicShortDescription: "Views on various pets",
              subtopics: [
                {
                  subtopicName: "Cats",
                  subtopicShortDescription: "Positive feelings about cats",
                },
                {
                  subtopicName: "Dogs",
                  subtopicShortDescription: "Positive feelings about dogs",
                },
              ],
            },
          ],
        },
      };

      const result = semanticSimilarityScorer({ modelOutput, datasetRow });

      expect(result.semantic_similarity_score).toBeLessThan(1);
      expect(result.topic_coverage).toBeLessThan(1);
      expect(result.subtopic_coverage).toBeLessThan(1);
    });

    it("should return 0 for missing taxonomy data", () => {
      const result = semanticSimilarityScorer({
        modelOutput: {},
        datasetRow: {},
      });

      expect(result.semantic_similarity_score).toBe(0);
      expect(result.reason).toBe("Missing taxonomy data");
    });
  });

  describe("Sample Data", () => {
    it("should have valid sample comments", () => {
      expect(sampleComments).toContain("cats");
      expect(sampleComments).toContain("dogs");
      expect(sampleComments).toContain("birds");
    });

    it("should have valid sample clustering data structure", () => {
      expect(sampleClusteringData).toHaveProperty("input");
      expect(sampleClusteringData).toHaveProperty("expectedOutput");
      expect(sampleClusteringData.expectedOutput).toHaveProperty("taxonomy");
      expect(Array.isArray(sampleClusteringData.expectedOutput.taxonomy)).toBe(
        true,
      );
    });

    it("should have expected taxonomy that passes validation", () => {
      const result = jsonStructureScorer({
        modelOutput: sampleClusteringData.expectedOutput,
      });

      expect(result.valid_json_structure).toBe(true);
    });
  });
});
