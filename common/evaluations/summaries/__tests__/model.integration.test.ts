import { OpenAI } from "openai";
import { beforeAll, describe, expect, it } from "vitest";
import * as weave from "weave";
import { defaultSummariesPrompt, defaultSystemPrompt } from "../../../prompts";
import { createEvaluationModel } from "../../";
import { EVAL_MODEL } from "../../constants";
import {
  createLLMJudgeScorer,
  summariesJsonStructureScorer,
  summaryLengthScorer,
} from "../scorers";
import type { SummariesDatasetRow, SummariesModelOutput } from "../types";

/**
 * Summaries Weave Integration Tests
 *
 * These tests verify that the summaries evaluation pipeline works end-to-end with Weave.
 * They run actual evaluations with a small test dataset to ensure all components integrate correctly.
 */

// Small test dataset for integration testing with proper SortedTopic structure
const testDataset: SummariesDatasetRow[] = [
  {
    id: "test-summaries-1",
    topic: [
      "Pets",
      {
        counts: { claims: 2, speakers: 1 },
        topics: [
          [
            "Dogs",
            {
              counts: { claims: 2, speakers: 1 },
              claims: [
                {
                  claim: "Dogs are loyal companions",
                  quote: "I love my dog's loyalty",
                  speaker: "testuser1",
                  topicName: "Pets",
                  subtopicName: "Dogs",
                  commentId: "test1",
                  duplicates: [],
                },
                {
                  claim: "Dogs need daily exercise",
                  quote: "Walking my dog every day keeps us healthy",
                  speaker: "testuser1",
                  topicName: "Pets",
                  subtopicName: "Dogs",
                  commentId: "test1",
                  duplicates: [],
                },
              ],
            },
          ],
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
    const summariesModel = createEvaluationModel<
      SummariesDatasetRow,
      SummariesModelOutput
    >(openaiClient, EVAL_MODEL, defaultSummariesPrompt, defaultSystemPrompt);

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

    const summariesModel = createEvaluationModel<
      SummariesDatasetRow,
      SummariesModelOutput
    >(openaiClient, EVAL_MODEL, defaultSummariesPrompt, defaultSystemPrompt);

    // Test model directly
    const result = await summariesModel({
      datasetRow: testDataset[0],
    });

    // Verify output structure - model processes one topic and returns single summary
    expect(result).toBeDefined();
    expect(result).toHaveProperty("summary");
    expect(result).toHaveProperty("topicName");
    expect(typeof result.summary).toBe("string");
    expect(typeof result.topicName).toBe("string");
  }, 30000);

  it("should execute all scorers successfully", async () => {
    const mockModelOutput: SummariesModelOutput = {
      topicName: "Pets",
      summary:
        "Discussion focuses on dogs as loyal companions that require daily exercise and walking.",
    };

    // Test structure scorer
    const structureResult = await summariesJsonStructureScorer({
      modelOutput: mockModelOutput,
      datasetRow: testDataset[0],
    });
    expect(structureResult).toHaveProperty("valid_json_structure");
    expect(structureResult.valid_json_structure).toBe(true);

    // Test length scorer
    const lengthResult = await summaryLengthScorer({
      modelOutput: mockModelOutput,
      datasetRow: testDataset[0],
    });
    expect(lengthResult).toHaveProperty("summary_length_score");
    expect(typeof lengthResult.summary_length_score).toBe("number");
  });
});
