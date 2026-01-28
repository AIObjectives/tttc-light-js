/**
 * Pipeline Runner Types
 *
 * Type definitions for the pipeline runner that executes all pipeline steps
 * with state management, analytics tracking, and failure recovery.
 */

import type {
  ClaimsResult,
  ClaimsTree,
  ClusteringOptions,
  Comment,
  CruxesResult,
  LLMConfig,
  SortAndDeduplicateResult,
  SortedTree,
  SummariesResult,
  Topic,
  TopicTreeResult,
} from "../pipeline-steps/types.js";

/**
 * Pipeline step names
 */
export type PipelineStepName =
  | "clustering"
  | "claims"
  | "sort_and_deduplicate"
  | "summaries"
  | "cruxes";

/**
 * Pipeline step status
 */
export type PipelineStepStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "failed"
  | "skipped";

/**
 * Analytics data for a single pipeline step
 */
export interface StepAnalytics {
  /** Step name */
  stepName: PipelineStepName;
  /** Step status */
  status: PipelineStepStatus;
  /** Time when step started (ISO timestamp) */
  startedAt?: string;
  /** Time when step completed (ISO timestamp) */
  completedAt?: string;
  /** Duration in milliseconds */
  durationMs?: number;
  /** Input token count */
  inputTokens?: number;
  /** Output token count */
  outputTokens?: number;
  /** Total token count */
  totalTokens?: number;
  /** Estimated cost in USD */
  cost?: number;
  /** Error message if step failed */
  errorMessage?: string;
  /** Error name/type if step failed */
  errorName?: string;
}

/**
 * Complete pipeline state stored in Redis
 */
export interface PipelineState {
  /** Schema version for state migrations */
  version: "1.0";
  /** Unique report identifier */
  reportId: string;
  /** User who initiated the pipeline */
  userId: string;
  /** Pipeline creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
  /** Current pipeline status */
  status: "pending" | "running" | "completed" | "failed";
  /** Current step being executed */
  currentStep?: PipelineStepName;
  /** Analytics for each step */
  stepAnalytics: Record<PipelineStepName, StepAnalytics>;
  /** Completed step results (serialized) */
  completedResults: {
    clustering?: TopicTreeResult;
    claims?: ClaimsResult;
    sort_and_deduplicate?: SortAndDeduplicateResult;
    summaries?: SummariesResult;
    cruxes?: CruxesResult;
  };
  /** Track validation failures to prevent infinite retry loops */
  validationFailures: Record<PipelineStepName, number>;
  /** Pipeline-level error if failed */
  error?: {
    message: string;
    name: string;
    step?: PipelineStepName;
  };
  /** Total tokens used across all steps */
  totalTokens: number;
  /** Total cost across all steps */
  totalCost: number;
  /** Total duration in milliseconds */
  totalDurationMs: number;
}

/**
 * Input configuration for the pipeline runner
 */
export interface PipelineInput {
  /** Array of comments to process */
  comments: Comment[];
  /** LLM configuration for clustering step */
  clusteringConfig: LLMConfig;
  /** LLM configuration for claims extraction step */
  claimsConfig: LLMConfig;
  /** LLM configuration for deduplication step */
  dedupConfig: LLMConfig;
  /** LLM configuration for summaries step */
  summariesConfig: LLMConfig;
  /** LLM configuration for cruxes step (optional) */
  cruxesConfig?: LLMConfig;
  /** OpenAI API key */
  apiKey: string;
  /** Whether to run cruxes step */
  enableCruxes: boolean;
  /** Sort strategy for deduplication */
  sortStrategy: "numPeople" | "numClaims";
}

/**
 * Configuration for the pipeline runner
 */
export interface PipelineRunnerConfig {
  /** Unique report identifier */
  reportId: string;
  /** User who initiated the pipeline */
  userId: string;
  /** Whether to resume from existing state */
  resumeFromState: boolean;
  /** Optional callback for step status updates */
  onStepUpdate?: (step: PipelineStepName, status: PipelineStepStatus) => void;
  /** Optional callback for progress updates */
  onProgress?: (progress: PipelineProgress) => void;
  /** Additional options passed to each step */
  options?: ClusteringOptions;
}

/**
 * Progress information for the pipeline
 */
export interface PipelineProgress {
  /** Current step being executed */
  currentStep: PipelineStepName;
  /** Total number of steps */
  totalSteps: number;
  /** Number of completed steps */
  completedSteps: number;
  /** Percentage complete (0-100) */
  percentComplete: number;
  /** Estimated time remaining in milliseconds (if available) */
  estimatedTimeRemainingMs?: number;
}

/**
 * Result from the pipeline runner
 */
export interface PipelineResult {
  /** Whether the pipeline completed successfully */
  success: boolean;
  /** Final pipeline state */
  state: PipelineState;
  /** Pipeline outputs if successful */
  outputs?: {
    /** Topic tree from clustering */
    topicTree: Topic[];
    /** Claims tree */
    claimsTree: ClaimsTree;
    /** Sorted and deduplicated tree */
    sortedTree: SortedTree;
    /** Topic summaries */
    summaries: SummariesResult["data"];
    /** Cruxes result (if enabled) */
    cruxes?: CruxesResult;
  };
  /** Error if pipeline failed */
  error?: Error;
}

/**
 * Options for pipeline state operations
 */
export interface StateOptions {
  /** TTL for state in seconds (default: 24 hours) */
  ttl?: number;
}

/**
 * Interface for pipeline state store
 */
export interface PipelineStateStore {
  /**
   * Get pipeline state from store
   * @param reportId - Report identifier
   * @returns Pipeline state or null if not found
   */
  get(reportId: string): Promise<PipelineState | null>;

  /**
   * Save pipeline state to store
   * @param state - Pipeline state to save
   * @param options - Optional settings
   */
  save(state: PipelineState, options?: StateOptions): Promise<void>;

  /**
   * Delete pipeline state from store
   * @param reportId - Report identifier
   */
  delete(reportId: string): Promise<void>;

  /**
   * Update specific fields in pipeline state
   * @param reportId - Report identifier
   * @param updates - Partial state updates
   */
  update(
    reportId: string,
    updates: Partial<PipelineState>,
  ): Promise<PipelineState | null>;
}

/**
 * Error thrown when pipeline step fails
 */
export class PipelineStepError extends Error {
  constructor(
    public stepName: PipelineStepName,
    public cause: Error,
    public state: PipelineState,
  ) {
    super(`Pipeline step '${stepName}' failed: ${cause.message}`);
    this.name = "PipelineStepError";
  }
}

/**
 * Error thrown when pipeline state is invalid
 */
export class PipelineStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PipelineStateError";
  }
}

/**
 * Error thrown when pipeline cannot be resumed
 */
export class PipelineResumeError extends Error {
  constructor(
    public reportId: string,
    reason: string,
  ) {
    super(`Cannot resume pipeline for report '${reportId}': ${reason}`);
    this.name = "PipelineResumeError";
  }
}

/**
 * Error thrown when pipeline output cannot be formatted
 */
export class PipelineFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PipelineFormatError";
  }
}
