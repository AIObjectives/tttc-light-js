import { OpenAI } from "openai";
import * as weave from "weave";
import {
  jsonStructureScorer,
  topicCoverageScorer,
  contentQualityScorer,
  semanticSimilarityScorer,
  createClusteringModel,
  sampleComments,
  sampleClusteringData,
} from "./scorers/clustering-scorers.js";
import {
  defaultClusteringPrompt,
  defaultSystemPrompt,
  hydratePromptLiterals,
} from "../prompts/index.js";

// Clustering examples using imported sample data with expected taxonomy
const clusteringExamples = [
  {
    id: "clustering-1",
    comments: sampleComments,
    expectedTaxonomy: sampleClusteringData.expectedOutput,
  },
];

const openaiClient = weave.wrapOpenAI(new OpenAI());

// Create clustering model with system prompt
const clusteringModel = createClusteringModel(
  openaiClient,
  hydratePromptLiterals,
  defaultClusteringPrompt,
  defaultSystemPrompt,
);

async function main() {
  await weave.init("t3c-pipeline-evaluation");

  const clusteringDataset = new weave.Dataset({
    name: "T3C Clustering Dataset",
    rows: clusteringExamples,
  });

  const clusteringEvaluation = new weave.Evaluation({
    dataset: clusteringDataset,
    scorers: [
      jsonStructureScorer,
      topicCoverageScorer,
      contentQualityScorer,
      semanticSimilarityScorer,
    ],
  });

  console.log("Running T3C clustering evaluation...");
  const results = await clusteringEvaluation.evaluate({
    model: clusteringModel,
  });
  console.log("Results:", JSON.stringify(results, null, 2));
}

main();
