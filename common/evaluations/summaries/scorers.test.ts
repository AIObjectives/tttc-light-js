import { describe, it, expect, vi } from "vitest";
import {
  summariesJsonStructureScorer,
  summaryLengthScorer,
  createLLMJudgeScorer,
} from "./scorers.js";
import { summariesTestCases } from "./datasets.js";

// Mock weave.op to return the function directly for testing
vi.mock("weave", () => ({
  op: vi.fn((fn) => fn),
  wrapOpenAI: vi.fn(),
  Dataset: vi.fn(),
  Evaluation: vi.fn(),
  init: vi.fn(),
}));

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

  describe("Sample Data", () => {
    it("should have valid summaries test cases", () => {
      expect(summariesTestCases).toBeDefined();
      expect(Array.isArray(summariesTestCases)).toBe(true);
      expect(summariesTestCases.length).toBeGreaterThan(0);

      const firstTestCase = summariesTestCases[0];
      expect(firstTestCase.topics).toBeDefined();
      expect(Array.isArray(firstTestCase.topics)).toBe(true);
      expect(firstTestCase.topics.length).toBeGreaterThan(0);

      const firstTopic = firstTestCase.topics[0];
      expect(firstTopic.topicName).toBeDefined();
      expect(firstTopic.topicShortDescription).toBeDefined();
      expect(Array.isArray(firstTopic.subtopics)).toBe(true);
    });
  });

  describe("createLLMJudgeScorer", () => {
    it("should return 0 when summaries data is missing", async () => {
      const mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn(),
          },
        },
      };

      const llmJudgeScorer = createLLMJudgeScorer(mockOpenAI);

      const result = await llmJudgeScorer({
        modelOutput: {},
        datasetRow: {
          topics: [
            {
              topicName: "Test",
              topicShortDescription: "Test description",
              subtopics: [],
            },
          ],
        },
      });

      expect(result.llm_judge_score).toBe(0);
      expect(result.reason).toBe("Missing summaries data");
      expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
    });

    it("should call OpenAI with correct prompt and return parsed evaluation", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                comprehensiveness_score: 0.92,
                synthesis_quality_score: 0.88,
                accuracy_score: 0.95,
                conciseness_score: 0.91,
                overall_score: 0.91,
                reasoning: "Summaries accurately capture the main themes",
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

      const llmJudgeScorer = createLLMJudgeScorer(mockOpenAI);

      const modelOutput = {
        summaries: [
          {
            topicName: "Pets",
            summary: "Discussion about various types of pets and their care.",
          },
        ],
      };

      const datasetRow = {
        topics: [
          {
            topicName: "Pets",
            topicShortDescription: "Views on different types of pets",
            subtopics: [
              {
                subtopicName: "Cats",
                subtopicShortDescription: "Information about cats",
                claims: [
                  {
                    claim: "Cats are independent",
                    quote: "I love cats",
                  },
                ],
              },
            ],
          },
        ],
      };

      const result = await llmJudgeScorer({ modelOutput, datasetRow });

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith({
        model: "gpt-4o-mini",
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "system" }),
          expect.objectContaining({ role: "user" }),
        ]),
        response_format: { type: "json_object" },
      });

      expect(result.llm_judge_score).toBe(0.91);
      expect(result.comprehensiveness_score).toBe(0.92);
      expect(result.synthesis_quality_score).toBe(0.88);
      expect(result.accuracy_score).toBe(0.95);
      expect(result.conciseness_score).toBe(0.91);
      expect(result.reasoning).toBe(
        "Summaries accurately capture the main themes",
      );
    });

    it("should handle OpenAI API errors gracefully", async () => {
      const mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn().mockRejectedValue(new Error("Connection timeout")),
          },
        },
      };

      const llmJudgeScorer = createLLMJudgeScorer(mockOpenAI);

      const result = await llmJudgeScorer({
        modelOutput: {
          summaries: [
            {
              topicName: "Test",
              summary: "Test summary",
            },
          ],
        },
        datasetRow: {
          topics: [
            {
              topicName: "Test",
              topicShortDescription: "Test",
              subtopics: [],
            },
          ],
        },
      });

      expect(result.llm_judge_score).toBe(0);
      expect(result.error).toBe("Connection timeout");
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

      const llmJudgeScorer = createLLMJudgeScorer(mockOpenAI);

      const result = await llmJudgeScorer({
        modelOutput: {
          summaries: [
            {
              topicName: "Test",
              summary: "Test",
            },
          ],
        },
        datasetRow: {
          topics: [
            {
              topicName: "Test",
              topicShortDescription: "Test",
              subtopics: [],
            },
          ],
        },
      });

      expect(result.llm_judge_score).toBe(0);
      expect(result.error).toBe("No response from LLM judge");
    });
  });
});
