/**
 * Example usage of the clustering pipeline step
 *
 * This demonstrates how to use the commentsToTree function to generate
 * a topic taxonomy from a list of comments.
 *
 * To run this example:
 * 1. Set OPENAI_API_KEY environment variable
 * 2. Run: npx ts-node src/pipeline-steps/clustering/example.ts
 */

import { commentsToTree } from "./index.js";
import type { Comment, LLMConfig } from "./types.js";

async function main() {
  // Check for API key
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error("Error: OPENAI_API_KEY environment variable not set");
    process.exit(1);
  }

  // Example comments about pets
  const comments: Comment[] = [
    {
      id: "c1",
      text: "I love cats. They are independent and clean animals.",
      speaker: "Alice",
    },
    {
      id: "c2",
      text: "Dogs are great companions. They are loyal and friendly.",
      speaker: "Bob",
    },
    {
      id: "c3",
      text: "I'm not sure about birds as pets. They can be noisy.",
      speaker: "Charlie",
    },
    {
      id: "c4",
      text: "Cats are low maintenance compared to dogs.",
      speaker: "Diana",
    },
    {
      id: "c5",
      text: "Dogs need regular exercise and walks.",
      speaker: "Eve",
    },
    {
      id: "c6",
      text: "Birds can be beautiful but require special care.",
      speaker: "Frank",
    },
  ];

  const llmConfig: LLMConfig = {
    model_name: "gpt-4o-mini",
    system_prompt: `You are a professional research assistant. You have helped run many public consultations,
surveys and citizen assemblies. You have good instincts when it comes to extracting interesting insights.`,
    user_prompt: `I will give you a list of comments.
Please propose a way to organize the information contained in these comments into topics and subtopics of interest.
Keep the topic and subtopic names very concise and use the short description to explain what the topic is about.

Return a JSON object of the form {
  "taxonomy": [
    {
      "topicName": "Topic Name",
      "topicShortDescription": "Brief description",
      "subtopics": [
        {
          "subtopicName": "Subtopic Name",
          "subtopicShortDescription": "Brief description"
        }
      ]
    }
  ]
}

Comments:`,
  };

  console.log("Processing comments...\n");

  // Call the clustering function
  const result = await commentsToTree(comments, llmConfig, apiKey, {
    reportId: "example-report",
    userId: "example-user",
  });

  if (result.tag === "failure") {
    console.error("Failed to generate taxonomy:", result.error.message);
    process.exit(1);
  }

  const topicTree = result.value;
  console.log("\n=== RESULTS ===\n");
  console.log("Topics generated:", topicTree.data.length);
  console.log("\nTaxonomy:");
  console.log(JSON.stringify(topicTree.data, null, 2));

  console.log("\n=== USAGE STATS ===");
  console.log("Prompt tokens:", topicTree.usage.input_tokens);
  console.log("Completion tokens:", topicTree.usage.output_tokens);
  console.log("Total tokens:", topicTree.usage.total_tokens);
  console.log(`Estimated cost: $${topicTree.cost.toFixed(4)}`);
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
