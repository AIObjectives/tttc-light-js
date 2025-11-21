import { OpenAI } from "openai";
import * as weave from "weave";
import {
  extractionJsonStructureScorer,
  taxonomyAlignmentScorer,
  createLLMJudgeScorer,
  createExtractionModel,
} from "./scorers.js";
import { extractionTestCases } from "./datasets.js";
import {
  defaultExtractionPrompt,
  defaultSystemPrompt,
  hydratePromptLiterals,
} from "../../prompts/index.js";
import { logger } from "../../logger/index.js";

const evaluationLogger = logger.child({ module: "evaluations" });

export async function runExtractionEvaluation() {
  const openaiClient = weave.wrapOpenAI(new OpenAI());

  // Create LLM-based judge scorer
  const llmJudgeScorer = createLLMJudgeScorer(openaiClient);

  // Create extraction model with system prompt
  const extractionModel = createExtractionModel(
    openaiClient,
    hydratePromptLiterals,
    defaultExtractionPrompt,
    defaultSystemPrompt,
  );

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
