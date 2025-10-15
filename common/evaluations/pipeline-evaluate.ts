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
  extractionJsonStructureScorer,
  claimQualityScorer,
  taxonomyAlignmentScorer,
  quoteRelevanceScorer,
  extractionCompletenessScorer,
  createExtractionModel,
  extractionTestCases,
} from "./scorers/extraction-scorers.js";
import {
  defaultClusteringPrompt,
  defaultExtractionPrompt,
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

// Create extraction model with system prompt
const extractionModel = createExtractionModel(
  openaiClient,
  hydratePromptLiterals,
  defaultExtractionPrompt,
  defaultSystemPrompt,
);

async function runClusteringEvaluation() {
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
  const clusteringResults = await clusteringEvaluation.evaluate({
    model: clusteringModel,
  });
  console.log(
    "Clustering Results:",
    JSON.stringify(clusteringResults, null, 2),
  );
  return clusteringResults;
}

async function runExtractionEvaluation() {
  const extractionDataset = new weave.Dataset({
    name: "T3C Extraction Dataset",
    rows: extractionTestCases,
  });

  const extractionEvaluation = new weave.Evaluation({
    dataset: extractionDataset,
    scorers: [
      extractionJsonStructureScorer,
      claimQualityScorer,
      taxonomyAlignmentScorer,
      quoteRelevanceScorer,
      extractionCompletenessScorer,
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

async function main() {
  await weave.init("t3c-pipeline-evaluation");

  const evaluationType = process.argv[2];

  switch (evaluationType) {
    case "clustering":
      console.log("Running clustering evaluation...\n");
      await runClusteringEvaluation();
      break;
    case "extraction":
      console.log("Running extraction evaluation...\n");
      await runExtractionEvaluation();
      break;
    default:
      console.log(
        "Running full T3C pipeline evaluation (clustering + extraction)...\n",
      );
      await runClusteringEvaluation();
      await runExtractionEvaluation();
      break;
  }
}

main();
