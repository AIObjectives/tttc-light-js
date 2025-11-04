import { OpenAI } from "openai";
import * as weave from "weave";
import {
  deduplicationJsonStructureScorer,
  claimCoverageScorer,
  consolidationScorer,
  groupClaimQualityScorer,
  createLLMJudgeScorer,
} from "./scorers";
import type {
  DeduplicationDatasetRow,
  DeduplicationModelOutput,
} from "./types";
import { deduplicationTestCases } from "./datasets";
import { defaultDedupPrompt, defaultSystemPrompt } from "../../prompts";
import { logger } from "../../logger";
import { createEvaluationModel } from "../";
import { EVAL_MODEL } from "../constants";

const evaluationLogger = logger.child({ module: "evaluations" });

export async function runDeduplicationEvaluation(): Promise<
  Record<string, unknown>
> {
  const openaiClient = weave.wrapOpenAI(new OpenAI());

  // Create LLM-based judge scorer
  const llmJudgeScorer = createLLMJudgeScorer(openaiClient);

  const deduplicationModel = createEvaluationModel<
    DeduplicationDatasetRow,
    DeduplicationModelOutput
  >(openaiClient, EVAL_MODEL, defaultDedupPrompt, defaultSystemPrompt);

  const deduplicationDataset = new weave.Dataset({
    name: "T3C Deduplication Dataset",
    rows: deduplicationTestCases,
  });

  const deduplicationEvaluation = new weave.Evaluation({
    dataset: deduplicationDataset,
    scorers: [
      deduplicationJsonStructureScorer,
      claimCoverageScorer,
      consolidationScorer,
      groupClaimQualityScorer,
      llmJudgeScorer,
    ],
  });

  evaluationLogger.info("Running T3C deduplication evaluation...");
  const deduplicationResults = await deduplicationEvaluation.evaluate({
    model: deduplicationModel,
  });
  evaluationLogger.info(
    {
      results: deduplicationResults,
    },
    "Deduplication Results",
  );
  return deduplicationResults;
}
