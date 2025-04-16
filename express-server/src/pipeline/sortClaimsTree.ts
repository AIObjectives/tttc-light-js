import * as apiPyserver from "tttc-common/apiPyserver";
import { SortClaimTreeStep } from "./types";
import { Env } from "../types/context";
import { handlePipelineStep } from "./handlePipelineStep";

export async function sortClaimsTreePipelineStep(
  env: Env,
  input: SortClaimTreeStep["data"],
) {
  return await handlePipelineStep(
    apiPyserver.sortClaimsTreeResponse,
    async () =>
      await fetch(`${env.PYSERVER_URL}/sort_claims_tree`, {
        method: "PUT",
        body: JSON.stringify(input),
        headers: {
          "Content-Type": "application/json",
        },
      }),
  );
}
