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

  console.log("Running T3C extraction evaluation...");
  const extractionResults = await extractionEvaluation.evaluate({
    model: extractionModel,
  });
  console.log(
    "Extraction Results:",
    JSON.stringify(extractionResults, null, 2),
  );
  return extractionResults;
}
