import { OpenAI } from "openai";
import * as weave from "weave";
import { logger } from "../../logger";
import { defaultExtractionPrompt, defaultSystemPrompt } from "../../prompts";
import { createEvaluationModel } from "../";
import { EVAL_MODEL } from "../constants";
import { extractionTestCases } from "./datasets";
import {
  createLLMJudgeScorer,
  extractionJsonStructureScorer,
  taxonomyAlignmentScorer,
} from "./scorers.js";
import type { ExtractionDatasetRow, ExtractionModelOutput } from "./types";

const evaluationLogger = logger.child({ module: "evaluations" });

export async function runExtractionEvaluation(): Promise<
  Record<string, unknown>
> {
  const openaiClient = weave.wrapOpenAI(new OpenAI());

  // Create LLM-based judge scorer
  const llmJudgeScorer = createLLMJudgeScorer(openaiClient);

  // Create extraction model with system prompt
  const extractionModel = createEvaluationModel<
    ExtractionDatasetRow,
    ExtractionModelOutput
  >(openaiClient, EVAL_MODEL, defaultExtractionPrompt, defaultSystemPrompt);

  const extractionDataset = new weave.Dataset({
    name: "T3C Extraction Dataset",
    rows: extractionTestCases,
  });

  const extractionEvaluation = new weave.Evaluation({
    dataset: extractionDataset,
    scorers: [
      extractionJsonStructureScorer,
      taxonomyAlignmentScorer,
      llmJudgeScorer,
    ],
  });

  evaluationLogger.info("Running T3C extraction evaluation...");
  const extractionResults = await extractionEvaluation.evaluate({
    model: extractionModel,
  });
  evaluationLogger.info(
    {
      results: extractionResults,
    },
    "Extraction Results",
  );
  return extractionResults;
}
