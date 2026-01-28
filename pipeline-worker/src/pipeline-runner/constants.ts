/**
 * Pipeline Configuration Constants
 *
 * Centralized configuration for pipeline execution timing.
 * Lock TTLs are calculated dynamically based on the pipeline timeout
 * to ensure consistency when timeout values change.
 */

/** Maximum pipeline execution time: 30 minutes */
export const PIPELINE_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Lock TTL: 1.17x pipeline timeout (35 minutes for 30 minute timeout)
 * Must exceed PIPELINE_TIMEOUT_MS to prevent lock expiration during normal execution.
 * If a pipeline times out, the lock will still be held to prevent duplicate execution
 * until it naturally expires.
 *
 * Calculated dynamically to maintain consistency with PIPELINE_TIMEOUT_MS.
 * Example: 30 minutes * 1.17 = 35 minutes
 */
export const LOCK_TTL_SECONDS = Math.ceil((PIPELINE_TIMEOUT_MS / 1000) * 1.17);

/**
 * Lock extension TTL: 33% of pipeline timeout (10 minutes for 30 minute timeout)
 * Used to extend the lock after pipeline execution completes but before
 * result processing (GCS upload, Firestore updates). Provides protection
 * against race conditions during the critical post-execution window.
 *
 * Calculated dynamically to maintain consistency with PIPELINE_TIMEOUT_MS.
 * Example: 30 minutes * 0.33 = 10 minutes
 */
export const LOCK_EXTENSION_SECONDS = Math.ceil(
  (PIPELINE_TIMEOUT_MS / 1000) * 0.33,
);
