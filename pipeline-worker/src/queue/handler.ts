/**
 * Queue message handler for pipeline jobs
 */

import { logger } from "tttc-common/logger";
import type { PipelineJobMessage } from "tttc-common/schema";
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
    speaker: "participant", // Default speaker since express-server doesn't provide this
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
    sortStrategy: "numPeople", // Default strategy
  };
}

/**
 * Handle incoming pipeline job message
 */
export async function handlePipelineJob(
  message: PubSubMessage<PipelineJobMessage>,
  stateStore: RedisPipelineStateStore,
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

    // Run the pipeline
    const result = await runPipeline(
      pipelineInput,
      {
        reportId,
        userId,
        resumeFromState: false, // Always start fresh from queue
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

      // TODO: Save report to GCS and update Firestore
      // This will be implemented when we connect the storage layer
    } else {
      jobLogger.error(
        {
          error: result.error,
          currentStep: result.state.currentStep,
        },
        "Pipeline job failed",
      );

      // TODO: Update Firestore with error status
      throw result.error;
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
