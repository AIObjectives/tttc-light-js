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
 * Interface for step results that include usage analytics.
 * All pipeline step results (TopicTreeResult, ClaimsResult, SortAndDeduplicateResult,
 * SummariesResult, CruxesResult) implement this pattern with usage and cost properties.
 */
interface StepResultWithAnalytics {
  usage?: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  cost?: number;
}

/**
 * Type guard to check if a value has analytics properties
 */
function hasAnalytics(value: unknown): value is StepResultWithAnalytics {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Check for usage object
  if (obj.usage !== undefined) {
    const usage = obj.usage;
    if (typeof usage !== "object" || usage === null) {
      return false;
    }

    const usageObj = usage as Record<string, unknown>;
    if (
      typeof usageObj.input_tokens !== "number" ||
      typeof usageObj.output_tokens !== "number" ||
      typeof usageObj.total_tokens !== "number"
    ) {
      return false;
    }
  }

  // Check for cost
  if (obj.cost !== undefined && typeof obj.cost !== "number") {
    return false;
  }

  return true;
}

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

    // Validate and extract analytics from result
    if (!hasAnalytics(result.value)) {
      const error = new Error(
        `Step ${stepName} returned invalid result: missing or malformed analytics`,
      );
      reportLogger.error(
        {
          step: stepName,
          error,
          durationMs,
        },
        `Pipeline step returned invalid result: ${stepName}`,
      );
      return failure(error);
    }

    const inputTokens = result.value.usage?.input_tokens ?? 0;
    const outputTokens = result.value.usage?.output_tokens ?? 0;
    const totalTokens = result.value.usage?.total_tokens ?? 0;
    const cost = result.value.cost ?? 0;

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

  const cruxesConfig = input.cruxesConfig;

  return executeStep(
    "cruxes",
    () =>
      extractCruxes(claimsTree, topics, cruxesConfig, input.apiKey, {
        reportId: config.reportId,
        userId: config.userId,
        ...config.options,
      }),
    reportLogger,
  );
}

interface StepResultContext {
  stateStore: RedisPipelineStateStore;
  state: PipelineState;
  stepName: PipelineStepName;
  result: unknown;
  analytics: {
    durationMs: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
  };
}

/**
 * Save step result to state
 */
async function saveStepResult(
  context: StepResultContext,
): Promise<PipelineState> {
  const { stateStore, state, stepName, result, analytics } = context;

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

interface StepExecutionContext {
  stepName: PipelineStepName;
  state: PipelineState;
  stateStore: RedisPipelineStateStore;
  config: PipelineRunnerConfig;
  totalSteps: number;
  completedSteps: number;
  executor: () => Promise<Result<StepExecutionResult<unknown>, Error>>;
}

/**
 * Execute a pipeline step with full error handling and state management
 */
async function executeAndHandleStep(
  context: StepExecutionContext,
): Promise<
  Result<{ state: PipelineState; result: unknown }, PipelineStepError>
> {
  const {
    stepName,
    state,
    stateStore,
    config,
    totalSteps,
    completedSteps,
    executor,
  } = context;

  // Mark step as started
  let updatedState = markStepStarted(state, stepName);
  updatedState.currentStep = stepName;
  await stateStore.save(updatedState);
  config.onStepUpdate?.(stepName, "in_progress");

  // Execute the step
  const result = await executor();

  // Handle failure
  if (result.tag === "failure") {
    updatedState = markStepFailed(updatedState, stepName, result.error);
    await stateStore.save(updatedState);
    config.onStepUpdate?.(stepName, "failed");
    return failure(new PipelineStepError(stepName, result.error, updatedState));
  }

  // Save successful result
  const stepResult = result.value.result;
  updatedState = await saveStepResult({
    stateStore,
    state: updatedState,
    stepName,
    result: stepResult,
    analytics: {
      durationMs: result.value.durationMs,
      inputTokens: result.value.inputTokens,
      outputTokens: result.value.outputTokens,
      totalTokens: result.value.totalTokens,
      cost: result.value.cost,
    },
  });

  // Notify completion
  config.onStepUpdate?.(stepName, "completed");
  const percentComplete = Math.round((completedSteps / totalSteps) * 100);
  config.onProgress?.({
    currentStep: stepName,
    totalSteps,
    completedSteps,
    percentComplete,
  });

  return success({ state: updatedState, result: stepResult });
}

/**
 * Get or create pipeline state with validation
 */
async function initializePipelineState(
  config: PipelineRunnerConfig,
  stateStore: RedisPipelineStateStore,
  reportLogger: typeof runnerLogger,
): Promise<PipelineState> {
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

    reportLogger.info(
      {
        currentStep: existingState.currentStep,
        status: existingState.status,
      },
      "Resuming pipeline from existing state",
    );

    return existingState;
  }

  const state = createInitialState(config.reportId, config.userId);
  state.status = "running";
  await stateStore.save(state);
  return state;
}

interface PipelineStepResults {
  clusteringResult?: TopicTreeResult;
  claimsResult?: ClaimsResult;
  sortedResult?: SortAndDeduplicateResult;
  summariesResult?: SummariesResult;
  cruxesResult?: CruxesResult;
}

/**
 * Helper to execute a step if not already completed
 * Returns updated state and result, or failure
 */
async function executeStepIfNeeded<T>(
  stepName: PipelineStepName,
  shouldExecute: boolean,
  currentState: PipelineState,
  stateStore: RedisPipelineStateStore,
  config: PipelineRunnerConfig,
  totalSteps: number,
  completedSteps: number,
  executor: () => Promise<Result<StepExecutionResult<T>, Error>>,
): Promise<Result<
  { state: PipelineState; result: T },
  PipelineStepError
> | null> {
  if (!shouldExecute) {
    return null;
  }

  const result = await executeAndHandleStep({
    stepName,
    state: currentState,
    stateStore,
    config,
    totalSteps,
    completedSteps,
    executor,
  });

  if (result.tag === "failure") {
    return failure(result.error);
  }

  return success({
    state: result.value.state,
    result: result.value.result as T,
  });
}

/**
 * Execute all pipeline steps in sequence
 */
async function executeAllSteps(
  input: PipelineInput,
  config: PipelineRunnerConfig,
  state: PipelineState,
  stateStore: RedisPipelineStateStore,
  reportLogger: typeof runnerLogger,
): Promise<
  Result<
    { state: PipelineState; results: PipelineStepResults },
    PipelineStepError
  >
> {
  let currentState = state;
  const results: PipelineStepResults = {
    clusteringResult: state.completedResults.clustering as
      | TopicTreeResult
      | undefined,
    claimsResult: state.completedResults.claims as ClaimsResult | undefined,
    sortedResult: state.completedResults.sort_and_deduplicate as
      | SortAndDeduplicateResult
      | undefined,
    summariesResult: state.completedResults.summaries as
      | SummariesResult
      | undefined,
    cruxesResult: state.completedResults.cruxes as CruxesResult | undefined,
  };

  const nextStep = getNextStep(currentState);
  const totalSteps = input.enableCruxes ? 5 : 4;

  // Step 1: Clustering
  const clusteringResult = await executeStepIfNeeded(
    "clustering",
    nextStep === "clustering" || !results.clusteringResult,
    currentState,
    stateStore,
    config,
    totalSteps,
    1,
    () => executeClusteringStep(input, config, reportLogger),
  );

  if (clusteringResult?.tag === "failure") {
    return failure(clusteringResult.error);
  }

  if (clusteringResult) {
    currentState = clusteringResult.value.state;
    results.clusteringResult = clusteringResult.value.result;
  }

  // Step 2: Claims extraction
  if (!results.clusteringResult) {
    return failure(
      new PipelineStepError(
        "claims",
        new Error("Clustering result is required for claims extraction"),
        currentState,
      ),
    );
  }

  const clusteringTopics = results.clusteringResult.data;
  const claimsResult = await executeStepIfNeeded(
    "claims",
    !results.claimsResult,
    currentState,
    stateStore,
    config,
    totalSteps,
    2,
    () => executeClaimsStep(input, clusteringTopics, config, reportLogger),
  );

  if (claimsResult?.tag === "failure") {
    return failure(claimsResult.error);
  }

  if (claimsResult) {
    currentState = claimsResult.value.state;
    results.claimsResult = claimsResult.value.result;
  }

  // Step 3: Sort and deduplicate
  if (!results.claimsResult) {
    return failure(
      new PipelineStepError(
        "sort_and_deduplicate",
        new Error("Claims result is required for sort and deduplicate"),
        currentState,
      ),
    );
  }

  const claimsTreeData = results.claimsResult.data;
  const sortedResult = await executeStepIfNeeded(
    "sort_and_deduplicate",
    !results.sortedResult,
    currentState,
    stateStore,
    config,
    totalSteps,
    3,
    () =>
      executeSortAndDeduplicateStep(
        input,
        claimsTreeData,
        config,
        reportLogger,
      ),
  );

  if (sortedResult?.tag === "failure") {
    return failure(sortedResult.error);
  }

  if (sortedResult) {
    currentState = sortedResult.value.state;
    results.sortedResult = sortedResult.value.result;
  }

  // Step 4: Summaries
  if (!results.sortedResult) {
    return failure(
      new PipelineStepError(
        "summaries",
        new Error("Sorted result is required for summaries"),
        currentState,
      ),
    );
  }

  const sortedData = results.sortedResult;
  const summariesResult = await executeStepIfNeeded(
    "summaries",
    !results.summariesResult,
    currentState,
    stateStore,
    config,
    totalSteps,
    4,
    () => executeSummariesStep(input, sortedData, config, reportLogger),
  );

  if (summariesResult?.tag === "failure") {
    return failure(summariesResult.error);
  }

  if (summariesResult) {
    currentState = summariesResult.value.state;
    results.summariesResult = summariesResult.value.result;
  }

  // Step 5: Cruxes (optional)
  if (input.enableCruxes) {
    if (!results.claimsResult || !results.clusteringResult) {
      return failure(
        new PipelineStepError(
          "cruxes",
          new Error("Claims and clustering results are required for cruxes"),
          currentState,
        ),
      );
    }

    const cruxesClaimsTree = results.claimsResult.data;
    const cruxesTopics = results.clusteringResult.data;
    const cruxesResult = await executeStepIfNeeded(
      "cruxes",
      !results.cruxesResult,
      currentState,
      stateStore,
      config,
      totalSteps,
      5,
      () =>
        executeCruxesStep(
          input,
          cruxesClaimsTree,
          cruxesTopics,
          config,
          reportLogger,
        ),
    );

    if (cruxesResult?.tag === "failure") {
      return failure(cruxesResult.error);
    }

    if (cruxesResult) {
      currentState = cruxesResult.value.state;
      results.cruxesResult = cruxesResult.value.result;
    }
  } else {
    currentState = markStepSkipped(currentState, "cruxes");
    await stateStore.save(currentState);
    config.onStepUpdate?.("cruxes", "skipped");
  }

  return success({ state: currentState, results });
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

  // Initialize state
  let state = await initializePipelineState(config, stateStore, reportLogger);

  try {
    // Execute all steps
    const stepsResult = await executeAllSteps(
      input,
      config,
      state,
      stateStore,
      reportLogger,
    );

    if (stepsResult.tag === "failure") {
      return {
        success: false,
        state: stepsResult.error.state,
        error: stepsResult.error,
      };
    }

    state = stepsResult.value.state;
    const {
      clusteringResult,
      claimsResult,
      sortedResult,
      summariesResult,
      cruxesResult,
    } = stepsResult.value.results;

    // Mark pipeline as completed
    state = {
      ...state,
      status: "completed",
      currentStep: undefined,
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

    // Validate required results exist (they must if we got here)
    if (
      !clusteringResult ||
      !claimsResult ||
      !sortedResult ||
      !summariesResult
    ) {
      throw new Error(
        "Pipeline completed but required results are missing. This should never happen.",
      );
    }

    return {
      success: true,
      state,
      outputs: {
        topicTree: clusteringResult.data,
        claimsTree: claimsResult.data,
        sortedTree: sortedResult.data,
        summaries: summariesResult.data,
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
