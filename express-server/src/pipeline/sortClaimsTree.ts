import * as apiPyserver from "tttc-common/apiPyserver";
import { SortClaimTreeStep } from "./types";
import { Env } from "../types/context";
import { handlePipelineStep } from "./handlePipelineStep";

export async function sortClaimsTreePipelineStep(
  env: Env,
  input: SortClaimTreeStep["data"],
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
    apiPyserver.sortClaimsTreeResponse,
    async () =>
      await fetch(`${env.PYSERVER_URL}/sort_claims_tree`, {
        method: "PUT",
        body: JSON.stringify(input),
        headers,
      }),
    env.PYSERVER_URL,
  );
}
