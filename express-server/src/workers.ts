import type { Logger } from "pino";
import { logger } from "tttc-common/logger";
import * as firebase from "./Firebase";
import { type PipelineJob, pipelineJob } from "./jobs/pipeline";

const workersLogger = logger.child({ module: "workers" });

/**
 * Create a logger with optional requestId for distributed tracing
 */
function createJobLogger(requestId?: string): Logger {
  if (requestId) {
    return workersLogger.child({ requestId });
  }
  return workersLogger;
}

/**
 * Extract error message from unknown error type
 */
function getErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Extract error stack from unknown error type
 */
function getErrorStack(err: unknown): string | undefined {
  return err instanceof Error ? err.stack : undefined;
}

/**
 * Build debug info object for error logging
 */
function buildDebugInfo(job: PipelineJob | null) {
  if (!job) {
    return undefined;
  }
  return {
    firebaseJobId: job.config?.firebaseDetails?.firebaseJobId,
    reportId: job.config?.firebaseDetails?.reportId,
    hasData: !!job.data,
    dataRowCount: job.data?.length,
  };
}

export async function processJob(job: PipelineJob, requestId?: string) {
  const jobLogger = createJobLogger(requestId);

  jobLogger.info(
    {
      reportId: job.config.firebaseDetails.reportId,
      firebaseJobId: job.config.firebaseDetails.firebaseJobId,
    },
    "Processing pipeline job",
  );

  await pipelineJob(job, requestId);
}

/**
 * Update Firebase status to failed when job processing fails
 */
async function updateFirebaseFailedStatus(
  job: PipelineJob,
  errorMessage: string,
  jobLogger: Logger,
): Promise<void> {
  if (!job?.config.firebaseDetails) {
    throw new firebase.JobNotFoundError();
  }

  const { firebaseJobId, reportId } = job.config.firebaseDetails;
  const reportIdentifier = reportId || firebaseJobId;

  await firebase.updateReportRefStatusWithRetry(reportIdentifier, "failed", {
    errorMessage,
  });

  jobLogger.info(
    { firebaseJobId, reportId: reportIdentifier, errorMessage },
    "Updated REPORT_REF collection to failed status",
  );
}

export async function processJobFailure(
  job: PipelineJob,
  err: unknown,
  requestId?: string,
) {
  const jobLogger = createJobLogger(requestId);
  const errorMessage = getErrorMessage(err);

  try {
    await updateFirebaseFailedStatus(job, errorMessage, jobLogger);
  } catch (updateError) {
    if (updateError instanceof firebase.JobNotFoundError) {
      return;
    }
    if (updateError instanceof Error) {
      jobLogger.error(
        { error: updateError, originalJobError: err },
        "Failed to update Firebase REPORT_REF to failed status",
      );
    }
  }

  jobLogger.error(
    {
      error: err,
      debugInfo: buildDebugInfo(job),
      errorMessage,
      errorStack: getErrorStack(err),
    },
    "Pipeline worker failed",
  );
}
