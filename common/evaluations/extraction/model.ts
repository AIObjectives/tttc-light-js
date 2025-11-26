import { OpenAI } from "openai";
import * as weave from "weave";
import {
  extractionJsonStructureScorer,
  taxonomyAlignmentScorer,
  createLLMJudgeScorer,
} from "./scorers.js";
import { ExtractionDatasetRow, ExtractionModelOutput } from "./types";
import { extractionTestCases } from "./datasets";
import { defaultExtractionPrompt, defaultSystemPrompt } from "../../prompts";
import { logger } from "../../logger";
import { createEvaluationModel } from "../";
import { EVAL_MODEL } from "../constants";

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
