import { describe, it, expect, beforeAll } from "vitest";
import * as weave from "weave";
import { OpenAI } from "openai";
import {
  deduplicationJsonStructureScorer,
  claimCoverageScorer,
  createLLMJudgeScorer,
  createDeduplicationModel,
} from "../scorers";
import {
  defaultDedupPrompt,
  defaultSystemPrompt,
  hydratePromptLiterals,
} from "../../../prompts/index";

/**
 * Deduplication Weave Integration Tests
 *
 * These tests verify that the deduplication evaluation pipeline works end-to-end with Weave.
 * They run actual evaluations with a small test dataset to ensure all components integrate correctly.
 */

// Small test dataset for integration testing
const testDataset = [
  {
    id: "test-deduplication-1",
    claims: [
      {
        claimId: "1",
        claimText: "Parking downtown is too expensive",
        quoteText: "I can't afford to park downtown",
      },
      {
        claimId: "2",
        claimText: "Downtown parking costs are prohibitive",
        quoteText: "Parking fees are ridiculously high",
      },
      {
        claimId: "3",
        claimText: "Public transit needs better coverage",
        quoteText: "We need more bus routes",
      },
    ],
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
    const deduplicationModel = createDeduplicationModel(
      openaiClient,
      hydratePromptLiterals,
      defaultDedupPrompt,
      defaultSystemPrompt,
    );

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

    const deduplicationModel = createDeduplicationModel(
      openaiClient,
      hydratePromptLiterals,
      defaultDedupPrompt,
      defaultSystemPrompt,
    );

    // Test model directly
    const result = await deduplicationModel({
      datasetRow: testDataset[0],
    });

    // Verify output structure
    expect(result).toBeDefined();
    expect(result).toHaveProperty("groupedClaims");
    expect(Array.isArray(result.groupedClaims)).toBe(true);

    if (result.groupedClaims.length > 0) {
      const group = result.groupedClaims[0];
      expect(group).toHaveProperty("claimText");
      expect(group).toHaveProperty("originalClaimIds");
      expect(Array.isArray(group.originalClaimIds)).toBe(true);
    }
  }, 30000);

  it("should execute all scorers successfully", async () => {
    const mockModelOutput = {
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
