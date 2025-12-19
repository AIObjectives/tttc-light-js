import { OpenAI } from "openai";
import { beforeAll, describe, expect, it } from "vitest";
import * as weave from "weave";
import { defaultCruxPrompt, defaultSystemPrompt } from "../../../prompts/index";
import { createEvaluationModel } from "../..";
import { EVAL_MODEL } from "../../constants";
import {
  createLLMJudgeScorer,
  cruxJsonStructureScorer,
  explanationQualityScorer,
} from "../scorers";
import type { CruxDatasetRow, CruxModelOutput } from "../types";

/**
 * Crux Weave Integration Tests
 *
 * These tests verify that the crux evaluation pipeline works end-to-end with Weave.
 * They run actual evaluations with a small test dataset to ensure all components integrate correctly.
 */

// Small test dataset for integration testing
const testDataset = [
  {
    id: "test-crux-1",
    topic: "Healthcare",
    topicDescription: "Views on healthcare systems",
    subtopic: "Universal Coverage",
    subtopicDescription: "Government-provided healthcare",
    participantClaims: [
      {
        participant: "Alice",
        claims: ["Healthcare is a fundamental human right"],
      },
      {
        participant: "Bob",
        claims: ["Free market solutions work better for healthcare"],
      },
      {
        participant: "Carol",
        claims: ["Everyone deserves access to medical care"],
      },
    ],
  },
];

// Checks if integration tests are enabled
const integrationEnabled = process.env.INTEGRATION_TESTS === "true";

// Skipped because these call the LLM and Weave.
// To run integration tests, set environment variable INTEGRATION_TESTS=true
describe.skipIf(!integrationEnabled)("Crux Weave Integration", () => {
  beforeAll(async () => {
    // Initialize weave for testing
    await weave.init("t3c-crux-integration-test");
  });

  it("should successfully run a complete crux evaluation with weave", async () => {
    const openaiClient = weave.wrapOpenAI(new OpenAI());

    // Create scorers
    const llmJudgeScorer = createLLMJudgeScorer(openaiClient);

    // Create model
    const cruxModel = createEvaluationModel<CruxDatasetRow, CruxModelOutput>(
      openaiClient,
      EVAL_MODEL,
      defaultCruxPrompt,
      defaultSystemPrompt,
    );

    // Create dataset
    const dataset = new weave.Dataset({
      name: "Test Crux Dataset",
      rows: testDataset,
    });

    // Create evaluation
    const evaluation = new weave.Evaluation({
      dataset,
      scorers: [
        cruxJsonStructureScorer,
        explanationQualityScorer,
        llmJudgeScorer,
      ],
    });

    // Run evaluation
    const results = await evaluation.evaluate({
      model: cruxModel,
    });

    // Verify results structure
    expect(results).toBeDefined();
    // Weave evaluation results have model_success and model_latency properties
    expect(results).toHaveProperty("model_success");
  }, 60000); // 60 second timeout for LLM calls

  it("should produce valid model outputs", async () => {
    const openaiClient = weave.wrapOpenAI(new OpenAI());

    const cruxModel = createEvaluationModel<CruxDatasetRow, CruxModelOutput>(
      openaiClient,
      EVAL_MODEL,
      defaultCruxPrompt,
      defaultSystemPrompt,
    );

    // Test model directly
    const result = await cruxModel({
      datasetRow: testDataset[0],
    });

    // Verify output structure
    expect(result).toBeDefined();
    expect(result).toHaveProperty("crux");
    expect(result.crux).toHaveProperty("cruxClaim");
    expect(result.crux).toHaveProperty("agree");
    expect(result.crux).toHaveProperty("disagree");
    expect(result.crux).toHaveProperty("explanation");
    expect(Array.isArray(result.crux.agree)).toBe(true);
    expect(Array.isArray(result.crux.disagree)).toBe(true);
    expect(typeof result.crux.cruxClaim).toBe("string");
    expect(typeof result.crux.explanation).toBe("string");
  }, 30000);

  it("should execute all scorers successfully", async () => {
    const mockModelOutput = {
      crux: {
        cruxClaim: "Government should provide universal healthcare coverage",
        agree: ["Alice", "Carol"],
        disagree: ["Bob"],
        explanation:
          "Alice and Carol believe healthcare is a right that should be accessible to all, while Bob prefers market-based solutions.",
      },
    };

    // Test structure scorer (weave.op makes it async)
    const structureResult = await cruxJsonStructureScorer({
      datasetRow: testDataset[0],
      modelOutput: mockModelOutput,
    });
    expect(structureResult).toHaveProperty("valid_json_structure");
    expect(structureResult.valid_json_structure).toBe(true);

    // Test explanation quality scorer (weave.op makes it async)
    const qualityResult = await explanationQualityScorer({
      datasetRow: testDataset[0],
      modelOutput: mockModelOutput,
    });
    expect(qualityResult).toHaveProperty("explanation_quality_score");
    expect(typeof qualityResult.explanation_quality_score).toBe("number");
  });
});
