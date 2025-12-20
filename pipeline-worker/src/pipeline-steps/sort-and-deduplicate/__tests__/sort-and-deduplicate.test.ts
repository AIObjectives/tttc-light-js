/**
 * Tests for sort-and-deduplicate pipeline step
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

// Mock the deduplication model
vi.mock("../model.js", () => ({
  callDeduplicationModel: vi.fn(
    async (
      _client,
      claims,
      _llmConfig,
      _topicName,
      _subtopicName,
      _reportId,
    ) => {
      // Simulate LLM grouping: group claims with same claim text
      const groups: Map<string, number[]> = new Map();

      claims.forEach((claim: any, index: number) => {
        const claimText = claim.claim;
        if (groups.has(claimText)) {
          groups.get(claimText)?.push(index);
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
import type { Claim, ClaimsTree, SortAndDeduplicateInput } from "../types.js";

// Test helper functions to reduce duplication

interface ClaimParams {
  claim: string;
  commentId: string;
  quote: string;
  speaker: string;
  topicName: string;
  subtopicName: string;
}

function createClaim(params: ClaimParams): Claim {
  return {
    claim: params.claim,
    commentId: params.commentId,
    quote: params.quote,
    speaker: params.speaker,
    topicName: params.topicName,
    subtopicName: params.subtopicName,
  };
}

// Shorthand for creating claims in the same topic/subtopic
function makeClaim(
  claim: string,
  id: string,
  speaker: string,
  topic: string,
  subtopic: string,
): Claim {
  return createClaim({
    claim,
    commentId: id,
    quote: `Quote for ${claim}`,
    speaker,
    topicName: topic,
    subtopicName: subtopic,
  });
}

function createInput(
  tree: ClaimsTree,
  sort: "numPeople" | "numClaims",
): SortAndDeduplicateInput {
  return {
    tree,
    llm: {
      model_name: "gpt-4o-mini",
      system_prompt: "You are a deduplication assistant.",
      user_prompt: "Group similar claims:",
    },
    sort,
  };
}

async function runSortAndDeduplicate(
  tree: ClaimsTree,
  sort: "numPeople" | "numClaims",
) {
  const input = createInput(tree, sort);
  return await sortAndDeduplicateClaims(input, "fake-api-key");
}

function expectSuccessResult(result: any) {
  expect(result.tag).toBe("success");
  if (result.tag !== "success") {
    throw new Error("Expected success result");
  }
  return result.value;
}

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
                makeClaim(
                  "Cats are the best pets.",
                  "c1",
                  "Alice",
                  "Pets",
                  "Cats",
                ),
                makeClaim(
                  "Cats are the best pets.",
                  "c2",
                  "Bob",
                  "Pets",
                  "Cats",
                ),
              ],
            },
          },
        },
      };

      const result = await runSortAndDeduplicate(tree, "numPeople");
      const value = expectSuccessResult(result);

      expect(value.data).toHaveLength(1);

      const [topicName, topicData] = value.data[0];
      expect(topicName).toBe("Pets");
      expect(topicData.topics).toHaveLength(1);

      const [subtopicName, subtopicData] = topicData.topics[0];
      expect(subtopicName).toBe("Cats");
      expect(subtopicData.claims).toHaveLength(1);

      // First claim should have second as duplicate
      const primaryClaim = subtopicData.claims[0];
      expect(primaryClaim.claim).toBe("Cats are the best pets.");
      expect(primaryClaim.duplicates).toHaveLength(1);
      expect(primaryClaim.duplicates?.[0].commentId).toBe("c2");
      expect(primaryClaim.duplicates?.[0].duplicated).toBe(true);

      // Should track both speakers
      expect(subtopicData.speakers).toHaveLength(2);
      expect(subtopicData.speakers).toContain("Alice");
      expect(subtopicData.speakers).toContain("Bob");
    });

    it("should sort topics by number of speakers when sort=numPeople", async () => {
      const tree: ClaimsTree = {
        "Topic A": {
          total: 1,
          subtopics: {
            "Subtopic A1": {
              total: 1,
              claims: [
                makeClaim("Claim A1", "c1", "Alice", "Topic A", "Subtopic A1"),
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
                makeClaim("Claim B1", "c2", "Bob", "Topic B", "Subtopic B1"),
                makeClaim(
                  "Claim B2",
                  "c3",
                  "Charlie",
                  "Topic B",
                  "Subtopic B1",
                ),
                makeClaim("Claim B3", "c4", "Diana", "Topic B", "Subtopic B1"),
              ],
            },
          },
        },
      };

      const result = await runSortAndDeduplicate(tree, "numPeople");
      const value = expectSuccessResult(result);

      // Topic B should come first (3 speakers vs 1 speaker)
      expect(value.data[0][0]).toBe("Topic B");
      expect(value.data[1][0]).toBe("Topic A");

      expect(value.data[0][1].counts.speakers).toBe(3);
      expect(value.data[1][1].counts.speakers).toBe(1);
    });

    it("should sort topics by number of claims when sort=numClaims", async () => {
      const tree: ClaimsTree = {
        "Topic A": {
          total: 2,
          subtopics: {
            "Subtopic A1": {
              total: 2,
              claims: [
                makeClaim("Claim A1", "c1", "Alice", "Topic A", "Subtopic A1"),
                makeClaim("Claim A2", "c2", "Alice", "Topic A", "Subtopic A1"),
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
                makeClaim("Claim B1", "c3", "Bob", "Topic B", "Subtopic B1"),
                makeClaim("Claim B2", "c4", "Bob", "Topic B", "Subtopic B1"),
                makeClaim("Claim B3", "c5", "Bob", "Topic B", "Subtopic B1"),
                makeClaim("Claim B4", "c6", "Bob", "Topic B", "Subtopic B1"),
                makeClaim("Claim B5", "c7", "Bob", "Topic B", "Subtopic B1"),
              ],
            },
          },
        },
      };

      const result = await runSortAndDeduplicate(tree, "numClaims");
      const value = expectSuccessResult(result);

      // Topic B should come first (5 claims vs 2 claims)
      expect(value.data[0][0]).toBe("Topic B");
      expect(value.data[1][0]).toBe("Topic A");

      expect(value.data[0][1].counts.claims).toBe(5);
      expect(value.data[1][1].counts.claims).toBe(2);
    });

    it("should sort claims by number of duplicates within subtopic", async () => {
      const tree: ClaimsTree = {
        Pets: {
          total: 4,
          subtopics: {
            Cats: {
              total: 4,
              claims: [
                makeClaim("Cats are cute.", "c1", "Alice", "Pets", "Cats"),
                makeClaim("Cats are independent.", "c2", "Bob", "Pets", "Cats"),
                makeClaim(
                  "Cats are independent.",
                  "c3",
                  "Charlie",
                  "Pets",
                  "Cats",
                ),
                makeClaim(
                  "Cats are independent.",
                  "c4",
                  "Diana",
                  "Pets",
                  "Cats",
                ),
              ],
            },
          },
        },
      };

      const result = await runSortAndDeduplicate(tree, "numPeople");
      const value = expectSuccessResult(result);

      const subtopicData = value.data[0][1].topics[0][1];
      expect(subtopicData.claims).toHaveLength(2);

      // First claim should be "Cats are independent." with 2 duplicates
      expect(subtopicData.claims[0].claim).toBe("Cats are independent.");
      expect(subtopicData.claims[0].duplicates).toHaveLength(2);

      // Second claim should be "Cats are cute." with 0 duplicates
      expect(subtopicData.claims[1].claim).toBe("Cats are cute.");
      expect(subtopicData.claims[1].duplicates).toHaveLength(0);
    });

    it("should handle single claim subtopics without deduplication", async () => {
      const tree: ClaimsTree = {
        Pets: {
          total: 1,
          subtopics: {
            Dogs: {
              total: 1,
              claims: [
                makeClaim("Dogs are loyal.", "c1", "Alice", "Pets", "Dogs"),
              ],
            },
          },
        },
      };

      const result = await runSortAndDeduplicate(tree, "numPeople");
      const value = expectSuccessResult(result);

      const subtopicData = value.data[0][1].topics[0][1];
      expect(subtopicData.claims).toHaveLength(1);
      expect(subtopicData.claims[0].duplicates).toHaveLength(0);
      expect(subtopicData.speakers).toContain("Alice");
    });

    it("should return usage and cost information", async () => {
      const tree: ClaimsTree = {
        Pets: {
          total: 2,
          subtopics: {
            Cats: {
              total: 2,
              claims: [
                makeClaim("Cats are great.", "c1", "Alice", "Pets", "Cats"),
                makeClaim("Cats are great.", "c2", "Bob", "Pets", "Cats"),
              ],
            },
          },
        },
      };

      const result = await runSortAndDeduplicate(tree, "numPeople");
      const value = expectSuccessResult(result);

      expect(value.usage.input_tokens).toBeGreaterThan(0);
      expect(value.usage.output_tokens).toBeGreaterThan(0);
      expect(value.usage.total_tokens).toBeGreaterThan(0);
      expect(value.cost).toBeGreaterThanOrEqual(0);
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
                makeClaim(
                  "Valid claim",
                  "c1",
                  "Alice",
                  "Valid Topic",
                  "Subtopic",
                ),
              ],
            },
          },
        },
      };

      const result = await runSortAndDeduplicate(tree, "numPeople");
      const value = expectSuccessResult(result);

      // Should only have the valid topic
      expect(value.data).toHaveLength(1);
      expect(value.data[0][0]).toBe("Valid Topic");
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
                  speaker: "",
                  topicName: "Pets",
                  subtopicName: "Dogs",
                },
              ],
            },
          },
        },
      };

      const result = await runSortAndDeduplicate(tree, "numPeople");
      const value = expectSuccessResult(result);

      const subtopicData = value.data[0][1].topics[0][1];
      expect(subtopicData.claims).toHaveLength(1);
      expect(subtopicData.speakers).toHaveLength(0);
    });

    it("should sort subtopics within a topic", async () => {
      const tree: ClaimsTree = {
        Pets: {
          total: 4,
          subtopics: {
            Dogs: {
              total: 1,
              claims: [
                makeClaim("Dogs are loyal.", "c1", "Alice", "Pets", "Dogs"),
              ],
            },
            Cats: {
              total: 3,
              claims: [
                makeClaim("Cats are independent.", "c2", "Bob", "Pets", "Cats"),
                makeClaim("Cats are cute.", "c3", "Charlie", "Pets", "Cats"),
                makeClaim("Cats are playful.", "c4", "Diana", "Pets", "Cats"),
              ],
            },
          },
        },
      };

      const result = await runSortAndDeduplicate(tree, "numClaims");
      const value = expectSuccessResult(result);

      const topicData = value.data[0][1];
      expect(topicData.topics).toHaveLength(2);

      // Cats should come first (3 claims vs 1 claim)
      expect(topicData.topics[0][0]).toBe("Cats");
      expect(topicData.topics[1][0]).toBe("Dogs");

      expect(topicData.topics[0][1].counts.claims).toBe(3);
      expect(topicData.topics[1][1].counts.claims).toBe(1);
    });

    it("should handle LLM API failure gracefully", async () => {
      const { callDeduplicationModel } = await import("../model.js");

      vi.mocked(callDeduplicationModel).mockResolvedValueOnce({
        tag: "failure",
        error: {
          name: "ApiCallFailedError",
          message: "Rate limit exceeded",
        } as any,
      });

      const tree: ClaimsTree = {
        Pets: {
          total: 2,
          subtopics: {
            Cats: {
              total: 2,
              claims: [
                makeClaim("Cats are great.", "c1", "Alice", "Pets", "Cats"),
                makeClaim("Dogs are great.", "c2", "Bob", "Pets", "Cats"),
              ],
            },
          },
        },
      };

      const result = await runSortAndDeduplicate(tree, "numPeople");
      const value = expectSuccessResult(result);

      expect(value.data).toHaveLength(0);
      expect(value.usage.total_tokens).toBe(0);
    });

    it("should handle invalid claim IDs from LLM", async () => {
      const { callDeduplicationModel } = await import("../model.js");

      vi.mocked(callDeduplicationModel).mockResolvedValueOnce({
        tag: "success",
        value: {
          dedupClaims: {
            groupedClaims: [
              {
                claimText: "Grouped claim",
                originalClaimIds: ["claimId0", "claimId99"],
              },
            ],
          },
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            total_tokens: 150,
          },
        },
      });

      const tree: ClaimsTree = {
        Pets: {
          total: 2,
          subtopics: {
            Cats: {
              total: 2,
              claims: [
                makeClaim("Cats are great.", "c1", "Alice", "Pets", "Cats"),
                makeClaim("Dogs are great.", "c2", "Bob", "Pets", "Cats"),
              ],
            },
          },
        },
      };

      const result = await runSortAndDeduplicate(tree, "numPeople");
      const value = expectSuccessResult(result);

      const subtopicData = value.data[0][1].topics[0][1];
      expect(subtopicData.claims).toHaveLength(2);

      expect(subtopicData.claims[0].claim).toBe("Grouped claim");
      expect(subtopicData.claims[0].duplicates).toHaveLength(0);

      expect(subtopicData.claims[1].commentId).toBe("c2");
      expect(subtopicData.claims[1].duplicates).toHaveLength(0);
    });

    it("should handle partial claim ID parsing failures", async () => {
      const { callDeduplicationModel } = await import("../model.js");

      vi.mocked(callDeduplicationModel).mockResolvedValueOnce({
        tag: "success",
        value: {
          dedupClaims: {
            groupedClaims: [
              {
                claimText: "Grouped claim",
                originalClaimIds: ["claimId0", "invalidId", "claimId1", 999],
              },
            ],
          },
          usage: {
            input_tokens: 100,
            output_tokens: 50,
            total_tokens: 150,
          },
        },
      });

      const tree: ClaimsTree = {
        Pets: {
          total: 2,
          subtopics: {
            Cats: {
              total: 2,
              claims: [
                makeClaim("Cats are great.", "c1", "Alice", "Pets", "Cats"),
                makeClaim("Dogs are great.", "c2", "Bob", "Pets", "Cats"),
              ],
            },
          },
        },
      };

      const result = await runSortAndDeduplicate(tree, "numPeople");
      const value = expectSuccessResult(result);

      const subtopicData = value.data[0][1].topics[0][1];

      expect(subtopicData.claims).toHaveLength(1);
      expect(subtopicData.claims[0].duplicates).toHaveLength(1);
      expect(subtopicData.claims[0].commentId).toBe("c1");
      expect(subtopicData.claims[0].duplicates?.[0].commentId).toBe("c2");
    });

    it("should handle large subtopics efficiently", async () => {
      const largeClaims: Claim[] = [];
      for (let i = 0; i < 100; i++) {
        largeClaims.push(
          makeClaim(
            `Claim ${i % 10}`,
            `c${i}`,
            `Speaker${i}`,
            "Topic",
            "Subtopic",
          ),
        );
      }

      const tree: ClaimsTree = {
        Topic: {
          total: 100,
          subtopics: {
            Subtopic: {
              total: 100,
              claims: largeClaims,
            },
          },
        },
      };

      const result = await runSortAndDeduplicate(tree, "numClaims");
      const value = expectSuccessResult(result);

      const subtopicData = value.data[0][1].topics[0][1];

      expect(subtopicData.claims).toHaveLength(10);

      for (const claim of subtopicData.claims) {
        expect(claim.duplicates).toHaveLength(9);
      }

      expect(subtopicData.speakers).toHaveLength(100);
      expect(subtopicData.counts.claims).toBe(100);
      expect(subtopicData.counts.speakers).toBe(100);
    });
  });
});
