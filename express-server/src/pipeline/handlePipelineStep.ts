import { z } from "zod";
import { flatMapResult, Result } from "../types/result";
import { FetchError, InvalidResponseDataError } from "./errors";

/**
 * Calls some fetch function with a parser and returns a Result type
 *
 * This is seperated out from the particular fetch function used so that we can more easily mock it
 */
export async function handlePipelineStep<T extends z.ZodTypeAny>(
  parser: T, // Zod parser
  call: () => Promise<Response>, // some fetch function.
): Promise<Result<z.infer<T>, FetchError | InvalidResponseDataError>> {
  // Perform our fetch
  return await call()
    // parse our fetch and see if the request succeeded
    .then(async (res) => {
      const parsed = await res.json();
      // TODO we can potentially test for specific error codes and other cases here?
      if (res.ok) {
        const res: Result<unknown, FetchError> = {
          tag: "success",
          value: parsed,
        };
        return res;
      } else {
        const res: Result<unknown, FetchError> = {
          tag: "failure",
          error: new FetchError(parsed),
        };
        return res;
      }
    })
    // Make sure that the returned data fits our schema type
    .then((res) =>
      flatMapResult(res, (val) => {
        const parsed = parser.safeParse(val);
        if (parsed.success) {
          return { tag: "success", value: parsed.data };
        } else {
          return {
            tag: "failure",
            error: new InvalidResponseDataError(parsed.error),
          };
        }
      }),
    )
    .catch((e) => {
      return {
        tag: "failure",
        error: new FetchError(e),
      };
    });
}
