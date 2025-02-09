import * as apiPyserver from "tttc-common/apiPyserver";
import { SortClaimTreeStep } from "./types";
import { Env } from "../types/context";
import { z } from "zod";

const typedFetch =
  <T extends z.ZodTypeAny>(bodySchema: T) =>
  async (url: string, body: z.infer<T>, openaiAPIKey: string) =>
    await fetch(url, {
      method: "PUT",
      body: JSON.stringify(bodySchema.parse(body) as z.infer<T>),
      headers: {
        "Content-Type": "application/json",
        "openai-api-key": openaiAPIKey,
      },
    });

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
  data: SortClaimTreeStep["data"],
) {
  return await pyserverFetchSortClaimsTree(
    `${env.PYSERVER_URL}/sort_claims_tree`,
    data,
    openaiAPIKey,
  )
    .then((res) => res.json())
    .then(logger("sort claims step returns: "))
    .then(apiPyserver.sortClaimsTreeResponse.parse);
}
