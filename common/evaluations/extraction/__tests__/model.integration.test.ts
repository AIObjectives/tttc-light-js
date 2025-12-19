import { OpenAI } from "openai";
import { beforeAll, describe, expect, it } from "vitest";
import * as weave from "weave";
import { defaultExtractionPrompt, defaultSystemPrompt } from "../../../prompts";
import { createEvaluationModel } from "../../";
import { EVAL_MODEL } from "../../constants";
import {
  claimQualityScorer,
  createLLMJudgeScorer,
  extractionJsonStructureScorer,
} from "../scorers";
import type { ExtractionDatasetRow, ExtractionModelOutput } from "../types";

/**
 * Extraction Weave Integration Tests
 *
 * These tests verify that the extraction evaluation pipeline works end-to-end with Weave.
 * They run actual evaluations with a small test dataset to ensure all components integrate correctly.
 */

// Small test dataset for integration testing
const testDataset: Array<ExtractionDatasetRow> = [
  {
    comment:
      "I believe dogs are better pets than cats because they provide more companionship and security",
    taxonomy: [
      {
        topicName: "Pets",
        topicShortDescription: "Discussion about different types of pets",
        subtopics: [
          {
            subtopicName: "Dogs",
            subtopicShortDescription: "Perspectives on dogs as pets",
          },
          {
            subtopicName: "Cats",
            subtopicShortDescription: "Perspectives on cats as pets",
          },
        ],
      },
    ],
  },
];

const integrationEnabled = process.env.INTEGRATION_TESTS === "true";

// Skipped because these call the LLM and Weave.
// To run integration tests, set environment variable INTEGRATION_TESTS=true
describe.skipIf(!integrationEnabled)("Extraction Weave Integration", () => {
  beforeAll(async () => {
    // Initialize weave for testing
    await weave.init("t3c-extraction-integration-test");
  });

  it("should successfully run a complete extraction evaluation with weave", async () => {
    const openaiClient = weave.wrapOpenAI(new OpenAI());

    // Create scorers
    const llmJudgeScorer = createLLMJudgeScorer(openaiClient);

    // Create model
    const extractionModel = createEvaluationModel<
      ExtractionDatasetRow,
      ExtractionModelOutput
    >(openaiClient, EVAL_MODEL, defaultExtractionPrompt, defaultSystemPrompt);

    // Create dataset
    const dataset = new weave.Dataset({
      name: "Test Extraction Dataset",
      rows: testDataset,
    });

    // Create evaluation
    const evaluation = new weave.Evaluation({
      dataset,
      scorers: [
        extractionJsonStructureScorer,
        claimQualityScorer,
        llmJudgeScorer,
      ],
    });

    // Run evaluation
    const results = await evaluation.evaluate({
      model: extractionModel,
    });

    // Verify results structure
    expect(results).toBeDefined();
    // Weave evaluation results have model_success and model_latency properties
    expect(results).toHaveProperty("model_success");
  }, 60000); // 60 second timeout for LLM calls

  it("should produce valid model outputs", async () => {
    const openaiClient = weave.wrapOpenAI(new OpenAI());

    const extractionModel = createEvaluationModel<
      ExtractionDatasetRow,
      ExtractionModelOutput
    >(openaiClient, EVAL_MODEL, defaultExtractionPrompt, defaultSystemPrompt);

    // Test model directly
    const result = await extractionModel({
      datasetRow: testDataset[0],
    });

    // Verify output structure
    expect(result).toBeDefined();
    expect(result).toHaveProperty("claims");
    expect(Array.isArray(result.claims)).toBe(true);

    if (result.claims.length > 0) {
      const claim = result.claims[0];
      expect(claim).toHaveProperty("claim");
      expect(claim).toHaveProperty("quote");
      expect(claim).toHaveProperty("topicName");
      expect(claim).toHaveProperty("subtopicName");
    }
  }, 30000);

  it("should execute all scorers successfully", async () => {
    const mockModelOutput = {
      claims: [
        {
          claim: "Dogs provide better companionship than cats",
          quote:
            "dogs are better pets than cats because they provide more companionship",
          topicName: "Pets",
          subtopicName: "Dogs",
        },
      ],
    };

    // Test structure scorer (weave.op makes it async)
    const structureResult = await extractionJsonStructureScorer({
      modelOutput: mockModelOutput,
      datasetRow: testDataset[0],
    });
    expect(structureResult).toHaveProperty("valid_json_structure");
    expect(structureResult.valid_json_structure).toBe(true);

    // Test quality scorer (weave.op makes it async)
    const qualityResult = await claimQualityScorer({
      modelOutput: mockModelOutput,
      datasetRow: testDataset[0],
    });
    expect(qualityResult).toHaveProperty("claim_quality_score");
    expect(typeof qualityResult.claim_quality_score).toBe("number");
  });
});
