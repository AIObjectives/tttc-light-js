import * as apiPyserver from "tttc-common/apiPyserver";
import { ClaimsStep } from "./types";
import { Env } from "../types/context";
import { handlePipelineStep } from "./handlePipelineStep";

/**
 * Sends an http request to the pyserver for the claims step
 * Uses standard fetch with 15-minute timeout for large datasets
 */
export async function claimsPipelineStep(
  env: Env,
  input: ClaimsStep["data"],
  userId?: string,
  reportId?: string,
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    [apiPyserver.OPENAI_API_KEY_HEADER]: env.OPENAI_API_KEY,
  };

  if (reportId) {
    headers[apiPyserver.REPORT_ID_HEADER] = reportId;
  }

  if (userId) {
    headers[apiPyserver.USER_ID_HEADER] = userId;
  }

  return await handlePipelineStep(
    apiPyserver.claimsReply,
    async () =>
      await fetch(`${env.PYSERVER_URL}/claims`, {
        method: "POST",
        body: JSON.stringify(input),
        headers,
        // 40-minute timeout for large datasets (matches OPERATION_TIMEOUT)
        signal: AbortSignal.timeout(2400000),
      }),
  );
}
