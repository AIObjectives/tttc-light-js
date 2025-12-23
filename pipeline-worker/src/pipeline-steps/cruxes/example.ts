/**
 * Example usage of the cruxes extraction pipeline step
 *
 * This example demonstrates how to use the extractCruxes function to identify
 * crux claims that split speaker opinions on different subtopics.
 *
 * ## How to Run This Example
 *
 * ### Prerequisites
 * - Node.js installed
 * - OpenAI API key set as environment variable
 *
 * ### Steps
 *
 * 1. Set your OpenAI API key:
 *    ```bash
 *    export OPENAI_API_KEY="your-api-key-here"
 *    ```
 *
 * 2. Build the project:
 *    ```bash
 *    cd pipeline-worker
 *    npm run build
 *    ```
 *
 * 3. Run the example:
 *    ```bash
 *    node dist/pipeline-steps/cruxes/example.js
 *    ```
 *
 * ### Alternative: Run with tsx (no build required)
 *    ```bash
 *    npx tsx src/pipeline-steps/cruxes/example.ts
 *    ```
 *
 * ### Expected Output
 * The example will:
 * - Process the sample claims tree with 4 speakers discussing carbon pricing
 * - Generate a crux claim that divides opinions (e.g., "Carbon taxes are necessary")
 * - Output speaker positions (agree/disagree/no clear position)
 * - Calculate controversy scores and speaker involvement
 * - Display token usage and estimated cost
 *
 * ### Configuration Options
 * You can optionally enable Weave evaluation tracking:
 * ```typescript
 * const result = await extractCruxes(claimsTree, topics, llmConfig, apiKey, {
 *   reportId: "example-report",
 *   userId: "example-user",
 *   enableWeave: true,
 *   weaveProjectName: "my-project",
 * });
 * ```
 */

import { extractCruxes } from "./index.js";
import type { ClaimsTree, LLMConfig, Topic } from "./types.js";

/**
 * Example of extracting cruxes from a claims tree
 */
async function exampleCruxesExtraction() {
  // Example claims tree (from previous pipeline step)
  const claimsTree: ClaimsTree = {
    "Climate Policy": {
      total: 4,
      subtopics: {
        "Carbon Pricing": {
          total: 4,
          claims: [
            {
              claim:
                "Carbon taxes are the most effective way to reduce emissions",
              quote: "We need a carbon tax to address climate change",
              speaker: "Alice",
              topicName: "Climate Policy",
              subtopicName: "Carbon Pricing",
              commentId: "1",
            },
            {
              claim: "Carbon taxes hurt the economy and should be avoided",
              quote: "Carbon taxes will destroy jobs",
              speaker: "Bob",
              topicName: "Climate Policy",
              subtopicName: "Carbon Pricing",
              commentId: "2",
            },
            {
              claim: "We need stronger carbon pricing mechanisms",
              quote: "Current carbon pricing is too weak",
              speaker: "Charlie",
              topicName: "Climate Policy",
              subtopicName: "Carbon Pricing",
              commentId: "3",
            },
            {
              claim: "Carbon pricing should be replaced with regulations",
              quote: "Regulations work better than pricing",
              speaker: "Diana",
              topicName: "Climate Policy",
              subtopicName: "Carbon Pricing",
              commentId: "4",
            },
          ],
        },
      },
    },
  };

  // Example topics (from clustering step)
  const topics: Topic[] = [
    {
      topicName: "Climate Policy",
      topicShortDescription: "Discussion about climate policy approaches",
      subtopics: [
        {
          subtopicName: "Carbon Pricing",
          subtopicShortDescription:
            "Debate over carbon taxes and pricing mechanisms",
        },
      ],
    },
  ];

  // LLM configuration
  const llmConfig: LLMConfig = {
    model_name: "gpt-4o-mini",
    system_prompt:
      "You are an expert at identifying crux claims that divide opinions.",
    user_prompt:
      "Given the following claims, identify a crux claim that best splits opinions into agree/disagree groups.",
  };

  const apiKey = process.env.OPENAI_API_KEY || "your-api-key";

  // Extract cruxes
  const result = await extractCruxes(claimsTree, topics, llmConfig, apiKey, {
    reportId: "example-report",
    userId: "example-user",
  });

  if (result.tag === "success") {
    console.log("Cruxes extraction successful!");
    console.log("Subtopic cruxes:", result.value.subtopicCruxes);
    console.log("Topic scores:", result.value.topicScores);
    console.log("Usage:", result.value.usage);
    console.log("Cost:", result.value.cost);
  } else {
    console.error("Cruxes extraction failed:", result.error);
  }
}

// Run the example if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  exampleCruxesExtraction().catch(console.error);
}

export { exampleCruxesExtraction };
