import pRetry, { AbortError, type FailedAttemptError } from "p-retry";
import { logger } from "tttc-common/logger";

const retryLogger = logger.child({ module: "retry-config" });

// Re-export AbortError for use in other modules
export { AbortError };

/**
 * Default retry configuration for PyServer API calls
 *
 * Uses exponential backoff with jitter to prevent thundering herd issues
 * Reduced to 2 retries with health check validation
 */
export const DEFAULT_RETRY_OPTIONS = {
  retries: 2,
  factor: 2,
  minTimeout: 1000, // ms
  maxTimeout: 5000, // ms
  randomize: true, // Add jitter to prevent thundering herd
};

/**
 * Test-friendly retry configuration with no retries
 * Used when NODE_ENV is 'test' or when explicitly overridden
 */
export const TEST_RETRY_OPTIONS = {
  retries: 0,
  factor: 1,
  minTimeout: 0,
  maxTimeout: 0,
  randomize: false,
};

/**
 * Operation timeout configuration for retry logic
 * Set to 1 hour to match Cloud Run service maximum request timeout
 */
export const OPERATION_TIMEOUT = 3600000; // 1 hour (Cloud Run maximum)

/**
 * Creates a retry logger with context for p-retry's onFailedAttempt callback
 */
export function createRetryLogger(operation: string) {
  return (error: FailedAttemptError) => {
    retryLogger.warn(
      {
        operation,
        attempt: error.attemptNumber,
        retriesLeft: error.retriesLeft,
        maxAttempts: DEFAULT_RETRY_OPTIONS.retries + 1,
        error: error.message,
      },
      "Retry attempt failed",
    );
  };
}

/**
 * Wraps an operation with a total timeout to prevent indefinite hangs
 */
export function withOperationTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number = OPERATION_TIMEOUT,
  operationName: string = "Operation",
): Promise<T> {
  return Promise.race([
    operation,
    new Promise<T>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`${operationName} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }),
  ]);
}

/**
 * Get retry options based on environment
 * In test environments, use no retries for faster test execution
 */
function getRetryOptions() {
  const isTest =
    process.env.NODE_ENV === "test" || process.env.VITEST === "true";
  return isTest ? TEST_RETRY_OPTIONS : DEFAULT_RETRY_OPTIONS;
}

/**
 * Force no retries - useful for testing specific scenarios
 */
export const withoutRetries = (
  operation: () => Promise<any>,
  operationName: string,
  shouldBail?: (error: unknown) => boolean,
) => withRetry(operation, operationName, shouldBail, TEST_RETRY_OPTIONS);

/**
 * Consolidated retry utility for HTTP requests with proper error handling
 *
 * Uses p-retry for ESM-compatible retry logic with exponential backoff.
 * Throw AbortError to stop retrying immediately.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  shouldBail: (error: unknown) => boolean = () => false,
  retryOptions?: Partial<typeof DEFAULT_RETRY_OPTIONS>,
  onBeforeRetry?: (attempt: number) => Promise<void>,
): Promise<T> {
  const options = { ...getRetryOptions(), ...retryOptions };
  let attemptNumber = 0;

  return withOperationTimeout(
    pRetry(
      async () => {
        attemptNumber++;

        try {
          // Run pre-retry health check if provided (skip on first attempt)
          if (onBeforeRetry && attemptNumber > 1) {
            try {
              await onBeforeRetry(attemptNumber);
            } catch (healthError) {
              // Health check failed - abort immediately without retrying
              retryLogger.error(
                {
                  operation: operationName,
                  attempt: attemptNumber,
                  healthError:
                    healthError instanceof Error
                      ? healthError.message
                      : String(healthError),
                },
                "Health check failed before retry, aborting",
              );
              throw new AbortError(
                healthError instanceof Error
                  ? healthError
                  : new Error(String(healthError)),
              );
            }
          }

          return await operation();
        } catch (error) {
          // If already an AbortError, let it propagate
          if (error instanceof AbortError) {
            throw error;
          }

          // If this error shouldn't be retried, abort immediately
          if (shouldBail(error)) {
            throw new AbortError(
              error instanceof Error ? error : new Error(String(error)),
            );
          }

          // Re-throw to trigger retry
          throw error;
        }
      },
      {
        ...options,
        onFailedAttempt:
          options.retries > 0 ? createRetryLogger(operationName) : undefined,
      },
    ),
    OPERATION_TIMEOUT, // Use consistent timeout for all operations
    operationName,
  );
}
