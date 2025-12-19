import * as apiPyserver from "tttc-common/apiPyserver";
import type { Env } from "../types/context";
import { handlePipelineStep } from "./handlePipelineStep";
import type { CruxesStep } from "./types";

export async function cruxesPipelineStep(
  env: Env,
  input: CruxesStep["data"],
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
    apiPyserver.cruxesResponse,
    () =>
      fetch(`${env.PYSERVER_URL}/cruxes`, {
        method: "post",
        body: JSON.stringify(input),
        headers,
        // 1-hour timeout to match Cloud Run service limit
        signal: AbortSignal.timeout(3600000),
      }),
    env.PYSERVER_URL, // Enable health checks for retry logic
  );
}
