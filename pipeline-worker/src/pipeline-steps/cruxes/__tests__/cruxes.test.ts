/**
 * Tests for cruxes extraction pipeline step
 */

import { describe, expect, it, vi } from "vitest";

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

// Mock the model
vi.mock("../model", () => ({
  generateCruxForSubtopic: vi.fn(async (input) => ({
    tag: "success",
    value: {
      crux: {
        crux: {
          cruxClaim: `Test crux for ${input.topic}`,
          agree: ["0", "1"],
          disagree: ["2"],
          no_clear_position: ["3"],
          explanation: "This is a test crux explanation.",
        },
      },
      usage: {
        prompt_tokens: 200,
        completion_tokens: 100,
        total_tokens: 300,
      },
    },
  })),
}));

// Mock the sanitizer
vi.mock("../../sanitizer", () => ({
  sanitizeForOutput: vi.fn((data) => data),
}));

// Mock the utils
vi.mock("../../utils", async () => {
  const actual = await vi.importActual("../../utils");
  return {
    ...actual,
    tokenCost: vi.fn(() => 0.0001),
    getReportLogger: vi.fn(() => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    })),
  };
});

import { extractCruxes } from "../index";
import type { Claim, ClaimsTree, LLMConfig, Topic } from "../types";

describe("Cruxes Extraction Pipeline Step", () => {
  const llmConfig: LLMConfig = {
    model_name: "gpt-4o-mini",
    system_prompt: "You are a research assistant.",
    user_prompt: "Identify the crux of disagreement:",
  };

  const createSampleClaim = (
    claim: string,
    speaker: string,
    commentId: string,
  ): Claim => ({
    claim,
    quote: claim,
    speaker,
    commentId,
  });

  const createSampleClaimsTree = (): ClaimsTree => ({
    "Climate Change": {
      subtopics: {
        "Carbon Emissions": {
          claims: [
            createSampleClaim("We need to reduce emissions", "Alice", "c1"),
            createSampleClaim("Carbon tax is effective", "Bob", "c2"),
            createSampleClaim("Industry should lead", "Charlie", "c3"),
            createSampleClaim("Government regulation is key", "Diana", "c4"),
          ],
        },
      },
    },
  });

  const createSampleTopics = (): Topic[] => [
    {
      topicName: "Climate Change",
      topicShortDescription: "Discussion about climate change",
      subtopics: [
        {
          subtopicName: "Carbon Emissions",
          subtopicShortDescription: "Strategies for reducing carbon emissions",
        },
      ],
    },
  ];

  describe("extractCruxes", () => {
    it("should extract cruxes from a claims tree", async () => {
      const claimsTree = createSampleClaimsTree();
      const topics = createSampleTopics();

      const result = await extractCruxes(
        claimsTree,
        topics,
        llmConfig,
        "fake-api-key",
      );

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        expect(result.value.subtopicCruxes).toHaveLength(1);
        expect(result.value.subtopicCruxes[0].topic).toBe("Climate Change");
        expect(result.value.subtopicCruxes[0].subtopic).toBe(
          "Carbon Emissions",
        );
        expect(result.value.subtopicCruxes[0].cruxClaim).toContain("Test crux");
        expect(result.value.usage.input_tokens).toBeGreaterThan(0);
        expect(result.value.usage.output_tokens).toBeGreaterThan(0);
        expect(result.value.cost).toBeGreaterThan(0);
      }
    });

    it("should handle multiple topics and subtopics", async () => {
      const claimsTree: ClaimsTree = {
        "Climate Change": {
          subtopics: {
            "Carbon Emissions": {
              claims: [
                createSampleClaim("Reduce emissions", "Alice", "c1"),
                createSampleClaim("Carbon tax", "Bob", "c2"),
              ],
            },
            "Renewable Energy": {
              claims: [
                createSampleClaim("Solar power", "Charlie", "c3"),
                createSampleClaim("Wind power", "Diana", "c4"),
              ],
            },
          },
        },
        Transportation: {
          subtopics: {
            "Public Transit": {
              claims: [
                createSampleClaim("Buses are efficient", "Eve", "c5"),
                createSampleClaim("Trains are better", "Frank", "c6"),
              ],
            },
          },
        },
      };

      const topics: Topic[] = [
        {
          topicName: "Climate Change",
          topicShortDescription: "Climate discussion",
          subtopics: [
            {
              subtopicName: "Carbon Emissions",
              subtopicShortDescription: "Carbon reduction",
            },
            {
              subtopicName: "Renewable Energy",
              subtopicShortDescription: "Clean energy",
            },
          ],
        },
        {
          topicName: "Transportation",
          topicShortDescription: "Transport discussion",
          subtopics: [
            {
              subtopicName: "Public Transit",
              subtopicShortDescription: "Mass transit",
            },
          ],
        },
      ];

      const result = await extractCruxes(
        claimsTree,
        topics,
        llmConfig,
        "fake-api-key",
      );

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        expect(result.value.subtopicCruxes).toHaveLength(3);
        expect(result.value.topicScores).toHaveLength(2);
        const topicNames = result.value.topicScores.map((ts) => ts.topic);
        expect(topicNames).toContain("Climate Change");
        expect(topicNames).toContain("Transportation");
      }
    });

    it("should skip subtopics with fewer than 2 claims", async () => {
      const claimsTree: ClaimsTree = {
        "Climate Change": {
          subtopics: {
            "Carbon Emissions": {
              claims: [
                createSampleClaim("Reduce emissions", "Alice", "c1"),
                createSampleClaim("Carbon tax", "Bob", "c2"),
              ],
            },
            "Single Claim Topic": {
              claims: [createSampleClaim("Only one claim", "Charlie", "c3")],
            },
          },
        },
      };

      const topics: Topic[] = [
        {
          topicName: "Climate Change",
          topicShortDescription: "Climate discussion",
          subtopics: [
            {
              subtopicName: "Carbon Emissions",
              subtopicShortDescription: "Carbon reduction",
            },
            {
              subtopicName: "Single Claim Topic",
              subtopicShortDescription: "Not enough claims",
            },
          ],
        },
      ];

      const result = await extractCruxes(
        claimsTree,
        topics,
        llmConfig,
        "fake-api-key",
      );

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        // Should only have 1 crux (skipped the single-claim subtopic)
        expect(result.value.subtopicCruxes).toHaveLength(1);
        expect(result.value.subtopicCruxes[0].subtopic).toBe(
          "Carbon Emissions",
        );
      }
    });

    it("should calculate controversy scores correctly", async () => {
      const claimsTree = createSampleClaimsTree();
      const topics = createSampleTopics();

      const result = await extractCruxes(
        claimsTree,
        topics,
        llmConfig,
        "fake-api-key",
      );

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        const crux = result.value.subtopicCruxes[0];
        expect(crux.agreementScore).toBeGreaterThanOrEqual(0);
        expect(crux.agreementScore).toBeLessThanOrEqual(1);
        expect(crux.disagreementScore).toBeGreaterThanOrEqual(0);
        expect(crux.disagreementScore).toBeLessThanOrEqual(1);
        expect(crux.controversyScore).toBeGreaterThanOrEqual(0);
        expect(crux.controversyScore).toBeLessThanOrEqual(1);
      }
    });

    it("should build speaker crux matrix", async () => {
      const claimsTree = createSampleClaimsTree();
      const topics = createSampleTopics();

      const result = await extractCruxes(
        claimsTree,
        topics,
        llmConfig,
        "fake-api-key",
      );

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        expect(result.value.speakerCruxMatrix).toBeDefined();
        expect(result.value.speakerCruxMatrix.speakers).toBeDefined();
        expect(result.value.speakerCruxMatrix.cruxLabels).toBeDefined();
        expect(result.value.speakerCruxMatrix.matrix).toBeDefined();
      }
    });

    it("should aggregate usage and cost", async () => {
      const claimsTree: ClaimsTree = {
        Topic1: {
          subtopics: {
            Subtopic1: {
              claims: [
                createSampleClaim("Claim 1", "Alice", "c1"),
                createSampleClaim("Claim 2", "Bob", "c2"),
              ],
            },
          },
        },
        Topic2: {
          subtopics: {
            Subtopic2: {
              claims: [
                createSampleClaim("Claim 3", "Charlie", "c3"),
                createSampleClaim("Claim 4", "Diana", "c4"),
              ],
            },
          },
        },
      };

      const topics: Topic[] = [
        {
          topicName: "Topic1",
          topicShortDescription: "Topic 1",
          subtopics: [
            { subtopicName: "Subtopic1", subtopicShortDescription: "Sub 1" },
          ],
        },
        {
          topicName: "Topic2",
          topicShortDescription: "Topic 2",
          subtopics: [
            { subtopicName: "Subtopic2", subtopicShortDescription: "Sub 2" },
          ],
        },
      ];

      const result = await extractCruxes(
        claimsTree,
        topics,
        llmConfig,
        "fake-api-key",
      );

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        // Usage should be aggregated from both subtopics
        expect(result.value.usage.input_tokens).toBe(400); // 200 * 2
        expect(result.value.usage.output_tokens).toBe(200); // 100 * 2
        expect(result.value.usage.total_tokens).toBe(600); // 300 * 2
      }
    });

    it("should handle empty claims tree", async () => {
      const emptyTree: ClaimsTree = {};
      const topics = createSampleTopics();

      const result = await extractCruxes(
        emptyTree,
        topics,
        llmConfig,
        "fake-api-key",
      );

      expect(result.tag).toBe("failure");
      if (result.tag === "failure") {
        expect(result.error.message).toContain("cannot be empty");
      }
    });

    it("should handle empty topics array", async () => {
      const claimsTree = createSampleClaimsTree();
      const emptyTopics: Topic[] = [];

      const result = await extractCruxes(
        claimsTree,
        emptyTopics,
        llmConfig,
        "fake-api-key",
      );

      expect(result.tag).toBe("failure");
      if (result.tag === "failure") {
        expect(result.error.message).toContain("cannot be empty");
      }
    });

    it("should pass options to crux generation", async () => {
      const { generateCruxForSubtopic } = await import("../model.js");

      const claimsTree = createSampleClaimsTree();
      const topics = createSampleTopics();

      await extractCruxes(claimsTree, topics, llmConfig, "fake-api-key", {
        reportId: "test-report-123",
        userId: "test-user-456",
        enableWeave: true,
        weaveProjectName: "test-project",
      });

      // Verify options were passed to the model
      expect(vi.mocked(generateCruxForSubtopic)).toHaveBeenCalledWith(
        expect.objectContaining({
          reportId: "test-report-123",
          options: {
            enableWeave: true,
            weaveProjectName: "test-project",
          },
        }),
      );
    });

    it("should handle speaker anonymization", async () => {
      const claimsTree = createSampleClaimsTree();
      const topics = createSampleTopics();

      const result = await extractCruxes(
        claimsTree,
        topics,
        llmConfig,
        "fake-api-key",
      );

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        const crux = result.value.subtopicCruxes[0];
        // Speakers should be in "id:name" format
        expect(crux.agree[0]).toContain(":");
        expect(crux.disagree[0]).toContain(":");
      }
    });

    it("should process subtopics concurrently", async () => {
      const { generateCruxForSubtopic } = await import("../model.js");
      const callTimes: number[] = [];

      // Track when each call is made
      vi.mocked(generateCruxForSubtopic).mockImplementation(async (input) => {
        callTimes.push(Date.now());
        // Simulate some processing time
        await new Promise((resolve) => setTimeout(resolve, 10));
        return {
          tag: "success",
          value: {
            crux: {
              crux: {
                cruxClaim: `Test crux for ${input.topic}`,
                agree: ["0"],
                disagree: ["1"],
                no_clear_position: [],
                explanation: "Test explanation",
              },
            },
            usage: {
              prompt_tokens: 200,
              completion_tokens: 100,
              total_tokens: 300,
            },
          },
        };
      });

      // Create 10 subtopics to test concurrency
      const claimsTree: ClaimsTree = {};
      const topics: Topic[] = [];

      for (let i = 0; i < 10; i++) {
        claimsTree[`Topic${i}`] = {
          subtopics: {
            [`Subtopic${i}`]: {
              claims: [
                createSampleClaim(`Claim ${i}A`, "Alice", `c${i}a`),
                createSampleClaim(`Claim ${i}B`, "Bob", `c${i}b`),
              ],
            },
          },
        };
        topics.push({
          topicName: `Topic${i}`,
          topicShortDescription: `Topic ${i}`,
          subtopics: [
            {
              subtopicName: `Subtopic${i}`,
              subtopicShortDescription: `Subtopic ${i}`,
            },
          ],
        });
      }

      const result = await extractCruxes(
        claimsTree,
        topics,
        llmConfig,
        "fake-api-key",
      );

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        expect(result.value.subtopicCruxes).toHaveLength(10);
        // All subtopics should have been processed
        expect(callTimes).toHaveLength(10);
      }
    });

    it("should share OpenAI client across all subtopics", async () => {
      const { generateCruxForSubtopic } = await import("../model.js");
      const clientInstances = new Set();

      // Track OpenAI client instances
      vi.mocked(generateCruxForSubtopic).mockImplementation(async (input) => {
        clientInstances.add(input.openaiClient);
        return {
          tag: "success",
          value: {
            crux: {
              crux: {
                cruxClaim: "Test crux",
                agree: ["0"],
                disagree: ["1"],
                no_clear_position: [],
                explanation: "Test",
              },
            },
            usage: {
              prompt_tokens: 200,
              completion_tokens: 100,
              total_tokens: 300,
            },
          },
        };
      });

      const claimsTree: ClaimsTree = {
        Topic1: {
          subtopics: {
            Sub1: {
              claims: [
                createSampleClaim("C1", "Alice", "c1"),
                createSampleClaim("C2", "Bob", "c2"),
              ],
            },
          },
        },
        Topic2: {
          subtopics: {
            Sub2: {
              claims: [
                createSampleClaim("C3", "Charlie", "c3"),
                createSampleClaim("C4", "Diana", "c4"),
              ],
            },
          },
        },
      };

      const topics: Topic[] = [
        {
          topicName: "Topic1",
          topicShortDescription: "Topic 1",
          subtopics: [{ subtopicName: "Sub1", subtopicShortDescription: "S1" }],
        },
        {
          topicName: "Topic2",
          topicShortDescription: "Topic 2",
          subtopics: [{ subtopicName: "Sub2", subtopicShortDescription: "S2" }],
        },
      ];

      await extractCruxes(claimsTree, topics, llmConfig, "fake-api-key");

      // Should use the same client instance for all subtopics
      expect(clientInstances.size).toBe(1);
    });

    it("should filter out invalid speaker IDs and continue with valid ones", async () => {
      const { generateCruxForSubtopic } = await import("../model.js");

      // Create a simple claims tree with just 2 speakers for easier testing
      const simpleClaimsTree: ClaimsTree = {
        "Test Topic": {
          subtopics: {
            "Test Subtopic": {
              claims: [
                createSampleClaim("First claim", "Speaker1", "c1"),
                createSampleClaim("Second claim", "Speaker2", "c2"),
              ],
            },
          },
        },
      };

      const simpleTopics: Topic[] = [
        {
          topicName: "Test Topic",
          topicShortDescription: "A test topic",
          subtopics: [
            {
              subtopicName: "Test Subtopic",
              subtopicShortDescription: "A test subtopic",
            },
          ],
        },
      ];

      // Configure mock to return mixed valid/invalid speaker IDs
      // Valid IDs for this tree are "0" (Speaker1) and "1" (Speaker2)
      const mockFn = vi.mocked(generateCruxForSubtopic);
      mockFn.mockImplementationOnce(async () => ({
        tag: "success",
        value: {
          crux: {
            crux: {
              cruxClaim: "Test crux with mixed IDs",
              agree: ["0", "invalid_999"], // 0 is valid, invalid_999 is not
              disagree: ["1", "invalid_888"], // 1 is valid, invalid_888 is not
              no_clear_position: ["invalid_777"], // All invalid
              explanation: "Test explanation",
            },
          },
          usage: {
            prompt_tokens: 200,
            completion_tokens: 100,
            total_tokens: 300,
          },
        },
      }));

      const result = await extractCruxes(
        simpleClaimsTree,
        simpleTopics,
        llmConfig,
        "fake-api-key",
      );

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        // Should have one crux that continued despite invalid IDs
        expect(result.value.subtopicCruxes).toHaveLength(1);
        const crux = result.value.subtopicCruxes[0];

        // Should have filtered out invalid IDs but kept valid ones
        expect(crux.agree.length).toBe(1);
        expect(crux.disagree.length).toBe(1);
        expect(crux.no_clear_position.length).toBe(0); // All were invalid

        // Verify the valid speakers were kept (in "id:name" format)
        expect(crux.agree[0]).toContain("Speaker1");
        expect(crux.disagree[0]).toContain("Speaker2");
      }
    });
  });
});
