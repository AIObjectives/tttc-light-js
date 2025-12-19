import { OpenAI } from "openai";
import { beforeAll, describe, expect, it, vi } from "vitest";
import * as weave from "weave";
import { defaultClusteringPrompt, defaultSystemPrompt } from "../../../prompts";
import { createEvaluationModel } from "../..";
import { EVAL_MODEL } from "../../constants";
import {
  createLLMJudgeScorer,
  jsonStructureScorer,
  topicCoverageScorer,
} from "../scorers";
import type { ClusteringDatasetRow, ClusteringModelOutput } from "../types";

/**
 * Clustering Weave Integration Tests
 *
 * These tests verify that the clustering evaluation pipeline works end-to-end with Weave.
 * They run actual evaluations with a small test dataset to ensure all components integrate correctly.
 */

// Small test dataset for integration testing
const testDataset = [
  {
    id: "test-clustering-1",
    comments: `I love dogs because they're loyal
Dogs need daily walks which is great exercise
Cats are independent and low maintenance
I prefer cats for apartment living`,
  },
];

// Checks if integration tests are enabled
const integrationEnabled = process.env.INTEGRATION_TESTS === "true";

// Skipped because these call the LLM and Weave.
// To run integration tests, set environment variable INTEGRATION_TESTS=true
describe.skipIf(!integrationEnabled)("Clustering Weave Integration", () => {
  beforeAll(async () => {
    // Initialize weave for testing
    await weave.init("t3c-clustering-integration-test");
  });

  it("should successfully run a complete clustering evaluation with weave", async () => {
    const openaiClient = weave.wrapOpenAI(new OpenAI());

    // Create scorers
    const llmJudgeScorer = createLLMJudgeScorer(openaiClient);

    // Create model
    const clusteringModel = createEvaluationModel<
      ClusteringDatasetRow,
      ClusteringModelOutput
    >(openaiClient, EVAL_MODEL, defaultClusteringPrompt, defaultSystemPrompt);

    // Create dataset
    const dataset = new weave.Dataset({
      name: "Test Clustering Dataset",
      rows: testDataset,
    });

    // Create evaluation
    const evaluation = new weave.Evaluation({
      dataset,
      scorers: [jsonStructureScorer, topicCoverageScorer, llmJudgeScorer],
    });

    // Run evaluation
    const results = await evaluation.evaluate({
      model: clusteringModel,
    });

    // Verify results structure
    expect(results).toBeDefined();
    // Weave evaluation results have model_success and model_latency properties
    expect(results).toHaveProperty("model_success");
  }, 60000); // 60 second timeout for LLM calls

  it("should produce valid model outputs", async () => {
    const openaiClient = weave.wrapOpenAI(new OpenAI());

    const clusteringModel = createEvaluationModel<
      ClusteringDatasetRow,
      ClusteringModelOutput
    >(openaiClient, EVAL_MODEL, defaultClusteringPrompt, defaultSystemPrompt);

    // Test model directly
    const result = await clusteringModel({
      datasetRow: testDataset[0],
    });

    // Verify output structure
    expect(result).toBeDefined();
    expect(result).toHaveProperty("taxonomy");
    expect(Array.isArray(result.taxonomy)).toBe(true);

    if (result.taxonomy.length > 0) {
      const topic = result.taxonomy[0];
      expect(topic).toHaveProperty("topicName");
      expect(topic).toHaveProperty("topicShortDescription");
      expect(topic).toHaveProperty("subtopics");
      expect(Array.isArray(topic.subtopics)).toBe(true);
    }
  }, 30000);

  it("should execute all scorers successfully", async () => {
    const mockModelOutput = {
      taxonomy: [
        {
          topicName: "Pets",
          topicShortDescription:
            "Discussion about different types of pets including dogs and cats focusing on their unique characteristics care requirements and lifestyle compatibility with various different ownership scenarios",
          subtopics: [
            {
              subtopicName: "Dogs",
              subtopicShortDescription:
                "Perspectives on dogs emphasizing their loyalty and the importance of regular exercise through daily walks. Comments highlight the health benefits and bonding opportunities that come with walking dogs while acknowledging the time commitment required for proper dog care and training. Participants discuss the investment needed for veterinary care, food, supplies, and time dedicated to training and socialization. Many note that despite the significant responsibilities and daily attention required, the emotional rewards and companionship that dogs provide make the effort worthwhile for most owners who value active bonds",
            },
          ],
        },
      ],
    };

    // Test structure scorer (weave.op makes it async)
    const structureResult = await jsonStructureScorer({
      modelOutput: mockModelOutput,
      datasetRow: testDataset[0],
    });
    expect(structureResult).toHaveProperty("valid_json_structure");
    expect(structureResult.valid_json_structure).toBe(true);

    // Test coverage scorer (weave.op makes it async)
    const coverageResult = await topicCoverageScorer({
      modelOutput: mockModelOutput,
      datasetRow: testDataset[0],
    });
    expect(coverageResult).toHaveProperty("topic_coverage_score");
    expect(typeof coverageResult.topic_coverage_score).toBe("number");
  });
});
