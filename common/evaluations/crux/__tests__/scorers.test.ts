import type { OpenAI } from "openai";
import { describe, expect, it, vi } from "vitest";
import { EVAL_MODEL } from "../../constants";
import { createLLMJudgeScorer, cruxJsonStructureScorer } from "../scorers";

// Mock weave.op to return the function directly for testing
vi.mock("weave", () => ({
  op: vi.fn((fn) => fn),
  wrapOpenAI: vi.fn(),
  Dataset: vi.fn(),
  Evaluation: vi.fn(),
  init: vi.fn(),
}));

describe("Crux Scorers", () => {
  // dummyData is used to fill the type requirements for scorer functions, but is not used.
  const dummyData = {
    topic: "Test Topic",
    topicDescription: "This is a topic",
    subtopic: "Test Subtopic",
    subtopicDescription: "This is a subtopic",
    participantClaims: [],
  };

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
        datasetRow: dummyData,
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
        datasetRow: dummyData,
      });

      expect(result.valid_json_structure).toBe(false);
      expect(result.reason).toBe("Empty cruxClaim text");
    });
  });

  describe("createLLMJudgeScorer", () => {
    it("should return 0 when crux data is missing", async () => {
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
        datasetRow: dummyData,
      });

      expect(result.llm_judge_score).toBe(0);
      expect(result.error).toBe("Missing crux data");
      expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
    });

    it("should call OpenAI with correct prompt and return parsed evaluation", async () => {
      const mockResponse = {
        choices: [
          {
            message: {
              content: JSON.stringify({
                crux_quality_score: 0.9,
                assignment_accuracy_score: 0.85,
                explanation_quality_score: 0.95,
                completeness_score: 0.88,
                overall_score: 0.89,
                reasoning: "The crux effectively captures the disagreement",
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
        crux: {
          cruxClaim: "Government should guarantee healthcare for all",
          agree: ["Person 1", "Person 3"],
          disagree: ["Person 2"],
          explanation: "Person 1 and 3 support government intervention",
        },
      };

      const datasetRow = {
        topic: "Healthcare",
        topicDescription: "Views on healthcare",
        subtopic: "Universal Coverage",
        subtopicDescription: "Government healthcare",
        participantClaims: [
          { participant: "Person 1", claims: ["Healthcare is a right"] },
          { participant: "Person 2", claims: ["Market solutions work"] },
          { participant: "Person 3", claims: ["Universal coverage needed"] },
        ],
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
      expect(result.crux_quality_score).toBe(0.9);
      expect(result.assignment_accuracy_score).toBe(0.85);
      expect(result.explanation_quality_score).toBe(0.95);
      expect(result.completeness_score).toBe(0.88);
      expect(result.reasoning).toBe(
        "The crux effectively captures the disagreement",
      );
    });

    it("should handle OpenAI API errors gracefully", async () => {
      const mockOpenAI = {
        chat: {
          completions: {
            create: vi
              .fn()
              .mockRejectedValue(new Error("API rate limit exceeded")),
          },
        },
      };

      const llmJudgeScorer = createLLMJudgeScorer(
        mockOpenAI as unknown as OpenAI,
      );

      const result = await llmJudgeScorer({
        modelOutput: {
          crux: {
            cruxClaim: "Test claim",
            agree: ["A"],
            disagree: ["B"],
            explanation: "Test",
          },
        },
        datasetRow: {
          topic: "Test",
          topicDescription: "Test",
          subtopic: "Test",
          subtopicDescription: "Test",
          participantClaims: [],
        },
      });

      expect(result.llm_judge_score).toBe(0);
      expect(result.error).toBe("API rate limit exceeded");
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
          crux: {
            cruxClaim: "Test",
            agree: [],
            disagree: [],
            explanation: "Test",
          },
        },
        datasetRow: dummyData,
      });

      expect(result.llm_judge_score).toBe(0);
      expect(result.error).toBe("No response from LLM judge");
    });
  });
});
