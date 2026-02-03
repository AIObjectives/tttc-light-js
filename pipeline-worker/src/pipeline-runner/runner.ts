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
  LOCK_REFRESH_INTERVAL_MS,
  LOCK_TTL_SECONDS,
  PIPELINE_TIMEOUT_MS,
} from "./constants.js";
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

/** Maximum validation failures before considering state permanently corrupted */
const MAX_VALIDATION_FAILURES = 3;

/**
 * Minimum step duration in milliseconds for analytics tracking.
 * Very fast operations (e.g., mocked steps) can complete in <1ms,
 * but we need at least 1ms for accurate analytics reporting.
 */
const MIN_STEP_DURATION_MS = 1;

/**
 * Verify lock ownership before state save.
 * If lockValue is provided, verifies we still hold the lock.
 * Throws an error if lock verification fails.
 */
async function verifyLockBeforeSave(
  stateStore: RedisPipelineStateStore,
  reportId: string,
  lockValue: string | undefined,
  reportLogger: typeof runnerLogger,
): Promise<void> {
  if (!lockValue) {
    // No lock value provided - skip verification
    return;
  }

  const hasLock = await stateStore.verifyPipelineLock(reportId, lockValue);
  if (!hasLock) {
    reportLogger.error(
      { reportId, lockValue },
      "Lock verification failed - lock expired or acquired by another worker",
    );
    throw new Error(
      "Pipeline lock lost during execution - cannot safely save state",
    );
  }
}

/**
 * Atomically saves pipeline state with lock verification.
 * This prevents TOCTOU race conditions by using a Lua script that verifies
 * lock ownership and saves state in a single atomic Redis operation.
 *
 * Falls back to non-atomic save if no lock value is provided.
 *
 * @param stateStore - Redis state store
 * @param state - Pipeline state to save
 * @param lockValue - Unique lock identifier (optional)
 * @param reportLogger - Logger for this report
 * @throws {Error} When lock is lost or save fails
 */
async function saveWithLockVerification(
  stateStore: RedisPipelineStateStore,
  state: PipelineState,
  lockValue: string | undefined,
  reportLogger: typeof runnerLogger,
): Promise<void> {
  if (!lockValue) {
    // No lock value provided - use regular save without verification
    await stateStore.save(state);
    return;
  }

  // Use atomic lock-verified save to prevent TOCTOU race conditions
  const result = await stateStore.saveWithLockVerification(state, lockValue);

  if (!result.success) {
    reportLogger.error(
      { reportId: state.reportId, lockValue, reason: result.reason },
      "Atomic save failed - lock verification failed during save operation",
    );
    throw new Error(
      `Pipeline lock lost during save - cannot safely persist state: ${result.reason}`,
    );
  }
}

/**
 * Validate that a recovered result has the expected structure.
 * Most steps return { data, usage, cost }, but cruxes returns
 * { subtopicCruxes, topicScores, speakerCruxMatrix, usage, cost }
 */
function validateResultStructure(
  result: unknown,
  stepName: PipelineStepName,
): result is
  | { data: unknown; usage: unknown; cost: number }
  | {
      subtopicCruxes: unknown;
      topicScores: unknown;
      speakerCruxMatrix: unknown;
      usage: unknown;
      cost: number;
    } {
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
 * Start periodic lock extension during long-running step execution.
 * Returns a cleanup function to stop the extension timer and a promise that
 * resolves if the lock is lost (refresh fails or throws).
 *
 * @param stateStore - State store for lock operations
 * @param reportId - Report identifier
 * @param lockValue - Lock value to verify ownership
 * @param reportLogger - Logger instance
 * @returns Object with cleanup function and abort promise
 */
function startLockExtension(
  stateStore: RedisPipelineStateStore,
  reportId: string,
  lockValue: string | undefined,
  reportLogger: typeof runnerLogger,
): { cleanup: () => void; aborted: Promise<void> } {
  // If no lock value provided, return no-op cleanup and never-resolving abort promise
  if (!lockValue) {
    return {
      cleanup: () => {},
      aborted: new Promise(() => {}), // Never resolves
    };
  }

  let extensionCount = 0;
  let abortResolve: (() => void) | undefined;
  const aborted = new Promise<void>((resolve) => {
    abortResolve = resolve;
  });

  const intervalId = setInterval(async () => {
    try {
      extensionCount++;
      const refreshed = await stateStore.refreshPipelineLock(
        reportId,
        lockValue,
      );

      if (refreshed) {
        reportLogger.debug(
          {
            reportId,
            extensionCount,
            newTtlSeconds: LOCK_TTL_SECONDS,
          },
          "Lock TTL refreshed during step execution",
        );
      } else {
        reportLogger.error(
          {
            reportId,
            extensionCount,
            lockValue,
          },
          "Failed to refresh lock during step execution - lock lost or held by another worker, aborting pipeline",
        );
        clearInterval(intervalId);
        abortResolve?.();
      }
    } catch (error) {
      reportLogger.error(
        {
          error,
          reportId,
          extensionCount,
        },
        "Error refreshing lock during step execution - aborting pipeline",
      );
      clearInterval(intervalId);
      abortResolve?.();
    }
  }, LOCK_REFRESH_INTERVAL_MS);

  // Return cleanup function and abort promise
  return {
    cleanup: () => {
      clearInterval(intervalId);
      if (extensionCount > 0) {
        reportLogger.debug(
          { reportId, extensionCount },
          "Lock extension timer stopped",
        );
      }
    },
    aborted,
  };
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

  reportLogger.info(
    { step: stepName, status: "started" },
    "Pipeline step started",
  );

  try {
    const result = await executor();

    // Ensure minimum duration for analytics tracking
    // (very fast operations like mocked steps can complete in <1ms)
    const durationMs = Math.max(MIN_STEP_DURATION_MS, Date.now() - startTime);

    if (result.tag === "failure") {
      reportLogger.error(
        {
          step: stepName,
          error: result.error,
          durationMs,
          status: "failed",
        },
        "Pipeline step failed",
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
          missingFields: ["usage", "cost"],
        },
        "Step returned result without analytics - analytics tracking will be incomplete",
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
        status: "completed",
      },
      "Pipeline step completed",
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
        status: "exception",
      },
      "Pipeline step threw exception",
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
  lockValue?: string;
  reportLogger: typeof runnerLogger;
}

/**
 * Save step result to state
 */
async function saveStepResult(
  context: StepResultContext,
): Promise<PipelineState> {
  const {
    stateStore,
    state,
    stepName,
    result,
    analytics,
    lockValue,
    reportLogger,
  } = context;

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

  // Atomically save state with lock verification to prevent TOCTOU race conditions
  await saveWithLockVerification(
    stateStore,
    updatedState,
    lockValue,
    reportLogger,
  );

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
  reportLogger: typeof runnerLogger;
}

/**
 * Safely invoke a callback without breaking pipeline execution
 */
function safelyInvokeCallback<TArgs extends unknown[]>(
  callback: ((...args: TArgs) => void) | undefined,
  callbackName: string,
  stepName: PipelineStepName,
  ...args: TArgs
): void {
  if (!callback) return;

  try {
    callback(...args);
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

  safelyInvokeCallback(config.onProgress, "onProgress", stepName, {
    currentStep: stepName,
    totalSteps,
    completedSteps,
    percentComplete,
  });
}

/**
 * Handle step failure
 */
function handleStepFailure(
  stepName: PipelineStepName,
  error: Error,
  state: PipelineState,
  config: PipelineRunnerConfig,
): Result<never, PipelineStepError> {
  const updatedState = markStepFailed(state, stepName, error);

  safelyInvokeCallback(
    config.onStepUpdate,
    "onStepUpdate",
    stepName,
    stepName,
    "failed",
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
    reportLogger,
  } = context;

  // Mark step as started
  let updatedState = markStepStarted(state, stepName);
  updatedState.currentStep = stepName;

  // Atomically save state with lock verification to prevent TOCTOU race conditions
  await saveWithLockVerification(
    stateStore,
    updatedState,
    config.lockValue,
    reportLogger,
  );

  safelyInvokeCallback(
    config.onStepUpdate,
    "onStepUpdate",
    stepName,
    stepName,
    "in_progress",
  );

  // Start periodic lock extension during step execution
  const { cleanup: stopLockExtension, aborted } = startLockExtension(
    stateStore,
    state.reportId,
    config.lockValue,
    reportLogger,
  );

  // Execute the step (make sure to stop lock extension on completion or error)
  // Race between step execution and lock refresh failure
  let result: Result<StepExecutionResult<unknown>, Error>;
  try {
    const executionResult = await Promise.race([
      executor(),
      aborted.then(() => {
        // Lock was lost during execution
        return failure(
          new Error(
            "Pipeline lock lost during step execution - another worker may have acquired the lock",
          ),
        );
      }),
    ]);
    result = executionResult;
  } finally {
    // Always stop lock extension when step completes (success or failure)
    stopLockExtension();
  }

  // Handle failure
  if (result.tag === "failure") {
    const failureResult = handleStepFailure(
      stepName,
      result.error,
      updatedState,
      config,
    );
    // handleStepFailure always returns failure, so we can safely access error
    if (failureResult.tag === "failure") {
      // Atomically save failure state with lock verification
      await saveWithLockVerification(
        stateStore,
        failureResult.error.state,
        config.lockValue,
        reportLogger,
      );
    }
    return failureResult;
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
    lockValue: config.lockValue,
    reportLogger,
  });

  // Notify completion
  safelyInvokeCallback(
    config.onStepUpdate,
    "onStepUpdate",
    stepName,
    stepName,
    "completed",
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

  // Atomically save initial state with lock verification
  await saveWithLockVerification(
    stateStore,
    state,
    config.lockValue,
    reportLogger,
  );

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
  reportLogger: typeof runnerLogger,
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
    reportLogger,
  });

  if (result.tag === "failure") {
    return failure(result.error);
  }

  // Validate the result has the expected structure before casting
  // This provides runtime safety that the executor returned a valid result
  const stepResult = result.value.result;
  if (!validateResultStructure(stepResult, stepName)) {
    reportLogger.error(
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
 * Configuration for executing a single pipeline step with dependency validation
 */
interface StepExecutionConfig<T> {
  stepName: PipelineStepName;
  stepNumber: number;
  cachedResult: T | undefined;
  executor: () => Promise<Result<StepExecutionResult<T>, Error>>;
  dependencyError?: string;
}

/**
 * Execute a pipeline step with automatic recovery, dependency validation, and state updates.
 * This function encapsulates the common pattern used across all pipeline steps:
 * 1. Check for cached/recovered result
 * 2. Validate dependencies (if provided)
 * 3. Execute step if needed
 * 4. Handle failures
 * 5. Update state and results
 *
 * @returns Updated state and result, or failure if dependencies are missing or execution fails
 */
async function executeStepWithRecovery<T>(
  config: StepExecutionConfig<T>,
  state: PipelineState,
  stateStore: RedisPipelineStateStore,
  runnerConfig: PipelineRunnerConfig,
  totalSteps: number,
  reportLogger: typeof runnerLogger,
): Promise<Result<{ state: PipelineState; result: T }, PipelineStepError>> {
  // Check dependency validation first
  if (config.dependencyError) {
    return failure(
      new PipelineStepError(
        config.stepName,
        new Error(config.dependencyError),
        state,
      ),
    );
  }

  // Execute step if not already cached
  const executionResult = await executeStepIfNeeded(
    config.stepName,
    !config.cachedResult,
    state,
    stateStore,
    runnerConfig,
    totalSteps,
    config.stepNumber,
    config.executor,
    reportLogger,
  );

  // Handle execution failure
  if (executionResult?.tag === "failure") {
    return failure(executionResult.error);
  }

  // Return updated state and result (either from execution or cache)
  if (executionResult) {
    return success({
      state: executionResult.value.state,
      result: executionResult.value.result,
    });
  }

  // Use cached result
  return success({
    state,
    result: config.cachedResult as T,
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
  const validateAndCast = async <T>(
    result: unknown,
    stepName: PipelineStepName,
  ): Promise<Result<T | undefined, PipelineStepError>> => {
    if (!result) return success(undefined);
    if (!validateResultStructure(result, stepName)) {
      // Atomically increment failure counter in Redis
      // This ensures the counter persists across crashes and prevents race conditions
      const newFailureCount = await stateStore.incrementValidationFailure(
        state.reportId,
        stepName,
      );

      // If we've exceeded the retry limit, fail the pipeline permanently
      // Check AFTER incrementing to avoid race condition where two workers
      // both read count=2, both pass check, both increment → count=4 when MAX=3
      if (newFailureCount >= MAX_VALIDATION_FAILURES) {
        return failure(
          new PipelineStepError(
            stepName,
            new Error(
              `Step result validation failed ${newFailureCount} times - state is permanently corrupted. ` +
                `This may indicate a schema version mismatch or data serialization issue.`,
            ),
            currentState,
          ),
        );
      }

      // Note: We do not update currentState.validationFailures here because:
      // 1. Redis counter is the source of truth (atomically incremented above)
      // 2. In-memory update would not persist until state is saved later
      // 3. This prevents race condition if process crashes before state save
      // The counter will be synced to state JSON when save() is eventually called

      // If validation fails, we cannot use this result and must re-run the step
      reportLogger.error(
        {
          stepName,
          reportId: state.reportId,
          hasResult: !!result,
          resultType: typeof result,
          failureCount: newFailureCount,
          maxFailures: MAX_VALIDATION_FAILURES,
        },
        `Discarding corrupted step result from Redis - step '${stepName}' will be re-executed (attempt ${newFailureCount}/${MAX_VALIDATION_FAILURES})`,
      );
      return success(undefined);
    }
    return success(result as T);
  };

  // Validate each result and collect any errors
  const clusteringValidation = await validateAndCast<TopicTreeResult>(
    state.completedResults.clustering,
    "clustering",
  );
  if (clusteringValidation.tag === "failure") {
    return failure(clusteringValidation.error);
  }

  const claimsValidation = await validateAndCast<ClaimsResult>(
    state.completedResults.claims,
    "claims",
  );
  if (claimsValidation.tag === "failure") {
    return failure(claimsValidation.error);
  }

  const sortedValidation = await validateAndCast<SortAndDeduplicateResult>(
    state.completedResults.sort_and_deduplicate,
    "sort_and_deduplicate",
  );
  if (sortedValidation.tag === "failure") {
    return failure(sortedValidation.error);
  }

  const summariesValidation = await validateAndCast<SummariesResult>(
    state.completedResults.summaries,
    "summaries",
  );
  if (summariesValidation.tag === "failure") {
    return failure(summariesValidation.error);
  }

  const cruxesValidation = await validateAndCast<CruxesResult>(
    state.completedResults.cruxes,
    "cruxes",
  );
  if (cruxesValidation.tag === "failure") {
    return failure(cruxesValidation.error);
  }

  const results: PipelineStepResults = {
    clusteringResult: clusteringValidation.value,
    claimsResult: claimsValidation.value,
    sortedResult: sortedValidation.value,
    summariesResult: summariesValidation.value,
    cruxesResult: cruxesValidation.value,
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
  const clusteringResult = await executeStepWithRecovery(
    {
      stepName: "clustering",
      stepNumber: 1,
      cachedResult: results.clusteringResult,
      executor: () => executeClusteringStep(input, config, reportLogger),
    },
    currentState,
    stateStore,
    config,
    totalSteps,
    reportLogger,
  );

  if (clusteringResult.tag === "failure") {
    return failure(clusteringResult.error);
  }

  currentState = clusteringResult.value.state;
  results.clusteringResult = clusteringResult.value.result;

  // Step 2: Claims extraction
  const claimsResult = await executeStepWithRecovery(
    {
      stepName: "claims",
      stepNumber: 2,
      cachedResult: results.claimsResult,
      executor: () =>
        executeClaimsStep(
          input,
          results.clusteringResult!.data,
          config,
          reportLogger,
        ),
      dependencyError: !results.clusteringResult
        ? "Clustering result is required for claims extraction"
        : undefined,
    },
    currentState,
    stateStore,
    config,
    totalSteps,
    reportLogger,
  );

  if (claimsResult.tag === "failure") {
    return failure(claimsResult.error);
  }

  currentState = claimsResult.value.state;
  results.claimsResult = claimsResult.value.result;

  // Step 3: Sort and deduplicate
  const sortedResult = await executeStepWithRecovery(
    {
      stepName: "sort_and_deduplicate",
      stepNumber: 3,
      cachedResult: results.sortedResult,
      executor: () =>
        executeSortAndDeduplicateStep(
          input,
          results.claimsResult!.data,
          config,
          reportLogger,
        ),
      dependencyError: !results.claimsResult
        ? "Claims result is required for sort and deduplicate"
        : undefined,
    },
    currentState,
    stateStore,
    config,
    totalSteps,
    reportLogger,
  );

  if (sortedResult.tag === "failure") {
    return failure(sortedResult.error);
  }

  currentState = sortedResult.value.state;
  results.sortedResult = sortedResult.value.result;

  // Step 4: Summaries
  const summariesResult = await executeStepWithRecovery(
    {
      stepName: "summaries",
      stepNumber: 4,
      cachedResult: results.summariesResult,
      executor: () =>
        executeSummariesStep(
          input,
          results.sortedResult!,
          config,
          reportLogger,
        ),
      dependencyError: !results.sortedResult
        ? "Sorted result is required for summaries"
        : undefined,
    },
    currentState,
    stateStore,
    config,
    totalSteps,
    reportLogger,
  );

  if (summariesResult.tag === "failure") {
    return failure(summariesResult.error);
  }

  currentState = summariesResult.value.state;
  results.summariesResult = summariesResult.value.result;

  // Step 5: Cruxes (optional)
  if (input.enableCruxes) {
    const cruxesResult = await executeStepWithRecovery(
      {
        stepName: "cruxes",
        stepNumber: 5,
        cachedResult: results.cruxesResult,
        executor: () =>
          executeCruxesStep(
            input,
            results.claimsResult!.data,
            results.clusteringResult!.data,
            config,
            reportLogger,
          ),
        dependencyError:
          !results.claimsResult || !results.clusteringResult
            ? "Claims and clustering results are required for cruxes"
            : undefined,
      },
      currentState,
      stateStore,
      config,
      totalSteps,
      reportLogger,
    );

    if (cruxesResult.tag === "failure") {
      return failure(cruxesResult.error);
    }

    currentState = cruxesResult.value.state;
    results.cruxesResult = cruxesResult.value.result;
  } else {
    currentState = markStepSkipped(currentState, "cruxes");

    // Atomically save skipped step state with lock verification
    await saveWithLockVerification(
      stateStore,
      currentState,
      config.lockValue,
      reportLogger,
    );

    safelyInvokeCallback(
      config.onStepUpdate,
      "onStepUpdate",
      "cruxes",
      "cruxes",
      "skipped",
    );
  }

  return success({ state: currentState, results });
}

/**
 * Validate that all required pipeline results are present
 */
function validateRequiredResults(
  results: PipelineStepResults,
): Result<
  Required<
    Pick<
      PipelineStepResults,
      "clusteringResult" | "claimsResult" | "sortedResult" | "summariesResult"
    >
  > &
    PipelineStepResults,
  Error
> {
  const { clusteringResult, claimsResult, sortedResult, summariesResult } =
    results;

  if (!clusteringResult) {
    return failure(
      new Error("Pipeline completed but clustering result is missing"),
    );
  }

  if (!claimsResult) {
    return failure(
      new Error("Pipeline completed but claims result is missing"),
    );
  }

  if (!sortedResult) {
    return failure(
      new Error("Pipeline completed but sorted result is missing"),
    );
  }

  if (!summariesResult) {
    return failure(
      new Error("Pipeline completed but summaries result is missing"),
    );
  }

  return success(
    results as Required<
      Pick<
        PipelineStepResults,
        "clusteringResult" | "claimsResult" | "sortedResult" | "summariesResult"
      >
    > &
      PipelineStepResults,
  );
}

/**
 * Build successful pipeline result from completed steps
 */
function buildSuccessResult(
  state: PipelineState,
  results: PipelineStepResults,
): Result<PipelineResult, Error> {
  const validation = validateRequiredResults(results);
  if (validation.tag === "failure") {
    return failure(validation.error);
  }

  const validatedResults = validation.value;

  return success({
    success: true,
    state,
    outputs: {
      topicTree: validatedResults.clusteringResult.data,
      claimsTree: validatedResults.claimsResult.data,
      sortedTree: validatedResults.sortedResult.data,
      summaries: validatedResults.summariesResult.data,
      cruxes: validatedResults.cruxesResult,
    },
  });
}

/**
 * Handle pipeline failure and update state
 */
async function handlePipelineFailure(
  error: unknown,
  state: PipelineState,
  stateStore: RedisPipelineStateStore,
  config: PipelineRunnerConfig,
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

  // Atomically save failure state with lock verification
  await saveWithLockVerification(
    stateStore,
    updatedState,
    config.lockValue,
    reportLogger,
  );

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

    // Atomically save completion state with lock verification
    await saveWithLockVerification(
      stateStore,
      state,
      config.lockValue,
      reportLogger,
    );

    reportLogger.info(
      {
        totalDurationMs: state.totalDurationMs,
        totalTokens: state.totalTokens,
        totalCost: state.totalCost,
      },
      "Pipeline completed successfully",
    );

    const successResult = buildSuccessResult(state, stepsResult.value.results);
    if (successResult.tag === "failure") {
      return handlePipelineFailure(
        successResult.error,
        state,
        stateStore,
        config,
        reportLogger,
      );
    }

    return successResult.value;
  } catch (error) {
    return handlePipelineFailure(
      error,
      state,
      stateStore,
      config,
      reportLogger,
    );
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
  // Note: This promise only rejects (never resolves) which is intentional.
  // In Promise.race, the main pipeline promise handles the success case.
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
    try {
      const currentState = await stateStore.get(config.reportId);
      if (currentState) {
        return handlePipelineFailure(
          error,
          currentState,
          stateStore,
          config,
          reportLogger,
        );
      }
    } catch (stateError) {
      // If we can't get state (e.g., Redis disconnected), fall through to minimal error result
      reportLogger.warn(
        { stateError },
        "Could not retrieve state during error handling",
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
 *
 * Acquires a lock to ensure safe cancellation without race conditions.
 * If the pipeline is already locked by an active worker, this will wait
 * briefly and return false if the lock cannot be acquired.
 */
export async function cancelPipeline(
  reportId: string,
  stateStore: RedisPipelineStateStore,
): Promise<boolean> {
  // Generate a unique lock value for this cancellation operation
  const lockValue = `cancel-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  // Attempt to acquire lock to safely modify state
  const lockAcquired = await stateStore.acquirePipelineLock(
    reportId,
    lockValue,
  );

  if (!lockAcquired) {
    // Lock held by active pipeline worker - cannot cancel safely
    runnerLogger.warn(
      { reportId },
      "Cannot cancel pipeline - lock held by active worker",
    );
    return false;
  }

  try {
    // Read state after acquiring lock to prevent race conditions
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

    // Atomically save cancellation state with lock verification
    const result = await stateStore.saveWithLockVerification(
      updatedState,
      lockValue,
    );

    if (!result.success) {
      runnerLogger.error(
        { reportId, lockValue, reason: result.reason },
        "Lock lost during cancellation - another worker may have taken over",
      );
      return false;
    }

    return true;
  } finally {
    // Always release the lock, even if cancellation failed
    await stateStore.releasePipelineLock(reportId, lockValue);
  }
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
