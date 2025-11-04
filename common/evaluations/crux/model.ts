import { OpenAI } from "openai";
import * as weave from "weave";
import {
  cruxJsonStructureScorer,
  explanationQualityScorer,
  createLLMJudgeScorer,
} from "./scorers.js";
import { cruxTestCases } from "./datasets";
import { CruxDatasetRow, CruxModelOutput } from "./types";
import { defaultCruxPrompt, defaultSystemPrompt } from "../../prompts";
import { createEvaluationModel } from "../";
import { logger } from "../../logger";
import { EVAL_MODEL } from "../constants";

const evaluationLogger = logger.child({ module: "evaluations" });

export async function runCruxEvaluation(): Promise<Record<string, unknown>> {
  const openaiClient = weave.wrapOpenAI(new OpenAI());

  // Create LLM-based judge scorer
  const llmJudgeScorer = createLLMJudgeScorer(openaiClient);

  // Create crux model with system prompt
  const cruxModel = createEvaluationModel<CruxDatasetRow, CruxModelOutput>(
    openaiClient,
    EVAL_MODEL,
    defaultCruxPrompt,
    defaultSystemPrompt,
  );

  const cruxDataset = new weave.Dataset({
    name: "T3C Crux Dataset",
    rows: cruxTestCases,
  });

  const cruxEvaluation = new weave.Evaluation({
    dataset: cruxDataset,
    scorers: [
      cruxJsonStructureScorer,
      explanationQualityScorer,
      llmJudgeScorer,
    ],
  });

  evaluationLogger.info("Running T3C crux evaluation...");
  const cruxResults = await cruxEvaluation.evaluate({
    model: cruxModel,
  });
  evaluationLogger.info({ results: cruxResults }, "Crux Results");
  return cruxResults;
}
