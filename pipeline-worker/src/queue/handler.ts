/**
 * Queue message handler for pipeline jobs
 */

import type { ReportRef } from "tttc-common/firebase";
import { failure, type Result, success } from "tttc-common/functional-utils";
import { logger } from "tttc-common/logger";
import type { PipelineJobMessage } from "tttc-common/schema";
import type { BucketStore } from "../bucketstore/index.js";
import type { RefStoreServices } from "../datastore/refstore/index.js";
import { formatPipelineOutput } from "../pipeline-runner/format-output.js";
import { runPipeline } from "../pipeline-runner/index.js";
import type { RedisPipelineStateStore } from "../pipeline-runner/state-store.js";
import type { PipelineInput } from "../pipeline-runner/types.js";
import {
  HandlerError,
  StorageError,
  ValidationError,
} from "./handler-errors.js";
import type { PubSubMessage } from "./index.js";

const queueLogger = logger.child({ module: "queue-handler" });

/**
 * Validate required fields in pipeline job config
 */
function validatePipelineJobConfig(
  job: PipelineJobMessage,
): Result<void, ValidationError> {
  const { config } = job;
  const { instructions, llm, options, env } = config;

  const requiredFields = [
    { value: llm.model, name: "config.llm.model" },
    {
      value: instructions.systemInstructions,
      name: "config.instructions.systemInstructions",
    },
    {
      value: instructions.clusteringInstructions,
      name: "config.instructions.clusteringInstructions",
    },
    {
      value: instructions.extractionInstructions,
      name: "config.instructions.extractionInstructions",
    },
    {
      value: instructions.dedupInstructions,
      name: "config.instructions.dedupInstructions",
    },
    {
      value: instructions.summariesInstructions,
      name: "config.instructions.summariesInstructions",
    },
    { value: env.OPENAI_API_KEY, name: "config.env.OPENAI_API_KEY" },
  ];

  for (const field of requiredFields) {
    if (!field.value) {
      return failure(
        new ValidationError(`Missing required field: ${field.name}`),
      );
    }
  }

  if (options.cruxes && !instructions.cruxInstructions) {
    return failure(
      new ValidationError(
        "Missing required field: config.instructions.cruxInstructions (required when cruxes are enabled)",
      ),
    );
  }

  return success(undefined);
}

/**
 * Validate that the data array contains valid, non-empty comments.
 * This prevents the pipeline from consuming resources on malformed entries.
 * @internal Exported for testing
 */
export function validateDataArray(
  data: PipelineJobMessage["data"],
): Result<void, ValidationError> {
  if (data.length === 0) {
    return failure(
      new ValidationError("Data array is empty - no comments to process"),
    );
  }

  const emptyComments: string[] = [];

  for (const comment of data) {
    if (!comment.comment_text || comment.comment_text.trim().length === 0) {
      emptyComments.push(comment.comment_id);
    }
  }

  if (emptyComments.length > 0) {
    const displayIds =
      emptyComments.length <= 5
        ? emptyComments.join(", ")
        : `${emptyComments.slice(0, 5).join(", ")} and ${emptyComments.length - 5} more`;
    return failure(
      new ValidationError(
        `Found ${emptyComments.length} comment(s) with empty or whitespace-only text: ${displayIds}`,
      ),
    );
  }

  return success(undefined);
}

/**
 * Convert express-server PipelineJob to pipeline-worker PipelineInput
 * Assumes validation has already been performed
 */
function convertToPipelineInput(
  job: PipelineJobMessage,
): Result<PipelineInput, ValidationError> {
  const { config, data } = job;
  const { instructions, llm, options, env } = config;

  // Convert comments to pipeline-worker format
  const comments = data.map((comment: (typeof data)[0]) => ({
    id: comment.comment_id,
    text: comment.comment_text,
    speaker: comment.speaker,
  }));

  return success({
    comments,
    clusteringConfig: {
      model_name: llm.model,
      system_prompt: instructions.systemInstructions,
      user_prompt: instructions.clusteringInstructions,
    },
    claimsConfig: {
      model_name: llm.model,
      system_prompt: instructions.systemInstructions,
      user_prompt: instructions.extractionInstructions,
    },
    dedupConfig: {
      model_name: llm.model,
      system_prompt: instructions.systemInstructions,
      user_prompt: instructions.dedupInstructions,
    },
    summariesConfig: {
      model_name: llm.model,
      system_prompt: instructions.systemInstructions,
      user_prompt: instructions.summariesInstructions,
    },
    cruxesConfig: options.cruxes
      ? {
          model_name: llm.model,
          system_prompt: instructions.systemInstructions,
          user_prompt: instructions.cruxInstructions,
        }
      : undefined,
    apiKey: env.OPENAI_API_KEY,
    enableCruxes: options.cruxes,
    sortStrategy: options.sortStrategy,
  });
}

/**
 * Save successful pipeline result to storage and update Firestore
 *
 * Saves in this order to ensure consistency:
 * 1. Mark Firestore as "processing_upload" (transient state)
 * 2. Upload to GCS
 * 3. Update Firestore with final "completed" status and reportDataUri
 *
 * This ensures that if GCS upload fails, Firestore correctly shows "processing_upload"
 * and can be retried, rather than being stuck in "completed" without a file.
 */
async function saveSuccessfulPipeline(
  result: Awaited<ReturnType<typeof runPipeline>>,
  data: PipelineJobMessage,
  reportId: string,
  storage: BucketStore,
  refStore: RefStoreServices,
  jobLogger: typeof queueLogger,
): Promise<Result<void, StorageError>> {
  try {
    // Format pipeline output for storage
    const pipelineOutput = formatPipelineOutput(result, data);
    const reportJson = JSON.stringify(pipelineOutput);
    const filename = `${reportId}.json`;

    // Extract statistics from sortedTree
    const sortedTree = pipelineOutput.sortedTree;
    const numTopics = sortedTree.length;
    const numSubtopics = sortedTree.reduce(
      (sum, [, topicData]) => sum + topicData.topics.length,
      0,
    );
    const numClaims = sortedTree.reduce(
      (sum, [, topicData]) => sum + topicData.counts.claims,
      0,
    );

    // Step 1: Mark in Firestore that we're uploading (transient state)
    const reportRef = await refStore.Report.get(reportId);
    if (!reportRef) {
      return failure(
        new StorageError(`ReportRef ${reportId} not found`, false),
      );
    }

    await refStore.Report.modify(reportId, {
      ...reportRef,
      status: "processing",
      lastStatusUpdate: new Date(),
    });

    jobLogger.info(
      {
        filename,
        reportJsonSize: reportJson.length,
      },
      "Uploading report to GCS",
    );

    // Step 2: Upload to GCS
    const reportUrl = await storage.storeFile(filename, reportJson);

    jobLogger.info(
      {
        reportUrl,
        reportJsonSize: reportJson.length,
      },
      "Report saved to GCS successfully",
    );

    // Step 3: Update ReportRef in Firestore with final status
    const updatedReportRef: ReportRef = {
      ...reportRef,
      reportDataUri: reportUrl,
      status: "completed",
      lastStatusUpdate: new Date(),
      title: data.reportDetails.title,
      description: data.reportDetails.description,
      numTopics,
      numSubtopics,
      numClaims,
      // numPeople is not currently tracked by pipeline-worker
      // This would require analyzing unique speakers across all comments
      // For now, set to 0 to indicate "unknown" rather than implementing incorrectly
      numPeople: 0,
      createdDate: new Date(pipelineOutput.completedAt),
    };

    await refStore.Report.modify(reportId, updatedReportRef);

    jobLogger.info(
      {
        reportId,
        numTopics,
        numSubtopics,
        numClaims,
      },
      "Firestore updated with completed status",
    );

    return success(undefined);
  } catch (error) {
    const cause = error instanceof Error ? error : new Error(String(error));
    // Storage operations are generally transient (network issues)
    // unless they're permission errors, which would have been caught in checkStorageExists
    return failure(new StorageError(cause.message, true, cause));
  }
}

/**
 * Update Firestore with error status
 * Errors here are logged but not propagated since we're already in error handling
 */
async function updateFirestoreWithError(
  reportId: string,
  errorMessage: string,
  refStore: RefStoreServices,
  jobLogger: typeof queueLogger,
): Promise<Result<void, Error>> {
  try {
    const reportRef = await refStore.Report.get(reportId);
    if (reportRef) {
      await refStore.Report.modify(reportId, {
        ...reportRef,
        status: "failed",
        errorMessage,
        lastStatusUpdate: new Date(),
      });

      jobLogger.info({ reportId }, "Firestore updated with failure status");
      return success(undefined);
    }
    return failure(new Error(`ReportRef ${reportId} not found`));
  } catch (updateError) {
    const error =
      updateError instanceof Error
        ? updateError
        : new Error(String(updateError));
    jobLogger.error({ error }, "Failed to update Firestore with error status");
    return failure(error);
  }
}

/**
 * Check if file exists in storage, handling errors
 *
 * Returns failure on permanent errors (permissions, config) to fail fast and avoid
 * wasting compute/LLM resources on a pipeline that cannot save results.
 * Returns failure on transient errors (network) with isTransient flag to trigger message retry.
 */
async function checkStorageExists(
  reportId: string,
  storage: BucketStore,
  jobLogger: typeof queueLogger,
): Promise<Result<{ exists: boolean }, StorageError>> {
  const filename = `${reportId}.json`;
  const fileExistsResult = await storage.fileExists(filename);

  if (fileExistsResult.exists) {
    jobLogger.info(
      "Report file already exists in storage, skipping duplicate message",
    );
    return success({ exists: true });
  }

  if (fileExistsResult.error) {
    const isTransient = fileExistsResult.errorType === "transient";

    if (isTransient) {
      // Transient errors (network blips) - return failure with isTransient flag
      jobLogger.warn(
        {
          error: fileExistsResult.error,
          errorType: fileExistsResult.errorType,
        },
        "Transient storage error checking file existence - message will be retried",
      );
      return failure(
        new StorageError(
          `Transient storage error: ${fileExistsResult.error}`,
          true,
          fileExistsResult.error,
        ),
      );
    }

    // Permanent errors (permissions, bucket not found, etc.) - fail fast
    jobLogger.error(
      {
        error: fileExistsResult.error,
        errorType: fileExistsResult.errorType,
      },
      "Permanent storage error - cannot proceed with pipeline (would fail on save)",
    );
    return failure(
      new StorageError(
        `Storage configuration error: ${fileExistsResult.error}`,
        false,
        fileExistsResult.error,
      ),
    );
  }

  return success({ exists: false });
}

/**
 * Determine if pipeline should resume from existing state
 */
function shouldResumeFromState(
  state: Awaited<ReturnType<RedisPipelineStateStore["get"]>>,
): boolean {
  if (!state) return false;
  return state.status === "running" || state.status === "failed";
}

/**
 * Check if pipeline should be skipped due to existing completion.
 *
 * Storage errors (both transient and permanent) are returned as failures.
 */
async function shouldSkipPipeline(
  reportId: string,
  storage: BucketStore,
  stateStore: RedisPipelineStateStore,
  jobLogger: typeof queueLogger,
): Promise<
  Result<
    {
      skip: boolean;
      shouldResume: boolean;
      existingState: Awaited<ReturnType<typeof stateStore.get>>;
    },
    StorageError
  >
> {
  const storageCheck = await checkStorageExists(reportId, storage, jobLogger);

  if (storageCheck.tag === "failure") {
    return storageCheck;
  }

  if (storageCheck.value.exists) {
    return success({ skip: true, shouldResume: false, existingState: null });
  }

  const existingState = await stateStore.get(reportId);
  const shouldResume = shouldResumeFromState(existingState);

  if (existingState?.status === "completed") {
    // If we reach here, storage check succeeded but file doesn't exist
    // This means the pipeline completed but the file was deleted or never saved
    jobLogger.info(
      "Pipeline marked completed but storage missing, re-attempting save only (not re-running pipeline)",
    );
  }

  return success({ skip: false, shouldResume, existingState });
}

/**
 * Handle successful pipeline result
 */
async function handlePipelineSuccess(
  result: Awaited<ReturnType<typeof runPipeline>>,
  data: PipelineJobMessage,
  reportId: string,
  storage: BucketStore,
  refStore: RefStoreServices,
  jobLogger: typeof queueLogger,
): Promise<Result<void, StorageError>> {
  jobLogger.info(
    {
      totalDurationMs: result.state.totalDurationMs,
      totalTokens: result.state.totalTokens,
      totalCost: result.state.totalCost,
    },
    "Pipeline job completed successfully",
  );

  const saveResult = await saveSuccessfulPipeline(
    result,
    data,
    reportId,
    storage,
    refStore,
    jobLogger,
  );

  if (saveResult.tag === "failure") {
    jobLogger.error(
      { error: saveResult.error },
      "Failed to save report or update Firestore",
    );

    const errorMessage = `Storage error: ${saveResult.error.message}`;
    await updateFirestoreWithError(reportId, errorMessage, refStore, jobLogger);

    return saveResult;
  }

  return success(undefined);
}

/**
 * Handle failed pipeline result
 */
async function handlePipelineFailureResult(
  result: Awaited<ReturnType<typeof runPipeline>>,
  reportId: string,
  refStore: RefStoreServices,
  jobLogger: typeof queueLogger,
): Promise<Result<never, HandlerError>> {
  jobLogger.error(
    {
      error: result.error,
      currentStep: result.state.currentStep,
    },
    "Pipeline job failed",
  );

  const errorMessage = result.error?.message ?? "Unknown error";
  await updateFirestoreWithError(reportId, errorMessage, refStore, jobLogger);

  return failure(
    new HandlerError(`Pipeline failed: ${errorMessage}`, false, result.error),
  );
}

/**
 * Execute pipeline with locking to prevent concurrent execution
 */
async function executePipelineWithLock(
  reportId: string,
  userId: string,
  lockValue: string,
  shouldResume: boolean,
  existingState: Awaited<ReturnType<RedisPipelineStateStore["get"]>>,
  pipelineInput: PipelineInput,
  stateStore: RedisPipelineStateStore,
  storage: BucketStore,
  refStore: RefStoreServices,
  data: PipelineJobMessage,
  jobLogger: typeof queueLogger,
): Promise<Result<void, HandlerError | StorageError>> {
  const lockAcquired = await stateStore.acquirePipelineLock(
    reportId,
    lockValue,
  );

  if (!lockAcquired) {
    jobLogger.info(
      "Pipeline execution already in progress by another worker, skipping",
    );
    return success(undefined);
  }

  try {
    if (shouldResume && existingState) {
      jobLogger.info(
        {
          currentStep: existingState.currentStep,
          status: existingState.status,
        },
        "Resuming existing pipeline from saved state",
      );
    }

    const result = await runPipeline(
      pipelineInput,
      {
        reportId,
        userId,
        resumeFromState: shouldResume,
      },
      stateStore,
    );

    // Verify we still hold the lock before processing results
    // This prevents race conditions if the lock expired during execution
    const stillHoldsLock = await stateStore.verifyPipelineLock(
      reportId,
      lockValue,
    );

    if (!stillHoldsLock) {
      jobLogger.error(
        "Lost pipeline lock during execution - another worker may have started duplicate processing",
      );
      return failure(
        new HandlerError(
          "Pipeline lock expired during execution - potential duplicate processing detected",
          false,
        ),
      );
    }

    // Extend the lock to protect result processing operations (GCS upload, Firestore updates)
    // This prevents lock expiration during the critical post-execution window
    const lockExtended = await stateStore.extendPipelineLock(
      reportId,
      lockValue,
    );

    if (!lockExtended) {
      jobLogger.error(
        "Failed to extend pipeline lock after verification - lock may have expired",
      );
      return failure(
        new HandlerError(
          "Pipeline lock extension failed - cannot safely process results",
          false,
        ),
      );
    }

    jobLogger.info("Pipeline lock extended for result processing");

    if (result.success) {
      return handlePipelineSuccess(
        result,
        data,
        reportId,
        storage,
        refStore,
        jobLogger,
      );
    }
    return handlePipelineFailureResult(result, reportId, refStore, jobLogger);
  } finally {
    const lockReleased = await stateStore.releasePipelineLock(
      reportId,
      lockValue,
    );
    if (!lockReleased) {
      jobLogger.warn(
        "Failed to release pipeline lock - it may have already expired or been released",
      );
    }
  }
}

/**
 * Handle incoming pipeline job message
 */
export async function handlePipelineJob(
  message: PubSubMessage<PipelineJobMessage>,
  stateStore: RedisPipelineStateStore,
  storage: BucketStore,
  refStore: RefStoreServices,
): Promise<Result<void, HandlerError | ValidationError | StorageError>> {
  const { data } = message;
  const { reportId, userId } = data.config.firebaseDetails;

  const jobLogger = queueLogger.child({
    reportId,
    userId,
    messageId: message.id,
    requestId: message.attributes?.requestId,
  });

  jobLogger.info(
    {
      commentCount: data.data.length,
      enableCruxes: data.config.options.cruxes,
    },
    "Processing pipeline job from queue",
  );

  // Validate config
  const configResult = validatePipelineJobConfig(data);
  if (configResult.tag === "failure") {
    jobLogger.error(
      { error: configResult.error },
      "Pipeline job config validation failed",
    );
    await updateFirestoreWithError(
      reportId,
      configResult.error.message,
      refStore,
      jobLogger,
    );
    return configResult;
  }

  // Validate data
  const dataResult = validateDataArray(data.data);
  if (dataResult.tag === "failure") {
    jobLogger.error(
      { error: dataResult.error },
      "Pipeline job data validation failed",
    );
    await updateFirestoreWithError(
      reportId,
      dataResult.error.message,
      refStore,
      jobLogger,
    );
    return dataResult;
  }

  // Convert to pipeline input
  const inputResult = convertToPipelineInput(data);
  if (inputResult.tag === "failure") {
    jobLogger.error(
      { error: inputResult.error },
      "Failed to convert pipeline input",
    );
    await updateFirestoreWithError(
      reportId,
      inputResult.error.message,
      refStore,
      jobLogger,
    );
    return inputResult;
  }

  // Check if we should skip
  const skipResult = await shouldSkipPipeline(
    reportId,
    storage,
    stateStore,
    jobLogger,
  );

  if (skipResult.tag === "failure") {
    jobLogger.error({ error: skipResult.error }, "Storage check failed");
    await updateFirestoreWithError(
      reportId,
      skipResult.error.message,
      refStore,
      jobLogger,
    );
    return skipResult;
  }

  if (skipResult.value.skip) {
    jobLogger.info("Pipeline already completed, skipping");
    return success(undefined);
  }

  // Execute pipeline
  return executePipelineWithLock(
    reportId,
    userId,
    message.id,
    skipResult.value.shouldResume,
    skipResult.value.existingState,
    inputResult.value,
    stateStore,
    storage,
    refStore,
    data,
    jobLogger,
  );
}
