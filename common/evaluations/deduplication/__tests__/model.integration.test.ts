import { OpenAI } from "openai";
import { beforeAll, describe, expect, it } from "vitest";
import * as weave from "weave";
import { defaultDedupPrompt, defaultSystemPrompt } from "../../../prompts";
import { createEvaluationModel } from "../../";
import { EVAL_MODEL } from "../../constants";
import {
  claimCoverageScorer,
  createLLMJudgeScorer,
  deduplicationJsonStructureScorer,
} from "../scorers";
import type {
  DeduplicationDatasetRow,
  DeduplicationModelOutput,
} from "../types";

/**
 * Deduplication Weave Integration Tests
 *
 * These tests verify that the deduplication evaluation pipeline works end-to-end with Weave.
 * They run actual evaluations with a small test dataset to ensure all components integrate correctly.
 */

// Small test dataset for integration testing
const testDataset: DeduplicationDatasetRow[] = [
  {
    id: "test-deduplication-1",
    claims: `ID: 1
Claim: Parking downtown is too expensive
Quote: I can't afford to park downtown

ID: 2
Claim: Downtown parking costs are prohibitive
Quote: Parking fees are ridiculously high

ID: 3
Claim: Public transit needs better coverage
Quote: We need more bus routes`,
  },
];

const integrationEnabled = process.env.INTEGRATION_TESTS === "true";

// Skipped because these call the LLM and Weave.
// To run integration tests, set environment variable INTEGRATION_TESTS=true
describe.skipIf(!integrationEnabled)("Deduplication Weave Integration", () => {
  beforeAll(async () => {
    // Initialize weave for testing
    await weave.init("t3c-deduplication-integration-test");
  });

  it("should successfully run a complete deduplication evaluation with weave", async () => {
    const openaiClient = weave.wrapOpenAI(new OpenAI());

    // Create scorers
    const llmJudgeScorer = createLLMJudgeScorer(openaiClient);

    // Create model
    const deduplicationModel = createEvaluationModel<
      DeduplicationDatasetRow,
      DeduplicationModelOutput
    >(openaiClient, EVAL_MODEL, defaultDedupPrompt, defaultSystemPrompt);

    // Create dataset
    const dataset = new weave.Dataset({
      name: "Test Deduplication Dataset",
      rows: testDataset,
    });

    // Create evaluation
    const evaluation = new weave.Evaluation({
      dataset,
      scorers: [
        deduplicationJsonStructureScorer,
        claimCoverageScorer,
        llmJudgeScorer,
      ],
    });

    // Run evaluation
    const results = await evaluation.evaluate({
      model: deduplicationModel,
    });

    // Verify results structure
    expect(results).toBeDefined();
    // Weave evaluation results have model_success and model_latency properties
    expect(results).toHaveProperty("model_success");
  }, 60000); // 60 second timeout for LLM calls

  it("should produce valid model outputs", async () => {
    const openaiClient = weave.wrapOpenAI(new OpenAI());

    const deduplicationModel = createEvaluationModel<
      DeduplicationDatasetRow,
      DeduplicationModelOutput
    >(openaiClient, EVAL_MODEL, defaultDedupPrompt, defaultSystemPrompt);

    // Test model directly
    const result = await deduplicationModel({
      datasetRow: testDataset[0],
    });

    // Verify output structure
    expect(result).toBeDefined();
    expect(result).toHaveProperty("groupedClaims");
    expect(Array.isArray(result.groupedClaims)).toBe(true);

    // Check structure of grouped claims
    if (result.groupedClaims.length > 0) {
      expect(result.groupedClaims[0]).toHaveProperty("claimText");
      expect(result.groupedClaims[0]).toHaveProperty("originalClaimIds");
      expect(typeof result.groupedClaims[0].claimText).toBe("string");
      expect(Array.isArray(result.groupedClaims[0].originalClaimIds)).toBe(
        true,
      );
    }
  }, 30000);

  it("should execute all scorers successfully", async () => {
    const mockModelOutput: DeduplicationModelOutput = {
      groupedClaims: [
        {
          claimText: "Downtown parking is too expensive",
          originalClaimIds: ["1", "2"],
        },
        {
          claimText: "Public transit needs better coverage",
          originalClaimIds: ["3"],
        },
      ],
    };

    // Test structure scorer (weave.op makes it async)
    const structureResult = await deduplicationJsonStructureScorer({
      modelOutput: mockModelOutput,
      datasetRow: testDataset[0],
    });
    expect(structureResult).toHaveProperty("valid_json_structure");
    expect(structureResult.valid_json_structure).toBe(true);

    // Test coverage scorer (weave.op makes it async)
    const coverageResult = await claimCoverageScorer({
      modelOutput: mockModelOutput,
      datasetRow: testDataset[0],
    });
    expect(coverageResult).toHaveProperty("claim_coverage_score");
    expect(typeof coverageResult.claim_coverage_score).toBe("number");
  });
});
