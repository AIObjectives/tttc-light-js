import { z } from "zod";
import { performance } from "perf_hooks";
import { Result } from "tttc-common/functional-utils";
import { FetchError, InvalidResponseDataError } from "./errors";
import { withRetry } from "./retryConfig";
import { logger } from "tttc-common/logger";

const pipelineStepLogger = logger.child({ module: "pipeline-step" });

/**
 * Calls some fetch function with a parser and returns a Result type
 *
 * This is separated out from the particular fetch function used so that we can more easily mock it
 */
export async function handlePipelineStep<T extends z.ZodTypeAny>(
  parser: T, // Zod parser
  call: () => Promise<Response>, // some fetch function.
): Promise<Result<z.infer<T>, FetchError | InvalidResponseDataError>> {
  const stepStart = performance.now();
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
        } as Result<z.infer<T>, FetchError | InvalidResponseDataError>;
      },
      "Pipeline step",
      // Don't retry schema validation errors
      (error) => error instanceof InvalidResponseDataError,
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
    // For all other errors (including timeout), wrap in FetchError
    return {
      tag: "failure",
      error: new FetchError(error),
    };
  }
}
