/**
 * Pipeline Runner Module
 *
 * Orchestrates the execution of all pipeline steps with state persistence,
 * analytics tracking, and failure recovery capabilities.
 */

// Export runner
export {
  cancelPipeline,
  cleanupPipelineState,
  getPipelineStatus,
  runPipeline,
} from "./runner.js";
// Export state store
export {
  canResumePipeline,
  createInitialState,
  createInitialStepAnalytics,
  getCompletedStepResults,
  getNextStep,
  markStepCompleted,
  markStepFailed,
  markStepSkipped,
  markStepStarted,
  RedisPipelineStateStore,
  updateStepAnalytics,
} from "./state-store.js";
// Export types
export type {
  PipelineInput,
  PipelineProgress,
  PipelineResult,
  PipelineRunnerConfig,
  PipelineState,
  PipelineStateStore,
  PipelineStepName,
  PipelineStepStatus,
  StateOptions,
  StepAnalytics,
} from "./types.js";
// Export error classes
export {
  PipelineResumeError,
  PipelineStateError,
  PipelineStepError,
} from "./types.js";
