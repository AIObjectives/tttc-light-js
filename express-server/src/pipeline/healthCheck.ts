import { z } from "zod";
import {
  PyserverOOMError,
  PyserverUnresponsiveError,
  PyserverHungError,
} from "./errors.js";
import { OPERATION_TIMEOUT } from "./retryConfig.js";

// Pyserver health check response schema
const PyserverHealthSchema = z.object({
  status: z.enum(["processing", "idle"]),
  health: z.enum(["healthy", "memory_warning"]),
  active_requests: z.number(),
  progress: z.object({
    total_comments: z.number(),
    completed_comments: z.number(),
    progress_percentage: z.number(),
  }),
  performance: z.object({
    concurrency_enabled: z.boolean(),
    concurrency_limit: z.number(),
    memory_usage_mb: z.number(),
    memory_percent: z.number(),
    memory_limit_mb: z.number(),
  }),
  cache: z.any(), // Cache stats structure varies
});

type PyserverHealth = z.infer<typeof PyserverHealthSchema>;

/**
 * Health check timeout - Fast fail to detect unresponsive pyserver
 * 10 seconds vs 3-hour request timeout allows quick retry decisions
 */
const HEALTH_CHECK_TIMEOUT = 10000;

/**
 * Hung request detection threshold - Matches the operation timeout
 * Detects when a request has been active for the full timeout window,
 * indicating it's stuck and will never complete even with retries
 */
const HUNG_REQUEST_THRESHOLD = OPERATION_TIMEOUT; // 3 hours

/**
 * Memory usage threshold for bailing on retries
 * Set at 90% to provide a 10% buffer above pyserver's 80% warning level
 * This allows pyserver to recover from temporary memory spikes (80-90%)
 * before express-server gives up and stops retrying
 */
const MEMORY_BAIL_THRESHOLD = 90;

interface HealthCheckOptions {
  pyserverUrl: string;
  /**
   * Timestamp of the initial request attempt (not individual retry time)
   * Used to detect if the overall request has been stuck for too long
   */
  requestStartTime?: number;
}

export async function checkPyserverHealth(
  options: HealthCheckOptions,
): Promise<PyserverHealth> {
  const { pyserverUrl, requestStartTime } = options;

  try {
    const response = await fetch(`${pyserverUrl}/health/processing`, {
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT),
    });

    if (!response.ok) {
      throw new PyserverUnresponsiveError(
        `Health check failed with status ${response.status}`,
      );
    }

    const data = await response.json();
    const health = PyserverHealthSchema.parse(data);

    // Check for OOM condition (90% memory threshold)
    if (health.performance.memory_percent >= MEMORY_BAIL_THRESHOLD) {
      throw new PyserverOOMError(
        `Pyserver memory usage at ${health.performance.memory_percent}% (${health.performance.memory_usage_mb}MB), exceeds ${MEMORY_BAIL_THRESHOLD}% threshold`,
      );
    }

    // Check for hung requests (active request stuck for more than threshold)
    if (requestStartTime && health.active_requests > 0) {
      const requestDuration = Date.now() - requestStartTime;
      if (requestDuration > HUNG_REQUEST_THRESHOLD) {
        throw new PyserverHungError(
          `Pyserver has ${health.active_requests} active request(s) stuck for ${Math.round(requestDuration / 1000)}s, exceeds ${HUNG_REQUEST_THRESHOLD / 1000}s threshold`,
        );
      }
    }

    return health;
  } catch (error) {
    // Re-throw our custom errors
    if (
      error instanceof PyserverOOMError ||
      error instanceof PyserverUnresponsiveError ||
      error instanceof PyserverHungError
    ) {
      throw error;
    }

    // Timeout or network errors indicate unresponsive pyserver
    if (error instanceof Error && error.name === "TimeoutError") {
      throw new PyserverUnresponsiveError(
        `Health check timed out after ${HEALTH_CHECK_TIMEOUT}ms`,
      );
    }

    // Other errors also indicate unresponsive pyserver
    throw new PyserverUnresponsiveError(
      `Health check failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
