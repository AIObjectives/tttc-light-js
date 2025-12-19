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
 * Print a single claim with its duplicate count
 */
function printClaim(claim: any): void {
  const dupeCount = claim.duplicates?.length || 0;
  console.log(`    - "${claim.claim}" (${dupeCount} duplicates)`);
}

/**
 * Print a subtopic with its claims
 */
function printSubtopic(subtopicName: string, subtopicData: any): void {
  const { counts, claims } = subtopicData;
  console.log(
    `  ${subtopicName} (${counts.speakers} speakers, ${counts.claims} claims)`,
  );
  claims.forEach(printClaim);
}

/**
 * Print a topic with its subtopics
 */
function printTopic(topicName: string, topicData: any): void {
  const { counts, topics } = topicData;
  console.log(
    `\n${topicName} (${counts.speakers} speakers, ${counts.claims} claims)`,
  );
  topics.forEach(([subtopicName, subtopicData]: [string, any]) => {
    printSubtopic(subtopicName, subtopicData);
  });
}

/**
 * Print the results of a successful sort and deduplicate operation
 */
function printSuccessResults(value: any): void {
  console.log("\nSuccess!");
  console.log(`Topics: ${value.data.length}`);
  console.log(`Total tokens: ${value.usage.total_tokens}`);
  console.log(`Cost: $${value.cost.toFixed(4)}`);

  console.log("\nSorted Tree:");
  value.data.forEach(([topicName, topicData]: [string, any]) => {
    printTopic(topicName, topicData);
  });
}

/**
 * Main example function
 */
async function main() {
  // Guard clause for API key
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

  // Guard clause for error case
  if (result.tag !== "success") {
    console.error("Error:", result.error);
    return;
  }

  printSuccessResults(result.value);
}

// Run main function
main().catch(console.error);
