import { z } from "zod";
import { Result } from "tttc-common/functional-utils";
import { FetchError, InvalidResponseDataError } from "./errors";
import { withRetry } from "./retryConfig";

/**
 * Calls some fetch function with a parser and returns a Result type
 *
 * This is separated out from the particular fetch function used so that we can more easily mock it
 */
export async function handlePipelineStep<T extends z.ZodTypeAny>(
  parser: T, // Zod parser
  call: () => Promise<Response>, // some fetch function.
): Promise<Result<z.infer<T>, FetchError | InvalidResponseDataError>> {
  try {
    const result = await withRetry(
      async () => {
        // Perform our fetch
        const response = await call();
        const parsed = await response.json();

        // Check if the request succeeded
        if (!response.ok) {
          throw new FetchError(parsed);
        }

        // Validate schema
        const schemaResult = parser.safeParse(parsed);
        if (schemaResult.success === false) {
          // Schema validation errors shouldn't be retried
          throw new InvalidResponseDataError(schemaResult.error);
        }

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
