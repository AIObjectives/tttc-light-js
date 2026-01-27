/**
 * Queue message handler for pipeline jobs
 */

import type { ReportRef } from "tttc-common/firebase";
import { logger } from "tttc-common/logger";
import type { PipelineJobMessage } from "tttc-common/schema";
import type { BucketStore } from "../bucketstore/index.js";
import type { RefStoreServices } from "../datastore/refstore/index.js";
import { formatPipelineOutput } from "../pipeline-runner/format-output.js";
import { runPipeline } from "../pipeline-runner/index.js";
import type { RedisPipelineStateStore } from "../pipeline-runner/state-store.js";
import type { PipelineInput } from "../pipeline-runner/types.js";
import type { PubSubMessage } from "./index.js";

const queueLogger = logger.child({ module: "queue-handler" });

/**
 * Validate required fields in pipeline job config
 */
function validatePipelineJobConfig(job: PipelineJobMessage): void {
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
      throw new Error(`Missing required field: ${field.name}`);
    }
  }

  if (options.cruxes && !instructions.cruxInstructions) {
    throw new Error(
      "Missing required field: config.instructions.cruxInstructions (required when cruxes are enabled)",
    );
  }
}

/**
 * Convert express-server PipelineJob to pipeline-worker PipelineInput
 * Validates all required fields to prevent undefined values from reaching the pipeline
 */
function convertToPipelineInput(job: PipelineJobMessage): PipelineInput {
  const { config, data } = job;
  const { instructions, llm, options, env } = config;

  validatePipelineJobConfig(job);

  // Convert comments to pipeline-worker format
  const comments = data.map((comment: (typeof data)[0]) => ({
    id: comment.comment_id,
    text: comment.comment_text,
    speaker: comment.speaker,
    vote_count: comment.votes ?? 0,
  }));

  return {
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
  };
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
): Promise<void> {
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
    throw new Error(`ReportRef ${reportId} not found`);
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
}

/**
 * Update Firestore with error status
 */
async function updateFirestoreWithError(
  reportId: string,
  errorMessage: string,
  refStore: RefStoreServices,
  jobLogger: typeof queueLogger,
): Promise<void> {
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
    }
  } catch (updateError) {
    jobLogger.error(
      { error: updateError },
      "Failed to update Firestore with error status",
    );
  }
}

/**
 * Check if file exists in storage, handling errors
 */
async function checkStorageExists(
  reportId: string,
  storage: BucketStore,
  jobLogger: typeof queueLogger,
): Promise<{ exists: boolean; hasTransientError: boolean }> {
  const filename = `${reportId}.json`;
  const fileExistsResult = await storage.fileExists(filename);

  if (fileExistsResult.exists) {
    jobLogger.info(
      "Report file already exists in storage, skipping duplicate message",
    );
    return { exists: true, hasTransientError: false };
  }

  if (fileExistsResult.error) {
    jobLogger.warn(
      {
        error: fileExistsResult.error,
        errorType: fileExistsResult.errorType,
      },
      "Failed to check storage existence, will attempt to acquire lock and process",
    );
    return {
      exists: false,
      hasTransientError: fileExistsResult.errorType === "transient",
    };
  }

  return { exists: false, hasTransientError: false };
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
 * Check if pipeline should be skipped due to existing completion
 */
async function shouldSkipPipeline(
  reportId: string,
  storage: BucketStore,
  stateStore: RedisPipelineStateStore,
  jobLogger: typeof queueLogger,
): Promise<{
  skip: boolean;
  shouldResume: boolean;
  existingState: Awaited<ReturnType<typeof stateStore.get>>;
}> {
  const storageCheck = await checkStorageExists(reportId, storage, jobLogger);

  if (storageCheck.exists) {
    return { skip: true, shouldResume: false, existingState: null };
  }

  const existingState = await stateStore.get(reportId);
  const shouldResume = shouldResumeFromState(existingState);

  if (existingState?.status === "completed") {
    if (storageCheck.hasTransientError) {
      throw new Error(
        "Pipeline marked completed but unable to verify storage due to transient error",
      );
    }

    jobLogger.info(
      "Pipeline marked completed but storage missing, re-attempting save only (not re-running pipeline)",
    );
  }

  return { skip: false, shouldResume, existingState };
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
): Promise<void> {
  jobLogger.info(
    {
      totalDurationMs: result.state.totalDurationMs,
      totalTokens: result.state.totalTokens,
      totalCost: result.state.totalCost,
    },
    "Pipeline job completed successfully",
  );

  try {
    await saveSuccessfulPipeline(
      result,
      data,
      reportId,
      storage,
      refStore,
      jobLogger,
    );
  } catch (storageError) {
    const error =
      storageError instanceof Error
        ? storageError
        : new Error(String(storageError));

    jobLogger.error({ error }, "Failed to save report or update Firestore");

    const errorMessage = `Storage error: ${error.message}`;
    await updateFirestoreWithError(reportId, errorMessage, refStore, jobLogger);

    throw storageError;
  }
}

/**
 * Handle failed pipeline result
 */
async function handlePipelineFailureResult(
  result: Awaited<ReturnType<typeof runPipeline>>,
  reportId: string,
  refStore: RefStoreServices,
  jobLogger: typeof queueLogger,
): Promise<never> {
  jobLogger.error(
    {
      error: result.error,
      currentStep: result.state.currentStep,
    },
    "Pipeline job failed",
  );

  const errorMessage = result.error?.message ?? "Unknown error";
  await updateFirestoreWithError(reportId, errorMessage, refStore, jobLogger);

  throw result.error ?? new Error("Pipeline failed with unknown error");
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
): Promise<void> {
  const lockAcquired = await stateStore.acquirePipelineLock(
    reportId,
    lockValue,
  );

  if (!lockAcquired) {
    jobLogger.info(
      "Pipeline execution already in progress by another worker, skipping",
    );
    return;
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
      throw new Error(
        "Pipeline lock expired during execution - potential duplicate processing detected",
      );
    }

    if (result.success) {
      await handlePipelineSuccess(
        result,
        data,
        reportId,
        storage,
        refStore,
        jobLogger,
      );
    } else {
      await handlePipelineFailureResult(result, reportId, refStore, jobLogger);
    }
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
): Promise<void> {
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

  try {
    const pipelineInput = convertToPipelineInput(data);

    const { skip, shouldResume, existingState } = await shouldSkipPipeline(
      reportId,
      storage,
      stateStore,
      jobLogger,
    );

    if (skip) {
      return;
    }

    await executePipelineWithLock(
      reportId,
      userId,
      message.id,
      shouldResume,
      existingState,
      pipelineInput,
      stateStore,
      storage,
      refStore,
      data,
      jobLogger,
    );
  } catch (error) {
    jobLogger.error(
      {
        error: error instanceof Error ? error : new Error(String(error)),
      },
      "Unhandled error processing pipeline job",
    );

    // Update Firestore with error status if not already handled
    const errorMessage = error instanceof Error ? error.message : String(error);
    await updateFirestoreWithError(reportId, errorMessage, refStore, jobLogger);

    // Re-throw to trigger message nack
    throw error;
  }
}
