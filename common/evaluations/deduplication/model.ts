import { OpenAI } from "openai";
import * as weave from "weave";
import {
  deduplicationJsonStructureScorer,
  claimCoverageScorer,
  groupingQualityScorer,
  consolidationScorer,
  groupClaimQualityScorer,
  createLLMJudgeScorer,
  createDeduplicationModel,
} from "./scorers.js";
import { deduplicationTestCases } from "./datasets.js";
import {
  defaultDedupPrompt,
  defaultSystemPrompt,
  hydratePromptLiterals,
} from "../../prompts/index.js";
import { logger } from "../../logger/index.js";

const evaluationLogger = logger.child({ module: "evaluations" });

export async function runDeduplicationEvaluation() {
  const openaiClient = weave.wrapOpenAI(new OpenAI());

  // Create LLM-based judge scorer
  const llmJudgeScorer = createLLMJudgeScorer(openaiClient);

  // Create deduplication model with system prompt
  const deduplicationModel = createDeduplicationModel(
    openaiClient,
    hydratePromptLiterals,
    defaultDedupPrompt,
    defaultSystemPrompt,
  );

  const deduplicationDataset = new weave.Dataset({
    name: "T3C Deduplication Dataset",
    rows: deduplicationTestCases,
  });

  const deduplicationEvaluation = new weave.Evaluation({
    dataset: deduplicationDataset,
    scorers: [
      deduplicationJsonStructureScorer,
      claimCoverageScorer,
      groupingQualityScorer,
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
