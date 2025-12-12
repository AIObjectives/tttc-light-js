/**
 * Tests for sort-and-deduplicate pipeline step
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

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

// Mock the deduplication model
vi.mock("../model.js", () => ({
  callDeduplicationModel: vi.fn(
    async (client, claims, llmConfig, topicName, subtopicName, reportId) => {
      // Simulate LLM grouping: group claims with same claim text
      const groups: Map<string, number[]> = new Map();

      claims.forEach((claim: any, index: number) => {
        const claimText = claim.claim;
        if (groups.has(claimText)) {
          groups.get(claimText)!.push(index);
        } else {
          groups.set(claimText, [index]);
        }
      });

      const groupedClaims = Array.from(groups.entries()).map(
        ([claimText, ids]) => ({
          claimText,
          originalClaimIds: ids.map((id) => `claimId${id}`),
        }),
      );

      return {
        tag: "success",
        value: {
          dedupClaims: { groupedClaims },
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            total_tokens: 150,
          },
        },
      };
    },
  ),
}));

import { sortAndDeduplicateClaims } from "../index.js";
import type { ClaimsTree, SortAndDeduplicateInput, Claim } from "../types.js";

describe("Sort and Deduplicate Pipeline Step", () => {
  describe("sortAndDeduplicateClaims", () => {
    it("should deduplicate claims with same claim text", async () => {
      const tree: ClaimsTree = {
        Pets: {
          total: 2,
          subtopics: {
            Cats: {
              total: 2,
              claims: [
                {
                  claim: "Cats are the best pets.",
                  commentId: "c1",
                  quote: "I love cats.",
                  speaker: "Alice",
                  topicName: "Pets",
                  subtopicName: "Cats",
                },
                {
                  claim: "Cats are the best pets.",
                  commentId: "c2",
                  quote: "I really really love cats",
                  speaker: "Bob",
                  topicName: "Pets",
                  subtopicName: "Cats",
                },
              ],
            },
          },
        },
      };

      const input: SortAndDeduplicateInput = {
        tree,
        llm: {
          model_name: "gpt-4o-mini",
          system_prompt: "You are a deduplication assistant.",
          user_prompt: "Group similar claims:",
        },
        sort: "numPeople",
      };

      const result = await sortAndDeduplicateClaims(input, "fake-api-key");

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        expect(result.value.data).toHaveLength(1);

        const [topicName, topicData] = result.value.data[0];
        expect(topicName).toBe("Pets");
        expect(topicData.topics).toHaveLength(1);

        const [subtopicName, subtopicData] = topicData.topics[0];
        expect(subtopicName).toBe("Cats");
        expect(subtopicData.claims).toHaveLength(1);

        // First claim should have second as duplicate
        const primaryClaim = subtopicData.claims[0];
        expect(primaryClaim.claim).toBe("Cats are the best pets.");
        expect(primaryClaim.duplicates).toHaveLength(1);
        expect(primaryClaim.duplicates![0].commentId).toBe("c2");
        expect(primaryClaim.duplicates![0].duplicated).toBe(true);

        // Should track both speakers
        expect(subtopicData.speakers).toHaveLength(2);
        expect(subtopicData.speakers).toContain("Alice");
        expect(subtopicData.speakers).toContain("Bob");
      }
    });

    it("should sort topics by number of speakers when sort=numPeople", async () => {
      const tree: ClaimsTree = {
        "Topic A": {
          total: 1,
          subtopics: {
            "Subtopic A1": {
              total: 1,
              claims: [
                {
                  claim: "Claim A1",
                  commentId: "c1",
                  quote: "Quote A1",
                  speaker: "Alice",
                  topicName: "Topic A",
                  subtopicName: "Subtopic A1",
                },
              ],
            },
          },
        },
        "Topic B": {
          total: 3,
          subtopics: {
            "Subtopic B1": {
              total: 3,
              claims: [
                {
                  claim: "Claim B1",
                  commentId: "c2",
                  quote: "Quote B1",
                  speaker: "Bob",
                  topicName: "Topic B",
                  subtopicName: "Subtopic B1",
                },
                {
                  claim: "Claim B2",
                  commentId: "c3",
                  quote: "Quote B2",
                  speaker: "Charlie",
                  topicName: "Topic B",
                  subtopicName: "Subtopic B1",
                },
                {
                  claim: "Claim B3",
                  commentId: "c4",
                  quote: "Quote B3",
                  speaker: "Diana",
                  topicName: "Topic B",
                  subtopicName: "Subtopic B1",
                },
              ],
            },
          },
        },
      };

      const input: SortAndDeduplicateInput = {
        tree,
        llm: {
          model_name: "gpt-4o-mini",
          system_prompt: "You are a deduplication assistant.",
          user_prompt: "Group similar claims:",
        },
        sort: "numPeople",
      };

      const result = await sortAndDeduplicateClaims(input, "fake-api-key");

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        // Topic B should come first (3 speakers vs 1 speaker)
        expect(result.value.data[0][0]).toBe("Topic B");
        expect(result.value.data[1][0]).toBe("Topic A");

        expect(result.value.data[0][1].counts.speakers).toBe(3);
        expect(result.value.data[1][1].counts.speakers).toBe(1);
      }
    });

    it("should sort topics by number of claims when sort=numClaims", async () => {
      const tree: ClaimsTree = {
        "Topic A": {
          total: 2,
          subtopics: {
            "Subtopic A1": {
              total: 2,
              claims: [
                {
                  claim: "Claim A1",
                  commentId: "c1",
                  quote: "Quote A1",
                  speaker: "Alice",
                  topicName: "Topic A",
                  subtopicName: "Subtopic A1",
                },
                {
                  claim: "Claim A2",
                  commentId: "c2",
                  quote: "Quote A2",
                  speaker: "Alice",
                  topicName: "Topic A",
                  subtopicName: "Subtopic A1",
                },
              ],
            },
          },
        },
        "Topic B": {
          total: 5,
          subtopics: {
            "Subtopic B1": {
              total: 5,
              claims: [
                {
                  claim: "Claim B1",
                  commentId: "c3",
                  quote: "Quote B1",
                  speaker: "Bob",
                  topicName: "Topic B",
                  subtopicName: "Subtopic B1",
                },
                {
                  claim: "Claim B2",
                  commentId: "c4",
                  quote: "Quote B2",
                  speaker: "Bob",
                  topicName: "Topic B",
                  subtopicName: "Subtopic B1",
                },
                {
                  claim: "Claim B3",
                  commentId: "c5",
                  quote: "Quote B3",
                  speaker: "Bob",
                  topicName: "Topic B",
                  subtopicName: "Subtopic B1",
                },
                {
                  claim: "Claim B4",
                  commentId: "c6",
                  quote: "Quote B4",
                  speaker: "Bob",
                  topicName: "Topic B",
                  subtopicName: "Subtopic B1",
                },
                {
                  claim: "Claim B5",
                  commentId: "c7",
                  quote: "Quote B5",
                  speaker: "Bob",
                  topicName: "Topic B",
                  subtopicName: "Subtopic B1",
                },
              ],
            },
          },
        },
      };

      const input: SortAndDeduplicateInput = {
        tree,
        llm: {
          model_name: "gpt-4o-mini",
          system_prompt: "You are a deduplication assistant.",
          user_prompt: "Group similar claims:",
        },
        sort: "numClaims",
      };

      const result = await sortAndDeduplicateClaims(input, "fake-api-key");

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        // Topic B should come first (5 claims vs 2 claims)
        expect(result.value.data[0][0]).toBe("Topic B");
        expect(result.value.data[1][0]).toBe("Topic A");

        expect(result.value.data[0][1].counts.claims).toBe(5);
        expect(result.value.data[1][1].counts.claims).toBe(2);
      }
    });

    it("should sort claims by number of duplicates within subtopic", async () => {
      const tree: ClaimsTree = {
        Pets: {
          total: 4,
          subtopics: {
            Cats: {
              total: 4,
              claims: [
                {
                  claim: "Cats are cute.",
                  commentId: "c1",
                  quote: "Cats are very cute.",
                  speaker: "Alice",
                  topicName: "Pets",
                  subtopicName: "Cats",
                },
                {
                  claim: "Cats are independent.",
                  commentId: "c2",
                  quote: "Cats are independent animals.",
                  speaker: "Bob",
                  topicName: "Pets",
                  subtopicName: "Cats",
                },
                {
                  claim: "Cats are independent.",
                  commentId: "c3",
                  quote: "I like independent cats.",
                  speaker: "Charlie",
                  topicName: "Pets",
                  subtopicName: "Cats",
                },
                {
                  claim: "Cats are independent.",
                  commentId: "c4",
                  quote: "Cats independence is great.",
                  speaker: "Diana",
                  topicName: "Pets",
                  subtopicName: "Cats",
                },
              ],
            },
          },
        },
      };

      const input: SortAndDeduplicateInput = {
        tree,
        llm: {
          model_name: "gpt-4o-mini",
          system_prompt: "You are a deduplication assistant.",
          user_prompt: "Group similar claims:",
        },
        sort: "numPeople",
      };

      const result = await sortAndDeduplicateClaims(input, "fake-api-key");

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        const subtopicData = result.value.data[0][1].topics[0][1];
        expect(subtopicData.claims).toHaveLength(2);

        // First claim should be "Cats are independent." with 2 duplicates
        expect(subtopicData.claims[0].claim).toBe("Cats are independent.");
        expect(subtopicData.claims[0].duplicates).toHaveLength(2);

        // Second claim should be "Cats are cute." with 0 duplicates
        expect(subtopicData.claims[1].claim).toBe("Cats are cute.");
        expect(subtopicData.claims[1].duplicates).toHaveLength(0);
      }
    });

    it("should handle single claim subtopics without deduplication", async () => {
      const tree: ClaimsTree = {
        Pets: {
          total: 1,
          subtopics: {
            Dogs: {
              total: 1,
              claims: [
                {
                  claim: "Dogs are loyal.",
                  commentId: "c1",
                  quote: "Dogs are very loyal.",
                  speaker: "Alice",
                  topicName: "Pets",
                  subtopicName: "Dogs",
                },
              ],
            },
          },
        },
      };

      const input: SortAndDeduplicateInput = {
        tree,
        llm: {
          model_name: "gpt-4o-mini",
          system_prompt: "You are a deduplication assistant.",
          user_prompt: "Group similar claims:",
        },
        sort: "numPeople",
      };

      const result = await sortAndDeduplicateClaims(input, "fake-api-key");

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        const subtopicData = result.value.data[0][1].topics[0][1];
        expect(subtopicData.claims).toHaveLength(1);
        expect(subtopicData.claims[0].duplicates).toHaveLength(0);
        expect(subtopicData.speakers).toContain("Alice");
      }
    });

    it("should return usage and cost information", async () => {
      const tree: ClaimsTree = {
        Pets: {
          total: 2,
          subtopics: {
            Cats: {
              total: 2,
              claims: [
                {
                  claim: "Cats are great.",
                  commentId: "c1",
                  quote: "I love cats.",
                  speaker: "Alice",
                  topicName: "Pets",
                  subtopicName: "Cats",
                },
                {
                  claim: "Cats are great.",
                  commentId: "c2",
                  quote: "Cats are awesome.",
                  speaker: "Bob",
                  topicName: "Pets",
                  subtopicName: "Cats",
                },
              ],
            },
          },
        },
      };

      const input: SortAndDeduplicateInput = {
        tree,
        llm: {
          model_name: "gpt-4o-mini",
          system_prompt: "You are a deduplication assistant.",
          user_prompt: "Group similar claims:",
        },
        sort: "numPeople",
      };

      const result = await sortAndDeduplicateClaims(input, "fake-api-key");

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        expect(result.value.usage.input_tokens).toBeGreaterThan(0);
        expect(result.value.usage.output_tokens).toBeGreaterThan(0);
        expect(result.value.usage.total_tokens).toBeGreaterThan(0);
        expect(result.value.cost).toBeGreaterThanOrEqual(0);
      }
    });

    it("should handle empty topics gracefully", async () => {
      const tree: ClaimsTree = {
        "Empty Topic": {
          total: 0,
          subtopics: {},
        },
        "Valid Topic": {
          total: 1,
          subtopics: {
            Subtopic: {
              total: 1,
              claims: [
                {
                  claim: "Valid claim",
                  commentId: "c1",
                  quote: "Valid quote",
                  speaker: "Alice",
                  topicName: "Valid Topic",
                  subtopicName: "Subtopic",
                },
              ],
            },
          },
        },
      };

      const input: SortAndDeduplicateInput = {
        tree,
        llm: {
          model_name: "gpt-4o-mini",
          system_prompt: "You are a deduplication assistant.",
          user_prompt: "Group similar claims:",
        },
        sort: "numPeople",
      };

      const result = await sortAndDeduplicateClaims(input, "fake-api-key");

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        // Should only have the valid topic
        expect(result.value.data).toHaveLength(1);
        expect(result.value.data[0][0]).toBe("Valid Topic");
      }
    });

    it("should handle claims without speakers", async () => {
      const tree: ClaimsTree = {
        Pets: {
          total: 1,
          subtopics: {
            Dogs: {
              total: 1,
              claims: [
                {
                  claim: "Dogs are loyal.",
                  commentId: "c1",
                  quote: "Dogs are very loyal.",
                  topicName: "Pets",
                  subtopicName: "Dogs",
                  // speaker is optional
                },
              ],
            },
          },
        },
      };

      const input: SortAndDeduplicateInput = {
        tree,
        llm: {
          model_name: "gpt-4o-mini",
          system_prompt: "You are a deduplication assistant.",
          user_prompt: "Group similar claims:",
        },
        sort: "numPeople",
      };

      const result = await sortAndDeduplicateClaims(input, "fake-api-key");

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        const subtopicData = result.value.data[0][1].topics[0][1];
        expect(subtopicData.claims).toHaveLength(1);
        expect(subtopicData.speakers).toHaveLength(0);
      }
    });

    it("should sort subtopics within a topic", async () => {
      const tree: ClaimsTree = {
        Pets: {
          total: 4,
          subtopics: {
            Dogs: {
              total: 1,
              claims: [
                {
                  claim: "Dogs are loyal.",
                  commentId: "c1",
                  quote: "Dogs are loyal pets.",
                  speaker: "Alice",
                  topicName: "Pets",
                  subtopicName: "Dogs",
                },
              ],
            },
            Cats: {
              total: 3,
              claims: [
                {
                  claim: "Cats are independent.",
                  commentId: "c2",
                  quote: "Cats are independent animals.",
                  speaker: "Bob",
                  topicName: "Pets",
                  subtopicName: "Cats",
                },
                {
                  claim: "Cats are cute.",
                  commentId: "c3",
                  quote: "Cats are cute creatures.",
                  speaker: "Charlie",
                  topicName: "Pets",
                  subtopicName: "Cats",
                },
                {
                  claim: "Cats are playful.",
                  commentId: "c4",
                  quote: "Cats love to play.",
                  speaker: "Diana",
                  topicName: "Pets",
                  subtopicName: "Cats",
                },
              ],
            },
          },
        },
      };

      const input: SortAndDeduplicateInput = {
        tree,
        llm: {
          model_name: "gpt-4o-mini",
          system_prompt: "You are a deduplication assistant.",
          user_prompt: "Group similar claims:",
        },
        sort: "numClaims",
      };

      const result = await sortAndDeduplicateClaims(input, "fake-api-key");

      expect(result.tag).toBe("success");
      if (result.tag === "success") {
        const topicData = result.value.data[0][1];
        expect(topicData.topics).toHaveLength(2);

        // Cats should come first (3 claims vs 1 claim)
        expect(topicData.topics[0][0]).toBe("Cats");
        expect(topicData.topics[1][0]).toBe("Dogs");

        expect(topicData.topics[0][1].counts.claims).toBe(3);
        expect(topicData.topics[1][1].counts.claims).toBe(1);
      }
    });
  });
});
