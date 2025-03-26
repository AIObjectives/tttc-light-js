import * as apiPyserver from "tttc-common/apiPyserver";
import { SortClaimTreeStep } from "./types";
import { Env } from "../types/context";
import { z } from "zod";
import { Environment, requiresHttps } from "tttc-common/environmentValidation";

const typedFetch =
  <T extends z.ZodTypeAny>(bodySchema: T) =>
  async (
    url: string,
    body: z.infer<T>,
    openaiAPIKey: string,
    currentEnv: string,
  ) => {
    const fetchOptions: RequestInit = {
      method: "PUT",
      body: JSON.stringify(bodySchema.parse(body) as z.infer<T>),
      headers: {
        "Content-Type": "application/json",
        "openai-api-key": openaiAPIKey,
      },
    };

    if (requiresHttps(currentEnv as Environment)) {
      fetchOptions.redirect = "follow";
    }

    return await fetch(url, fetchOptions);
  };

const pyserverFetchSortClaimsTree = typedFetch(
  apiPyserver.sortClaimsTreeRequest,
);

const logger =
  (prependMessage: string) =>
  <T>(arg: T): T => {
    console.log(prependMessage, arg);
    return arg;
  };

export async function sortClaimsTreePipelineStep(
  env: Env,
  openaiAPIKey: string,
  input: SortClaimTreeStep["data"],
) {
  const { data, usage, cost } = await pyserverFetchSortClaimsTree(
    `${env.PYSERVER_URL}/sort_claims_tree`,
    input,
    openaiAPIKey,
    env.NODE_ENV,
  )
    .then((res) => res.json())
    .then(logger("sort claims step returns: "))
    .then(apiPyserver.sortClaimsTreeResponse.parse);
  return { data, usage, cost };
}
