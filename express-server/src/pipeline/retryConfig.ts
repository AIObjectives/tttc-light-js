import retry from "async-retry";
import { logger } from "tttc-common/logger";

const retryLogger = logger.child({ module: "retry-config" });

/**
 * Default retry configuration for PyServer API calls
 *
 * Uses exponential backoff with jitter to prevent thundering herd issues
 */
export const DEFAULT_RETRY_OPTIONS = {
  retries: 3,
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
 * Creates a retry logger with context
 */
export function createRetryLogger(operation: string) {
  return (error: Error, attempt: number) => {
    retryLogger.warn(
      {
        operation,
        attempt,
        maxAttempts: DEFAULT_RETRY_OPTIONS.retries! + 1,
        error: error.message,
      },
      "Retry attempt",
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
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
  shouldBail: (error: unknown) => boolean = () => false,
  retryOptions?: Partial<typeof DEFAULT_RETRY_OPTIONS>,
): Promise<T> {
  const options = { ...getRetryOptions(), ...retryOptions };

  return withOperationTimeout(
    retry(
      async (bail) => {
        try {
          return await operation();
        } catch (error) {
          // If this error shouldn't be retried, bail immediately
          if (shouldBail(error)) {
            bail(error as Error);
            throw error; // This will never execute but satisfies TypeScript
          }
          // Re-throw to trigger retry
          throw error;
        }
      },
      {
        ...options,
        onRetry:
          options.retries > 0 ? createRetryLogger(operationName) : undefined,
      },
    ),
    OPERATION_TIMEOUT, // Use consistent timeout for all operations
    operationName,
  );
}
