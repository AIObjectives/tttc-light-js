import type { OpenAI } from "openai";
import { describe, expect, it, vi } from "vitest";
import { EVAL_MODEL } from "../../constants";
import {
  createLLMJudgeScorer,
  jsonStructureScorer,
  topicCoverageScorer,
} from "../scorers";

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
    // dummyDataset is not used for comparison, only to meet the type requirements for the scorers
    const dummyDataset = { comments: "Something about pets" };

    it("should return valid structure for correct taxonomy format", () => {
      const validModelOutput = {
        taxonomy: [
          {
            topicName: "Pets",
            topicShortDescription:
              "Perspectives on different types of pets and their unique behavioral traits care requirements and suitability for various living situations and owner preferences preferences and owner situations",
            subtopics: [
              {
                subtopicName: "Dogs",
                subtopicShortDescription:
                  "Strong appreciation for dogs focusing on their loyalty protective nature and the health benefits of regular exercise through daily walks in parks and neighborhoods. Comments acknowledge the significant training commitment required especially for puppies but emphasize the rewarding bond that develops over time through consistent effort. Space constraints and daily exercise needs are noted as challenges for potential owners with limited living space and busy schedules throughout the day and week requiring careful planning and dedication to proper care",
              },
            ],
          },
        ],
      };

      const result = jsonStructureScorer({
        modelOutput: validModelOutput,
        datasetRow: dummyDataset,
      });

      expect(result.valid_json_structure).toBe(true);
      expect(result.topic_count).toBe(1);
      expect(result.total_subtopics).toBe(1);
    });

    it("should reject empty taxonomy array", () => {
      const invalidModelOutput = {
        taxonomy: [],
      };

      const result = jsonStructureScorer({
        modelOutput: invalidModelOutput,
        datasetRow: dummyDataset,
      });

      expect(result.valid_json_structure).toBe(false);
      expect(result.reason).toBe("Missing or invalid taxonomy array");
    });

    it("should reject missing taxonomy property", () => {
      const invalidModelOutput = {};

      const result = jsonStructureScorer({
        modelOutput: invalidModelOutput as any,
        datasetRow: dummyDataset,
      });

      expect(result.valid_json_structure).toBe(false);
      expect(result.reason).toBe("Missing or invalid taxonomy array");
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

      const result = jsonStructureScorer({
        modelOutput: invalidModelOutput as any,
        datasetRow: dummyDataset,
      });

      expect(result.valid_json_structure).toBe(false);
      expect(result.reason).toBe("Invalid topic structure");
    });

    it("should reject topic description that is too short or too long", () => {
      const invalidModelOutput = {
        taxonomy: [
          {
            topicName: "Pets",
            topicShortDescription: "This description is way too short",
            subtopics: [],
          },
        ],
      };

      const result = jsonStructureScorer({
        modelOutput: invalidModelOutput,
        datasetRow: dummyDataset,
      });

      expect(result.valid_json_structure).toBe(false);
      expect(result.reason).toContain("Topic description must be 25-35 words");
    });

    it("should reject subtopic description that is too short or too long", () => {
      const invalidModelOutput = {
        taxonomy: [
          {
            topicName: "Pets",
            topicShortDescription:
              "Perspectives on different types of pets and their unique behavioral traits care requirements and suitability for various living situations and owner preferences preferences and owner situations",
            subtopics: [
              {
                subtopicName: "Dogs",
                subtopicShortDescription:
                  "This subtopic description is way too short",
              },
            ],
          },
        ],
      };

      const result = jsonStructureScorer({
        modelOutput: invalidModelOutput,
        datasetRow: dummyDataset,
      });

      expect(result.valid_json_structure).toBe(false);
      expect(result.reason).toContain(
        "Subtopic description must be 70-90 words",
      );
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

      const result = topicCoverageScorer({
        modelOutput,
        datasetRow: {} as any,
      });

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

      const result = topicCoverageScorer({
        modelOutput,
        datasetRow: {} as any,
      });

      expect(result.topic_count_score).toBe(0.7);
      expect(result.topic_count).toBe(1);
    });

    it("should handle missing taxonomy", () => {
      const modelOutput = {} as any;

      const result = topicCoverageScorer({
        modelOutput,
        datasetRow: {} as any,
      });

      expect(result.topic_coverage_score).toBe(0);
      expect(result.reason).toBe("No taxonomy found");
    });
  });

  describe("createLLMJudgeScorer", () => {
    it("should return 0 when taxonomy data is missing", async () => {
      const mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn(),
          },
        },
      };

      const llmJudgeScorer = createLLMJudgeScorer(
        mockOpenAI as unknown as OpenAI,
      );

      const result = await llmJudgeScorer({
        modelOutput: {} as any,
        datasetRow: {
          comments: "Some test comments",
        },
      });

      expect(result.llm_judge_score).toBe(0);
      expect(result.error).toBe("Missing Taxonomy Data");
      expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
    });

    it("should call OpenAI with correct prompt and return parsed evaluation", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                topic_coverage_score: 0.92,
                subtopic_coverage_score: 0.88,
                overall_score: 0.9,
                reasoning: "Topics accurately capture the main themes",
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
      };

      const llmJudgeScorer = createLLMJudgeScorer(
        mockOpenAI as unknown as OpenAI,
      );

      const modelOutput = {
        taxonomy: [
          {
            topicName: "Pets",
            topicShortDescription:
              "Discussion about various types of pets and their care requirements",
            subtopics: [
              {
                subtopicName: "Dogs",
                subtopicShortDescription:
                  "Information about dog care and training",
              },
            ],
          },
        ],
      };

      const datasetRow = {
        comments: "I love dogs. They are loyal and friendly.",
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

      expect(result.llm_judge_score).toBe(0.9);
      expect(result.topic_coverage_score).toBe(0.92);
      expect(result.subtopic_coverage_score).toBe(0.88);
      expect(result.reasoning).toBe(
        "Topics accurately capture the main themes",
      );
    });

    it("should handle OpenAI API errors gracefully", async () => {
      const mockOpenAI = {
        chat: {
          completions: {
            create: vi
              .fn()
              .mockRejectedValue(new Error("OpenAI service unavailable")),
          },
        },
      };

      const llmJudgeScorer = createLLMJudgeScorer(
        mockOpenAI as unknown as OpenAI,
      );

      const result = await llmJudgeScorer({
        modelOutput: {
          taxonomy: [
            {
              topicName: "Test",
              subtopics: [],
            },
          ],
        },
        datasetRow: {
          comments: "Test comments",
        },
      });

      expect(result.llm_judge_score).toBe(0);
      expect(result.error).toBe("OpenAI service unavailable");
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
      };

      const llmJudgeScorer = createLLMJudgeScorer(
        mockOpenAI as unknown as OpenAI,
      );

      const result = await llmJudgeScorer({
        modelOutput: {
          taxonomy: [
            {
              topicName: "Test",
              subtopics: [],
            },
          ],
        },
        datasetRow: {
          comments: "Test",
        },
      });

      expect(result.llm_judge_score).toBe(0);
      expect(result.error).toBe("No response from LLM judge");
    });
  });
});
