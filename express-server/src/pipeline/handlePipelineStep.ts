import { performance } from "node:perf_hooks";
import type { Result } from "tttc-common/functional-utils";
import { logger } from "tttc-common/logger";
import type { z } from "zod";
import {
  FetchError,
  InvalidResponseDataError,
  PyserverHungError,
  PyserverOOMError,
  PyserverUnresponsiveError,
} from "./errors";
import { checkPyserverHealth } from "./healthCheck";
import { withRetry } from "./retryConfig";

const pipelineStepLogger = logger.child({ module: "pipeline-step" });

/**
 * Calls some fetch function with a parser and returns a Result type
 *
 * This is separated out from the particular fetch function used so that we can more easily mock it
 */
export async function handlePipelineStep<T extends z.ZodTypeAny>(
  parser: T, // Zod parser
  call: () => Promise<Response>, // some fetch function.
  pyserverUrl?: string, // Optional: if provided, health checks will be performed before retries
): Promise<
  Result<
    z.infer<T>,
    | FetchError
    | InvalidResponseDataError
    | PyserverOOMError
    | PyserverUnresponsiveError
    | PyserverHungError
  >
> {
  const stepStart = performance.now();
  const requestStartTime = Date.now();

  try {
    pipelineStepLogger.debug("Starting pipeline step");
    const result = await withRetry(
      async () => {
        // Perform our fetch
        const fetchStart = performance.now();
        const response = await call();
        const fetchEnd = performance.now();

        pipelineStepLogger.debug(
          {
            fetchDuration: Math.round(fetchEnd - fetchStart),
            status: response.status,
            statusText: response.statusText,
          },
          "Fetch completed",
        );

        const parsed = await response.json();

        // Check if the request succeeded
        if (!response.ok) {
          pipelineStepLogger.error(
            {
              status: response.status,
              statusText: response.statusText,
              responseBody:
                typeof parsed === "object"
                  ? JSON.stringify(parsed).substring(0, 500)
                  : String(parsed).substring(0, 500),
            },
            "Pipeline step HTTP error",
          );
          throw new FetchError(parsed);
        }

        // Validate schema
        const schemaResult = parser.safeParse(parsed);
        if (schemaResult.success === false) {
          pipelineStepLogger.error(
            {
              validationErrors: schemaResult.error.errors,
              responsePreview:
                typeof parsed === "object"
                  ? JSON.stringify(parsed).substring(0, 500)
                  : String(parsed).substring(0, 500),
            },
            "Pipeline step schema validation error",
          );
          // Schema validation errors shouldn't be retried
          throw new InvalidResponseDataError(schemaResult.error);
        }

        pipelineStepLogger.debug("Pipeline step completed successfully");
        // Return successful result
        return {
          tag: "success",
          value: schemaResult.data,
        } as Result<
          z.infer<T>,
          | FetchError
          | InvalidResponseDataError
          | PyserverOOMError
          | PyserverUnresponsiveError
          | PyserverHungError
        >;
      },
      "Pipeline step",
      // Don't retry schema validation errors or health-related errors
      (error) =>
        error instanceof InvalidResponseDataError ||
        error instanceof PyserverOOMError ||
        error instanceof PyserverUnresponsiveError ||
        error instanceof PyserverHungError,
      undefined, // Use default retry options
      // Health check before retries (if pyserverUrl provided)
      pyserverUrl
        ? async (attemptNumber) => {
            pipelineStepLogger.info(
              { attemptNumber },
              "Running health check before retry",
            );
            const health = await checkPyserverHealth({
              pyserverUrl,
              requestStartTime,
            });
            pipelineStepLogger.info(
              {
                attemptNumber,
                health: {
                  status: health.status,
                  health: health.health,
                  active_requests: health.active_requests,
                  memory_percent: health.performance.memory_percent,
                  memory_mb: health.performance.memory_usage_mb,
                },
              },
              "Health check passed",
            );
          }
        : undefined,
    );

    const totalDuration = Math.round(performance.now() - stepStart);
    pipelineStepLogger.info(
      { duration: totalDuration },
      "Pipeline step result obtained",
    );
    return result;
  } catch (error: unknown) {
    // Handle InvalidResponseDataError directly
    if (error instanceof InvalidResponseDataError) {
      return {
        tag: "failure",
        error: error,
      };
    }
    // Handle FetchError directly
    if (error instanceof FetchError) {
      return {
        tag: "failure",
        error: error,
      };
    }
    // Handle health-related errors directly
    if (
      error instanceof PyserverOOMError ||
      error instanceof PyserverUnresponsiveError ||
      error instanceof PyserverHungError
    ) {
      return {
        tag: "failure",
        error: error,
      };
    }
    // For all other errors (including timeout), wrap in FetchError
    return {
      tag: "failure",
      error: new FetchError(error),
    };
  }
}
