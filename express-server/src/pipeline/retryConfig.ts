import retry from "async-retry";
import { Client } from "undici";

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
 * HTTP client timeout configuration
 */
export const HTTP_TIMEOUTS = {
  // 2 minutes per request - LLM processing can take time
  REQUEST_TIMEOUT: 120000,
  HEADERS_TIMEOUT: 120000,
  BODY_TIMEOUT: 120000,
  KEEP_ALIVE_TIMEOUT: 30000,
  // Total operation timeout to prevent indefinite hangs (8 minutes with retries)
  OPERATION_TIMEOUT: 480000,
} as const;

/**
 * Shared HTTP client pool to avoid creating new connections on each retry
 */
const clientPool = new Map<string, Client>();

/**
 * Gets or creates a shared HTTP client for the given base URL
 */
export function getHttpClient(baseUrl: string): Client {
  if (!clientPool.has(baseUrl)) {
    console.log(
      `[RetryConfig] Creating new HTTP client for ${baseUrl} with ${HTTP_TIMEOUTS.HEADERS_TIMEOUT}ms headers timeout`,
    );
    const client = new Client(baseUrl, {
      headersTimeout: HTTP_TIMEOUTS.HEADERS_TIMEOUT,
      bodyTimeout: HTTP_TIMEOUTS.BODY_TIMEOUT,
      keepAliveTimeout: HTTP_TIMEOUTS.KEEP_ALIVE_TIMEOUT,
      // Enable connection pooling with pipelining
      pipelining: 1,
    });
    clientPool.set(baseUrl, client);
  }
  return clientPool.get(baseUrl)!;
}

/**
 * Cleanup function to close all HTTP clients
 * Should be called during application shutdown
 */
export async function closeAllClients(): Promise<void> {
  const closePromises = Array.from(clientPool.values()).map((client) =>
    client.close(),
  );
  await Promise.all(closePromises);
  clientPool.clear();
}

/**
 * Refresh client pool to pick up new timeout configurations
 * Useful when timeout settings change
 */
export async function refreshClientPool(): Promise<void> {
  console.log(
    "[RetryConfig] Refreshing client pool to pick up new timeout configurations",
  );
  await closeAllClients();
}

/**
 * Force refresh a specific client to pick up new timeout configurations
 */
export async function refreshClient(baseUrl: string): Promise<void> {
  const client = clientPool.get(baseUrl);
  if (client) {
    console.log(`[RetryConfig] Refreshing client for ${baseUrl}`);
    await client.close();
    clientPool.delete(baseUrl);
  }
}

/**
 * Setup process cleanup handlers to prevent resource leaks
 */
function setupCleanupHandlers() {
  const cleanup = async () => {
    try {
      await closeAllClients();
    } catch (error) {
      console.error("Error during cleanup:", error);
    }
  };

  process.on("SIGTERM", cleanup);
  process.on("SIGINT", cleanup);
  process.on("beforeExit", cleanup);
}

// Initialize cleanup handlers
setupCleanupHandlers();

/**
 * Creates a retry logger with context
 */
export function createRetryLogger(operation: string) {
  return (error: Error, attempt: number) => {
    console.log(
      `[${operation}] Retry attempt ${attempt}/${DEFAULT_RETRY_OPTIONS.retries! + 1}. Error: ${error.message}`,
    );
  };
}

/**
 * Wraps an operation with a total timeout to prevent indefinite hangs
 */
export function withOperationTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number = HTTP_TIMEOUTS.OPERATION_TIMEOUT,
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
    HTTP_TIMEOUTS.OPERATION_TIMEOUT,
    operationName,
  );
}
