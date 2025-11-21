import { OpenAI } from "openai";
import * as weave from "weave";
import {
  jsonStructureScorer,
  topicCoverageScorer,
  createLLMJudgeScorer,
  createClusteringModel,
} from "./scorers";
import { clusteringDatasets } from "./datasets";
import {
  defaultClusteringPrompt,
  defaultSystemPrompt,
  hydratePromptLiterals,
} from "../../prompts/index";
import { logger } from "../../logger/index.js";

const evaluationLogger = logger.child({ module: "evaluations" });

// Clustering examples using imported sample data

export async function runClusteringEvaluation() {
  const openaiClient = weave.wrapOpenAI(new OpenAI());

  // Create LLM-based semantic similarity scorer
  const llmJudgeScorer = createLLMJudgeScorer(openaiClient);

  // Create clustering model with system prompt
  const clusteringModel = createClusteringModel(
    openaiClient,
    hydratePromptLiterals,
    defaultClusteringPrompt,
    defaultSystemPrompt,
  );

  const clusteringDataset = new weave.Dataset({
    name: "T3C Clustering Dataset",
    rows: clusteringDatasets,
  });

  const clusteringEvaluation = new weave.Evaluation({
    dataset: clusteringDataset,
    scorers: [jsonStructureScorer, topicCoverageScorer, llmJudgeScorer],
  });

  evaluationLogger.info("Running T3C clustering evaluation...");
  const clusteringResults = await clusteringEvaluation.evaluate({
    model: clusteringModel,
  });
  evaluationLogger.info(
    {
      results: clusteringResults,
    },
    "Clustering Results",
  );
  return clusteringResults;
}
