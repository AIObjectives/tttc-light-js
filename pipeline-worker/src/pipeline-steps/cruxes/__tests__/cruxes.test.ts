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
        input_tokens: 200,
        output_tokens: 100,
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
    tokenCost: vi.fn(() => ({ tag: "success", value: 0.0001 })),
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

/** Input parameters for creating a sample claim */
interface ClaimInput {
  claim: string;
  speaker: string;
  commentId: string;
  topicName?: string;
  subtopicName?: string;
}

/** Creates a claim with default topic/subtopic values */
const createClaim = (input: ClaimInput): Claim => ({
  claim: input.claim,
  quote: input.claim,
  speaker: input.speaker,
  commentId: input.commentId,
  topicName: input.topicName ?? "Climate Change",
  subtopicName: input.subtopicName ?? "Carbon Emissions",
});

/** Helper to create a subtopic node with claims */
const createSubtopicNode = (claims: Claim[]) => ({
  total: claims.length,
  claims,
});

/** Helper to create a topic node with subtopics */
const createTopicNode = (
  subtopics: Record<string, { total: number; claims: Claim[] }>,
) => {
  const total = Object.values(subtopics).reduce(
    (sum, s) => sum + s.claims.length,
    0,
  );
  return { total, subtopics };
};

/** Creates a multi-topic claims tree for testing */
const createMultiTopicClaimsTree = (): ClaimsTree => ({
  "Climate Change": createTopicNode({
    "Carbon Emissions": createSubtopicNode([
      createClaim({
        claim: "Reduce emissions",
        speaker: "Alice",
        commentId: "c1",
      }),
      createClaim({ claim: "Carbon tax", speaker: "Bob", commentId: "c2" }),
    ]),
    "Renewable Energy": createSubtopicNode([
      createClaim({
        claim: "Solar power",
        speaker: "Charlie",
        commentId: "c3",
        topicName: "Climate Change",
        subtopicName: "Renewable Energy",
      }),
      createClaim({
        claim: "Wind power",
        speaker: "Diana",
        commentId: "c4",
        topicName: "Climate Change",
        subtopicName: "Renewable Energy",
      }),
    ]),
  }),
  Transportation: createTopicNode({
    "Public Transit": createSubtopicNode([
      createClaim({
        claim: "Buses are efficient",
        speaker: "Eve",
        commentId: "c5",
        topicName: "Transportation",
        subtopicName: "Public Transit",
      }),
      createClaim({
        claim: "Trains are better",
        speaker: "Frank",
        commentId: "c6",
        topicName: "Transportation",
        subtopicName: "Public Transit",
      }),
    ]),
  }),
});

/** Creates topics config for multi-topic test */
const createMultiTopicConfig = (): Topic[] => [
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

/** Creates test data for concurrency testing */
const createConcurrencyTestData = (count: number) => {
  const claimsTree: ClaimsTree = {};
  const topics: Topic[] = [];
  for (let i = 0; i < count; i++) {
    const topicName = `Topic${i}`;
    const subtopicName = `Subtopic${i}`;
    claimsTree[topicName] = createTopicNode({
      [subtopicName]: createSubtopicNode([
        createClaim({
          claim: `Claim ${i}A`,
          speaker: "Alice",
          commentId: `c${i}a`,
          topicName,
          subtopicName,
        }),
        createClaim({
          claim: `Claim ${i}B`,
          speaker: "Bob",
          commentId: `c${i}b`,
          topicName,
          subtopicName,
        }),
      ]),
    });
    topics.push({
      topicName,
      topicShortDescription: `Topic ${i}`,
      subtopics: [{ subtopicName, subtopicShortDescription: `Subtopic ${i}` }],
    });
  }
  return { claimsTree, topics };
};

/** Creates simple test data for speaker ID validation */
const createSpeakerValidationTestData = () => {
  const claimsTree: ClaimsTree = {
    "Test Topic": createTopicNode({
      "Test Subtopic": createSubtopicNode([
        createClaim({
          claim: "First claim",
          speaker: "Speaker1",
          commentId: "c1",
          topicName: "Test Topic",
          subtopicName: "Test Subtopic",
        }),
        createClaim({
          claim: "Second claim",
          speaker: "Speaker2",
          commentId: "c2",
          topicName: "Test Topic",
          subtopicName: "Test Subtopic",
        }),
      ]),
    }),
  };
  const topics: Topic[] = [
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
  return { claimsTree, topics };
};

describe("Cruxes Extraction Pipeline Step", () => {
  const llmConfig: LLMConfig = {
    model_name: "gpt-4o-mini",
    system_prompt: "You are a research assistant.",
    user_prompt: "Identify the crux of disagreement:",
  };

  const createSampleClaimsTree = (): ClaimsTree => {
    const claims = [
      createClaim({
        claim: "We need to reduce emissions",
        speaker: "Alice",
        commentId: "c1",
      }),
      createClaim({
        claim: "Carbon tax is effective",
        speaker: "Bob",
        commentId: "c2",
      }),
      createClaim({
        claim: "Industry should lead",
        speaker: "Charlie",
        commentId: "c3",
      }),
      createClaim({
        claim: "Government regulation is key",
        speaker: "Diana",
        commentId: "c4",
      }),
    ];
    return {
      "Climate Change": createTopicNode({
        "Carbon Emissions": createSubtopicNode(claims),
      }),
    };
  };

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
      const claimsTree = createMultiTopicClaimsTree();
      const topics = createMultiTopicConfig();

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
        "Climate Change": createTopicNode({
          "Carbon Emissions": createSubtopicNode([
            createClaim({
              claim: "Reduce emissions",
              speaker: "Alice",
              commentId: "c1",
            }),
            createClaim({
              claim: "Carbon tax",
              speaker: "Bob",
              commentId: "c2",
            }),
          ]),
          "Single Claim Topic": createSubtopicNode([
            createClaim({
              claim: "Only one claim",
              speaker: "Charlie",
              commentId: "c3",
              topicName: "Climate Change",
              subtopicName: "Single Claim Topic",
            }),
          ]),
        }),
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
      const { claimsTree, topics } = createConcurrencyTestData(2);

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

      vi.mocked(generateCruxForSubtopic).mockImplementation(async (input) => {
        callTimes.push(Date.now());
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
                explanation: "Test",
              },
            },
            usage: { input_tokens: 200, output_tokens: 100, total_tokens: 300 },
          },
        };
      });

      const { claimsTree, topics } = createConcurrencyTestData(10);
      const result = await extractCruxes(
        claimsTree,
        topics,
        llmConfig,
        "fake-api-key",
      );

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        expect(result.value.subtopicCruxes).toHaveLength(10);
        expect(callTimes).toHaveLength(10);
      }
    });

    it("should share OpenAI client across all subtopics", async () => {
      const { generateCruxForSubtopic } = await import("../model.js");
      const clientInstances = new Set();

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
            usage: { input_tokens: 200, output_tokens: 100, total_tokens: 300 },
          },
        };
      });

      const { claimsTree, topics } = createConcurrencyTestData(2);
      await extractCruxes(claimsTree, topics, llmConfig, "fake-api-key");

      expect(clientInstances.size).toBe(1);
    });

    it("should filter out invalid speaker IDs and continue with valid ones", async () => {
      const { generateCruxForSubtopic } = await import("../model.js");
      const { claimsTree, topics } = createSpeakerValidationTestData();

      // Mock returns mixed valid/invalid speaker IDs (valid: "0", "1")
      vi.mocked(generateCruxForSubtopic).mockImplementationOnce(async () => ({
        tag: "success",
        value: {
          crux: {
            crux: {
              cruxClaim: "Test crux with mixed IDs",
              agree: ["0", "invalid_999"],
              disagree: ["1", "invalid_888"],
              no_clear_position: ["invalid_777"],
              explanation: "Test explanation",
            },
          },
          usage: { input_tokens: 200, output_tokens: 100, total_tokens: 300 },
        },
      }));

      const result = await extractCruxes(
        claimsTree,
        topics,
        llmConfig,
        "fake-api-key",
      );

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        expect(result.value.subtopicCruxes).toHaveLength(1);
        const crux = result.value.subtopicCruxes[0];
        expect(crux.agree.length).toBe(1);
        expect(crux.disagree.length).toBe(1);
        expect(crux.no_clear_position.length).toBe(0);
        expect(crux.agree[0]).toContain("Speaker1");
        expect(crux.disagree[0]).toContain("Speaker2");
      }
    });
  });
});
