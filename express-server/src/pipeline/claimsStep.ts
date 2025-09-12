import * as apiPyserver from "tttc-common/apiPyserver";
import { ClaimsStep } from "./types";
import { Env } from "../types/context";
import { handlePipelineStep } from "./handlePipelineStep";

/**
 * Sends an http request to the pyserver for the claims step
 * Uses standard fetch with 15-minute timeout for large datasets
 */
export async function claimsPipelineStep(env: Env, input: ClaimsStep["data"]) {
  return await handlePipelineStep(
    apiPyserver.claimsReply,
    async () =>
      await fetch(`${env.PYSERVER_URL}/claims`, {
        method: "POST",
        body: JSON.stringify(input),
        headers: {
          "Content-Type": "application/json",
          [apiPyserver.OPENAI_API_KEY_HEADER]: env.OPENAI_API_KEY,
        },
        // 15-minute timeout for large datasets with concurrent processing
        signal: AbortSignal.timeout(900000),
      }),
  );
}
