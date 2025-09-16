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
    // Update REPORT_REF collection to failed status
    try {
      if (!job?.data.config.firebaseDetails) {
        throw new firebase.JobNotFoundError();
      }

      const { firebaseJobId, reportId } = job.data.config.firebaseDetails;
      const errorMessage = e instanceof Error ? e.message : String(e);

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
            originalJobError: e,
            jobId: job?.id,
          },
          "Failed to update Firebase REPORT_REF to failed status",
        );
        // TODO: do we want to throw an error here?
        // throw new Error("Could not update Firestore REPORT_REF to failed status: " + updateError.message)
      }
    }
    workersLogger.error(
      {
        error: e,
        jobId: job?.id,
        // Only log minimal, non-sensitive debugging info
        debugInfo: job?.data
          ? {
              firebaseJobId: job.data.config?.firebaseDetails?.firebaseJobId,
              reportId: job.data.config?.firebaseDetails?.reportId,
              hasData: !!job.data.data,
              dataRowCount: job.data.data?.length,
            }
          : undefined,
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
