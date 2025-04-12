import { Worker, Job } from "bullmq";
import * as firebase from "./Firebase";
import Redis from "ioredis";
import { PipelineJob, pipelineJob } from "./jobs/pipeline";

const setupPipelineWorker = (connection: Redis) => {
  const pipeLineWorker = new Worker(
    "pipeline",
    async (job: Job<PipelineJob>) => {
      await pipelineJob(job);
    },
    { connection, stalledInterval: 3000000, skipStalledCheck: true }, // ! the stalledInterval and skipStalledCheck is a magical solution to the timeout problem. Need to find a better long-term fix
  );

  pipeLineWorker.on("failed", async (job, e) => {
    // Update Firestore reportJob to failed status
    try {
      if (!job?.data.config.firebaseDetails) {
        throw new firebase.JobNotFoundError();
      }
      await firebase.updateReportJobStatus(
        job.data.config.firebaseDetails.firebaseJobId,
        "failed",
      );
    } catch (e) {
      // if job not found, don't throw a fit
      if (e instanceof firebase.JobNotFoundError) {
        return;
      } else if (e instanceof Error) {
        // TODO: do we want to throw an error here?
        // throw new Error("Could not update Firestore reportJob to failed status: " + e.message)
      }
    }
    console.error(
      "Pipeline worker failed: " +
        (e instanceof Error ? `${e.message}: ${e.stack}` : e),
    );
    // TODO: Logging 🪵
  });

  return pipeLineWorker;
};

export const setupWorkers = (connection: Redis) =>
  setupPipelineWorker(connection);
