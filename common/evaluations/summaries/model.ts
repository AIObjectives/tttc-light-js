import { OpenAI } from "openai";
import * as weave from "weave";
import { logger } from "../../logger/index.js";
import {
  defaultSummariesPrompt,
  defaultSystemPrompt,
} from "../../prompts/index.js";
import { EVAL_MODEL } from "../constants";
import { createEvaluationModel } from "../index.js";
import { summariesTestCases } from "./datasets.js";
import {
  createLLMJudgeScorer,
  summariesJsonStructureScorer,
  summaryContentQualityScorer,
  summaryLengthScorer,
} from "./scorers.js";
import type { SummariesDatasetRow, SummariesModelOutput } from "./types.js";

const evaluationLogger = logger.child({ module: "evaluations" });

export async function runSummariesEvaluation(): Promise<
  Record<string, unknown>
> {
  const openaiClient = weave.wrapOpenAI(new OpenAI());

  // Create LLM-based judge scorer
  const llmJudgeScorer = createLLMJudgeScorer(openaiClient);

  // Create summaries model with system prompt
  const summariesModel = createEvaluationModel<
    SummariesDatasetRow,
    SummariesModelOutput
  >(openaiClient, EVAL_MODEL, defaultSummariesPrompt, defaultSystemPrompt);

  const summariesDataset = new weave.Dataset({
    name: "T3C Summaries Dataset",
    rows: summariesTestCases,
  });

  const summariesEvaluation = new weave.Evaluation({
    dataset: summariesDataset,
    scorers: [
      summariesJsonStructureScorer,
      summaryLengthScorer,
      summaryContentQualityScorer,
      llmJudgeScorer,
    ],
  });

  evaluationLogger.info("Running T3C summaries evaluation...");
  const summariesResults = await summariesEvaluation.evaluate({
    model: summariesModel,
  });
  evaluationLogger.info({ results: summariesResults }, "Summaries Results");
  return summariesResults;
}
