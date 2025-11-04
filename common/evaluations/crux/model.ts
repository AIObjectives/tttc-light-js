import { OpenAI } from "openai";
import * as weave from "weave";
import {
  cruxJsonStructureScorer,
  explanationQualityScorer,
  createLLMJudgeScorer,
  createCruxModel,
} from "./scorers.js";
import { cruxTestCases } from "./datasets.js";
import {
  defaultCruxPrompt,
  defaultSystemPrompt,
  hydratePromptLiterals,
} from "../../prompts/index.js";

export async function runCruxEvaluation() {
  const openaiClient = weave.wrapOpenAI(new OpenAI());

  // Create LLM-based judge scorer
  const llmJudgeScorer = createLLMJudgeScorer(openaiClient);

  // Create crux model with system prompt
  const cruxModel = createCruxModel(
    openaiClient,
    hydratePromptLiterals,
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

  console.log("Running T3C crux evaluation...");
  const cruxResults = await cruxEvaluation.evaluate({
    model: cruxModel,
  });
  console.log("Crux Results:", JSON.stringify(cruxResults, null, 2));
  return cruxResults;
}
