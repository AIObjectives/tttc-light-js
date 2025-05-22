import * as apiPyserver from "tttc-common/apiPyserver";
import { ClaimsStep } from "./types";
import { Env } from "../types/context";
import { Client, Dispatcher } from "undici";
import { AbortController } from "abort-controller"; // If needed in your environment
import { TimeoutError, FetchError, InvalidResponseDataError } from "./errors";
import { flatMapResult, Result } from "../types/result";

/**
 * Sends an http request to the pyserver for the claims step
 *
 * Returns a Result type with either the claimsstep data or an error
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

  // Create an AbortController for the request
  // Brandon: I'm pretty sure this doesn't do anything as of right now.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000000);
  // Create the Undici client
  const client = new Client(baseUrl, {
    headersTimeout: 6000000,
    bodyTimeout: 6000000,
    keepAliveTimeout: 1200000,
  });

  try {
    /**
     * Send fetch request to pyserver
     */
    const fetchResult: Result<
      apiPyserver.ClaimsReply,
      FetchError | TimeoutError | InvalidResponseDataError
    > = await client
      .request({
        path: path,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [apiPyserver.OPENAI_API_KEY_HEADER]: env.OPENAI_API_KEY,
        },
        body: JSON.stringify(input),
      })
      /**
       * After we've received the response, clear out the abort signal timer
       * Brandon: I'm pretty sure this abort signal doesn't do anything since it's not attached to the client. TODO
       */
      .then((res) => {
        clearTimeout(timeoutId);
        return res;
      })
      /**
       * Check the response for error codes we don't like
       *
       * unknown -> Result<unknown, errors>
       */
      .then(validateResponse)
      /**
       * Pipe the previous result. Validate the data schema.
       */
      .then((result) =>
        flatMapResult(result, (val) => {
          const parse = apiPyserver.claimsReply.safeParse(val);
          if (parse.success) {
            return {
              tag: "success",
              value: parse.data,
            };
          } else {
            return {
              tag: "failure",
              error: new InvalidResponseDataError(parse.error),
            };
          }
        }),
      );
    return fetchResult;
    /**
     * Catch any errors that threw
     */
  } catch (e) {
    /**
     * If the abort signal went off - return a timeout error
     */
    if (controller.signal.aborted) {
      return {
        tag: "failure",
        error: new TimeoutError(e),
      };
      /**
       * Otherwise, return a general error.
       *
       * TODO: figure out what kinds of errors are best here.
       */
    } else {
      return {
        tag: "failure",
        error: new FetchError(e),
      };
    }
    /**
     * Finally, close the client's connection
     */
  } finally {
    await client.close();
  }
}

/**
 * Tests the resposne for error codes we don't like and returns a Result
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
