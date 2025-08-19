import * as apiPyserver from "tttc-common/apiPyserver";
import { ClaimsStep } from "./types";
import { Env } from "../types/context";
import { Dispatcher } from "undici";
import { TimeoutError, FetchError, InvalidResponseDataError } from "./errors";
import { Result } from "tttc-common/functional-utils";
import { getHttpClient, withRetry, refreshClient } from "./retryConfig";

/**
 * Sends an http request to the pyserver for the claims step
 *
 * Returns a Result type with either the claims step data or an error
 */
export async function claimsPipelineStep(
  env: Env,
  input: ClaimsStep["data"],
): Promise<
  Result<
    apiPyserver.ClaimsReply,
    TimeoutError | FetchError | InvalidResponseDataError
  >
> {
  // Prepare the Python server URL and path
  const baseUrl = env.PYSERVER_URL.replace(/\/$/, ""); // Remove trailing slash if any
  const path = "/claims";

  // Force refresh client to ensure we get updated timeout configuration
  await refreshClient(baseUrl);

  try {
    const result = await withRetry(
      async () => {
        // Use shared client from pool
        const client = getHttpClient(baseUrl);

        // Send fetch request to pyserver (rely on undici client timeouts)
        const response = await client.request({
          path: path,
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            [apiPyserver.OPENAI_API_KEY_HEADER]: env.OPENAI_API_KEY,
          },
          body: JSON.stringify(input),
        });

        // Validate response status
        const validationResult = await validateResponse(response);
        if (validationResult.tag === "failure") {
          throw validationResult.error;
        }

        // Parse and validate schema
        const schemaResult = apiPyserver.claimsReply.safeParse(
          validationResult.value,
        );
        if (schemaResult.success === false) {
          // Schema validation errors shouldn't be retried
          throw new InvalidResponseDataError(schemaResult.error);
        }

        // Return successful result
        return {
          tag: "success" as const,
          value: schemaResult.data,
        };
      },
      `PyServer claims call to ${baseUrl}${path}`,
      // Don't retry schema validation errors
      (error) => error instanceof InvalidResponseDataError,
    );

    return result;
  } catch (error: unknown) {
    // Type-safe error handling for errors from retry logic or operation timeout
    if (error instanceof InvalidResponseDataError) {
      return {
        tag: "failure",
        error: error,
      };
    }
    if (error instanceof TimeoutError) {
      return {
        tag: "failure",
        error: error,
      };
    }
    if (error instanceof FetchError) {
      return {
        tag: "failure",
        error: error,
      };
    }
    // For all other errors (including operation timeout), wrap in FetchError
    return {
      tag: "failure",
      error: new FetchError(error),
    };
  }
}

/**
 * Tests the response for error codes we don't like and returns a Result
 */
const validateResponse = async (
  response: Dispatcher.ResponseData<unknown>,
): Promise<Result<unknown, FetchError>> => {
  const { statusCode, body } = response;
  /**
   * If we get a response code we don't like, return an error
   *
   * TODO: We can add additional error types here.
   */
  if (statusCode < 200 || statusCode >= 300) {
    const error = await body.json();
    return {
      tag: "failure",
      error: new FetchError(error),
    };
  } else {
    /**
     * Return a success result
     */
    const data = await body.json();
    return {
      tag: "success",
      value: data,
    };
  }
};
