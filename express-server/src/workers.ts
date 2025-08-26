import { Worker, Job } from "bullmq";
import * as firebase from "./Firebase";
import Redis from "ioredis";
import { logger } from "tttc-common/logger";
import { PipelineJob, pipelineJob } from "./jobs/pipeline";

const workersLogger = logger.child({ module: "workers" });

const setupPipelineWorker = (connection: Redis, queueName: string) => {
  const pipeLineWorker = new Worker(
    queueName,
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
    workersLogger.error(
      {
        error: e,
        jobId: job?.id,
        jobData: job?.data,
        errorMessage: e instanceof Error ? e.message : String(e),
        errorStack: e instanceof Error ? e.stack : undefined,
      },
      "Pipeline worker failed",
    );
  });

  return pipeLineWorker;
};

export const setupWorkers = (connection: Redis, queueName: string) =>
  setupPipelineWorker(connection, queueName);
