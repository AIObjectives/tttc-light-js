import { describe, it, expect } from "vitest";
import {
  summariesJsonStructureScorer,
  summaryLengthScorer,
  summaryContentQualityScorer,
  summariesTopicCoverageScorer,
  sampleTopicsData,
  summariesTestCases,
} from "./summaries-scorers";

describe("Summaries Scorers", () => {
  describe("summariesJsonStructureScorer", () => {
    it("should return valid structure for correct summaries format", async () => {
      const validModelOutput = {
        summaries: [
          {
            topicName: "Pets",
            summary: "This is a valid summary about pets.",
          },
        ],
      };

      const result = await summariesJsonStructureScorer({
        modelOutput: validModelOutput,
      });

      expect(result.valid_json_structure).toBe(true);
      expect(result.summaries_count).toBe(1);
    });

    it("should accept empty summaries array", async () => {
      const validModelOutput = {
        summaries: [],
      };

      const result = await summariesJsonStructureScorer({
        modelOutput: validModelOutput,
      });

      expect(result.valid_json_structure).toBe(true);
      expect(result.summaries_count).toBe(0);
    });

    it("should reject empty summary text", async () => {
      const invalidModelOutput = {
        summaries: [
          {
            topicName: "Pets",
            summary: "   ",
          },
        ],
      };

      const result = await summariesJsonStructureScorer({
        modelOutput: invalidModelOutput,
      });

      expect(result.valid_json_structure).toBe(false);
      expect(result.error).toBe("Empty summary text");
    });
  });

  describe("summaryLengthScorer", () => {
    it("should score summaries within 140 word limit as 1.0", async () => {
      const validModelOutput = {
        summaries: [
          {
            topicName: "Pets",
            summary:
              "This is a short summary that is well within the 140 word limit.",
          },
        ],
      };

      const result = await summaryLengthScorer({
        modelOutput: validModelOutput,
      });

      expect(result.summary_length_score).toBe(1.0);
      expect(result.summaries_within_limit).toBe(1);
      expect(result.total_summaries).toBe(1);
      expect(result.issues_count).toBe(0);
    });

    it("should detect summaries exceeding 140 words", async () => {
      const longSummary = Array(150).fill("word").join(" ");
      const invalidModelOutput = {
        summaries: [
          {
            topicName: "Pets",
            summary: longSummary,
          },
        ],
      };

      const result = await summaryLengthScorer({
        modelOutput: invalidModelOutput,
      });

      expect(result.summary_length_score).toBe(0);
      expect(result.summaries_within_limit).toBe(0);
      expect(result.total_summaries).toBe(1);
      expect(result.issues_count).toBe(1);
    });

    it("should handle mixed length summaries", async () => {
      const longSummary = Array(150).fill("word").join(" ");
      const mixedModelOutput = {
        summaries: [
          {
            topicName: "Pets",
            summary: "Short summary.",
          },
          {
            topicName: "Animals",
            summary: longSummary,
          },
        ],
      };

      const result = await summaryLengthScorer({
        modelOutput: mixedModelOutput,
      });

      expect(result.summary_length_score).toBe(0.5);
      expect(result.summaries_within_limit).toBe(1);
      expect(result.total_summaries).toBe(2);
      expect(result.issues_count).toBe(1);
    });
  });

  describe("summaryContentQualityScorer", () => {
    it("should score high-quality summaries as 1.0", async () => {
      const validModelOutput = {
        summaries: [
          {
            topicName: "Pets",
            summary:
              "Participants expressed diverse views on pet ownership, with many emphasizing the importance of responsible care and the emotional benefits pets provide.",
          },
        ],
      };

      const result = await summaryContentQualityScorer({
        modelOutput: validModelOutput,
      });

      expect(result.content_quality_score).toBe(1.0);
      expect(result.issues_count).toBe(0);
    });

    it("should detect summaries that are too brief", async () => {
      const invalidModelOutput = {
        summaries: [
          {
            topicName: "Pets",
            summary: "Participants like pets.",
          },
        ],
      };

      const result = await summaryContentQualityScorer({
        modelOutput: invalidModelOutput,
      });

      expect(result.content_quality_score).toBe(0);
      expect(result.issues_count).toBeGreaterThan(0);
    });

    it("should detect platitudes", async () => {
      const invalidModelOutput = {
        summaries: [
          {
            topicName: "Pets",
            summary:
              "This is important to consider when thinking about pets and how we should interact with them in our daily lives and communities. Participants shared various perspectives on this topic.",
          },
        ],
      };

      const result = await summaryContentQualityScorer({
        modelOutput: invalidModelOutput,
      });

      expect(result.content_quality_score).toBe(0);
      expect(result.issues_count).toBeGreaterThan(0);
    });
  });

  describe("summariesTopicCoverageScorer", () => {
    it("should score perfect topic coverage as 1.0", async () => {
      const modelOutput = {
        summaries: [
          {
            topicName: "Pets",
            summary: "Summary about pets.",
          },
        ],
      };

      const datasetRow = {
        topics: [
          {
            topicName: "Pets",
            topicShortDescription: "About pets",
          },
        ],
      };

      const result = await summariesTopicCoverageScorer({
        modelOutput,
        datasetRow,
      });

      expect(result.topic_coverage_score).toBe(1.0);
      expect(result.topics_matched).toBe(1);
      expect(result.expected_topics).toBe(1);
      expect(result.generated_summaries).toBe(1);
    });

    it("should detect missing topic coverage", async () => {
      const modelOutput = {
        summaries: [
          {
            topicName: "Dogs",
            summary: "Summary about dogs.",
          },
        ],
      };

      const datasetRow = {
        topics: [
          {
            topicName: "Pets",
            topicShortDescription: "About pets",
          },
          {
            topicName: "Animals",
            topicShortDescription: "About animals",
          },
        ],
      };

      const result = await summariesTopicCoverageScorer({
        modelOutput,
        datasetRow,
      });

      expect(result.topic_coverage_score).toBe(0);
      expect(result.topics_matched).toBe(0);
      expect(result.expected_topics).toBe(2);
      expect(result.generated_summaries).toBe(1);
    });

    it("should handle case-insensitive topic matching", async () => {
      const modelOutput = {
        summaries: [
          {
            topicName: "PETS",
            summary: "Summary about pets.",
          },
        ],
      };

      const datasetRow = {
        topics: [
          {
            topicName: "pets",
            topicShortDescription: "About pets",
          },
        ],
      };

      const result = await summariesTopicCoverageScorer({
        modelOutput,
        datasetRow,
      });

      expect(result.topic_coverage_score).toBe(1.0);
      expect(result.topics_matched).toBe(1);
    });
  });

  describe("Sample Data", () => {
    it("should have valid sample topics data", () => {
      expect(sampleTopicsData).toBeDefined();
      expect(Array.isArray(sampleTopicsData)).toBe(true);
      expect(sampleTopicsData.length).toBeGreaterThan(0);

      const firstTopic = sampleTopicsData[0];
      expect(firstTopic.topicName).toBeDefined();
      expect(firstTopic.topicShortDescription).toBeDefined();
      expect(Array.isArray(firstTopic.subtopics)).toBe(true);
    });

    it("should have valid summaries test cases", () => {
      expect(summariesTestCases).toBeDefined();
      expect(Array.isArray(summariesTestCases)).toBe(true);
      expect(summariesTestCases.length).toBeGreaterThan(0);

      const firstTestCase = summariesTestCases[0];
      expect(firstTestCase.topics).toBeDefined();
      expect(firstTestCase.expectedSummaries).toBeDefined();
      expect(Array.isArray(firstTestCase.expectedSummaries)).toBe(true);
    });
  });
});
