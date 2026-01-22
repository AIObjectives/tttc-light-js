/**
 * Pipeline State Store
 *
 * Redis-based state management for pipeline execution.
 * Stores partially completed steps and allows resuming from failures.
 */

import { z } from "zod";
import type { Cache } from "../cache/types.js";
import {
  type PipelineState,
  PipelineStateError,
  type PipelineStateStore,
  type PipelineStepName,
  type StateOptions,
  type StepAnalytics,
} from "./types.js";

/** Default TTL for pipeline state: 24 hours */
const DEFAULT_STATE_TTL = 24 * 60 * 60;

/** Redis key prefix for pipeline state */
const STATE_KEY_PREFIX = "pipeline_state:";

/**
 * Zod schema for validating step analytics
 */
const stepAnalyticsSchema = z.object({
  stepName: z.enum([
    "clustering",
    "claims",
    "sort_and_deduplicate",
    "summaries",
    "cruxes",
  ]),
  status: z.enum(["pending", "in_progress", "completed", "failed", "skipped"]),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  durationMs: z.number().optional(),
  inputTokens: z.number().optional(),
  outputTokens: z.number().optional(),
  totalTokens: z.number().optional(),
  cost: z.number().optional(),
  errorMessage: z.string().optional(),
  errorName: z.string().optional(),
});

/**
 * Zod schema for validating step analytics record
 * Uses explicit object keys instead of z.record for Zod 4 compatibility
 */
const stepAnalyticsRecordSchema = z.object({
  clustering: stepAnalyticsSchema,
  claims: stepAnalyticsSchema,
  sort_and_deduplicate: stepAnalyticsSchema,
  summaries: stepAnalyticsSchema,
  cruxes: stepAnalyticsSchema,
});

/**
 * Zod schema for validating pipeline state
 */
const pipelineStateSchema = z.object({
  version: z.literal("1.0"),
  reportId: z.string(),
  userId: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  status: z.enum(["pending", "running", "completed", "failed"]),
  currentStep: z
    .enum([
      "clustering",
      "claims",
      "sort_and_deduplicate",
      "summaries",
      "cruxes",
    ])
    .optional(),
  stepAnalytics: stepAnalyticsRecordSchema,
  completedResults: z.object({
    clustering: z.unknown().optional(),
    claims: z.unknown().optional(),
    sort_and_deduplicate: z.unknown().optional(),
    summaries: z.unknown().optional(),
    cruxes: z.unknown().optional(),
  }),
  error: z
    .object({
      message: z.string(),
      name: z.string(),
      step: z
        .enum([
          "clustering",
          "claims",
          "sort_and_deduplicate",
          "summaries",
          "cruxes",
        ])
        .optional(),
    })
    .optional(),
  totalTokens: z.number(),
  totalCost: z.number(),
  totalDurationMs: z.number(),
});

/**
 * Get the Redis key for a pipeline state
 */
function getStateKey(reportId: string): string {
  return `${STATE_KEY_PREFIX}${reportId}`;
}

/**
 * Create initial step analytics for all steps
 */
export function createInitialStepAnalytics(): Record<
  PipelineStepName,
  StepAnalytics
> {
  const steps: PipelineStepName[] = [
    "clustering",
    "claims",
    "sort_and_deduplicate",
    "summaries",
    "cruxes",
  ];

  const analytics: Record<PipelineStepName, StepAnalytics> = {} as Record<
    PipelineStepName,
    StepAnalytics
  >;

  for (const step of steps) {
    analytics[step] = {
      stepName: step,
      status: "pending",
    };
  }

  return analytics;
}

/**
 * Create initial pipeline state
 */
export function createInitialState(
  reportId: string,
  userId: string,
): PipelineState {
  const now = new Date().toISOString();

  return {
    version: "1.0",
    reportId,
    userId,
    createdAt: now,
    updatedAt: now,
    status: "pending",
    stepAnalytics: createInitialStepAnalytics(),
    completedResults: {},
    totalTokens: 0,
    totalCost: 0,
    totalDurationMs: 0,
  };
}

/**
 * Redis-based implementation of PipelineStateStore
 */
export class RedisPipelineStateStore implements PipelineStateStore {
  constructor(private cache: Cache) {}

  /**
   * Get pipeline state from Redis
   */
  async get(reportId: string): Promise<PipelineState | null> {
    const key = getStateKey(reportId);
    const data = await this.cache.get(key);

    if (!data) {
      return null;
    }

    try {
      const parsed = JSON.parse(data);
      const validated = pipelineStateSchema.parse(parsed);
      return validated as PipelineState;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new PipelineStateError(
          `Invalid pipeline state for report '${reportId}': ${error.message}`,
        );
      }
      throw new PipelineStateError(
        `Failed to parse pipeline state for report '${reportId}': ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Save pipeline state to Redis
   */
  async save(state: PipelineState, options?: StateOptions): Promise<void> {
    const key = getStateKey(state.reportId);
    const ttl = options?.ttl ?? DEFAULT_STATE_TTL;

    // Update timestamp
    const updatedState: PipelineState = {
      ...state,
      updatedAt: new Date().toISOString(),
    };

    await this.cache.set(key, JSON.stringify(updatedState), { ttl });
  }

  /**
   * Delete pipeline state from Redis
   */
  async delete(reportId: string): Promise<void> {
    const key = getStateKey(reportId);
    await this.cache.delete(key);
  }

  /**
   * Update specific fields in pipeline state
   */
  async update(
    reportId: string,
    updates: Partial<PipelineState>,
  ): Promise<PipelineState | null> {
    const existing = await this.get(reportId);

    if (!existing) {
      return null;
    }

    const updatedState: PipelineState = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.save(updatedState);
    return updatedState;
  }
}

/**
 * Helper function to update step analytics in state
 */
export function updateStepAnalytics(
  state: PipelineState,
  stepName: PipelineStepName,
  updates: Partial<StepAnalytics>,
): PipelineState {
  return {
    ...state,
    stepAnalytics: {
      ...state.stepAnalytics,
      [stepName]: {
        ...state.stepAnalytics[stepName],
        ...updates,
      },
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Helper to mark a step as started
 */
export function markStepStarted(
  state: PipelineState,
  stepName: PipelineStepName,
): PipelineState {
  return updateStepAnalytics(state, stepName, {
    status: "in_progress",
    startedAt: new Date().toISOString(),
  });
}

/**
 * Helper to mark a step as completed with results
 */
export function markStepCompleted(
  state: PipelineState,
  stepName: PipelineStepName,
  analytics: {
    durationMs: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    cost: number;
  },
): PipelineState {
  const now = new Date().toISOString();

  return {
    ...updateStepAnalytics(state, stepName, {
      status: "completed",
      completedAt: now,
      ...analytics,
    }),
    totalTokens: state.totalTokens + analytics.totalTokens,
    totalCost: state.totalCost + analytics.cost,
  };
}

/**
 * Helper to mark a step as failed
 */
export function markStepFailed(
  state: PipelineState,
  stepName: PipelineStepName,
  error: Error,
  durationMs?: number,
): PipelineState {
  return {
    ...updateStepAnalytics(state, stepName, {
      status: "failed",
      completedAt: new Date().toISOString(),
      errorMessage: error.message,
      errorName: error.name,
      durationMs,
    }),
    status: "failed",
    error: {
      message: error.message,
      name: error.name,
      step: stepName,
    },
  };
}

/**
 * Helper to mark a step as skipped
 */
export function markStepSkipped(
  state: PipelineState,
  stepName: PipelineStepName,
): PipelineState {
  return updateStepAnalytics(state, stepName, {
    status: "skipped",
  });
}

/**
 * Get the next step to execute based on current state
 */
export function getNextStep(state: PipelineState): PipelineStepName | null {
  const stepOrder: PipelineStepName[] = [
    "clustering",
    "claims",
    "sort_and_deduplicate",
    "summaries",
    "cruxes",
  ];

  for (const step of stepOrder) {
    const stepStatus = state.stepAnalytics[step].status;

    // Return the first step that is not completed or skipped
    if (stepStatus !== "completed" && stepStatus !== "skipped") {
      return step;
    }
  }

  return null;
}

/**
 * Check if pipeline can be resumed
 */
export function canResumePipeline(state: PipelineState): boolean {
  // Cannot resume completed or pending pipelines
  if (state.status === "completed" || state.status === "pending") {
    return false;
  }

  // Can resume failed or running pipelines
  return true;
}

/**
 * Get completed step results for resumption
 */
export function getCompletedStepResults(state: PipelineState): {
  hasClusteringResult: boolean;
  hasClaimsResult: boolean;
  hasSortedResult: boolean;
  hasSummariesResult: boolean;
  hasCruxesResult: boolean;
} {
  return {
    hasClusteringResult: state.completedResults.clustering !== undefined,
    hasClaimsResult: state.completedResults.claims !== undefined,
    hasSortedResult: state.completedResults.sort_and_deduplicate !== undefined,
    hasSummariesResult: state.completedResults.summaries !== undefined,
    hasCruxesResult: state.completedResults.cruxes !== undefined,
  };
}
