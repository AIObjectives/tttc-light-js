import type { OpenAI } from "openai";
import { describe, expect, it, vi } from "vitest";
import { EVAL_MODEL } from "../../constants";
import { summariesTestCases } from "../datasets.js";
import {
  createLLMJudgeScorer,
  summariesJsonStructureScorer,
  summaryLengthScorer,
} from "../scorers.js";

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
    it("should return valid structure for correct summary format", async () => {
      const validModelOutput = {
        topicName: "Pets",
        summary: "This is a valid summary about pets.",
      };

      const result = await summariesJsonStructureScorer({
        modelOutput: validModelOutput,
        datasetRow: summariesTestCases[0],
      });

      expect(result.valid_json_structure).toBe(true);
      expect(result.summaries_count).toBeDefined();
    });

    it("should reject missing topicName", async () => {
      const invalidModelOutput = {
        summary: "This is a summary without a topicName.",
      } as any;

      const result = await summariesJsonStructureScorer({
        modelOutput: invalidModelOutput,
        datasetRow: summariesTestCases[0],
      });

      expect(result.valid_json_structure).toBe(false);
      expect(result.reason).toBe("Missing topicName");
    });

    it("should reject missing summary", async () => {
      const invalidModelOutput = {
        topicName: "Pets",
      } as any;

      const result = await summariesJsonStructureScorer({
        modelOutput: invalidModelOutput,
        datasetRow: summariesTestCases[0],
      });

      expect(result.valid_json_structure).toBe(false);
      expect(result.reason).toBe("Missing summary");
    });

    it("should reject empty summary text", async () => {
      const invalidModelOutput = {
        topicName: "Pets",
        summary: "   ",
      };

      const result = await summariesJsonStructureScorer({
        modelOutput: invalidModelOutput,
        datasetRow: summariesTestCases[0],
      });

      expect(result.valid_json_structure).toBe(false);
      expect(result.reason).toBe("Empty summary text");
    });
  });

  describe("summaryLengthScorer", () => {
    it("should score summary within 140 word limit as 1.0", async () => {
      const validModelOutput = {
        topicName: "Pets",
        summary:
          "This is a short summary that is well within the 140 word limit.",
      };

      const result = await summaryLengthScorer({
        modelOutput: validModelOutput,
        datasetRow: summariesTestCases[0],
      });

      expect(result.summary_length_score).toBe(1.0);
      expect(result.summaries_within_limit).toBe(1);
      expect(result.total_summaries).toBe(1);
      expect(result.issues_count).toBe(0);
    });

    it("should detect summary exceeding 140 words", async () => {
      const longSummary = Array(150).fill("word").join(" ");
      const invalidModelOutput = {
        topicName: "Pets",
        summary: longSummary,
      };

      const result = await summaryLengthScorer({
        modelOutput: invalidModelOutput,
        datasetRow: summariesTestCases[0],
      });

      expect(result.summary_length_score).toBe(0);
      expect(result.summaries_within_limit).toBe(0);
      expect(result.total_summaries).toBe(1);
      expect(result.issues_count).toBe(1);
      expect(result.issues).toBeDefined();
      expect(result.issues!.length).toBe(1);
      expect(result.issues![0]).toContain("Pets");
      expect(result.issues![0]).toContain("150 words");
    });
  });

  describe("Sample Data", () => {
    it("should have valid summaries test cases", () => {
      expect(summariesTestCases).toBeDefined();
      expect(Array.isArray(summariesTestCases)).toBe(true);
      expect(summariesTestCases.length).toBeGreaterThan(0);

      const firstTestCase = summariesTestCases[0];
      expect(firstTestCase.id).toBeDefined();
      expect(firstTestCase.topic).toBeDefined();

      // topics is a SortedTopic tuple: [topicName, { counts, topic }]
      expect(Array.isArray(firstTestCase.topic)).toBe(true);
      expect(firstTestCase.topic.length).toBe(2);
      expect(typeof firstTestCase.topic[0]).toBe("string"); // Topic name
      expect(typeof firstTestCase.topic[1]).toBe("object"); // Topic data
      expect(firstTestCase.topic[1].counts).toBeDefined();
      expect(firstTestCase.topic[1].topics).toBeDefined();
      expect(Array.isArray(firstTestCase.topic[1].topics)).toBe(true);
    });
  });

  describe("createLLMJudgeScorer", () => {
    it("should return 0 when summary data is missing", async () => {
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
        datasetRow: summariesTestCases[0],
      });

      expect(result.llm_judge_score).toBe(0);
      expect(result.error).toBe("Missing summary data");
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
                reasoning: "Summary accurately captures the main themes",
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
        topicName: "Pets",
        summary: "Discussion about various types of pets and their care.",
      };

      const result = await llmJudgeScorer({
        modelOutput,
        datasetRow: summariesTestCases[0],
      });

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
      expect(result.comprehensiveness_score).toBe(0.92);
      expect(result.synthesis_quality_score).toBe(0.88);
      expect(result.accuracy_score).toBe(0.95);
      expect(result.conciseness_score).toBe(0.91);
      expect(result.reasoning).toBe(
        "Summary accurately captures the main themes",
      );
    });

    it("should handle OpenAI API errors gracefully", async () => {
      const mockOpenAI = {
        chat: {
          completions: {
            create: vi.fn().mockRejectedValue(new Error("Connection timeout")),
          },
        },
      } as unknown as OpenAI;

      const llmJudgeScorer = createLLMJudgeScorer(mockOpenAI);

      const result = await llmJudgeScorer({
        modelOutput: {
          topicName: "Test",
          summary: "Test summary",
        },
        datasetRow: summariesTestCases[0],
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
      } as unknown as OpenAI;

      const llmJudgeScorer = createLLMJudgeScorer(mockOpenAI);

      const result = await llmJudgeScorer({
        modelOutput: {
          topicName: "Test",
          summary: "Test",
        },
        datasetRow: summariesTestCases[0],
      });

      expect(result.llm_judge_score).toBe(0);
      expect(result.error).toBe("No response from LLM judge");
    });
  });
});
