import { Worker, Job } from "bullmq";
import Redis from "ioredis";
import * as firebase from "./Firebase";
import { logger } from "tttc-common/logger";
import { PipelineJob, pipelineJob } from "./jobs/pipeline";

const workersLogger = logger.child({ module: "workers" });

// setupPipelineWorker is here so that if any jobs remain in the Redis queue after implementing the new pubsub feature they can be processed.  This should be removed after that.
const setupPipelineWorker = (connection: Redis, queueName: string) => {
  const pipelineWorker = new Worker(
    queueName,
    async (job: Job) => {
      await processJob(job.data);
    },
    { connection, stalledInterval: 3000000, skipStalledCheck: true }, // ! the stalledInterval and skipStalledCheck is a magical solution to the timeout problem. Need to find a better long-term fix
  );

  pipelineWorker.on("failed", async (job, err) => {
    await processJobFailure(job?.data, err);
  });

  return pipelineWorker;
};

export async function processJob(job: PipelineJob) {
  await pipelineJob(job);
}

export async function processJobFailure(job: PipelineJob, err: any) {
  // Update REPORT_REF collection to failed status
  try {
    if (!job?.config.firebaseDetails) {
      throw new firebase.JobNotFoundError();
    }

    const { firebaseJobId, reportId } = job.config.firebaseDetails;
    const errorMessage = err instanceof Error ? err.message : String(err);

    // Update REPORT_REF collection only (REPORT_JOB no longer tracks status)
    await firebase.updateReportRefStatusWithRetry(
      reportId || firebaseJobId, // Use reportId if available, fallback to firebaseJobId
      "failed",
      { errorMessage },
    );

    workersLogger.info(
      {
        firebaseJobId,
        reportId: reportId || firebaseJobId,
        errorMessage,
      },
      "Updated REPORT_REF collection to failed status",
    );
  } catch (updateError) {
    // if job not found, don't throw a fit
    if (updateError instanceof firebase.JobNotFoundError) {
      return;
    } else if (updateError instanceof Error) {
      workersLogger.error(
        {
          error: updateError,
          originalJobError: err,
        },
        "Failed to update Firebase REPORT_REF to failed status",
      );
      // TODO: do we want to throw an error here?
      // throw new Error("Could not update Firestore REPORT_REF to failed status: " + updateError.message)
    }
  }
  workersLogger.error(
    {
      error: err,
      // Only log minimal, non-sensitive debugging info
      debugInfo: job
        ? {
            firebaseJobId: job.config?.firebaseDetails?.firebaseJobId,
            reportId: job.config?.firebaseDetails?.reportId,
            hasData: !!job.data,
            dataRowCount: job.data?.length,
          }
        : undefined,
      errorMessage: err instanceof Error ? err.message : String(err),
      errorStack: err instanceof Error ? err.stack : undefined,
    },
    "Pipeline worker failed",
  );
}

export const setupWorkers = (connection: Redis, queueName: string) => {
  setupPipelineWorker(connection, queueName);
};
