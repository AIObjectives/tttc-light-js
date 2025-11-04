import { describe, it, expect, beforeAll } from "vitest";
import * as weave from "weave";
import { OpenAI } from "openai";
import {
  summariesJsonStructureScorer,
  summaryLengthScorer,
  createLLMJudgeScorer,
  createSummariesModel,
} from "../scorers";
import {
  defaultSummariesPrompt,
  defaultSystemPrompt,
  hydratePromptLiterals,
} from "../../../prompts/index";

/**
 * Summaries Weave Integration Tests
 *
 * These tests verify that the summaries evaluation pipeline works end-to-end with Weave.
 * They run actual evaluations with a small test dataset to ensure all components integrate correctly.
 */

// Small test dataset for integration testing
const testDataset = [
  {
    id: "test-summaries-1",
    topics: [
      {
        topicName: "Pets",
        topicShortDescription: "Discussion about different types of pets",
        subtopics: [
          {
            subtopicName: "Dogs",
            subtopicShortDescription: "Perspectives on dogs as pets",
            claims: [
              {
                claim: "Dogs are loyal companions",
                quote: "I love my dog's loyalty",
              },
              {
                claim: "Dogs need daily exercise",
                quote: "Walking my dog every day keeps us healthy",
              },
            ],
          },
        ],
      },
    ],
  },
];

const integrationEnabled = process.env.INTEGRATION_TESTS === "true";

// Skipped because these call the LLM and Weave.
// To run integration tests, set environment variable INTEGRATION_TESTS=true
describe.skipIf(!integrationEnabled)("Summaries Weave Integration", () => {
  beforeAll(async () => {
    // Initialize weave for testing
    await weave.init("t3c-summaries-integration-test");
  });

  it("should successfully run a complete summaries evaluation with weave", async () => {
    const openaiClient = weave.wrapOpenAI(new OpenAI());

    // Create scorers
    const llmJudgeScorer = createLLMJudgeScorer(openaiClient);

    // Create model
    const summariesModel = createSummariesModel(
      openaiClient,
      hydratePromptLiterals,
      defaultSummariesPrompt,
      defaultSystemPrompt,
    );

    // Create dataset
    const dataset = new weave.Dataset({
      name: "Test Summaries Dataset",
      rows: testDataset,
    });

    // Create evaluation
    const evaluation = new weave.Evaluation({
      dataset,
      scorers: [
        summariesJsonStructureScorer,
        summaryLengthScorer,
        llmJudgeScorer,
      ],
    });

    // Run evaluation
    const results = await evaluation.evaluate({
      model: summariesModel,
    });

    // Verify results structure
    expect(results).toBeDefined();
    // Weave evaluation results have model_success and model_latency properties
    expect(results).toHaveProperty("model_success");
  }, 60000); // 60 second timeout for LLM calls

  it("should produce valid model outputs", async () => {
    const openaiClient = weave.wrapOpenAI(new OpenAI());

    const summariesModel = createSummariesModel(
      openaiClient,
      hydratePromptLiterals,
      defaultSummariesPrompt,
      defaultSystemPrompt,
    );

    // Test model directly
    const result = await summariesModel({
      datasetRow: testDataset[0],
    });

    // Verify output structure - model processes one topic and returns single summary
    expect(result).toBeDefined();
    expect(result).toHaveProperty("summary");
    expect(typeof result.summary).toBe("string");
  }, 30000);

  it("should execute all scorers successfully", async () => {
    const mockModelOutput = {
      summaries: [
        {
          topicName: "Pets",
          summary:
            "Discussion focuses on dogs as loyal companions that require daily exercise and walking.",
        },
      ],
    };

    // Test structure scorer
    const structureResult = await summariesJsonStructureScorer({
      modelOutput: mockModelOutput,
    });
    expect(structureResult).toHaveProperty("valid_json_structure");
    expect(structureResult.valid_json_structure).toBe(true);

    // Test length scorer
    const lengthResult = await summaryLengthScorer({
      modelOutput: mockModelOutput,
    });
    expect(lengthResult).toHaveProperty("summary_length_score");
    expect(typeof lengthResult.summary_length_score).toBe("number");
  });
});
