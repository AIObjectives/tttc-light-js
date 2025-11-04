import * as weave from "weave";
import { runClusteringEvaluation } from "./clustering/model";
import { runExtractionEvaluation } from "./extraction/model";
import { runDeduplicationEvaluation } from "./deduplication/model";
import { runSummariesEvaluation } from "./summaries/model";
import { runCruxEvaluation } from "./crux/model";
import { logger } from "../logger";

const evaluationLogger = logger.child({ module: "evaluations" });

async function main(): Promise<void> {
  await weave.init("t3c-pipeline-evaluation");

  const evaluationType = process.argv[2];

  switch (evaluationType) {
    case "clustering":
      evaluationLogger.info("Running clustering evaluation...\n");
      await runClusteringEvaluation();
      break;
    case "extraction":
      evaluationLogger.info("Running extraction evaluation...\n");
      await runExtractionEvaluation();
      break;
    case "deduplication":
      evaluationLogger.info("Running deduplication evaluation...\n");
      await runDeduplicationEvaluation();
      break;
    case "summaries":
      evaluationLogger.info("Running summaries evaluation...\n");
      await runSummariesEvaluation();
      break;
    case "crux":
      evaluationLogger.info("Running crux evaluation...\n");
      await runCruxEvaluation();
      break;
    default:
      evaluationLogger.info(
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
