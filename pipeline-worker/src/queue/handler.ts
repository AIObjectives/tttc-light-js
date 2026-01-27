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
 * Convert express-server PipelineJob to pipeline-worker PipelineInput
 * Validates all required fields to prevent undefined values from reaching the pipeline
 */
function convertToPipelineInput(job: PipelineJobMessage): PipelineInput {
  const { config, data } = job;
  const { instructions, llm, options, env } = config;

  // Validate required fields
  if (!llm.model) {
    throw new Error("Missing required field: config.llm.model");
  }
  if (!instructions.systemInstructions) {
    throw new Error(
      "Missing required field: config.instructions.systemInstructions",
    );
  }
  if (!instructions.clusteringInstructions) {
    throw new Error(
      "Missing required field: config.instructions.clusteringInstructions",
    );
  }
  if (!instructions.extractionInstructions) {
    throw new Error(
      "Missing required field: config.instructions.extractionInstructions",
    );
  }
  if (!instructions.dedupInstructions) {
    throw new Error(
      "Missing required field: config.instructions.dedupInstructions",
    );
  }
  if (!instructions.summariesInstructions) {
    throw new Error(
      "Missing required field: config.instructions.summariesInstructions",
    );
  }
  if (!env.OPENAI_API_KEY) {
    throw new Error("Missing required field: config.env.OPENAI_API_KEY");
  }

  // Validate cruxes config if enabled
  if (options.cruxes && !instructions.cruxInstructions) {
    throw new Error(
      "Missing required field: config.instructions.cruxInstructions (required when cruxes are enabled)",
    );
  }

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
    // Convert job to pipeline input
    const pipelineInput = convertToPipelineInput(data);

    // Check for existing pipeline state to handle idempotent retries
    // First check if file exists in storage to avoid race conditions
    const filename = `${reportId}.json`;
    const fileExistsResult = await storage.fileExists(filename);

    if (fileExistsResult.exists) {
      jobLogger.info(
        "Report file already exists in storage, skipping duplicate message",
      );
      return; // Ack the message without re-processing
    }

    // If storage check failed, log warning but continue with caution
    if (fileExistsResult.error) {
      jobLogger.warn(
        {
          error: fileExistsResult.error,
          errorType: fileExistsResult.errorType,
        },
        "Failed to check storage existence, will attempt to acquire lock and process",
      );
    }

    // Now check Redis state
    const existingState = await stateStore.get(reportId);
    const shouldResume =
      existingState &&
      (existingState.status === "running" || existingState.status === "failed");

    if (existingState && existingState.status === "completed") {
      // This is the edge case: Redis says completed but storage doesn't have the file
      // This could mean storage upload failed after pipeline completion
      if (
        fileExistsResult.error &&
        fileExistsResult.errorType === "transient"
      ) {
        // If we had a transient error checking storage, don't re-run the expensive pipeline
        // Instead, throw an error to retry the entire job (including the storage check)
        throw new Error(
          `Pipeline marked completed but unable to verify storage due to transient error: ${fileExistsResult.error.message}`,
        );
      }

      jobLogger.info(
        "Pipeline marked completed but storage missing, re-attempting save only (not re-running pipeline)",
      );
      // Continue to re-save from existing state
    }

    // Acquire lock to prevent concurrent execution of the same pipeline
    const lockValue = message.id; // Use message ID as unique lock identifier
    const lockAcquired = await stateStore.acquirePipelineLock(
      reportId,
      lockValue,
    );

    if (!lockAcquired) {
      jobLogger.info(
        "Pipeline execution already in progress by another worker, skipping",
      );
      return; // Another worker is processing this pipeline, safe to skip
    }

    try {
      if (shouldResume) {
        jobLogger.info(
          {
            currentStep: existingState.currentStep,
            status: existingState.status,
          },
          "Resuming existing pipeline from saved state",
        );
      }

      // Run the pipeline (will resume from state if exists)
      const result = await runPipeline(
        pipelineInput,
        {
          reportId,
          userId,
          resumeFromState: shouldResume ?? false,
        },
        stateStore,
      );

      if (result.success) {
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
          jobLogger.error(
            {
              error:
                storageError instanceof Error
                  ? storageError
                  : new Error(String(storageError)),
            },
            "Failed to save report or update Firestore",
          );

          const errorMessage = `Storage error: ${storageError instanceof Error ? storageError.message : String(storageError)}`;
          await updateFirestoreWithError(
            reportId,
            errorMessage,
            refStore,
            jobLogger,
          );

          throw storageError;
        }
      } else {
        jobLogger.error(
          {
            error: result.error,
            currentStep: result.state.currentStep,
          },
          "Pipeline job failed",
        );

        const errorMessage = result.error?.message ?? "Unknown error";
        await updateFirestoreWithError(
          reportId,
          errorMessage,
          refStore,
          jobLogger,
        );

        throw result.error ?? new Error("Pipeline failed with unknown error");
      }
    } finally {
      // Always release the lock when done (success or failure)
      const lockReleased = await stateStore.releasePipelineLock(
        reportId,
        lockValue,
      );
      if (!lockReleased) {
        jobLogger.warn("Failed to release pipeline lock (may have expired)");
      }
    }
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
