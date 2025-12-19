/**
 * Tests for claims extraction pipeline step
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the model
vi.mock("../model", () => ({
  extractClaimsFromComment: vi.fn(async (input) => ({
    tag: "success",
    value: {
      claims: [
        {
          claim: "Test claim about cats",
          quote: input.commentText.substring(0, 20),
          topicName: "Pets",
          subtopicName: "Cats",
          speaker: input.speaker,
          commentId: input.commentId,
        },
      ],
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        total_tokens: 150,
      },
      cost: 0.0001,
    },
  })),
}));

import { extractClaims } from "../index";
import type { Comment, LLMConfig, Topic } from "../types";
import { extractSubtopicNames, extractTopicNames, tokenCost } from "../utils";

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

describe("Claims Extraction Pipeline Step", () => {
  const sampleTaxonomy: Topic[] = [
    {
      topicName: "Pets",
      topicShortDescription: "Opinions about pets",
      subtopics: [
        {
          subtopicName: "Cats",
          subtopicShortDescription: "Cats as pets",
        },
        {
          subtopicName: "Dogs",
          subtopicShortDescription: "Dogs as pets",
        },
      ],
    },
    {
      topicName: "Transportation",
      topicShortDescription: "Transportation options",
      subtopics: [
        {
          subtopicName: "Public Transit",
          subtopicShortDescription: "Buses and trains",
        },
      ],
    },
  ];

  const llmConfig: LLMConfig = {
    model_name: "gpt-4o-mini",
    system_prompt: "You are a research assistant.",
    user_prompt: "Extract claims from this comment:",
  };

  describe("extractClaims", () => {
    it("should extract claims and return tree structure with usage", async () => {
      const comments: Comment[] = [
        {
          id: "c1",
          text: "I love cats, they are the best pets.",
          speaker: "Alice",
        },
      ];

      const result = await extractClaims(
        comments,
        sampleTaxonomy,
        llmConfig,
        "fake-api-key",
      );

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        expect(result.value.data).toHaveProperty("Pets");
        expect(result.value.data.Pets.subtopics).toHaveProperty("Cats");
        expect(result.value.data.Pets.subtopics.Cats.claims).toHaveLength(1);
        expect(result.value.data.Pets.total).toBe(1);
        expect(result.value.usage.input_tokens).toBeGreaterThan(0);
        expect(result.value.usage.output_tokens).toBeGreaterThan(0);
        expect(result.value.cost).toBeGreaterThan(0);
      }
    });

    it("should handle multiple comments", async () => {
      const comments: Comment[] = [
        {
          id: "c1",
          text: "I love cats, they are the best pets.",
          speaker: "Alice",
        },
        {
          id: "c2",
          text: "Dogs are amazing companions.",
          speaker: "Bob",
        },
      ];

      const result = await extractClaims(
        comments,
        sampleTaxonomy,
        llmConfig,
        "fake-api-key",
      );

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        expect(result.value.data.Pets.total).toBe(2);
        expect(result.value.usage.input_tokens).toBeGreaterThan(0);
      }
    });

    it("should handle empty comments array", async () => {
      const result = await extractClaims(
        [],
        sampleTaxonomy,
        llmConfig,
        "fake-api-key",
      );

      expect(result.tag).toBe("failure");
    });

    it("should fail with empty taxonomy", async () => {
      const comments: Comment[] = [
        {
          id: "c1",
          text: "I love cats.",
          speaker: "Alice",
        },
      ];

      const result = await extractClaims(
        comments,
        [],
        llmConfig,
        "fake-api-key",
      );

      expect(result.tag).toBe("failure");
    });

    it("should filter out non-meaningful comments", async () => {
      const comments: Comment[] = [
        {
          id: "c1",
          text: "I love cats, they are the best pets.",
          speaker: "Alice",
        },
        {
          id: "c2",
          text: "ok",
          speaker: "Bob",
        },
      ];

      const result = await extractClaims(
        comments,
        sampleTaxonomy,
        llmConfig,
        "fake-api-key",
      );

      expect(result.tag).toBe("success");
      // Should only process the meaningful comment
    });

    it("should initialize all topics and subtopics in tree", async () => {
      const comments: Comment[] = [
        {
          id: "c1",
          text: "I love cats.",
          speaker: "Alice",
        },
      ];

      const result = await extractClaims(
        comments,
        sampleTaxonomy,
        llmConfig,
        "fake-api-key",
      );

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        // All topics should exist
        expect(result.value.data).toHaveProperty("Pets");
        expect(result.value.data).toHaveProperty("Transportation");

        // All subtopics should exist even with 0 claims
        expect(result.value.data.Pets.subtopics).toHaveProperty("Cats");
        expect(result.value.data.Pets.subtopics).toHaveProperty("Dogs");
        expect(result.value.data.Transportation.subtopics).toHaveProperty(
          "Public Transit",
        );
      }
    });

    it("should aggregate usage and cost across multiple comments", async () => {
      const comments: Comment[] = [
        {
          id: "c1",
          text: "I love cats.",
          speaker: "Alice",
        },
        {
          id: "c2",
          text: "Dogs are great.",
          speaker: "Bob",
        },
        {
          id: "c3",
          text: "Public transit is convenient.",
          speaker: "Charlie",
        },
      ];

      const result = await extractClaims(
        comments,
        sampleTaxonomy,
        llmConfig,
        "fake-api-key",
      );

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        // Usage should be aggregated from all 3 comments
        expect(result.value.usage.input_tokens).toBe(300); // 100 * 3
        expect(result.value.usage.output_tokens).toBe(150); // 50 * 3
        expect(result.value.usage.total_tokens).toBe(450);
        expect(result.value.cost).toBeCloseTo(0.0003, 5); // 0.0001 * 3
      }
    });

    it("should fail when more than 50% of comments fail to extract", async () => {
      // Create 4 comments where 3 will fail (75% failure rate)
      const comments: Comment[] = [
        {
          id: "c1",
          text: "Valid comment about cats.",
          speaker: "Alice",
        },
        {
          id: "c2",
          text: "Another valid comment.",
          speaker: "Bob",
        },
        {
          id: "c3",
          text: "Third valid comment.",
          speaker: "Charlie",
        },
        {
          id: "c4",
          text: "Fourth valid comment.",
          speaker: "Dave",
        },
      ];

      // Temporarily override the mock to simulate failures
      const { extractClaimsFromComment } =
        await vi.importMock<typeof import("../model.js")>("../model.js");

      // Save the original implementation
      const originalImplementation = (
        extractClaimsFromComment as any
      ).getMockImplementation();

      let callCount = 0;
      (extractClaimsFromComment as any).mockImplementation(
        async (input: any) => {
          callCount++;
          // Fail for first 3 calls
          if (callCount <= 3) {
            return {
              tag: "failure",
              error: new Error("API call failed"),
            };
          }
          // Succeed for the 4th call
          return {
            tag: "success",
            value: {
              claims: [],
              usage: {
                input_tokens: 100,
                output_tokens: 50,
                total_tokens: 150,
              },
              cost: 0.0001,
            },
          };
        },
      );

      const result = await extractClaims(
        comments,
        sampleTaxonomy,
        llmConfig,
        "fake-api-key",
      );

      expect(result.tag).toBe("failure");
      if (result.tag === "failure") {
        expect(result.error.message).toContain("High failure rate detected");
        expect(result.error.message).toContain("3/4");
      }

      // Restore the original mock implementation
      (extractClaimsFromComment as any).mockImplementation(
        originalImplementation ||
          (async (input: any) => ({
            tag: "success",
            value: {
              claims: [
                {
                  claim: "Test claim about cats",
                  quote: input.commentText.substring(0, 20),
                  topicName: "Pets",
                  subtopicName: "Cats",
                  speaker: input.speaker,
                  commentId: input.commentId,
                },
              ],
              usage: {
                input_tokens: 100,
                output_tokens: 50,
                total_tokens: 150,
              },
              cost: 0.0001,
            },
          })),
      );
    });
  });

  describe("utils", () => {
    describe("tokenCost", () => {
      it("should calculate cost for gpt-4o-mini", () => {
        const result = tokenCost("gpt-4o-mini", 1000, 500);
        expect(result.tag).toBe("success");
        if (result.tag === "success") {
          expect(result.value).toBeCloseTo(0.00015 + 0.0003, 5); // 0.00045
        }
      });

      it("should return error for unknown models", () => {
        const result = tokenCost("unknown-model", 1000, 500);
        expect(result.tag).toBe("failure");
        if (result.tag === "failure") {
          expect(result.error.name).toBe("UnknownModelError");
          expect(result.error.message).toContain("unknown-model");
        }
      });
    });

    describe("extractTopicNames", () => {
      it("should extract all topic names", () => {
        const names = extractTopicNames(sampleTaxonomy);
        expect(names).toEqual(["Pets", "Transportation"]);
      });

      it("should handle empty taxonomy", () => {
        const names = extractTopicNames([]);
        expect(names).toEqual([]);
      });
    });

    describe("extractSubtopicNames", () => {
      it("should extract all subtopic names", () => {
        const names = extractSubtopicNames(sampleTaxonomy);
        expect(names).toEqual(["Cats", "Dogs", "Public Transit"]);
      });

      it("should handle empty taxonomy", () => {
        const names = extractSubtopicNames([]);
        expect(names).toEqual([]);
      });

      it("should handle topics with no subtopics", () => {
        const taxonomy: Topic[] = [
          {
            topicName: "Empty Topic",
            topicShortDescription: "A topic",
            subtopics: [],
          },
        ];
        const names = extractSubtopicNames(taxonomy);
        expect(names).toEqual([]);
      });
    });
  });

  describe("tree building", () => {
    it("should correctly count claims per subtopic", async () => {
      // Mock to return multiple claims from one comment
      const { extractClaimsFromComment } = await import("../model.js");
      vi.mocked(extractClaimsFromComment).mockResolvedValueOnce({
        tag: "success",
        value: {
          claims: [
            {
              claim: "Cats are independent",
              quote: "I love cats",
              topicName: "Pets",
              subtopicName: "Cats",
              speaker: "Alice",
              commentId: "c1",
            },
            {
              claim: "Cats are clean",
              quote: "they are clean",
              topicName: "Pets",
              subtopicName: "Cats",
              speaker: "Alice",
              commentId: "c1",
            },
          ],
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            total_tokens: 150,
          },
          cost: 0.0001,
        },
      });

      const comments: Comment[] = [
        {
          id: "c1",
          text: "I love cats, they are clean.",
          speaker: "Alice",
        },
      ];

      const result = await extractClaims(
        comments,
        sampleTaxonomy,
        llmConfig,
        "fake-api-key",
      );

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        expect(result.value.data.Pets.subtopics.Cats.total).toBe(2);
        expect(result.value.data.Pets.total).toBe(2);
        expect(result.value.data.Pets.subtopics.Cats.claims).toHaveLength(2);
      }
    });

    it("should correctly track speaker information", async () => {
      const comments: Comment[] = [
        {
          id: "c1",
          text: "I love cats.",
          speaker: "Alice",
        },
      ];

      const result = await extractClaims(
        comments,
        sampleTaxonomy,
        llmConfig,
        "fake-api-key",
      );

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        const claim = result.value.data.Pets.subtopics.Cats.claims[0];
        expect(claim.speaker).toBe("Alice");
        expect(claim.commentId).toBe("c1");
      }
    });
  });

  describe("error handling", () => {
    it("should continue processing when one comment fails", async () => {
      const { extractClaimsFromComment } = await import("../model.js");

      // First call fails, second succeeds
      vi.mocked(extractClaimsFromComment)
        .mockResolvedValueOnce({
          tag: "failure",
          error: new Error("API error"),
        })
        .mockResolvedValueOnce({
          tag: "success",
          value: {
            claims: [
              {
                claim: "Dogs are great",
                quote: "dogs are great",
                topicName: "Pets",
                subtopicName: "Dogs",
                speaker: "Bob",
                commentId: "c2",
              },
            ],
            usage: {
              input_tokens: 100,
              output_tokens: 50,
              total_tokens: 150,
            },
            cost: 0.0001,
          },
        });

      const comments: Comment[] = [
        {
          id: "c1",
          text: "I love cats.",
          speaker: "Alice",
        },
        {
          id: "c2",
          text: "Dogs are great.",
          speaker: "Bob",
        },
      ];

      const result = await extractClaims(
        comments,
        sampleTaxonomy,
        llmConfig,
        "fake-api-key",
      );

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        // Should have processed the second comment despite first failing
        expect(result.value.data.Pets.subtopics.Dogs.total).toBe(1);
      }
    });
  });
});
