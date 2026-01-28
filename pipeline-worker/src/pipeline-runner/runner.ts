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

/** Maximum pipeline execution time: 30 minutes */
const PIPELINE_TIMEOUT_MS = 30 * 60 * 1000;

/** Maximum validation failures before considering state permanently corrupted */
const MAX_VALIDATION_FAILURES = 3;

/**
 * Validate that a recovered result has the expected structure.
 * Most steps return { data, usage, cost }, but cruxes returns
 * { subtopicCruxes, topicScores, speakerCruxMatrix, usage, cost }
 */
function validateResultStructure(
  result: unknown,
  stepName: PipelineStepName,
): result is { data: unknown; usage: unknown; cost: number } {
  if (!result || typeof result !== "object") {
    runnerLogger.warn(
      { stepName, resultType: typeof result, isNull: result === null },
      "Recovered result is not an object, cannot resume from this step",
    );
    return false;
  }

  const hasUsage = "usage" in result;
  const hasCost = "cost" in result;

  // All results must have usage and cost
  if (!hasUsage || !hasCost) {
    runnerLogger.warn(
      {
        stepName,
        hasUsage,
        hasCost,
        actualKeys: Object.keys(result),
      },
      "Recovered result missing required fields (usage, cost)",
    );
    return false;
  }

  // Validate step-specific required fields
  if (stepName === "cruxes") {
    const hasCruxFields =
      "subtopicCruxes" in result &&
      "topicScores" in result &&
      "speakerCruxMatrix" in result;

    if (!hasCruxFields) {
      runnerLogger.warn(
        {
          stepName,
          hasSubtopicCruxes: "subtopicCruxes" in result,
          hasTopicScores: "topicScores" in result,
          hasSpeakerCruxMatrix: "speakerCruxMatrix" in result,
          actualKeys: Object.keys(result),
        },
        "Cruxes result missing required fields (subtopicCruxes, topicScores, speakerCruxMatrix)",
      );
      return false;
    }
  } else {
    // All other steps must have a 'data' field
    const hasData = "data" in result;
    if (!hasData) {
      runnerLogger.warn(
        {
          stepName,
          hasData,
          actualKeys: Object.keys(result),
        },
        "Result missing required 'data' field",
      );
      return false;
    }
  }

  return true;
}

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
 * Validate usage object structure
 */
function isValidUsageObject(usage: unknown): boolean {
  if (typeof usage !== "object" || usage === null) {
    return false;
  }

  const usageObj = usage as Record<string, unknown>;
  return (
    typeof usageObj.input_tokens === "number" &&
    typeof usageObj.output_tokens === "number" &&
    typeof usageObj.total_tokens === "number"
  );
}

/**
 * Type guard to check if a value has analytics properties
 */
function hasAnalytics(value: unknown): value is StepResultWithAnalytics {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  // Check for valid usage object if present
  if (obj.usage !== undefined && !isValidUsageObject(obj.usage)) {
    return false;
  }

  // Check for valid cost if present
  if (obj.cost !== undefined && typeof obj.cost !== "number") {
    return false;
  }

  // At least one analytics field must be present
  return obj.usage !== undefined || obj.cost !== undefined;
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

    // Validate analytics - log warning but don't fail pipeline
    if (!hasAnalytics(result.value)) {
      reportLogger.warn(
        {
          step: stepName,
          durationMs,
          resultKeys: Object.keys(result.value as object),
        },
        `Step ${stepName} returned result without analytics (usage/cost) - analytics tracking will be incomplete`,
      );

      // Continue with default analytics to avoid breaking the pipeline
      return success({
        result: result.value,
        durationMs,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        cost: 0,
      });
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

  // Save result and reset validation failure counter on successful completion
  updatedState = {
    ...updatedState,
    completedResults: {
      ...updatedState.completedResults,
      [stepName]: result,
    },
    validationFailures: {
      ...updatedState.validationFailures,
      [stepName]: 0, // Reset failure counter on successful completion
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
 * Safely invoke a callback without breaking pipeline execution
 */
function safelyInvokeCallback(
  callback: (() => void) | undefined,
  callbackName: string,
  stepName: PipelineStepName,
): void {
  if (!callback) return;

  try {
    callback();
  } catch (callbackError) {
    runnerLogger.warn(
      { error: callbackError, stepName },
      `${callbackName} callback threw an error`,
    );
  }
}

/**
 * Notify progress callbacks
 */
function notifyProgress(
  config: PipelineRunnerConfig,
  stepName: PipelineStepName,
  completedSteps: number,
  totalSteps: number,
): void {
  const percentComplete = Math.round((completedSteps / totalSteps) * 100);

  safelyInvokeCallback(
    config.onProgress
      ? () =>
          config.onProgress?.({
            currentStep: stepName,
            totalSteps,
            completedSteps,
            percentComplete,
          })
      : undefined,
    "onProgress",
    stepName,
  );
}

/**
 * Handle step failure
 */
async function handleStepFailure(
  stepName: PipelineStepName,
  error: Error,
  state: PipelineState,
  stateStore: RedisPipelineStateStore,
  config: PipelineRunnerConfig,
): Promise<Result<never, PipelineStepError>> {
  const updatedState = markStepFailed(state, stepName, error);
  await stateStore.save(updatedState);

  safelyInvokeCallback(
    () => config.onStepUpdate?.(stepName, "failed"),
    "onStepUpdate",
    stepName,
  );

  return failure(new PipelineStepError(stepName, error, updatedState));
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

  safelyInvokeCallback(
    () => config.onStepUpdate?.(stepName, "in_progress"),
    "onStepUpdate",
    stepName,
  );

  // Execute the step
  const result = await executor();

  // Handle failure
  if (result.tag === "failure") {
    return handleStepFailure(
      stepName,
      result.error,
      updatedState,
      stateStore,
      config,
    );
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
  safelyInvokeCallback(
    () => config.onStepUpdate?.(stepName, "completed"),
    "onStepUpdate",
    stepName,
  );

  notifyProgress(config, stepName, completedSteps, totalSteps);

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

  // Validate the result has the expected structure before casting
  // This provides runtime safety that the executor returned a valid result
  const stepResult = result.value.result;
  if (!validateResultStructure(stepResult, stepName)) {
    runnerLogger.error(
      {
        stepName,
        resultType: typeof stepResult,
        actualKeys:
          stepResult && typeof stepResult === "object"
            ? Object.keys(stepResult)
            : [],
      },
      `Step executor returned invalid result structure for step '${stepName}'`,
    );
    return failure(
      new PipelineStepError(
        stepName,
        new Error(
          `Step executor returned invalid result structure - missing required fields (data, usage, cost)`,
        ),
        result.value.state,
      ),
    );
  }

  return success({
    state: result.value.state,
    result: stepResult as T,
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

  // Validate and recover results from Redis state
  // Each result must have the required structure (data, usage, cost)
  const validateAndCast = <T>(
    result: unknown,
    stepName: PipelineStepName,
  ): T | undefined => {
    if (!result) return undefined;
    if (!validateResultStructure(result, stepName)) {
      // Track validation failure
      const failureCount = currentState.validationFailures[stepName];

      // If we've exceeded the retry limit, fail the pipeline permanently
      if (failureCount >= MAX_VALIDATION_FAILURES) {
        throw new PipelineStepError(
          stepName,
          new Error(
            `Step result validation failed ${failureCount} times - state is permanently corrupted. ` +
              `This may indicate a schema version mismatch or data serialization issue.`,
          ),
          currentState,
        );
      }

      // Increment failure counter and update state
      currentState.validationFailures[stepName] = failureCount + 1;

      // If validation fails, we cannot use this result and must re-run the step
      reportLogger.error(
        {
          stepName,
          reportId: state.reportId,
          hasResult: !!result,
          resultType: typeof result,
          failureCount: currentState.validationFailures[stepName],
          maxFailures: MAX_VALIDATION_FAILURES,
        },
        `Discarding corrupted step result from Redis - step '${stepName}' will be re-executed (attempt ${currentState.validationFailures[stepName]}/${MAX_VALIDATION_FAILURES})`,
      );
      return undefined;
    }
    return result as T;
  };

  const results: PipelineStepResults = {
    clusteringResult: validateAndCast<TopicTreeResult>(
      state.completedResults.clustering,
      "clustering",
    ),
    claimsResult: validateAndCast<ClaimsResult>(
      state.completedResults.claims,
      "claims",
    ),
    sortedResult: validateAndCast<SortAndDeduplicateResult>(
      state.completedResults.sort_and_deduplicate,
      "sort_and_deduplicate",
    ),
    summariesResult: validateAndCast<SummariesResult>(
      state.completedResults.summaries,
      "summaries",
    ),
    cruxesResult: validateAndCast<CruxesResult>(
      state.completedResults.cruxes,
      "cruxes",
    ),
  };

  // Log summary of recovered vs corrupted results
  const stepsInState = Object.keys(state.completedResults).filter(
    (key) => state.completedResults[key as PipelineStepName] != null,
  );
  const recoveredSteps = Object.entries(results)
    .filter(([_, value]) => value !== undefined)
    .map(([key]) => key.replace("Result", ""));
  const corruptedSteps = stepsInState.filter(
    (step) => !recoveredSteps.includes(step),
  );

  if (stepsInState.length > 0) {
    reportLogger.info(
      {
        totalStepsInState: stepsInState.length,
        recoveredSteps: recoveredSteps.length,
        corruptedSteps: corruptedSteps.length,
        corruptedStepNames: corruptedSteps,
      },
      `State recovery: ${recoveredSteps.length}/${stepsInState.length} steps recovered successfully`,
    );
  }

  // Save updated state with incremented validation failure counters
  // This ensures the counters persist across restarts
  if (corruptedSteps.length > 0) {
    await stateStore.save(currentState);
    reportLogger.info(
      { validationFailures: currentState.validationFailures },
      "Updated validation failure counters persisted to Redis",
    );
  }

  const nextStep = getNextStep(currentState);

  // Calculate total steps based on what will actually run
  // Steps: clustering, claims, sort_and_deduplicate, summaries, [cruxes if enabled]
  const allSteps: PipelineStepName[] = [
    "clustering",
    "claims",
    "sort_and_deduplicate",
    "summaries",
    "cruxes",
  ];
  const totalSteps = input.enableCruxes ? allSteps.length : allSteps.length - 1;

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

    try {
      config.onStepUpdate?.("cruxes", "skipped");
    } catch (callbackError) {
      reportLogger.warn(
        { error: callbackError },
        "onStepUpdate callback threw an error",
      );
    }
  }

  return success({ state: currentState, results });
}

/**
 * Validate that all required pipeline results are present
 */
function validateRequiredResults(
  results: PipelineStepResults,
): asserts results is Required<
  Pick<
    PipelineStepResults,
    "clusteringResult" | "claimsResult" | "sortedResult" | "summariesResult"
  >
> &
  PipelineStepResults {
  const { clusteringResult, claimsResult, sortedResult, summariesResult } =
    results;

  if (!clusteringResult) {
    throw new Error("Pipeline completed but clustering result is missing");
  }

  if (!claimsResult) {
    throw new Error("Pipeline completed but claims result is missing");
  }

  if (!sortedResult) {
    throw new Error("Pipeline completed but sorted result is missing");
  }

  if (!summariesResult) {
    throw new Error("Pipeline completed but summaries result is missing");
  }
}

/**
 * Build successful pipeline result from completed steps
 */
function buildSuccessResult(
  state: PipelineState,
  results: PipelineStepResults,
): PipelineResult {
  validateRequiredResults(results);

  return {
    success: true,
    state,
    outputs: {
      topicTree: results.clusteringResult.data,
      claimsTree: results.claimsResult.data,
      sortedTree: results.sortedResult.data,
      summaries: results.summariesResult.data,
      cruxes: results.cruxesResult,
    },
  };
}

/**
 * Handle pipeline failure and update state
 */
async function handlePipelineFailure(
  error: unknown,
  state: PipelineState,
  stateStore: RedisPipelineStateStore,
  reportLogger: typeof runnerLogger,
): Promise<PipelineResult> {
  const err = error instanceof Error ? error : new Error(String(error));

  reportLogger.error(
    {
      error: err,
      currentStep: state.currentStep,
    },
    "Pipeline failed with unexpected error",
  );

  const updatedState: PipelineState = {
    ...state,
    status: "failed",
    error: {
      message: err.message,
      name: err.name,
      step: state.currentStep,
    },
  };
  await stateStore.save(updatedState);

  return {
    success: false,
    state: updatedState,
    error: err,
  };
}

/**
 * Internal pipeline execution (without timeout wrapper)
 */
async function executePipelineInternal(
  input: PipelineInput,
  config: PipelineRunnerConfig,
  stateStore: RedisPipelineStateStore,
  reportLogger: typeof runnerLogger,
): Promise<PipelineResult> {
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

    // Mark pipeline as completed
    state = {
      ...stepsResult.value.state,
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

    return buildSuccessResult(state, stepsResult.value.results);
  } catch (error) {
    return handlePipelineFailure(error, state, stateStore, reportLogger);
  }
}

/**
 * Main pipeline runner function with timeout protection
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
      timeoutMs: PIPELINE_TIMEOUT_MS,
    },
    "Starting pipeline execution",
  );

  // Create AbortController for proper cancellation
  const abortController = new AbortController();
  const { signal } = abortController;

  // Create timeout promise that respects abort signal
  const timeoutPromise = new Promise<PipelineResult>((_, reject) => {
    const timeoutId = setTimeout(() => {
      if (!signal.aborted) {
        reject(
          new Error(
            `Pipeline execution exceeded timeout of ${PIPELINE_TIMEOUT_MS / 1000}s`,
          ),
        );
      }
    }, PIPELINE_TIMEOUT_MS);

    // Clear timeout if aborted
    signal.addEventListener("abort", () => {
      clearTimeout(timeoutId);
    });
  });

  // Race between pipeline execution and timeout
  try {
    return await Promise.race([
      executePipelineInternal(input, config, stateStore, reportLogger),
      timeoutPromise,
    ]);
  } catch (error) {
    // Re-throw PipelineResumeError without converting to result
    // This is a validation error that should propagate to the caller
    if (error instanceof PipelineResumeError) {
      throw error;
    }

    reportLogger.error(
      { error, timeoutMs: PIPELINE_TIMEOUT_MS },
      "Pipeline execution timed out or failed",
    );

    // Try to get current state to save timeout error
    const currentState = await stateStore.get(config.reportId);
    if (currentState) {
      return handlePipelineFailure(
        error,
        currentState,
        stateStore,
        reportLogger,
      );
    }

    // If we can't get state, create a minimal error result
    return {
      success: false,
      state: createInitialState(config.reportId, config.userId),
      error: error instanceof Error ? error : new Error(String(error)),
    };
  } finally {
    // Abort the timeout promise to prevent memory leak
    abortController.abort();
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
