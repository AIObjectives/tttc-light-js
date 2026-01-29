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

/**
 * Lock refresh interval: how often to extend the lock during step execution
 * Should be significantly less than LOCK_TTL_SECONDS to ensure the lock doesn't expire
 * during long-running steps like claims extraction.
 *
 * Formula: Refresh every 1/10th of lock TTL to provide 10 refresh opportunities
 * Example: 35-minute lock / 10 = 3.5 minutes between refreshes
 * This provides resilience against 3-4 transient refresh failures before lock expiration.
 *
 * Calculated dynamically to maintain consistency with LOCK_TTL_SECONDS.
 */
export const LOCK_REFRESH_INTERVAL_MS = Math.floor(
  (LOCK_TTL_SECONDS * 1000) / 10,
);

/**
 * State staleness threshold: equal to LOCK_TTL_SECONDS (35 minutes)
 * Used to determine if a "running" state is stale and safe to resume.
 * If a state hasn't been updated within this threshold, we consider the
 * lock to have expired and the pipeline to be abandoned.
 *
 * This prevents resuming pipelines that might still be actively processing
 * by another worker (e.g., lock expired during a very long step).
 *
 * Example: 35 minutes (matches lock TTL)
 */
export const STATE_STALENESS_THRESHOLD_MS = LOCK_TTL_SECONDS * 1000;
