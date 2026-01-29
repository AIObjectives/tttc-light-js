/**
 * Queue message handler for pipeline jobs
 */

import type { ReportRef } from "tttc-common/firebase";
import { failure, type Result, success } from "tttc-common/functional-utils";
import { logger } from "tttc-common/logger";
import type { PipelineJobMessage } from "tttc-common/schema";
import type { BucketStore } from "../bucketstore/index.js";
import type { RefStoreServices } from "../datastore/refstore/index.js";
import {
  formatPipelineOutput,
  type SimplifiedPipelineOutput,
  simplifiedPipelineOutputSchema,
} from "../pipeline-runner/format-output.js";
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
    { value: llm.model, name: "LLM model" },
    {
      value: instructions.systemInstructions,
      name: "system instructions",
    },
    {
      value: instructions.clusteringInstructions,
      name: "clustering instructions",
    },
    {
      value: instructions.extractionInstructions,
      name: "extraction instructions",
    },
    {
      value: instructions.dedupInstructions,
      name: "deduplication instructions",
    },
    {
      value: instructions.summariesInstructions,
      name: "summaries instructions",
    },
    { value: env.OPENAI_API_KEY, name: "API key" },
  ];

  for (const field of requiredFields) {
    if (!field.value) {
      return failure(
        new ValidationError(`Missing required field: ${field.name}`),
      );
    }
  }

  if (
    options.cruxes &&
    (!instructions.cruxInstructions ||
      instructions.cruxInstructions.trim() === "")
  ) {
    return failure(
      new ValidationError(
        "Missing required field: crux instructions (required when cruxes are enabled)",
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
  const comments = data.map((comment: PipelineJobMessage["data"][number]) => ({
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
    cruxesConfig:
      options.cruxes && instructions.cruxInstructions
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
 * 1. Upload to GCS
 * 2. Update Firestore with final "completed" status and reportDataUri
 *
 * The report is already in "processing" status from pipeline execution.
 * If GCS upload fails, the error is caught and status is set to "failed".
 */
/**
 * Save pipeline output to GCS and update Firestore
 * This is the common save logic used by both fresh pipeline runs and save-only retries
 */
async function savePipelineOutput(
  pipelineOutput: SimplifiedPipelineOutput,
  data: PipelineJobMessage,
  reportId: string,
  storage: BucketStore,
  refStore: RefStoreServices,
  jobLogger: typeof queueLogger,
): Promise<Result<void, StorageError>> {
  try {
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
    const numPeople = new Set(
      data.data
        .map((comment: (typeof data.data)[0]) => comment.speaker)
        .filter(Boolean),
    ).size;

    // Get ReportRef to verify it exists before upload
    const reportRef = await refStore.Report.get(reportId);
    if (!reportRef) {
      return failure(
        new StorageError(`ReportRef ${reportId} not found`, false),
      );
    }

    jobLogger.info(
      {
        filename,
        reportJsonSize: reportJson.length,
      },
      "Uploading report to GCS",
    );

    // Upload to GCS
    const reportUrl = await storage.storeFile(filename, reportJson);

    jobLogger.info(
      {
        reportUrl,
        reportJsonSize: reportJson.length,
      },
      "Report saved to GCS successfully",
    );

    // Update ReportRef in Firestore with final status
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
      numPeople,
      createdDate: new Date(pipelineOutput.completedAt),
    };

    try {
      await refStore.Report.modify(reportId, updatedReportRef);
    } catch (firestoreError) {
      // Firestore update failed - rollback the GCS upload to maintain consistency
      jobLogger.error(
        { error: firestoreError, filename },
        "Firestore update failed, attempting to rollback GCS upload",
      );

      try {
        await storage.deleteFile(filename);
        jobLogger.info({ filename }, "Successfully rolled back GCS upload");
      } catch (deleteError) {
        // Log deletion failure but don't throw - the original Firestore error is more important
        jobLogger.error(
          { deleteError, filename },
          "Failed to rollback GCS upload after Firestore failure",
        );
      }

      // Re-throw the original Firestore error to trigger the outer catch block
      throw firestoreError;
    }

    jobLogger.info(
      {
        reportId,
        numTopics,
        numSubtopics,
        numClaims,
        numPeople,
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
 * Save successful pipeline result (formats output then saves)
 */
async function saveSuccessfulPipeline(
  result: Awaited<ReturnType<typeof runPipeline>>,
  data: PipelineJobMessage,
  reportId: string,
  storage: BucketStore,
  refStore: RefStoreServices,
  jobLogger: typeof queueLogger,
): Promise<Result<void, StorageError>> {
  // Format pipeline output for storage
  const pipelineOutput = formatPipelineOutput(result, data);
  return savePipelineOutput(
    pipelineOutput,
    data,
    reportId,
    storage,
    refStore,
    jobLogger,
  );
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
 * Check if pipeline should be skipped due to existing storage file.
 *
 * Storage errors (both transient and permanent) are returned as failures.
 * State checks are deferred until after lock acquisition to prevent race conditions.
 */
async function checkStorageForSkip(
  reportId: string,
  storage: BucketStore,
  jobLogger: typeof queueLogger,
): Promise<Result<{ skip: boolean }, StorageError>> {
  const storageCheck = await checkStorageExists(reportId, storage, jobLogger);

  if (storageCheck.tag === "failure") {
    return storageCheck;
  }

  if (storageCheck.value.exists) {
    return success({ skip: true });
  }

  return success({ skip: false });
}

/**
 * Reconstruct pipeline output from completed state stored in Redis
 * This is used when pipeline completed but save operations failed
 */
function reconstructPipelineOutputFromState(
  state: NonNullable<Awaited<ReturnType<RedisPipelineStateStore["get"]>>>,
  data: PipelineJobMessage,
): SimplifiedPipelineOutput {
  const { completedResults } = state;

  if (!completedResults.sort_and_deduplicate) {
    throw new ValidationError(
      "Cannot reconstruct output: sort_and_deduplicate result missing from completed state",
    );
  }

  const { instructions } = data.config;
  const { reportDetails } = data;

  const reconstructed = {
    version: "pipeline-worker-v1.0" as const,
    reportDetails: {
      title: reportDetails.title,
      description: reportDetails.description,
      question: reportDetails.question,
      filename: reportDetails.filename,
    },
    sortedTree: completedResults.sort_and_deduplicate.data,
    analytics: {
      totalTokens: state.totalTokens,
      totalCost: state.totalCost,
      totalDurationMs: state.totalDurationMs,
      stepAnalytics: state.stepAnalytics,
    },
    cruxes: completedResults.cruxes,
    prompts: {
      systemInstructions: instructions.systemInstructions,
      clusteringInstructions: instructions.clusteringInstructions,
      extractionInstructions: instructions.extractionInstructions,
      dedupInstructions: instructions.dedupInstructions,
      summariesInstructions: instructions.summariesInstructions,
      cruxInstructions: instructions.cruxInstructions,
      outputLanguage: instructions.outputLanguage,
    },
    completedAt: state.updatedAt,
  };

  // Validate the reconstructed data structure
  const parseResult = simplifiedPipelineOutputSchema.safeParse(reconstructed);

  if (!parseResult.success) {
    queueLogger.error(
      {
        errors: parseResult.error.issues,
        reportId: data.config.firebaseDetails.reportId,
      },
      "Reconstructed pipeline output validation failed - Redis state may be corrupted",
    );
    throw new ValidationError(
      `Invalid pipeline output reconstructed from Redis state: ${parseResult.error.message}`,
    );
  }

  return reconstructed;
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
async function handlePipelineFailure(
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
 * Execute pipeline with locking to prevent concurrent execution.
 * State is read AFTER lock acquisition to prevent TOCTOU race conditions.
 */
async function executePipelineWithLock(
  reportId: string,
  userId: string,
  lockValue: string,
  pipelineInput: PipelineInput,
  stateStore: RedisPipelineStateStore,
  storage: BucketStore,
  refStore: RefStoreServices,
  data: PipelineJobMessage,
  jobLogger: typeof queueLogger,
): Promise<Result<void, HandlerError | StorageError | ValidationError>> {
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
    // Read state AFTER acquiring lock to prevent race conditions
    const existingState = await stateStore.get(reportId);
    const shouldResume = shouldResumeFromState(existingState);

    // Handle save-only path: pipeline completed but save operations failed
    if (existingState?.status === "completed") {
      jobLogger.info(
        {
          totalDurationMs: existingState.totalDurationMs,
          totalTokens: existingState.totalTokens,
          totalCost: existingState.totalCost,
        },
        "Pipeline already completed, performing save-only retry",
      );

      try {
        const pipelineOutput = reconstructPipelineOutputFromState(
          existingState,
          data,
        );
        return savePipelineOutput(
          pipelineOutput,
          data,
          reportId,
          storage,
          refStore,
          jobLogger,
        );
      } catch (error) {
        // Preserve ValidationError type information for proper error handling
        if (error instanceof ValidationError) {
          jobLogger.error(
            { error: error.message },
            "Failed to reconstruct pipeline output from completed state",
          );
          await updateFirestoreWithError(
            reportId,
            error.message,
            refStore,
            jobLogger,
          );
          return failure(error);
        }

        // Handle other error types
        const cause = error instanceof Error ? error : new Error(String(error));
        jobLogger.error(
          { error: cause.message },
          "Failed to reconstruct pipeline output from completed state",
        );
        await updateFirestoreWithError(
          reportId,
          `Cannot reconstruct output: ${cause.message}`,
          refStore,
          jobLogger,
        );
        return failure(
          new HandlerError(
            `Cannot reconstruct output: ${cause.message}`,
            false,
            cause,
          ),
        );
      }
    }

    // Normal pipeline execution path
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
        lockValue,
      },
      stateStore,
    );

    // Extend the lock to protect result processing operations (GCS upload, Firestore updates)
    // extendPipelineLock atomically verifies ownership and extends TTL, preventing race conditions
    const lockExtended = await stateStore.extendPipelineLock(
      reportId,
      lockValue,
    );

    if (!lockExtended) {
      jobLogger.error(
        "Failed to extend pipeline lock - lock lost during execution (expired or acquired by another worker)",
      );
      await updateFirestoreWithError(
        reportId,
        "Lock lost during execution",
        refStore,
        jobLogger,
      );
      return failure(
        new HandlerError(
          "Pipeline lock lost during execution - cannot safely process results to prevent duplicate processing",
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
    return handlePipelineFailure(result, reportId, refStore, jobLogger);
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

  // Check if storage file already exists (quick optimization before acquiring lock)
  const skipResult = await checkStorageForSkip(reportId, storage, jobLogger);

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

  // Execute pipeline - state will be read after lock acquisition to prevent race conditions
  return executePipelineWithLock(
    reportId,
    userId,
    message.id,
    inputResult.value,
    stateStore,
    storage,
    refStore,
    data,
    jobLogger,
  );
}
