/**
 * Pipeline Runner
 *
 * Orchestrates the execution of all pipeline steps with:
 * - State persistence for failure recovery
 * - Analytics tracking for each step
 * - Resume capability from partially completed pipelines
 */

import { failure, type Result, success } from "tttc-common/functional-utils";
import { logger } from "tttc-common/logger";
import {
  commentsToTree,
  extractClaims,
  extractCruxes,
  generateTopicSummaries,
  sortAndDeduplicateClaims,
} from "../pipeline-steps/index.js";
import type {
  ClaimsResult,
  ClaimsTree,
  CruxesResult,
  SortAndDeduplicateResult,
  SummariesResult,
  Topic,
  TopicTreeResult,
} from "../pipeline-steps/types.js";
import {
  createInitialState,
  getNextStep,
  markStepCompleted,
  markStepFailed,
  markStepSkipped,
  markStepStarted,
  type RedisPipelineStateStore,
} from "./state-store.js";
import {
  type PipelineInput,
  type PipelineResult,
  PipelineResumeError,
  type PipelineRunnerConfig,
  type PipelineState,
  PipelineStepError,
  type PipelineStepName,
} from "./types.js";

const runnerLogger = logger.child({ module: "pipeline-runner" });

/**
 * Step execution result with analytics
 */
interface StepExecutionResult<T> {
  result: T;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
}

/**
 * Execute a single pipeline step with timing and error handling
 */
async function executeStep<T>(
  stepName: PipelineStepName,
  executor: () => Promise<Result<T, Error>>,
  reportLogger: typeof runnerLogger,
): Promise<Result<StepExecutionResult<T>, Error>> {
  const startTime = Date.now();

  reportLogger.info({ step: stepName }, `Starting pipeline step: ${stepName}`);

  try {
    const result = await executor();

    const durationMs = Date.now() - startTime;

    if (result.tag === "failure") {
      reportLogger.error(
        {
          step: stepName,
          error: result.error,
          durationMs,
        },
        `Pipeline step failed: ${stepName}`,
      );
      return failure(result.error);
    }

    // Extract usage from result (all steps return usage and cost)
    const value = result.value as {
      usage?: {
        input_tokens: number;
        output_tokens: number;
        total_tokens: number;
      };
      cost?: number;
    };

    const inputTokens = value.usage?.input_tokens ?? 0;
    const outputTokens = value.usage?.output_tokens ?? 0;
    const totalTokens = value.usage?.total_tokens ?? 0;
    const cost = value.cost ?? 0;

    reportLogger.info(
      {
        step: stepName,
        durationMs,
        inputTokens,
        outputTokens,
        totalTokens,
        cost,
      },
      `Pipeline step completed: ${stepName}`,
    );

    return success({
      result: result.value,
      durationMs,
      inputTokens,
      outputTokens,
      totalTokens,
      cost,
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const err = error instanceof Error ? error : new Error(String(error));

    reportLogger.error(
      {
        step: stepName,
        error: err,
        durationMs,
      },
      `Pipeline step threw exception: ${stepName}`,
    );

    return failure(err);
  }
}

/**
 * Execute the clustering step
 */
async function executeClusteringStep(
  input: PipelineInput,
  config: PipelineRunnerConfig,
  reportLogger: typeof runnerLogger,
): Promise<Result<StepExecutionResult<TopicTreeResult>, Error>> {
  return executeStep(
    "clustering",
    () =>
      commentsToTree(input.comments, input.clusteringConfig, input.apiKey, {
        reportId: config.reportId,
        userId: config.userId,
        ...config.options,
      }),
    reportLogger,
  );
}

/**
 * Execute the claims extraction step
 */
async function executeClaimsStep(
  input: PipelineInput,
  topics: Topic[],
  config: PipelineRunnerConfig,
  reportLogger: typeof runnerLogger,
): Promise<Result<StepExecutionResult<ClaimsResult>, Error>> {
  return executeStep(
    "claims",
    () =>
      extractClaims(input.comments, topics, input.claimsConfig, input.apiKey, {
        reportId: config.reportId,
        userId: config.userId,
        ...config.options,
      }),
    reportLogger,
  );
}

/**
 * Execute the sort and deduplicate step
 */
async function executeSortAndDeduplicateStep(
  input: PipelineInput,
  claimsTree: ClaimsTree,
  config: PipelineRunnerConfig,
  reportLogger: typeof runnerLogger,
): Promise<Result<StepExecutionResult<SortAndDeduplicateResult>, Error>> {
  return executeStep(
    "sort_and_deduplicate",
    () =>
      sortAndDeduplicateClaims(
        {
          tree: claimsTree,
          llm: input.dedupConfig,
          sort: input.sortStrategy,
        },
        input.apiKey,
        {
          reportId: config.reportId,
          userId: config.userId,
          ...config.options,
        },
      ),
    reportLogger,
  );
}

/**
 * Execute the summaries step
 */
async function executeSummariesStep(
  input: PipelineInput,
  sortedResult: SortAndDeduplicateResult,
  config: PipelineRunnerConfig,
  reportLogger: typeof runnerLogger,
): Promise<Result<StepExecutionResult<SummariesResult>, Error>> {
  return executeStep(
    "summaries",
    () =>
      generateTopicSummaries(
        {
          tree: sortedResult.data,
          llm: input.summariesConfig,
        },
        input.apiKey,
        {
          reportId: config.reportId,
          userId: config.userId,
          ...config.options,
        },
      ),
    reportLogger,
  );
}

/**
 * Execute the cruxes step (optional)
 */
async function executeCruxesStep(
  input: PipelineInput,
  claimsTree: ClaimsTree,
  topics: Topic[],
  config: PipelineRunnerConfig,
  reportLogger: typeof runnerLogger,
): Promise<Result<StepExecutionResult<CruxesResult>, Error>> {
  if (!input.cruxesConfig) {
    return failure(new Error("Cruxes config is required for cruxes step"));
  }

  return executeStep(
    "cruxes",
    () =>
      extractCruxes(claimsTree, topics, input.cruxesConfig!, input.apiKey, {
        reportId: config.reportId,
        userId: config.userId,
        ...config.options,
      }),
    reportLogger,
  );
}

/**
 * Save step result to state
 */
async function saveStepResult(
  stateStore: RedisPipelineStateStore,
  state: PipelineState,
  stepName: PipelineStepName,
  result: unknown,
  analytics: {
    durationMs: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
  },
): Promise<PipelineState> {
  // Mark step as completed with analytics
  let updatedState = markStepCompleted(state, stepName, analytics);

  // Save result
  updatedState = {
    ...updatedState,
    completedResults: {
      ...updatedState.completedResults,
      [stepName]: result,
    },
    totalDurationMs: updatedState.totalDurationMs + analytics.durationMs,
  };

  // Persist to Redis
  await stateStore.save(updatedState);

  return updatedState;
}

/**
 * Main pipeline runner function
 */
export async function runPipeline(
  input: PipelineInput,
  config: PipelineRunnerConfig,
  stateStore: RedisPipelineStateStore,
): Promise<PipelineResult> {
  const reportLogger = runnerLogger.child({
    reportId: config.reportId,
    userId: config.userId,
  });

  reportLogger.info(
    {
      commentCount: input.comments.length,
      enableCruxes: input.enableCruxes,
      resumeFromState: config.resumeFromState,
    },
    "Starting pipeline execution",
  );

  // Get or create pipeline state
  let state: PipelineState;

  if (config.resumeFromState) {
    const existingState = await stateStore.get(config.reportId);

    if (!existingState) {
      throw new PipelineResumeError(config.reportId, "No existing state found");
    }

    if (existingState.status === "completed") {
      throw new PipelineResumeError(
        config.reportId,
        "Pipeline already completed",
      );
    }

    state = existingState;
    reportLogger.info(
      {
        currentStep: state.currentStep,
        status: state.status,
      },
      "Resuming pipeline from existing state",
    );
  } else {
    state = createInitialState(config.reportId, config.userId);
    state.status = "running";
    await stateStore.save(state);
  }

  // Track intermediate results
  let clusteringResult: TopicTreeResult | undefined = state.completedResults
    .clustering as TopicTreeResult | undefined;
  let claimsResult: ClaimsResult | undefined = state.completedResults.claims as
    | ClaimsResult
    | undefined;
  let sortedResult: SortAndDeduplicateResult | undefined = state
    .completedResults.sort_and_deduplicate as
    | SortAndDeduplicateResult
    | undefined;
  let summariesResult: SummariesResult | undefined = state.completedResults
    .summaries as SummariesResult | undefined;
  let cruxesResult: CruxesResult | undefined = state.completedResults.cruxes as
    | CruxesResult
    | undefined;

  const pipelineStartTime = Date.now();

  try {
    // Execute steps in order, skipping completed ones
    const nextStep = getNextStep(state);

    // Step 1: Clustering
    if (nextStep === "clustering" || !clusteringResult) {
      state = markStepStarted(state, "clustering");
      state.currentStep = "clustering";
      await stateStore.save(state);
      config.onStepUpdate?.("clustering", "in_progress");

      const result = await executeClusteringStep(input, config, reportLogger);

      if (result.tag === "failure") {
        state = markStepFailed(state, "clustering", result.error);
        await stateStore.save(state);
        config.onStepUpdate?.("clustering", "failed");

        return {
          success: false,
          state,
          error: new PipelineStepError("clustering", result.error),
        };
      }

      clusteringResult = result.value.result;
      state = await saveStepResult(
        stateStore,
        state,
        "clustering",
        clusteringResult,
        {
          durationMs: result.value.durationMs,
          inputTokens: result.value.inputTokens,
          outputTokens: result.value.outputTokens,
          totalTokens: result.value.totalTokens,
          cost: result.value.cost,
        },
      );
      config.onStepUpdate?.("clustering", "completed");
      config.onProgress?.({
        currentStep: "clustering",
        totalSteps: input.enableCruxes ? 5 : 4,
        completedSteps: 1,
        percentComplete: input.enableCruxes ? 20 : 25,
      });
    }

    // Step 2: Claims extraction
    if (!claimsResult) {
      state = markStepStarted(state, "claims");
      state.currentStep = "claims";
      await stateStore.save(state);
      config.onStepUpdate?.("claims", "in_progress");

      const result = await executeClaimsStep(
        input,
        clusteringResult!.data,
        config,
        reportLogger,
      );

      if (result.tag === "failure") {
        state = markStepFailed(state, "claims", result.error);
        await stateStore.save(state);
        config.onStepUpdate?.("claims", "failed");

        return {
          success: false,
          state,
          error: new PipelineStepError("claims", result.error),
        };
      }

      claimsResult = result.value.result;
      state = await saveStepResult(stateStore, state, "claims", claimsResult, {
        durationMs: result.value.durationMs,
        inputTokens: result.value.inputTokens,
        outputTokens: result.value.outputTokens,
        totalTokens: result.value.totalTokens,
        cost: result.value.cost,
      });
      config.onStepUpdate?.("claims", "completed");
      config.onProgress?.({
        currentStep: "claims",
        totalSteps: input.enableCruxes ? 5 : 4,
        completedSteps: 2,
        percentComplete: input.enableCruxes ? 40 : 50,
      });
    }

    // Step 3: Sort and deduplicate
    if (!sortedResult) {
      state = markStepStarted(state, "sort_and_deduplicate");
      state.currentStep = "sort_and_deduplicate";
      await stateStore.save(state);
      config.onStepUpdate?.("sort_and_deduplicate", "in_progress");

      const result = await executeSortAndDeduplicateStep(
        input,
        claimsResult!.data,
        config,
        reportLogger,
      );

      if (result.tag === "failure") {
        state = markStepFailed(state, "sort_and_deduplicate", result.error);
        await stateStore.save(state);
        config.onStepUpdate?.("sort_and_deduplicate", "failed");

        return {
          success: false,
          state,
          error: new PipelineStepError("sort_and_deduplicate", result.error),
        };
      }

      sortedResult = result.value.result;
      state = await saveStepResult(
        stateStore,
        state,
        "sort_and_deduplicate",
        sortedResult,
        {
          durationMs: result.value.durationMs,
          inputTokens: result.value.inputTokens,
          outputTokens: result.value.outputTokens,
          totalTokens: result.value.totalTokens,
          cost: result.value.cost,
        },
      );
      config.onStepUpdate?.("sort_and_deduplicate", "completed");
      config.onProgress?.({
        currentStep: "sort_and_deduplicate",
        totalSteps: input.enableCruxes ? 5 : 4,
        completedSteps: 3,
        percentComplete: input.enableCruxes ? 60 : 75,
      });
    }

    // Step 4: Summaries
    if (!summariesResult) {
      state = markStepStarted(state, "summaries");
      state.currentStep = "summaries";
      await stateStore.save(state);
      config.onStepUpdate?.("summaries", "in_progress");

      const result = await executeSummariesStep(
        input,
        sortedResult!,
        config,
        reportLogger,
      );

      if (result.tag === "failure") {
        state = markStepFailed(state, "summaries", result.error);
        await stateStore.save(state);
        config.onStepUpdate?.("summaries", "failed");

        return {
          success: false,
          state,
          error: new PipelineStepError("summaries", result.error),
        };
      }

      summariesResult = result.value.result;
      state = await saveStepResult(
        stateStore,
        state,
        "summaries",
        summariesResult,
        {
          durationMs: result.value.durationMs,
          inputTokens: result.value.inputTokens,
          outputTokens: result.value.outputTokens,
          totalTokens: result.value.totalTokens,
          cost: result.value.cost,
        },
      );
      config.onStepUpdate?.("summaries", "completed");
      config.onProgress?.({
        currentStep: "summaries",
        totalSteps: input.enableCruxes ? 5 : 4,
        completedSteps: 4,
        percentComplete: input.enableCruxes ? 80 : 100,
      });
    }

    // Step 5: Cruxes (optional)
    if (input.enableCruxes && !cruxesResult) {
      state = markStepStarted(state, "cruxes");
      state.currentStep = "cruxes";
      await stateStore.save(state);
      config.onStepUpdate?.("cruxes", "in_progress");

      const result = await executeCruxesStep(
        input,
        claimsResult!.data,
        clusteringResult!.data,
        config,
        reportLogger,
      );

      if (result.tag === "failure") {
        state = markStepFailed(state, "cruxes", result.error);
        await stateStore.save(state);
        config.onStepUpdate?.("cruxes", "failed");

        return {
          success: false,
          state,
          error: new PipelineStepError("cruxes", result.error),
        };
      }

      cruxesResult = result.value.result;
      state = await saveStepResult(stateStore, state, "cruxes", cruxesResult, {
        durationMs: result.value.durationMs,
        inputTokens: result.value.inputTokens,
        outputTokens: result.value.outputTokens,
        totalTokens: result.value.totalTokens,
        cost: result.value.cost,
      });
      config.onStepUpdate?.("cruxes", "completed");
      config.onProgress?.({
        currentStep: "cruxes",
        totalSteps: 5,
        completedSteps: 5,
        percentComplete: 100,
      });
    } else if (!input.enableCruxes) {
      // Mark cruxes as skipped
      state = markStepSkipped(state, "cruxes");
      await stateStore.save(state);
      config.onStepUpdate?.("cruxes", "skipped");
    }

    // Mark pipeline as completed
    const totalDurationMs = Date.now() - pipelineStartTime;
    state = {
      ...state,
      status: "completed",
      currentStep: undefined,
      totalDurationMs: state.totalDurationMs + totalDurationMs,
    };
    await stateStore.save(state);

    reportLogger.info(
      {
        totalDurationMs: state.totalDurationMs,
        totalTokens: state.totalTokens,
        totalCost: state.totalCost,
      },
      "Pipeline completed successfully",
    );

    return {
      success: true,
      state,
      outputs: {
        topicTree: clusteringResult!.data,
        claimsTree: claimsResult!.data,
        sortedTree: sortedResult!.data,
        summaries: summariesResult!.data,
        cruxes: cruxesResult,
      },
    };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));

    reportLogger.error(
      {
        error: err,
        currentStep: state.currentStep,
      },
      "Pipeline failed with unexpected error",
    );

    // Update state with error
    state = {
      ...state,
      status: "failed",
      error: {
        message: err.message,
        name: err.name,
        step: state.currentStep,
      },
    };
    await stateStore.save(state);

    return {
      success: false,
      state,
      error: err,
    };
  }
}

/**
 * Get pipeline status from state store
 */
export async function getPipelineStatus(
  reportId: string,
  stateStore: RedisPipelineStateStore,
): Promise<PipelineState | null> {
  return stateStore.get(reportId);
}

/**
 * Cancel a running pipeline
 */
export async function cancelPipeline(
  reportId: string,
  stateStore: RedisPipelineStateStore,
): Promise<boolean> {
  const state = await stateStore.get(reportId);

  if (!state) {
    return false;
  }

  if (state.status !== "running") {
    return false;
  }

  const updatedState: PipelineState = {
    ...state,
    status: "failed",
    error: {
      message: "Pipeline cancelled by user",
      name: "CancellationError",
      step: state.currentStep,
    },
  };

  await stateStore.save(updatedState);
  return true;
}

/**
 * Clean up pipeline state after completion
 */
export async function cleanupPipelineState(
  reportId: string,
  stateStore: RedisPipelineStateStore,
): Promise<void> {
  await stateStore.delete(reportId);
}
