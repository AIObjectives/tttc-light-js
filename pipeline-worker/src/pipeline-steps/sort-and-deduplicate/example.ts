/**
 * Example usage of the sort-and-deduplicate pipeline step
 *
 * This demonstrates how to use the sortAndDeduplicateClaims function to
 * deduplicate claims within subtopics and sort the entire tree by frequency.
 *
 * To run this example:
 * 1. Set OPENAI_API_KEY environment variable
 * 2. Run: npx ts-node src/pipeline-steps/sort-and-deduplicate/example.ts
 */

import { sortAndDeduplicateClaims } from "./index";
import type { ClaimsTree, SortAndDeduplicateInput } from "./types";

/**
 * Example claims tree with duplicate claims
 */
const exampleTree: ClaimsTree = {
  Pets: {
    total: 5,
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
      Dogs: {
        total: 1,
        claims: [
          {
            claim: "Dogs are superior pets.",
            commentId: "c3",
            quote: "dogs are great",
            speaker: "Charlie",
            topicName: "Pets",
            subtopicName: "Dogs",
          },
        ],
      },
      Birds: {
        total: 2,
        claims: [
          {
            claim: "Birds are not ideal pets for everyone.",
            commentId: "c4",
            quote: "I'm not sure about birds.",
            speaker: "Diana",
            topicName: "Pets",
            subtopicName: "Birds",
          },
          {
            claim: "Birds are not suitable pets for everyone.",
            commentId: "c5",
            quote: "I don't know about birds.",
            speaker: "Eve",
            topicName: "Pets",
            subtopicName: "Birds",
          },
        ],
      },
    },
  },
};

/**
 * Main example function
 */
async function main() {
  // Check for API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("Error: OPENAI_API_KEY environment variable not set");
    process.exit(1);
  }

  const input: SortAndDeduplicateInput = {
    tree: exampleTree,
    llm: {
      model_name: "gpt-4o-mini",
      system_prompt: "You are a helpful assistant that groups similar claims.",
      user_prompt: "Group the following claims by similarity:",
    },
    sort: "numPeople",
  };

  console.log("Running sort and deduplicate example...");

  const result = await sortAndDeduplicateClaims(input, apiKey, {
    reportId: "example-report",
    userId: "example-user",
  });

  if (result.tag === "success") {
    console.log("\nSuccess!");
    console.log(`Topics: ${result.value.data.length}`);
    console.log(`Total tokens: ${result.value.usage.total_tokens}`);
    console.log(`Cost: $${result.value.cost.toFixed(4)}`);

    // Show the sorted tree structure
    console.log("\nSorted Tree:");
    for (const [topicName, topicData] of result.value.data) {
      console.log(
        `\n${topicName} (${topicData.counts.speakers} speakers, ${topicData.counts.claims} claims)`,
      );

      for (const [subtopicName, subtopicData] of topicData.topics) {
        console.log(
          `  ${subtopicName} (${subtopicData.counts.speakers} speakers, ${subtopicData.counts.claims} claims)`,
        );

        for (const claim of subtopicData.claims) {
          console.log(
            `    - "${claim.claim}" (${claim.duplicates?.length || 0} duplicates)`,
          );
        }
      }
    }
  } else {
    console.error("Error:", result.error);
  }
}

// Run main function
main().catch(console.error);
