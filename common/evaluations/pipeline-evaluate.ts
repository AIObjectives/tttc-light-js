import * as weave from "weave";
import { runClusteringEvaluation } from "./clustering/model.js";
import { runExtractionEvaluation } from "./extraction/model.js";
import { runDeduplicationEvaluation } from "./deduplication/model.js";
import { runSummariesEvaluation } from "./summaries/model.js";
import { runCruxEvaluation } from "./crux/model.js";

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
    case "summaries":
      console.log("Running summaries evaluation...\n");
      await runSummariesEvaluation();
      break;
    case "crux":
      console.log("Running crux evaluation...\n");
      await runCruxEvaluation();
      break;
    default:
      console.log(
        "Running full T3C pipeline evaluation (clustering + extraction + deduplication + summaries + crux)...\n",
      );
      await runClusteringEvaluation();
      await runExtractionEvaluation();
      await runDeduplicationEvaluation();
      await runSummariesEvaluation();
      await runCruxEvaluation();
      break;
  }
}

main();
