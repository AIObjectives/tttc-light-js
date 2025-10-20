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
  deduplicationJsonStructureScorer,
  claimCoverageScorer,
  groupingQualityScorer,
  consolidationScorer,
  groupClaimQualityScorer,
  createDeduplicationModel,
  deduplicationTestCases,
} from "./scorers/deduplication-scorers.js";
import {
  defaultClusteringPrompt,
  defaultExtractionPrompt,
  defaultDedupPrompt,
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

// Create deduplication model with system prompt
const deduplicationModel = createDeduplicationModel(
  openaiClient,
  hydratePromptLiterals,
  defaultDedupPrompt,
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

async function runDeduplicationEvaluation() {
  const deduplicationDataset = new weave.Dataset({
    name: "T3C Deduplication Dataset",
    rows: deduplicationTestCases,
  });

  const deduplicationEvaluation = new weave.Evaluation({
    dataset: deduplicationDataset,
    scorers: [
      deduplicationJsonStructureScorer,
      claimCoverageScorer,
      groupingQualityScorer,
      consolidationScorer,
      groupClaimQualityScorer,
    ],
  });

  console.log("Running T3C deduplication evaluation...");
  const deduplicationResults = await deduplicationEvaluation.evaluate({
    model: deduplicationModel,
  });
  console.log(
    "Deduplication Results:",
    JSON.stringify(deduplicationResults, null, 2),
  );
  return deduplicationResults;
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
    case "deduplication":
      console.log("Running deduplication evaluation...\n");
      await runDeduplicationEvaluation();
      break;
    default:
      console.log(
        "Running full T3C pipeline evaluation (clustering + extraction + deduplication)...\n",
      );
      await runClusteringEvaluation();
      await runExtractionEvaluation();
      await runDeduplicationEvaluation();
      break;
  }
}

main();
