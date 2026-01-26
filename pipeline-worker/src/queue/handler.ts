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
 */
function convertToPipelineInput(job: PipelineJobMessage): PipelineInput {
  const { config, data } = job;
  const { instructions, llm, options, env } = config;

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
    const existingState = await stateStore.get(reportId);
    const shouldResume =
      existingState &&
      (existingState.status === "running" || existingState.status === "failed");

    if (existingState && existingState.status === "completed") {
      jobLogger.info(
        {
          totalDurationMs: existingState.totalDurationMs,
        },
        "Pipeline already completed, skipping duplicate message",
      );
      return; // Ack the message without re-processing
    }

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
        // Format pipeline output for storage
        const pipelineOutput = formatPipelineOutput(result, data);
        const reportJson = JSON.stringify(pipelineOutput);
        const filename = `${reportId}.json`;

        jobLogger.info(
          {
            filename,
            reportJsonSize: reportJson.length,
          },
          "Saving report to GCS",
        );

        // Save to GCS
        const reportUrl = await storage.storeFile(filename, reportJson);

        jobLogger.info(
          {
            reportUrl,
            reportJsonSize: reportJson.length,
          },
          "Report saved to GCS successfully",
        );

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

        // Update ReportRef in Firestore
        const reportRef = await refStore.Report.get(reportId);
        if (!reportRef) {
          throw new Error(`ReportRef ${reportId} not found`);
        }

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
          numPeople: 0, // Not tracked in pipeline-worker yet
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
          "Firestore updated successfully",
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

        // Update status to failed
        try {
          const reportRef = await refStore.Report.get(reportId);
          if (reportRef) {
            await refStore.Report.modify(reportId, {
              ...reportRef,
              status: "failed",
              errorMessage: `Storage error: ${storageError instanceof Error ? storageError.message : String(storageError)}`,
              lastStatusUpdate: new Date(),
            });
          }
        } catch (updateError) {
          jobLogger.error(
            { error: updateError },
            "Failed to update Firestore with error status",
          );
        }

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

      // Update Firestore with error status
      try {
        const reportRef = await refStore.Report.get(reportId);
        if (reportRef) {
          const errorMessage = result.error?.message ?? "Unknown error";
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

      throw result.error ?? new Error("Pipeline failed with unknown error");
    }
  } catch (error) {
    jobLogger.error(
      {
        error: error instanceof Error ? error : new Error(String(error)),
      },
      "Unhandled error processing pipeline job",
    );

    // Re-throw to trigger message nack
    throw error;
  }
}
