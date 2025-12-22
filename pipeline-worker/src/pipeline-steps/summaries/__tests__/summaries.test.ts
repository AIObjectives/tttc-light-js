/**
 * Tests for summaries generation pipeline step
 */

import { describe, expect, it, vi } from "vitest";

// Mock the model
vi.mock("../model", () => ({
  callSummaryModel: vi.fn(async (input) => ({
    tag: "success",
    value: {
      summary: `This is a test summary for ${input.topicName}`,
      usage: {
        input_tokens: 200,
        output_tokens: 100,
        total_tokens: 300,
      },
      cost: 0.0002,
    },
  })),
}));

import { generateTopicSummaries } from "../index";
import type {
  DedupedClaim,
  LLMConfig,
  ProcessedSubtopic,
  SortedTree,
} from "../types";

// Mock the logger before importing modules that use it
vi.mock("tttc-common/logger", () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  },
}));

// Mock the sanitizer
vi.mock("../../sanitizer", () => ({
  sanitizeForOutput: vi.fn((data) => data),
}));

describe("Summaries Generation Pipeline Step", () => {
  const llmConfig: LLMConfig = {
    model_name: "gpt-4o-mini",
    system_prompt: "You are a research assistant.",
    user_prompt: "Generate a summary for this topic:",
  };

  const createSampleClaim = (claim: string, speaker: string): DedupedClaim => ({
    claim,
    quote: claim,
    speaker,
    topicName: "Test Topic",
    subtopicName: "Test Subtopic",
    commentId: "c1",
    duplicates: [],
    duplicated: false,
  });

  const createSampleSubtopic = (claims: DedupedClaim[]): ProcessedSubtopic => ({
    claims,
    speakers: claims.map((c) => c.speaker),
    counts: {
      claims: claims.length,
      speakers: new Set(claims.map((c) => c.speaker)).size,
    },
  });

  describe("generateTopicSummaries", () => {
    it("should generate summaries for all topics in the tree", async () => {
      const sampleTree: SortedTree = [
        [
          "Climate Change",
          {
            topics: [
              [
                "Carbon Emissions",
                createSampleSubtopic([
                  createSampleClaim("We need to reduce emissions", "Alice"),
                ]),
              ],
            ],
            speakers: ["Alice"],
            counts: { claims: 1, speakers: 1 },
          },
        ],
        [
          "Transportation",
          {
            topics: [
              [
                "Public Transit",
                createSampleSubtopic([
                  createSampleClaim("Buses are efficient", "Bob"),
                ]),
              ],
            ],
            speakers: ["Bob"],
            counts: { claims: 1, speakers: 1 },
          },
        ],
      ];

      const result = await generateTopicSummaries(
        { tree: sampleTree, llm: llmConfig },
        "fake-api-key",
      );

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        expect(result.value.data).toHaveLength(2);
        expect(result.value.data[0].topicName).toBe("Climate Change");
        expect(result.value.data[0].summary).toContain("Climate Change");
        expect(result.value.data[1].topicName).toBe("Transportation");
        expect(result.value.data[1].summary).toContain("Transportation");
        expect(result.value.usage.input_tokens).toBeGreaterThan(0);
        expect(result.value.usage.output_tokens).toBeGreaterThan(0);
        expect(result.value.cost).toBeGreaterThan(0);
      }
    });

    it("should handle single topic tree", async () => {
      const sampleTree: SortedTree = [
        [
          "Climate Change",
          {
            topics: [
              [
                "Carbon Emissions",
                createSampleSubtopic([
                  createSampleClaim("We need to reduce emissions", "Alice"),
                ]),
              ],
            ],
            speakers: ["Alice"],
            counts: { claims: 1, speakers: 1 },
          },
        ],
      ];

      const result = await generateTopicSummaries(
        { tree: sampleTree, llm: llmConfig },
        "fake-api-key",
      );

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        expect(result.value.data).toHaveLength(1);
        expect(result.value.data[0].topicName).toBe("Climate Change");
      }
    });

    it("should handle empty tree", async () => {
      const emptyTree: SortedTree = [];

      const result = await generateTopicSummaries(
        { tree: emptyTree, llm: llmConfig },
        "fake-api-key",
      );

      expect(result.tag).toBe("failure");
      if (result.tag === "failure") {
        expect(result.error.message).toContain("cannot be empty");
      }
    });

    it("should aggregate usage and cost across multiple topics", async () => {
      const sampleTree: SortedTree = [
        [
          "Topic 1",
          {
            topics: [
              [
                "Subtopic 1",
                createSampleSubtopic([createSampleClaim("Claim 1", "Alice")]),
              ],
            ],
            speakers: ["Alice"],
            counts: { claims: 1, speakers: 1 },
          },
        ],
        [
          "Topic 2",
          {
            topics: [
              [
                "Subtopic 2",
                createSampleSubtopic([createSampleClaim("Claim 2", "Bob")]),
              ],
            ],
            speakers: ["Bob"],
            counts: { claims: 1, speakers: 1 },
          },
        ],
        [
          "Topic 3",
          {
            topics: [
              [
                "Subtopic 3",
                createSampleSubtopic([createSampleClaim("Claim 3", "Charlie")]),
              ],
            ],
            speakers: ["Charlie"],
            counts: { claims: 1, speakers: 1 },
          },
        ],
      ];

      const result = await generateTopicSummaries(
        { tree: sampleTree, llm: llmConfig },
        "fake-api-key",
      );

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        // Usage should be aggregated from all 3 topics
        expect(result.value.usage.input_tokens).toBe(600); // 200 * 3
        expect(result.value.usage.output_tokens).toBe(300); // 100 * 3
        expect(result.value.usage.total_tokens).toBe(900); // 300 * 3
        expect(result.value.cost).toBeCloseTo(0.0006, 5); // 0.0002 * 3
      }
    });

    it("should fail fast when a topic fails to generate summary", async () => {
      const { callSummaryModel } = await import("../model.js");

      // First call succeeds, second fails
      vi.mocked(callSummaryModel)
        .mockResolvedValueOnce({
          tag: "success",
          value: {
            summary: "Summary for Topic 1",
            usage: {
              input_tokens: 200,
              output_tokens: 100,
              total_tokens: 300,
            },
            cost: 0.0002,
          },
        })
        .mockResolvedValueOnce({
          tag: "failure",
          error: new Error("API call failed"),
        });

      const sampleTree: SortedTree = [
        [
          "Topic 1",
          {
            topics: [
              [
                "Subtopic 1",
                createSampleSubtopic([createSampleClaim("Claim 1", "Alice")]),
              ],
            ],
            speakers: ["Alice"],
            counts: { claims: 1, speakers: 1 },
          },
        ],
        [
          "Topic 2",
          {
            topics: [
              [
                "Subtopic 2",
                createSampleSubtopic([createSampleClaim("Claim 2", "Bob")]),
              ],
            ],
            speakers: ["Bob"],
            counts: { claims: 1, speakers: 1 },
          },
        ],
      ];

      const result = await generateTopicSummaries(
        { tree: sampleTree, llm: llmConfig },
        "fake-api-key",
      );

      expect(result.tag).toBe("failure");
    });

    it("should handle topics with multiple subtopics", async () => {
      const sampleTree: SortedTree = [
        [
          "Climate Change",
          {
            topics: [
              [
                "Carbon Emissions",
                createSampleSubtopic([
                  createSampleClaim("We need to reduce emissions", "Alice"),
                  createSampleClaim("Carbon tax is effective", "Bob"),
                ]),
              ],
              [
                "Renewable Energy",
                createSampleSubtopic([
                  createSampleClaim("Solar power is the future", "Charlie"),
                ]),
              ],
            ],
            speakers: ["Alice", "Bob", "Charlie"],
            counts: { claims: 3, speakers: 3 },
          },
        ],
      ];

      const result = await generateTopicSummaries(
        { tree: sampleTree, llm: llmConfig },
        "fake-api-key",
      );

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        expect(result.value.data).toHaveLength(1);
        expect(result.value.data[0].topicName).toBe("Climate Change");
        expect(result.value.data[0].summary).toBeTruthy();
      }
    });

    it("should process topics with controlled concurrency", async () => {
      const { callSummaryModel } = await import("../model.js");
      const callTimes: number[] = [];

      // Track when each call is made
      vi.mocked(callSummaryModel).mockImplementation(async (input) => {
        callTimes.push(Date.now());
        // Simulate some processing time
        await new Promise((resolve) => setTimeout(resolve, 10));
        return {
          tag: "success",
          value: {
            summary: `Summary for ${input.topicName}`,
            usage: {
              input_tokens: 200,
              output_tokens: 100,
              total_tokens: 300,
            },
            cost: 0.0002,
          },
        };
      });

      // Create 10 topics to test concurrency limit
      const sampleTree: SortedTree = Array.from({ length: 10 }, (_, i) => [
        `Topic ${i + 1}`,
        {
          topics: [
            [
              `Subtopic ${i + 1}`,
              createSampleSubtopic([
                createSampleClaim(`Claim ${i + 1}`, "Alice"),
              ]),
            ],
          ],
          speakers: ["Alice"],
          counts: { claims: 1, speakers: 1 },
        },
      ]);

      const result = await generateTopicSummaries(
        { tree: sampleTree, llm: llmConfig },
        "fake-api-key",
      );

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        expect(result.value.data).toHaveLength(10);
        // All topics should have been processed
        expect(callTimes).toHaveLength(10);
      }
    });

    it("should pass options to summary generation", async () => {
      const { callSummaryModel } = await import("../model.js");

      const sampleTree: SortedTree = [
        [
          "Climate Change",
          {
            topics: [
              [
                "Carbon Emissions",
                createSampleSubtopic([
                  createSampleClaim("We need to reduce emissions", "Alice"),
                ]),
              ],
            ],
            speakers: ["Alice"],
            counts: { claims: 1, speakers: 1 },
          },
        ],
      ];

      await generateTopicSummaries(
        { tree: sampleTree, llm: llmConfig },
        "fake-api-key",
        {
          reportId: "test-report-123",
          enableWeave: true,
          weaveProjectName: "test-project",
        },
      );

      // Verify options were passed to the model
      expect(vi.mocked(callSummaryModel)).toHaveBeenCalledWith(
        expect.objectContaining({
          reportId: "test-report-123",
          options: {
            enableWeave: true,
            weaveProjectName: "test-project",
          },
        }),
      );
    });

    it("should maintain topic order in results", async () => {
      const sampleTree: SortedTree = [
        ["Zebra Topic", createSampleTopicData()],
        ["Alpha Topic", createSampleTopicData()],
        ["Middle Topic", createSampleTopicData()],
      ];

      const result = await generateTopicSummaries(
        { tree: sampleTree, llm: llmConfig },
        "fake-api-key",
      );

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        // Order should be preserved from the tree
        expect(result.value.data[0].topicName).toBe("Zebra Topic");
        expect(result.value.data[1].topicName).toBe("Alpha Topic");
        expect(result.value.data[2].topicName).toBe("Middle Topic");
      }
    });

    it("should share OpenAI client across all topics", async () => {
      const { callSummaryModel } = await import("../model.js");
      const clientInstances = new Set();

      // Track OpenAI client instances
      vi.mocked(callSummaryModel).mockImplementation(async (input) => {
        clientInstances.add(input.openaiClient);
        return {
          tag: "success",
          value: {
            summary: `Summary for ${input.topicName}`,
            usage: {
              input_tokens: 200,
              output_tokens: 100,
              total_tokens: 300,
            },
            cost: 0.0002,
          },
        };
      });

      const sampleTree: SortedTree = [
        ["Topic 1", createSampleTopicData()],
        ["Topic 2", createSampleTopicData()],
        ["Topic 3", createSampleTopicData()],
      ];

      await generateTopicSummaries(
        { tree: sampleTree, llm: llmConfig },
        "fake-api-key",
      );

      // Should use the same client instance for all topics
      expect(clientInstances.size).toBe(1);
    });
  });

  // Helper function to create sample topic data
  function createSampleTopicData() {
    return {
      topics: [
        [
          "Subtopic",
          createSampleSubtopic([createSampleClaim("Test claim", "Alice")]),
        ],
      ] as [string, ProcessedSubtopic][],
      speakers: ["Alice"],
      counts: { claims: 1, speakers: 1 },
    };
  }
});
