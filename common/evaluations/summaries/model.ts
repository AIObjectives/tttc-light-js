import { OpenAI } from "openai";
import * as weave from "weave";
import {
  summariesJsonStructureScorer,
  summaryLengthScorer,
  summaryContentQualityScorer,
  summariesTopicCoverageScorer,
  createLLMJudgeScorer,
  createSummariesModel,
} from "./scorers.js";
import { summariesTestCases } from "./datasets.js";
import {
  defaultSummariesPrompt,
  defaultSystemPrompt,
  hydratePromptLiterals,
} from "../../prompts/index.js";

export async function runSummariesEvaluation() {
  const openaiClient = weave.wrapOpenAI(new OpenAI());

  // Create LLM-based judge scorer
  const llmJudgeScorer = createLLMJudgeScorer(openaiClient);

  // Create summaries model with system prompt
  const summariesModel = createSummariesModel(
    openaiClient,
    hydratePromptLiterals,
    defaultSummariesPrompt,
    defaultSystemPrompt,
  );

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
      summariesTopicCoverageScorer,
      llmJudgeScorer,
    ],
  });

  console.log("Running T3C summaries evaluation...");
  const summariesResults = await summariesEvaluation.evaluate({
    model: summariesModel,
  });
  console.log("Summaries Results:", JSON.stringify(summariesResults, null, 2));
  return summariesResults;
}
