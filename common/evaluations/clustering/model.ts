import { OpenAI } from "openai";
import * as weave from "weave";
import { logger } from "../../logger";
import {
  defaultClusteringPrompt,
  defaultSystemPrompt,
} from "../../prompts/index.js";
import { createEvaluationModel } from "../";
import { EVAL_MODEL } from "../constants";
import { clusteringDatasets } from "./datasets";
import {
  createLLMJudgeScorer,
  jsonStructureScorer,
  topicCoverageScorer,
} from "./scorers.js";
import type { ClusteringDatasetRow, ClusteringModelOutput } from "./types";

const evaluationLogger = logger.child({ module: "evaluations" });

export async function runClusteringEvaluation(): Promise<
  Record<string, unknown>
> {
  const openaiClient = weave.wrapOpenAI(new OpenAI());

  // Create LLM-based scorer scorer
  const llmJudgeScorer = createLLMJudgeScorer(openaiClient);

  // Create clustering model with default prompts
  const clusteringModel = createEvaluationModel<
    ClusteringDatasetRow,
    ClusteringModelOutput
  >(openaiClient, EVAL_MODEL, defaultClusteringPrompt, defaultSystemPrompt);

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
